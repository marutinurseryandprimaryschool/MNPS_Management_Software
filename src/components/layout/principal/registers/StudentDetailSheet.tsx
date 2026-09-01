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

import React, { useState } from 'react';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useSchool } from '@/context/SchoolContext';
import { computeReceiptSnapshots } from '@/lib/principal-fees';
import { PrincipalPaymentsService } from '@/lib/principal-service';
import { exportPaymentReceiptPdf } from '@/lib/export-utils';
import type {
  FeeStatus, MonthCell, PrincipalActor, PrincipalPayment, ReceiptSnapshot,
  RegisterRow, RowSummary,
} from '@/types/principal';
import { headLabel, modeLabel, principalWriteError, refreshFailedMessage } from '../principal-shared';
import { inr, monthShort } from './register-shared';
import { Chip, Money, NoticeBanner, StatGrid, surfaceCard, useIsNarrow } from './register-ui';

/* PENDING / PARTIAL / PAID presentation. The state comes from the engine's
   feeStatus() via summary.status — never recomputed here (§17). */
const STATUS_LABEL: Record<FeeStatus, string> = {
  pending: 'PENDING', partial: 'PARTIAL', paid: 'PAID',
};
const STATUS_TONE: Record<FeeStatus, 'due' | 'pending' | 'paid'> = {
  pending: 'due', partial: 'pending', paid: 'paid',
};

/** One head's money, spelled out the way §9 asks: Due / Paid / Balance / status. */
function HeadRow({ title, charged, paid, pending, status }: {
  title: string;
  charged: number;
  paid: number;
  pending: number;
  status: FeeStatus;
}) {
  return (
    <div style={{
      ...surfaceCard, borderRadius: 'var(--radius-md)', padding: 'var(--space-3)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      gap: 'var(--space-3)', flexWrap: 'wrap',
    }}>
      <div style={{ minWidth: 0 }}>
        <div className="text-overline">{title}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
          Due {inr(charged)} · Paid {inr(paid)}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <Chip label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />
        {/* Balance is always a number here, never an em dash: "Balance ₹0" is
            the point of a PAID row (§9). */}
        <div style={{
          fontSize: '1rem', marginTop: 2, fontWeight: 700,
          color: pending > 0 ? 'var(--color-error)' : 'var(--color-success)',
        }}>
          {inr(pending)}
        </div>
      </div>
    </div>
  );
}

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

function PaymentList({ payments, narrow, snapshots, onReceipt, onDelete }: {
  payments: PrincipalPayment[];
  narrow: boolean;
  /** Balance-after-each-payment, precomputed by the engine (§18). */
  snapshots: Map<string, ReceiptSnapshot>;
  onReceipt: (payment: PrincipalPayment) => void;
  /** Principal only — absent for everyone else. */
  onDelete?: (payment: PrincipalPayment) => void;
}) {
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
              {payment.dateKey} · {modeLabel(payment.mode)}
              {payment.enteredByName ? ` · entered by ${payment.enteredByName}` : ''}
            </div>
            {/* §18: what was still owed once this payment was recorded. */}
            {snapshots.get(payment.id) && (
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                Balance after this payment:{' '}
                <strong style={{
                  color: snapshots.get(payment.id)!.remainingPending > 0
                    ? 'var(--color-error)'
                    : 'var(--color-success)',
                }}>
                  {inr(snapshots.get(payment.id)!.remainingPending)}
                </strong>
              </div>
            )}
            {payment.remarks && (
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                {payment.remarks}
              </div>
            )}
          </div>
          <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <Button variant="ghost" size="sm" onClick={() => onReceipt(payment)}>
              Receipt
            </Button>
            {onDelete && (
              <Button variant="ghost" size="sm" onClick={() => onDelete(payment)}>
                Delete
              </Button>
            )}
          </span>
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
  /** Principal only: lets a wrongly-entered payment be removed (SOFT delete —
      the receipt leaves every total but stays in the activity log forever). */
  actor?: PrincipalActor | null;
  canDeletePayments?: boolean;
  /** Post-commit refetch after a deletion; false = list is stale. */
  onPaymentsChanged?: () => Promise<boolean>;
}

export default function StudentDetailSheet({
  row, summary, payments, onClose, onRecordPayment, onEditFees,
  actor, canDeletePayments = false, onPaymentsChanged,
}: StudentDetailSheetProps) {
  const narrow = useIsNarrow();
  const { school } = useSchool();
  const { showToast } = useToast();

  /* Payment deletion (Principal only): confirm → soft-delete → refresh. */
  const [deleteTarget, setDeleteTarget] = useState<PrincipalPayment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDeletePayment = async () => {
    if (deleting || !deleteTarget || !actor) return;
    setDeleting(true);
    try {
      await PrincipalPaymentsService.softDelete(deleteTarget.id, actor);
    } catch (error) {
      console.error('[principal-register] payment delete failed', { paymentId: deleteTarget.id, error });
      showToast(principalWriteError(error, 'Only the Principal can delete a payment.'), 'error');
      setDeleting(false);
      return;
    }
    setDeleteTarget(null);
    const message = 'Payment removed — it no longer counts anywhere, and stays in the activity log.';
    try {
      const refreshed = onPaymentsChanged ? await onPaymentsChanged() : true;
      showToast(refreshed ? message : refreshFailedMessage(message), refreshed ? 'success' : 'warning');
    } finally {
      setDeleting(false);
    }
  };

  /* Every payment's balance story, computed once by the engine (§28, §31). */
  const snapshots = React.useMemo(
    () => computeReceiptSnapshots(row, payments),
    [row, payments],
  );

  /**
   * Reprint the receipt for any historical payment (§20). The balances are
   * rebuilt from the immutable history by computeReceiptSnapshot, so the
   * numbers are the ones that stood when THIS payment was recorded.
   */
  const handleReceipt = async (payment: PrincipalPayment) => {
    const snapshot = snapshots.get(payment.id);
    if (!snapshot) {
      showToast('Could not rebuild this receipt from the payment history.', 'error');
      return;
    }
    try {
      await exportPaymentReceiptPdf({
        schoolName: school?.name || 'School',
        schoolAddress: school?.address || undefined,
        schoolPhone: school?.phone || undefined,
        academicYear: row.academicYear,
        receiptRef: payment.id,
        paymentDate: payment.dateKey,
        studentName: row.name,
        className: row.className,
        sectionName: row.sectionName,
        rollNo: row.rollNo,
        teacherName: row.teacherName || undefined,
        feeHead: headLabel(payment.head),
        month: payment.month,
        previousBalance: snapshot.previousPending,
        amountReceived: Number(payment.amount) || 0,
        remainingBalance: snapshot.remainingPending,
        paymentMethod: modeLabel(payment.mode),
        status: snapshot.status.toUpperCase(),
        recordedBy: payment.enteredByName || undefined,
        remarks: payment.remarks,
      });
      showToast('Receipt downloaded');
    } catch (error) {
      console.error('[principal-register] receipt generation failed', error);
      showToast('Could not generate the receipt. Please retry.', 'error');
    }
  };

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

        {/* The three heads, each with its own status. ECA and van appear only
            when the student actually carries them (§11, §19). */}
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          <HeadRow
            title="School fees"
            charged={summary.school.charged}
            paid={summary.school.paid}
            pending={summary.school.pending}
            status={summary.school.status}
          />
          {summary.eca.charged > 0 && (
            <HeadRow
              title="ECA fees"
              charged={summary.eca.charged}
              paid={summary.eca.paid}
              pending={summary.eca.pending}
              status={summary.eca.status}
            />
          )}
          {summary.van.charged > 0 && (
            <HeadRow
              title="Van fees"
              charged={summary.van.charged}
              paid={summary.van.paid}
              pending={summary.van.pending}
              status={summary.van.status}
            />
          )}
        </div>

        {/* §13/§16: a student who carries no ECA or van gets no month grid for
            it — an empty schedule headed "₹0 a year" reads as a broken record
            rather than as "this child does not take that service". */}
        {summary.eca.charged > 0 ? (
          <MonthSchedule title={`ECA fees — ${inr(summary.eca.charged)} a year`} cells={summary.eca.months} narrow={narrow} />
        ) : (
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', margin: 0 }}>
            No ECA configured for this student.
          </p>
        )}
        {summary.van.charged > 0 ? (
          <MonthSchedule title={`Van fees — ${inr(summary.van.charged)} a year`} cells={summary.van.months} narrow={narrow} />
        ) : (
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', margin: 0 }}>
            No Van configured for this student.
          </p>
        )}

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
          <PaymentList
            payments={payments}
            narrow={narrow}
            snapshots={snapshots}
            onReceipt={payment => void handleReceipt(payment)}
            onDelete={canDeletePayments && actor ? setDeleteTarget : undefined}
          />
        </div>

        {(onRecordPayment || onEditFees) && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {onEditFees && <Button variant="secondary" onClick={onEditFees}>Edit fees</Button>}
            {onRecordPayment && <Button variant="primary" onClick={onRecordPayment}>Record payment</Button>}
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          isOpen
          onClose={() => { if (!deleting) setDeleteTarget(null); }}
          onConfirm={() => void confirmDeletePayment()}
          title="Remove this payment?"
          message={`${inr(deleteTarget.amount)} (${headLabel(deleteTarget.head)}`
            + `${deleteTarget.month ? ` · ${deleteTarget.month}` : ''}, ${deleteTarget.dateKey}) `
            + `will stop counting in ${row.name}'s balance and in every daily, monthly and `
            + 'income total. The record itself stays in the activity log permanently.'}
          confirmLabel="Remove payment"
        />
      )}
    </Modal>
  );
}
