'use client';
/* Payment edit dialog — gated by `editFeePayments` (principal).
   Writes the before-snapshot history entry in the SAME writeBatch as the
   payment update; full error policy + in-flight guard. */

import React, { useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input, { Select } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { paymentDateKey, toDateKey, type StudentFeeSummary } from '@/lib/fee-utils';
import { buildCategoryOptions, pendingAmountFor } from './category-options';
import { editPaymentWithHistory } from './payment-mutations';
import {
  describeWriteError, isBrowserOffline, OFFLINE_NOT_SAVED_MESSAGE,
  refreshAfterWrite, refreshFailedMessage,
} from './error-policy';
import type { FeePayment } from '@/types/models';

const EDIT_PERMISSION_MESSAGE = 'Only the Principal can edit fee payments.';

interface EditFormState {
  dateKey: string;
  category: string;
  amount: string;
  mode: string;
  referenceNumber: string;
}

interface PaymentEditModalProps {
  payment: FeePayment | null;
  getSummary: (studentId: string) => StudentFeeSummary | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export default function PaymentEditModal({ payment, getSummary, onClose, onSaved }: PaymentEditModalProps) {
  if (!payment) return null;
  // Keyed by payment id: switching payments remounts the form with fresh
  // initial state, so no reset-in-effect is needed.
  return (
    <PaymentEditModalInner
      key={payment.id}
      payment={payment}
      getSummary={getSummary}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

interface PaymentEditModalInnerProps extends Omit<PaymentEditModalProps, 'payment'> {
  payment: FeePayment;
}

function PaymentEditModalInner({ payment, getSummary, onClose, onSaved }: PaymentEditModalInnerProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState<EditFormState>(() => ({
    dateKey: paymentDateKey(payment) || toDateKey(new Date()),
    category: payment.category || '',
    amount: String(payment.amount ?? ''),
    mode: payment.mode || 'cash',
    referenceNumber: payment.referenceNumber || '',
  }));
  const [saving, setSaving] = useState(false);

  const todayKey = toDateKey(new Date());
  const summary = getSummary(payment.studentId);
  const categoryOptions = useMemo(
    () => buildCategoryOptions(summary, payment.category),
    [summary, payment.category],
  );

  const handleCategoryChange = (category: string) => {
    const pending = pendingAmountFor(summary, category);
    setForm(p => ({
      ...p,
      category,
      // Autofill only when switching category; keep the recorded amount for
      // the payment's own category.
      amount: category !== payment.category && pending !== null && pending > 0
        ? String(pending)
        : p.amount,
    }));
  };

  const handleSave = async () => {
    if (saving) return;
    const amount = parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) { showToast('Enter a valid amount', 'warning'); return; }
    if (!form.dateKey) { showToast('Pick a collection date', 'warning'); return; }
    if (form.dateKey > todayKey) { showToast('Collection date cannot be in the future', 'warning'); return; }
    if (isBrowserOffline()) { showToast(OFFLINE_NOT_SAVED_MESSAGE, 'error'); return; }
    const originalKey = paymentDateKey(payment);
    const paidAt = form.dateKey === originalKey
      ? payment.paidAt
      : new Date(`${form.dateKey}T12:00:00`);
    setSaving(true);
    try {
      await editPaymentWithHistory(payment, {
        amount,
        category: form.category || 'Other',
        mode: form.mode,
        referenceNumber: form.referenceNumber,
        paidAt,
        dateKey: form.dateKey,
      }, { id: user?.id || '', name: user?.name || 'Principal' });
    } catch (e) {
      console.error('Payment edit failed', { paymentId: payment.id, error: e });
      showToast(describeWriteError(e, EDIT_PERMISSION_MESSAGE), 'error');
      setSaving(false);
      return;
    }
    // Edit IS committed from here on — a refetch failure must not read as
    // "NOT saved" (retrying would re-apply the edit and write extra history).
    const refreshed = await refreshAfterWrite(onSaved);
    showToast(
      refreshed ? 'Payment updated!' : refreshFailedMessage('Payment updated'),
      refreshed ? 'success' : 'warning',
    );
    setSaving(false);
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title={`Edit Payment — ${payment.studentName}`} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-variant)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
          {payment.receiptNumber} • {payment.className}
          {payment.sectionName ? ` — ${payment.sectionName}` : ''} • Every edit is recorded in the payment history.
        </div>

        <div className="grid-2">
          <Input label="Collection Date" type="date" max={todayKey} value={form.dateKey}
            onChange={e => setForm(p => ({ ...p, dateKey: e.target.value }))} />
          <Select label="Category" options={categoryOptions} value={form.category}
            onChange={e => handleCategoryChange(e.target.value)} />
        </div>
        <div className="grid-2">
          <Input label="Amount (₹)" type="number" required value={form.amount}
            onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
          <Select label="Payment Mode"
            options={[{ value: 'cash', label: 'Cash' }, { value: 'upi', label: 'UPI' }, { value: 'cheque', label: 'Cheque' }, { value: 'bank_transfer', label: 'Bank Transfer' }]}
            value={form.mode} onChange={e => setForm(p => ({ ...p, mode: e.target.value }))} />
        </div>
        <Input label="Reference Number" placeholder="Optional" value={form.referenceNumber}
          onChange={e => setForm(p => ({ ...p, referenceNumber: e.target.value }))} />

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>Save Changes</Button>
        </div>
      </div>
    </Modal>
  );
}
