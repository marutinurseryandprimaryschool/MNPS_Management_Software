'use client';

/* ============================================
   Principal Register — record a receipt
   ============================================
   The one payment-entry form both registers use. It writes through
   PrincipalPaymentsService (which audits the write in the same batch); it
   never touches Firestore itself.

   Deliberate behaviours:
   - Opens on the head with the largest arrears and, for ECA/van, on the
     OLDEST month still due — Sharmi collects oldest-first.
   - ECA and van receipts MUST carry a month, otherwise the month cell they
     were meant to clear stays open.
   - In-flight guard: the save button disables while the batch is committing,
     so a double tap cannot create a duplicate receipt.
   - Duplicate guard: the same amount already recorded for this student on the
     same day stops the first press and says so. A second press records it
     anyway — part payments of equal size are real, so this warns, never blocks.
*/

import React, { useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input, { Select } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { toDateKey } from '@/lib/fee-utils';
import { PrincipalPaymentsService } from '@/lib/principal-service';
import { refreshFailedMessage } from '@/components/layout/admin/fees/error-policy';
import type {
  MonthCell, PrincipalActor, PrincipalFeeHead, PrincipalPayment, PrincipalPaymentMode,
  RegisterRow, RowSummary,
} from '@/types/principal';
import { describeError, inr } from './register-shared';
import { NoticeBanner } from './register-ui';

const HEAD_OPTIONS: { value: PrincipalFeeHead; label: string }[] = [
  { value: 'school', label: 'School fees' },
  { value: 'eca', label: 'ECA fees' },
  { value: 'van', label: 'Van fees' },
  { value: 'other', label: 'Other' },
];

const MODE_OPTIONS: { value: PrincipalPaymentMode; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
];

/**
 * 'yyyy-MM-dd' → local midnight. Built from parts, never `new Date(string)`,
 * which parses a bare date as UTC and can land the receipt on the wrong day
 * for anyone east of Greenwich — which is everyone at this school.
 */
function localDateFromKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

/** Oldest month that has ended and still owes money. */
function oldestDueMonth(months: MonthCell[]): MonthCell | null {
  return months.find(cell => cell.isDue && cell.pending > 0)
    ?? months.find(cell => cell.pending > 0)
    ?? null;
}

/** The head Sharmi is most likely collecting: biggest arrears, school first. */
function suggestHead(summary: RowSummary): PrincipalFeeHead {
  const ranked: { head: PrincipalFeeHead; due: number }[] = [
    { head: 'school', due: summary.school.pending },
    { head: 'eca', due: summary.eca.dueNow },
    { head: 'van', due: summary.van.dueNow },
  ];
  const best = ranked.reduce((top, item) => (item.due > top.due ? item : top), ranked[0]);
  return best.due > 0 ? best.head : 'school';
}

const HEAD_LABELS: Record<PrincipalFeeHead, string> = {
  school: 'school fee', eca: 'ECA fee', van: 'van fee', other: 'other',
};

export interface RecordPaymentModalProps {
  row: RegisterRow;
  summary: RowSummary;
  /** This student's live receipts — the duplicate check reads them. */
  payments: PrincipalPayment[];
  actor: PrincipalActor | null;
  onClose: () => void;
  /** Post-commit refetch. Returns false when the list could not refresh. */
  onSaved: () => Promise<boolean>;
}

export default function RecordPaymentModal({
  row, summary, payments, actor, onClose, onSaved,
}: RecordPaymentModalProps) {
  const { showToast } = useToast();

  const initialHead = useMemo(() => suggestHead(summary), [summary]);
  const [head, setHead] = useState<PrincipalFeeHead>(initialHead);
  const [month, setMonth] = useState(() => {
    const cells = initialHead === 'eca' ? summary.eca.months
      : initialHead === 'van' ? summary.van.months : [];
    return oldestDueMonth(cells)?.month ?? '';
  });
  const [amount, setAmount] = useState(() => {
    if (initialHead === 'school') return String(summary.school.pending || '');
    const cells = initialHead === 'eca' ? summary.eca.months
      : initialHead === 'van' ? summary.van.months : [];
    return String(oldestDueMonth(cells)?.pending ?? '');
  });
  const [dateKey, setDateKey] = useState(() => toDateKey(new Date()));
  const [mode, setMode] = useState<PrincipalPaymentMode>('cash');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  /** Set by the duplicate check; the next press commits anyway. */
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);

  const monthCells = head === 'eca' ? summary.eca.months : head === 'van' ? summary.van.months : [];
  const needsMonth = head === 'eca' || head === 'van';

  const headPending = head === 'school' ? summary.school.pending
    : head === 'eca' ? summary.eca.pending
      : head === 'van' ? summary.van.pending
        : 0;

  const selectedCell = monthCells.find(cell => cell.month === month) ?? null;

  /** Any edit invalidates a standing duplicate warning — it described the old values. */
  const touch = () => {
    setFormError(null);
    setDuplicateNotice(null);
  };

  /** Switching head re-seeds the month and the amount from that head's arrears. */
  const handleHeadChange = (next: PrincipalFeeHead) => {
    setHead(next);
    touch();
    if (next === 'school') {
      setMonth('');
      setAmount(String(summary.school.pending || ''));
      return;
    }
    if (next === 'other') {
      setMonth('');
      setAmount('');
      return;
    }
    const cells = next === 'eca' ? summary.eca.months : summary.van.months;
    const cell = oldestDueMonth(cells);
    setMonth(cell?.month ?? '');
    setAmount(String(cell?.pending ?? ''));
  };

  const handleMonthChange = (next: string) => {
    setMonth(next);
    touch();
    const cell = monthCells.find(item => item.month === next);
    if (cell) setAmount(String(cell.pending || ''));
  };

  const handleSave = async () => {
    if (saving) return;
    const value = Math.round(Number(amount));
    if (!Number.isFinite(value) || value <= 0) {
      setFormError('Enter an amount greater than zero.');
      return;
    }
    if (needsMonth && !month) {
      setFormError('Pick the month this ECA / van payment is for — otherwise its month stays open.');
      return;
    }
    if (!dateKey) {
      setFormError('Pick the date the money was collected.');
      return;
    }
    if (!actor) {
      setFormError('Your session has no signed-in user. Refresh the app and sign in again.');
      return;
    }

    // A parent paying twice in one day, or a re-tap after a slow commit, would
    // otherwise book the money twice with no warning. Warn once, then obey.
    if (!duplicateNotice) {
      const duplicate = payments.find(payment =>
        Math.round(Number(payment.amount) || 0) === value && payment.dateKey === dateKey);
      if (duplicate) {
        setDuplicateNotice(
          `${inr(value)} is already recorded for ${row.name} on ${dateKey} `
          + `(${HEAD_LABELS[duplicate.head] ?? duplicate.head}`
          + `${duplicate.month ? ` · ${duplicate.month}` : ''}). `
          + 'Press “Save payment” again to record it anyway.',
        );
        return;
      }
    }

    setSaving(true);
    setFormError(null);
    try {
      await PrincipalPaymentsService.create({
        academicYear: row.academicYear,
        rowId: row.id,
        studentName: row.name,
        className: row.className,
        head,
        month: needsMonth ? month : undefined,
        amount: value,
        dateKey,
        paidAt: localDateFromKey(dateKey),
        mode,
        remarks: remarks.trim() || undefined,
      }, actor);

      // Committed. A refetch failure from here on is NOT a save failure.
      const refreshed = await onSaved();
      showToast(
        refreshed
          ? `${inr(value)} recorded for ${row.name}`
          : refreshFailedMessage(`${inr(value)} recorded for ${row.name}`),
        refreshed ? 'success' : 'warning',
      );
      onClose();
    } catch (e) {
      console.error('[principal-register] payment save failed', e);
      setFormError(describeError(e, 'The payment was NOT saved. Please retry.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={saving ? () => {} : onClose} title={`Record payment — ${row.name}`} size="sm">
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', margin: 0 }}>
          {row.className}{row.sectionName ? ` · ${row.sectionName}` : ''}
          {' · '}Due now {inr(summary.totalDueNow)} of {inr(summary.totalPending)} pending
        </p>

        <Select
          label="Fee head"
          value={head}
          onChange={e => handleHeadChange(e.target.value as PrincipalFeeHead)}
          options={HEAD_OPTIONS}
        />

        {needsMonth && (
          monthCells.length === 0 ? (
            <NoticeBanner tone="warning">
              This student has no {head === 'eca' ? 'ECA' : 'van'} months set in the fees note, so
              there is no month to record against. Add the months first.
            </NoticeBanner>
          ) : (
            <Select
              label="Month"
              value={month}
              onChange={e => handleMonthChange(e.target.value)}
              placeholder="Select a month"
              options={monthCells.map(cell => ({
                value: cell.month,
                label: `${cell.month} — ${inr(cell.pending)} pending${cell.isDue ? ' (due)' : ''}`,
              }))}
            />
          )
        )}

        <Input
          label="Amount (INR)"
          type="number"
          min={1}
          inputMode="numeric"
          value={amount}
          onChange={e => { setAmount(e.target.value); touch(); }}
          hint={selectedCell
            ? `${selectedCell.month}: ${inr(selectedCell.amount)} charged, ${inr(selectedCell.pending)} pending`
            : headPending > 0 ? `${inr(headPending)} pending under this head` : undefined}
        />

        <Input
          label="Collected on"
          type="date"
          value={dateKey}
          onChange={e => { setDateKey(e.target.value); touch(); }}
          hint="Backdating is allowed — the activity log records who entered it and when."
        />

        <Select
          label="Received as"
          value={mode}
          onChange={e => setMode(e.target.value as PrincipalPaymentMode)}
          options={MODE_OPTIONS}
        />

        <Input
          label="Remarks (optional)"
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
          placeholder="Receipt no., part payment, etc."
        />

        {duplicateNotice && <NoticeBanner tone="warning">{duplicateNotice}</NoticeBanner>}
        {formError && <NoticeBanner tone="error">{formError}</NoticeBanner>}

        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} loading={saving} disabled={saving}>
            Save payment
          </Button>
        </div>
      </div>
    </Modal>
  );
}
