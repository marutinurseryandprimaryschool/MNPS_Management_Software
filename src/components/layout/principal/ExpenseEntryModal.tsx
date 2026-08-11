'use client';

/* Principal-only expense entry (moved out of the retired Expenses page —
   docs/designs/principal-role-fees-accounts.md D9). Carries the full form
   hardening pack (Addendum issue 8): in-flight submit guard, duplicate
   warning before save, offline surfaced as NOT saved, refetch after write —
   and the writeBatch expense+history audit pairing (issue 5). */

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import Input, { Select, Textarea } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { toDateKey, excludeDeleted, expenseDateKey } from '@/lib/fee-utils';
import type { Expense } from '@/types/models';
import {
  EXPENSE_CATEGORIES, createExpenseWithHistory, describeWriteError,
} from './principal-shared';

interface ExpenseEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  academicYear: string;
  /** Current expense list (any range) — used for the duplicate warning. */
  expenses: Expense[];
  /** Called after a successful save so the parent refetches. */
  onSaved: () => Promise<void> | void;
}

interface ExpenseForm {
  amount: string;
  dateKey: string;
  category: string;
  paymentMode: 'cash' | 'bank';
  description: string;
}

const emptyForm = (): ExpenseForm => ({
  amount: '',
  dateKey: toDateKey(new Date()),
  category: EXPENSE_CATEGORIES[0],
  paymentMode: 'cash',
  description: '',
});

export default function ExpenseEntryModal({
  isOpen, onClose, academicYear, expenses, onSaved,
}: ExpenseEntryModalProps) {
  const { user, role } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState<ExpenseForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);

  const setField = <K extends keyof ExpenseForm>(key: K, value: ExpenseForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setDuplicateAcknowledged(false);
  };

  const findDuplicate = (): Expense | undefined => {
    const amount = Number(form.amount);
    return excludeDeleted(expenses).find(e =>
      (Number(e.amount) || 0) === amount && expenseDateKey(e) === form.dateKey,
    );
  };

  const handleSave = async () => {
    if (saving) return; // in-flight guard
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
    if (!form.dateKey) { showToast('Pick a date', 'error'); return; }
    if (form.paymentMode !== 'cash' && form.paymentMode !== 'bank') {
      showToast('Choose how it was paid — cash or bank', 'error');
      return;
    }
    if (!form.description.trim()) { showToast('Add a short description', 'error'); return; }

    const duplicate = findDuplicate();
    if (duplicate && !duplicateAcknowledged) {
      setDuplicateAcknowledged(true);
      showToast(
        `An expense of the same amount is already recorded on ${form.dateKey} (${duplicate.category}). Tap Save again to record anyway.`,
        'warning',
      );
      return;
    }

    setSaving(true);
    try {
      await createExpenseWithHistory({
        amount,
        category: form.category,
        description: form.description.trim(),
        dateKey: form.dateKey,
        paymentMode: form.paymentMode,
        academicYear,
      }, { id: user?.id || '', name: user?.name || 'Principal', role: role || 'principal' });
      showToast('Expense recorded');
      setForm(emptyForm());
      setDuplicateAcknowledged(false);
      onClose();
      await onSaved();
    } catch (e) {
      console.error('Expense save failed', { form, error: e });
      showToast(describeWriteError(e, 'add expenses', 'The expense'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    setDuplicateAcknowledged(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Expense" size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <Input
            label="Amount (₹)"
            type="number"
            min={0}
            value={form.amount}
            onChange={e => setField('amount', e.target.value)}
          />
          <Input
            label="Date"
            type="date"
            value={form.dateKey}
            max={toDateKey(new Date())}
            onChange={e => setField('dateKey', e.target.value)}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <Select
            label="Category"
            value={form.category}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setField('category', e.target.value)}
            options={EXPENSE_CATEGORIES.map(c => ({ value: c, label: c }))}
          />
          <Select
            label="Paid from"
            value={form.paymentMode}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setField('paymentMode', e.target.value === 'bank' ? 'bank' : 'cash')}
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'bank', label: 'Bank' },
            ]}
          />
        </div>
        <Textarea
          label="Description"
          rows={2}
          placeholder="e.g. Chalk boxes, June electricity bill"
          value={form.description}
          onChange={e => setField('description', e.target.value)}
        />
        {duplicateAcknowledged && (
          <div style={{
            padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
            background: 'var(--color-warning-bg)', color: 'var(--color-warning)',
            fontSize: '0.85rem', fontWeight: 500,
          }}>
            Same amount already recorded on this date — press Save again to confirm this is a separate expense.
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {duplicateAcknowledged ? 'Save Anyway' : 'Save Expense'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
