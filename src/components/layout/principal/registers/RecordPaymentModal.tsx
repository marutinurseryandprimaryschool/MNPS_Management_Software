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
import { useSchool } from '@/context/SchoolContext';
import { ACADEMIC_MONTHS, toDateKey } from '@/lib/fee-utils';
import { feeStatus } from '@/lib/principal-fees';
import { PrincipalDayCloseService, PrincipalPaymentsService } from '@/lib/principal-service';
import { exportPaymentReceiptPdf } from '@/lib/export-utils';
import { refreshFailedMessage } from '@/components/layout/admin/fees/error-policy';
import type {
  FeeStatus, MonthCell, PrincipalActor, PrincipalFeeHead, PrincipalPayment,
  PrincipalPaymentMode, RegisterRow, RowSummary,
} from '@/types/principal';
import { PRINCIPAL_MODE_OPTIONS, headLabel, modeLabel } from '../principal-shared';
import { describeError, inr } from './register-shared';
import { NoticeBanner } from './register-ui';

const HEAD_OPTIONS: { value: PrincipalFeeHead; label: string }[] = [
  { value: 'school', label: 'School fees' },
  { value: 'eca', label: 'ECA fees' },
  { value: 'van', label: 'Van fees' },
  { value: 'other', label: 'Other' },
];

/**
 * Only the heads this student actually carries (§5): a student with no van
 * configured must not be offered "Van fees" at all — a ₹0 head in the list
 * reads as a mistake, not as "not applicable". School and Other always apply.
 */
function applicableHeadOptions(summary: RowSummary): typeof HEAD_OPTIONS {
  return HEAD_OPTIONS.filter(option =>
    option.value === 'school'
    || option.value === 'other'
    || (option.value === 'eca' && summary.eca.charged > 0)
    || (option.value === 'van' && summary.van.charged > 0));
}

const MODE_OPTIONS: { value: PrincipalPaymentMode; label: string }[] = PRINCIPAL_MODE_OPTIONS;

/**
 * School fees are collected TERM-WISE at this school. The chosen term rides
 * in the payment's `month` field — a free label the engine ignores for the
 * school head (school fee is due from day one, not month-scheduled), but the
 * history, receipts and exports all print it, which is exactly what's wanted:
 * "School fee — Term 2".
 */
const SCHOOL_TERMS = ['Term 1', 'Term 2', 'Term 3'] as const;

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

/** What the success view and its receipt print — captured AT save time, so a
    background refresh cannot change the numbers under the confirmation. */
interface SavedPayment {
  paymentId: string;
  amount: number;
  head: PrincipalFeeHead;
  month?: string;
  mode: PrincipalPaymentMode;
  dateKey: string;
  remarks?: string;
  previousBalance: number;
  remainingBalance: number;
  status: FeeStatus;
}

export interface RecordPaymentModalProps {
  row: RegisterRow;
  summary: RowSummary;
  /** This student's live receipts — the duplicate check reads them. */
  payments: PrincipalPayment[];
  actor: PrincipalActor | null;
  onClose: () => void;
  /** Post-commit refetch. Returns false when the list could not refresh. */
  onSaved: () => Promise<boolean>;
  /**
   * Reopens a closed business date so a late payment can still be recorded
   * (a parent who arrives after the drawer was counted). Provided by the
   * Billing screen, which owns day close; absent elsewhere.
   */
  onReopenDay?: (dateKey: string) => Promise<boolean>;
}

export default function RecordPaymentModal({
  row, summary, payments, actor, onClose, onSaved, onReopenDay,
}: RecordPaymentModalProps) {
  const { showToast } = useToast();
  const { school } = useSchool();
  /** Set after a successful commit — swaps the form for the §28 confirmation. */
  const [saved, setSaved] = useState<SavedPayment | null>(null);

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
  /** Which term a SCHOOL-fee payment belongs to (Term 1/2/3). */
  const [term, setTerm] = useState('');
  /** Which month within the term the payment applies to. */
  const [schoolMonth, setSchoolMonth] = useState('');
  const [mode, setMode] = useState<PrincipalPaymentMode>('cash');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  /** Set by the duplicate check; the next press commits anyway. */
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);
  /** The closed date blocking this save — drives the inline Reopen action. */
  const [blockedDate, setBlockedDate] = useState<string | null>(null);
  const [reopening, setReopening] = useState(false);

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
    setBlockedDate(null);
  };

  /** Reopen the closed day so this payment can go in, then clear the block. */
  const handleReopen = async () => {
    if (!blockedDate || !onReopenDay || reopening) return;
    setReopening(true);
    try {
      const ok = await onReopenDay(blockedDate);
      if (ok) {
        setBlockedDate(null);
        setFormError(null);
        showToast(`${blockedDate} reopened — record the payment, then close the day again.`);
      }
    } finally {
      setReopening(false);
    }
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
    if (head === 'school' && (!term || !schoolMonth)) {
      setFormError('Pick both the term and the month this school-fee payment is for.');
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

    // Closed-day guard (§18): the rules reject a payment on a closed date —
    // check first so the user reads a sentence instead of a permission error.
    // Teachers cannot read day-close records; for them the check is skipped
    // and firestore.rules remains the enforcement.
    try {
      const dayClose = await PrincipalDayCloseService.get(dateKey);
      if (dayClose?.status === 'closed') {
        setBlockedDate(dateKey);
        setFormError(
          `${dateKey} has already been closed and counted. A payment cannot be added to a `
          + 'closed day — reopen it, record the money, then close it again.',
        );
        setSaving(false);
        return;
      }
    } catch {
      // Unreadable day-close record — the rules still enforce the block.
    }

    try {
      const paymentId = await PrincipalPaymentsService.create({
        academicYear: row.academicYear,
        rowId: row.id,
        studentName: row.name,
        className: row.className,
        head,
        month: needsMonth ? month : head === 'school' ? `${term} — ${schoolMonth}` : undefined,
        amount: value,
        dateKey,
        paidAt: localDateFromKey(dateKey),
        mode,
        remarks: remarks.trim() || undefined,
      }, actor);

      // Committed. A refetch failure from here on is NOT a save failure.
      const refreshed = await onSaved();
      /* §28: say what was recorded AND what is still owed, so the Principal
         does not have to reopen the student to find out. The remainder is
         this row's pending less what was just taken — captured here, at save
         time, so a background refresh cannot change it under the view. */
      const remaining = Math.max(0, summary.totalPending - value);
      const confirmation = `${inr(value)} recorded for ${row.name} `
        + `(${HEAD_LABELS[head] ?? head}${needsMonth && month ? ` · ${month}` : ''}, `
        + `${modeLabel(mode)}, ${dateKey}). `
        + (remaining > 0 ? `Balance now ${inr(remaining)}.` : 'Nothing left pending.');
      showToast(
        refreshed ? confirmation : refreshFailedMessage(confirmation),
        refreshed ? 'success' : 'warning',
      );
      // §20/§28: swap the form for the confirmation with the receipt button.
      setSaved({
        paymentId,
        amount: value,
        head,
        month: needsMonth ? month : head === 'school' ? `${term} — ${schoolMonth}` : undefined,
        mode,
        dateKey,
        remarks: remarks.trim() || undefined,
        previousBalance: summary.totalPending,
        remainingBalance: remaining,
        status: feeStatus(summary.totalCharged, summary.totalPaid + value),
      });
    } catch (e) {
      console.error('[principal-register] payment save failed', e);
      setFormError(describeError(e, 'The payment was NOT saved. Please retry.'));
    } finally {
      setSaving(false);
    }
  };

  /** Build and download the PDF for the payment just recorded (§19–§20). */
  const downloadReceipt = async (record: SavedPayment) => {
    try {
      await exportPaymentReceiptPdf({
        schoolName: school?.name || 'School',
        schoolAddress: school?.address || undefined,
        schoolPhone: school?.phone || undefined,
        academicYear: row.academicYear,
        receiptRef: record.paymentId,
        paymentDate: record.dateKey,
        studentName: row.name,
        className: row.className,
        sectionName: row.sectionName,
        rollNo: row.rollNo,
        teacherName: row.teacherName || undefined,
        feeHead: headLabel(record.head),
        month: record.month,
        previousBalance: record.previousBalance,
        amountReceived: record.amount,
        remainingBalance: record.remainingBalance,
        paymentMethod: modeLabel(record.mode),
        status: record.status.toUpperCase(),
        recordedBy: actor?.name,
        remarks: record.remarks,
      });
      showToast('Receipt downloaded');
    } catch (e) {
      console.error('[principal-register] receipt generation failed', e);
      showToast('Could not generate the receipt — the payment itself IS saved.', 'error');
    }
  };

  /* §28 confirmation: what was recorded, what remains, and the receipt. */
  if (saved) {
    return (
      <Modal isOpen onClose={onClose} title="Payment Recorded" size="sm">
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <div style={{ textAlign: 'center', padding: 'var(--space-2) 0' }}>
            <div className="text-body" style={{ fontWeight: 700 }}>{row.name}</div>
            <div className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              {headLabel(saved.head)}{saved.month ? ` — ${saved.month}` : ''}
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-success)', margin: 'var(--space-2) 0' }}>
              {inr(saved.amount)}
            </div>
            <div className="text-body-sm">
              {saved.dateKey} · {modeLabel(saved.mode)}
            </div>
          </div>

          <div style={{
            background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)',
          }}>
            <span className="text-body-sm" style={{ fontWeight: 600 }}>Remaining Balance</span>
            <span style={{
              fontWeight: 700, fontSize: '1.05rem',
              color: saved.remainingBalance > 0 ? 'var(--color-error)' : 'var(--color-success)',
            }}>
              {inr(saved.remainingBalance)}
              <span style={{ marginLeft: 8, fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                {saved.status.toUpperCase()}
              </span>
            </span>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => void downloadReceipt(saved)}>
              Download Receipt
            </Button>
            <Button variant="primary" onClick={onClose}>Done</Button>
          </div>
        </div>
      </Modal>
    );
  }

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
          options={applicableHeadOptions(summary)}
        />
        {(summary.eca.charged <= 0 || summary.van.charged <= 0) && (
          <span className="text-caption" style={{ color: 'var(--color-text-tertiary)', marginTop: -8 }}>
            {[
              summary.eca.charged <= 0 ? 'ECA' : '',
              summary.van.charged <= 0 ? 'Van' : '',
            ].filter(Boolean).join(' and ')} fee is not configured for this student.
          </span>
        )}

        {head === 'school' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
            <Select
              label="Term"
              value={term}
              onChange={e => { setTerm(e.target.value); touch(); }}
              placeholder="Which term?"
              options={SCHOOL_TERMS.map(t => ({ value: t, label: t }))}
            />
            <Select
              label="Month"
              value={schoolMonth}
              onChange={e => { setSchoolMonth(e.target.value); touch(); }}
              placeholder="Which month?"
              options={ACADEMIC_MONTHS.map(m => ({ value: m, label: m }))}
            />
          </div>
        )}

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
          label="Amount Received"
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
          label="Payment Date"
          type="date"
          value={dateKey}
          onChange={e => { setDateKey(e.target.value); touch(); }}
          hint="Backdating is allowed — the activity log records who entered it and when."
        />

        <Select
          label="Payment Method"
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
        {formError && (
          <NoticeBanner tone="error">
            {formError}
            {blockedDate && onReopenDay && (
              <div style={{ marginTop: 'var(--space-2)' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleReopen()}
                  loading={reopening}
                  disabled={reopening}
                >
                  Reopen {blockedDate} and continue
                </Button>
              </div>
            )}
          </NoticeBanner>
        )}

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
