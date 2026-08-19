'use client';

/* ============================================
   Principal Register — student month drawer
   ============================================
   Read-only breakdown of one student: the three heads, the ECA and van month
   schedules, and every receipt recorded against the row.

   The arrears rule is visible here, not just computed: a month that has not
   ENDED is labelled "Not due yet" even when it carries a pending amount, so
   nobody chases August money in August.

   Responsive: on a PC the months are a compact grid; on a phone they stack as
   a vertical list. Neither ever scrolls the page sideways.
*/

import React from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import type { MonthCell, PrincipalPayment, RegisterRow, RowSummary } from '@/types/principal';
import { inr, monthShort } from './register-shared';
import { Chip, Money, NoticeBanner, StatGrid, surfaceCard, useIsNarrow } from './register-ui';

function monthTone(cell: MonthCell): 'paid' | 'due' | 'neutral' {
  if (cell.pending <= 0) return 'paid';
  return cell.isDue ? 'due' : 'neutral';
}

function monthLabel(cell: MonthCell): string {
  if (cell.pending <= 0) return 'Paid';
  return cell.isDue ? 'Due' : 'Not due yet';
}

function MonthSchedule({ title, cells, narrow }: {
  title: string;
  cells: MonthCell[];
  narrow: boolean;
}) {
  if (cells.length === 0) {
    return (
      <div>
        <h4 className="text-overline" style={{ marginBottom: 'var(--space-2)' }}>{title}</h4>
        <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', margin: 0 }}>
          No months set for this head.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-overline" style={{ marginBottom: 'var(--space-2)' }}>{title}</h4>
      <div style={{
        display: 'grid',
        gridTemplateColumns: narrow ? '1fr' : 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: 'var(--space-2)',
      }}>
        {cells.map(cell => (
          <div
            key={cell.month}
            style={{
              ...surfaceCard,
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 'var(--space-2)',
              background: cell.pending > 0 && cell.isDue
                ? 'var(--color-error-bg)'
                : 'var(--color-surface-variant)',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                {narrow ? cell.month : monthShort(cell.month)}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}>
                {inr(cell.amount)} charged
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Chip label={monthLabel(cell)} tone={monthTone(cell)} />
              <div style={{ fontSize: '0.78rem', marginTop: 2 }}>
                <Money amount={cell.pending} tone={cell.isDue ? 'due' : 'pending'} bold />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentList({ payments, narrow }: { payments: PrincipalPayment[]; narrow: boolean }) {
  if (payments.length === 0) {
    return (
      <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', margin: 0 }}>
        No payments recorded yet.
      </p>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
      {payments.map(payment => (
        <div
          key={payment.id}
          style={{
            display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)',
            alignItems: narrow ? 'flex-start' : 'center',
            flexDirection: narrow ? 'column' : 'row',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-md)', background: 'var(--color-surface-variant)',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
              {inr(payment.amount)} · {payment.head}{payment.month ? ` (${payment.month})` : ''}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}>
              {payment.dateKey} · {payment.mode === 'bank' ? 'Bank' : 'Cash'}
              {payment.enteredByName ? ` · entered by ${payment.enteredByName}` : ''}
            </div>
          </div>
          {payment.remarks && (
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              {payment.remarks}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export interface StudentDetailSheetProps {
  row: RegisterRow;
  summary: RowSummary;
  payments: PrincipalPayment[];
  onClose: () => void;
  onRecordPayment?: () => void;
  onEditFees?: () => void;
}

export default function StudentDetailSheet({
  row, summary, payments, onClose, onRecordPayment, onEditFees,
}: StudentDetailSheetProps) {
  const narrow = useIsNarrow();

  return (
    <Modal isOpen onClose={onClose} title={row.name} size={narrow ? 'full' : 'lg'}>
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <div>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', margin: '0 0 var(--space-3)' }}>
            {row.className}
            {row.sectionName ? ` · ${row.sectionName}` : ''}
            {row.rollNo ? ` · Roll ${row.rollNo}` : ''}
            {row.teacherName ? ` · Teacher: ${row.teacherName}` : ' · No teacher assigned'}
          </p>
          <StatGrid
            compact
            stats={[
              { label: 'Charged', value: inr(summary.totalCharged) },
              { label: 'Collected', value: inr(summary.totalPaid), tone: 'paid' },
              { label: 'Pending', value: inr(summary.totalPending), tone: 'pending' },
              { label: 'Due now', value: inr(summary.totalDueNow), tone: 'due' },
            ]}
          />
        </div>

        {summary.totalDueNow === 0 && summary.totalPending > 0 && (
          <NoticeBanner tone="success">
            Nothing to chase today. The pending amount belongs to months that have not ended yet.
          </NoticeBanner>
        )}

        <div style={{
          ...surfaceCard, borderRadius: 'var(--radius-md)', padding: 'var(--space-3)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)',
        }}>
          <div>
            <div className="text-overline">School fees</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
              {inr(summary.school.charged)} charged · {inr(summary.school.paid)} collected
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Chip label={summary.school.pending > 0 ? 'Due' : 'Paid'} tone={summary.school.pending > 0 ? 'due' : 'paid'} />
            <div style={{ fontSize: '0.85rem', marginTop: 2 }}>
              <Money amount={summary.school.pending} tone="due" bold />
            </div>
          </div>
        </div>

        <MonthSchedule title={`ECA fees — ${inr(summary.eca.charged)} a year`} cells={summary.eca.months} narrow={narrow} />
        <MonthSchedule title={`Van fees — ${inr(summary.van.charged)} a year`} cells={summary.van.months} narrow={narrow} />

        {summary.other.paid > 0 && (
          <NoticeBanner tone="info">
            {inr(summary.other.paid)} received under &ldquo;other&rdquo;. It counts towards this
            student&rsquo;s total collected but belongs to no month.
          </NoticeBanner>
        )}

        <div>
          <h4 className="text-overline" style={{ marginBottom: 'var(--space-2)' }}>
            Payments ({payments.length})
          </h4>
          <PaymentList payments={payments} narrow={narrow} />
        </div>

        {(onRecordPayment || onEditFees) && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {onEditFees && <Button variant="secondary" onClick={onEditFees}>Edit fees</Button>}
            {onRecordPayment && <Button variant="primary" onClick={onRecordPayment}>Record payment</Button>}
          </div>
        )}
      </div>
    </Modal>
  );
}
