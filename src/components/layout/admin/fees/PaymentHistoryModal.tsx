'use client';
/* Per-payment audit history drawer (feePayments/{id}/history, write-once).
   Read is principal-only in rules; the open affordance is capability-gated. */

import React, { useCallback, useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/SharedUI';
import { fetchPaymentHistory, type PaymentHistoryView } from './payment-mutations';
import { describeWriteError } from './error-policy';
import type { FeePayment } from '@/types/models';

const HISTORY_PERMISSION_MESSAGE = 'Only the Principal can view payment history.';

const ACTION_LABELS: Record<PaymentHistoryView['action'], { label: string; variant: 'success' | 'warning' | 'error' }> = {
  created: { label: 'Created', variant: 'success' },
  edited: { label: 'Edited', variant: 'warning' },
  deleted: { label: 'Deleted', variant: 'error' },
};

function beforeSummary(before: PaymentHistoryView['before']): string | null {
  if (!before) return null;
  const parts: string[] = [];
  if (before.amount !== undefined) parts.push(`₹${Number(before.amount).toLocaleString()}`);
  if (before.category) parts.push(String(before.category));
  if (before.mode) parts.push(String(before.mode).toUpperCase());
  if (before.dateKey) parts.push(String(before.dateKey));
  if (before.referenceNumber) parts.push(`Ref: ${before.referenceNumber}`);
  return parts.length > 0 ? parts.join(' • ') : null;
}

interface PaymentHistoryModalProps {
  payment: FeePayment | null;
  onClose: () => void;
}

export default function PaymentHistoryModal({ payment, onClose }: PaymentHistoryModalProps) {
  const [entries, setEntries] = useState<PaymentHistoryView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (paymentId: string) => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await fetchPaymentHistory(paymentId));
    } catch (e) {
      console.error('Payment history load failed', { paymentId, error: e });
      setError(describeWriteError(e, HISTORY_PERMISSION_MESSAGE));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (payment) void load(payment.id);
    else setEntries([]);
  }, [payment, load]);

  return (
    <Modal isOpen={!!payment} onClose={onClose} title={payment ? `Payment History — ${payment.studentName}` : ''} size="md">
      {payment && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-variant)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-body-sm" style={{ fontWeight: 600 }}>
              {payment.receiptNumber} • {payment.category}
            </span>
            <span className="text-body-sm" style={{ fontWeight: 700, color: payment.deleted ? 'var(--color-error)' : 'var(--color-success)' }}>
              ₹{Number(payment.amount).toLocaleString()}{payment.deleted ? ' (deleted)' : ''}
            </span>
          </div>

          {loading && (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>Loading history…</div>
          )}

          {error && !loading && (
            <div style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
              <p className="text-body-sm" style={{ color: 'var(--color-error)', marginBottom: 'var(--space-3)' }}>{error}</p>
              <Button variant="secondary" onClick={() => void load(payment.id)}>Retry</Button>
            </div>
          )}

          {!loading && !error && entries.length === 0 && (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
              No history entries for this payment (recorded before audit trail was enabled).
            </div>
          )}

          {!loading && !error && entries.map(entry => {
            const meta = ACTION_LABELS[entry.action];
            const before = beforeSummary(entry.before);
            return (
              <div key={entry.id} style={{ padding: 'var(--space-3) var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    <span className="text-body-sm" style={{ fontWeight: 600 }}>{entry.actorName}</span>
                  </div>
                  <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
                    {entry.at
                      ? entry.at.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : 'Unknown time'}
                  </span>
                </div>
                {before && (
                  <div className="text-caption" style={{ color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>
                    Before: {before}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
