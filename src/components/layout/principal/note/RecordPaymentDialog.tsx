'use client';

/* ============================================
   Fees Note — Record payment
   ============================================
   Opened from a month cell (prefilled with that month's pending amount) or
   from the row menu. Carries the full form-hardening pack:
   - in-flight guard, so a double tap cannot book the money twice;
   - duplicate warning when the same amount is already recorded for this
     student on the same day — the second press records it anyway;
   - offline and permission failures surfaced as NOT saved, never swallowed;
   - a committed write whose refetch fails says so WITHOUT saying "not saved".

   Backdating is allowed on purpose: Sharmi enters yesterday's collections in
   the morning. The collection DATE is what every ledger buckets on.
*/

import React, { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Input, { Select, Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { PrincipalPaymentsService } from '@/lib/principal-service';
import {
  formatINR, headLabel, principalWriteError, refreshFailedMessage, todayKey,
} from '../principal-shared';
import ResponsiveSheet, { SheetActions } from './ResponsiveSheet';
import { dateFromKey, type PaymentPrefill } from './note-helpers';
import type {
  MonthCell, NewPrincipalPayment, PrincipalActor, PrincipalFeeHead, PrincipalPayment,
  PrincipalPaymentMode, RegisterRow, RowSummary,
} from '@/types/principal';

/** What the dialog was opened against. Identity is stable per open. */
export interface PaymentTarget {
  row: RegisterRow;
  summary: RowSummary;
  prefill?: PaymentPrefill;
}

interface RecordPaymentDialogProps {
  target: PaymentTarget | null;
  onClose: () => void;
  isMobile: boolean;
  academicYear: string;
  actor: PrincipalActor;
  /** This student's live payments — the duplicate check reads them. */
  existingPayments: PrincipalPayment[];
  onSaved: () => Promise<void>;
}

interface PaymentForm {
  head: PrincipalFeeHead;
  month: string;
  amount: string;
  dateKey: string;
  mode: PrincipalPaymentMode;
  remarks: string;
}

const CANNOT_RECORD = 'Only the Principal and the responsible teacher can record payments.';

const HEAD_OPTIONS: { value: PrincipalFeeHead; label: string }[] = [
  { value: 'school', label: 'School fee' },
  { value: 'eca', label: 'ECA fee' },
  { value: 'van', label: 'Van fee' },
  { value: 'other', label: 'Other' },
];

const isMonthly = (head: PrincipalFeeHead): head is 'eca' | 'van' =>
  head === 'eca' || head === 'van';

const monthsFor = (summary: RowSummary, head: PrincipalFeeHead): MonthCell[] =>
  head === 'eca' ? summary.eca.months : head === 'van' ? summary.van.months : [];

/** The month the user most likely means: the oldest one still owed. */
function firstOwedMonth(cells: MonthCell[]): MonthCell | null {
  return cells.find(cell => cell.isDue && cell.pending > 0)
    ?? cells.find(cell => cell.pending > 0)
    ?? null;
}

function headPending(summary: RowSummary, head: PrincipalFeeHead): number {
  if (head === 'school') return summary.school.pending;
  if (head === 'eca') return summary.eca.pending;
  if (head === 'van') return summary.van.pending;
  return 0;
}

function initialForm(target: PaymentTarget): PaymentForm {
  const head = target.prefill?.head ?? 'school';
  const cells = monthsFor(target.summary, head);
  const month = target.prefill?.month
    ?? (isMonthly(head) ? firstOwedMonth(cells)?.month ?? cells[0]?.month ?? '' : '');
  const cell = cells.find(item => item.month === month);
  const amount = target.prefill?.amount
    ?? (isMonthly(head) ? cell?.pending ?? 0 : headPending(target.summary, head));

  return {
    head,
    month,
    amount: amount > 0 ? String(amount) : '',
    dateKey: todayKey(),
    mode: 'cash',
    remarks: '',
  };
}

function monthOptionLabel(cell: MonthCell): string {
  if (cell.amount <= 0) return `${cell.month} — no charge`;
  if (cell.pending <= 0) return `${cell.month} — paid`;
  return `${cell.month} — ${formatINR(cell.pending)} left${cell.isDue ? ' (due)' : ''}`;
}

export default function RecordPaymentDialog({
  target, onClose, isMobile, academicYear, actor, existingPayments, onSaved,
}: RecordPaymentDialogProps) {
  const { showToast } = useToast();
  const [form, setForm] = useState<PaymentForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);

  useEffect(() => {
    setForm(target ? initialForm(target) : null);
    setDuplicateAcknowledged(false);
  }, [target]);

  const setField = <K extends keyof PaymentForm>(key: K, value: PaymentForm[K]) => {
    setForm(prev => (prev ? { ...prev, [key]: value } : prev));
    setDuplicateAcknowledged(false); // any edit invalidates the warning
  };

  const changeHead = (head: PrincipalFeeHead) => {
    if (!target || !form) return;
    const cells = monthsFor(target.summary, head);
    const owed = isMonthly(head) ? firstOwedMonth(cells) : null;
    const amount = isMonthly(head) ? owed?.pending ?? 0 : headPending(target.summary, head);
    setForm({
      ...form,
      head,
      month: owed?.month ?? (isMonthly(head) ? cells[0]?.month ?? '' : ''),
      amount: amount > 0 ? String(amount) : '',
    });
    setDuplicateAcknowledged(false);
  };

  const changeMonth = (month: string) => {
    if (!target || !form) return;
    const cell = monthsFor(target.summary, form.head).find(item => item.month === month);
    setForm({
      ...form,
      month,
      amount: cell && cell.pending > 0 ? String(cell.pending) : form.amount,
    });
    setDuplicateAcknowledged(false);
  };

  const close = () => {
    if (saving) return;
    onClose();
  };

  const handleSave = async () => {
    if (saving || !target || !form) return;
    const { row, summary } = target;

    const amount = Math.round(Number((form.amount || '').replace(/[₹,\s]/g, '')));
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Enter the amount collected', 'error');
      return;
    }
    if (!form.dateKey) { showToast('Pick the collection date', 'error'); return; }
    if (isMonthly(form.head)) {
      const cells = monthsFor(summary, form.head);
      if (cells.length === 0) {
        showToast(
          `${row.name} has no ${headLabel(form.head)} months yet — set the amount on the row first.`,
          'error',
        );
        return;
      }
      if (!form.month) { showToast('Choose which month this payment is for', 'error'); return; }
    }
    if (!actor.uid) {
      showToast('Your session has no user id — sign in again before recording money.', 'error');
      return;
    }

    const duplicate = existingPayments.find(payment =>
      Math.round(Number(payment.amount) || 0) === amount && payment.dateKey === form.dateKey);
    if (duplicate && !duplicateAcknowledged) {
      setDuplicateAcknowledged(true);
      showToast(
        `${formatINR(amount)} is already recorded for ${row.name} on ${form.dateKey} `
        + `(${headLabel(duplicate.head)}${duplicate.month ? ` · ${duplicate.month}` : ''}). `
        + 'Press Save again to record it anyway.',
        'warning',
      );
      return;
    }

    const payload: NewPrincipalPayment = {
      academicYear,
      rowId: row.id,
      studentName: row.name,
      className: row.className,
      head: form.head,
      month: isMonthly(form.head) ? form.month : undefined,
      amount,
      dateKey: form.dateKey,
      paidAt: dateFromKey(form.dateKey),
      mode: form.mode,
      remarks: form.remarks.trim() || undefined,
    };

    setSaving(true);
    try {
      await PrincipalPaymentsService.create(payload, actor);
      showToast(`${formatINR(amount)} recorded for ${row.name}`);
      onClose();
      try {
        await onSaved();
      } catch (refreshError) {
        // COMMITTED. Saying "not saved" here would make the user pay it twice.
        console.error('[fees-note] refresh after payment failed', refreshError);
        showToast(refreshFailedMessage('Payment saved'), 'warning');
      }
    } catch (error) {
      console.error('[fees-note] payment save failed', { payload, error });
      showToast(principalWriteError(error, CANNOT_RECORD), 'error');
    } finally {
      setSaving(false);
    }
  };

  const monthCells = target && form ? monthsFor(target.summary, form.head) : [];

  return (
    <ResponsiveSheet
      isOpen={Boolean(target && form)}
      onClose={close}
      title={target ? `Record payment — ${target.row.name}` : 'Record payment'}
      isMobile={isMobile}
    >
      {target && form && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 'var(--space-3)',
          }}>
            <Select
              label="Fee head"
              value={form.head}
              disabled={saving}
              options={HEAD_OPTIONS}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                changeHead(event.target.value as PrincipalFeeHead)}
            />
            {isMonthly(form.head) && (
              <Select
                label="Month"
                value={form.month}
                disabled={saving || monthCells.length === 0}
                placeholder={monthCells.length === 0 ? 'No months scheduled' : 'Choose a month'}
                options={monthCells.map(cell => ({
                  value: cell.month, label: monthOptionLabel(cell),
                }))}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                  changeMonth(event.target.value)}
              />
            )}
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 'var(--space-3)',
          }}>
            <Input
              label="Amount (₹)"
              type="number"
              min={0}
              value={form.amount}
              disabled={saving}
              onChange={event => setField('amount', event.target.value)}
            />
            <Input
              label="Collection date"
              type="date"
              value={form.dateKey}
              max={todayKey()}
              disabled={saving}
              hint="Backdating is allowed"
              onChange={event => setField('dateKey', event.target.value)}
            />
            <Select
              label="Received as"
              value={form.mode}
              disabled={saving}
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'bank', label: 'Bank' },
              ]}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                setField('mode', event.target.value === 'bank' ? 'bank' : 'cash')}
            />
          </div>

          <Textarea
            label="Remarks (optional)"
            rows={2}
            value={form.remarks}
            disabled={saving}
            placeholder="e.g. paid by elder brother"
            onChange={event => setField('remarks', event.target.value)}
          />

          <span style={{ font: 'var(--text-caption)', color: 'var(--color-text-tertiary)' }}>
            Outstanding now: {formatINR(target.summary.totalDueNow)} of{' '}
            {formatINR(target.summary.totalPending)} pending this year.
          </span>

          <SheetActions>
            <Button variant="secondary" onClick={close} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {duplicateAcknowledged ? 'Save anyway' : 'Save payment'}
            </Button>
          </SheetActions>
        </div>
      )}
    </ResponsiveSheet>
  );
}
