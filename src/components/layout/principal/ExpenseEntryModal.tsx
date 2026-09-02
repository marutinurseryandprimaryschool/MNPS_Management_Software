'use client';

/* Principal-only expense entry for the standalone register
   (principalExpenses — never the legacy `expenses` collection).

   Form hardening kept from the previous module: in-flight submit guard,
   duplicate warning before saving, offline surfaced as NOT saved, refetch
   after the write. The expense and its audit entry are committed in one
   writeBatch by PrincipalExpensesService. */

import React, { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import Input, { Select, Textarea } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { PrincipalDayCloseService, PrincipalExpensesService } from '@/lib/principal-service';
import {
  DEFAULT_EXPENSE_CATEGORIES, PRINCIPAL_MODE_OPTIONS, asPrincipalMode, formatINR,
  principalWriteError, refreshFailedMessage, todayKey, usePrincipalActor,
} from './principal-shared';
import type { PrincipalExpense, PrincipalPaymentMode } from '@/types/principal';

interface ExpenseEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  academicYear: string;
  /** From principalSettings; falls back to the built-in list when empty. */
  categories: readonly string[];
  /** The year's live expenses — used only for the duplicate warning. */
  expenses: PrincipalExpense[];
  /** Refetch after a COMMITTED write. */
  onSaved: () => Promise<void>;
}

interface ExpenseForm {
  amount: string;
  dateKey: string;
  category: string;
  mode: PrincipalPaymentMode;
  /** Person / vendor the money went to (optional). */
  paidTo: string;
  description: string;
}

const emptyForm = (category: string): ExpenseForm => ({
  amount: '',
  dateKey: todayKey(),
  category,
  mode: 'cash',
  paidTo: '',
  description: '',
});

export default function ExpenseEntryModal({
  isOpen, onClose, academicYear, categories, expenses, onSaved,
}: ExpenseEntryModalProps) {
  const { showToast } = useToast();
  const actor = usePrincipalActor();

  const options = categories.length > 0 ? categories : DEFAULT_EXPENSE_CATEGORIES;
  const [form, setForm] = useState<ExpenseForm>(() => emptyForm(options[0]));
  const [saving, setSaving] = useState(false);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);

  /** Every exit path clears the form, so reopening always starts clean. */
  const resetForm = () => {
    setForm(emptyForm(options[0]));
    setDuplicateAcknowledged(false);
  };

  const setField = <K extends keyof ExpenseForm>(key: K, value: ExpenseForm[K]) => {
    setForm(previous => ({ ...previous, [key]: value }));
    setDuplicateAcknowledged(false); // any edit re-arms the duplicate check
  };

  const findDuplicate = (amount: number): PrincipalExpense | undefined =>
    expenses.find(expense =>
      !expense.deleted
      && (Number(expense.amount) || 0) === amount
      && expense.dateKey === form.dateKey);

  const handleSave = async () => {
    if (saving) return; // in-flight guard
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
    if (!form.dateKey) { showToast('Pick a date', 'error'); return; }
    if (!form.category) { showToast('Choose a category', 'error'); return; }
    if (!form.description.trim()) { showToast('Add a short description', 'error'); return; }

    const duplicate = findDuplicate(Math.round(amount));
    if (duplicate && !duplicateAcknowledged) {
      setDuplicateAcknowledged(true);
      showToast(
        `${formatINR(amount)} is already recorded on ${form.dateKey} (${duplicate.category}). Tap Save again to record it anyway.`,
        'warning',
      );
      return;
    }

    setSaving(true);

    // Closed-day guard (§18): a closed date rejects new expenses server-side
    // anyway — checking first turns a permission error into a sentence.
    try {
      const dayClose = await PrincipalDayCloseService.get(form.dateKey);
      if (dayClose?.status === 'closed') {
        showToast(
          `${form.dateKey} is closed in the day-close book. Reopen it from Accounts → Daily to record corrections.`,
          'error',
        );
        setSaving(false);
        return;
      }
    } catch {
      // Could not read the day-close record — firestore.rules still enforce it.
    }

    try {
      await PrincipalExpensesService.create({
        academicYear,
        amount: Math.round(amount),
        category: form.category,
        paidTo: form.paidTo.trim() || undefined,
        description: form.description.trim(),
        dateKey: form.dateKey,
        mode: form.mode,
      }, actor);
    } catch (error) {
      console.error('Expense save failed', { form, error });
      showToast(principalWriteError(error, 'Only the Principal can record expenses.'), 'error');
      setSaving(false);
      return;
    }

    // Committed — from here on nothing may read as "not saved".
    resetForm();
    onClose();
    try {
      await onSaved();
      showToast('Expense recorded');
    } catch (error) {
      console.error('Post-save refresh failed', error);
      showToast(refreshFailedMessage('Expense recorded'), 'warning');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    resetForm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Expense" size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)' }}>
          <Input
            label="Amount (₹)"
            type="number"
            min={0}
            inputMode="numeric"
            value={form.amount}
            onChange={e => setField('amount', e.target.value)}
          />
          <Input
            label="Date"
            type="date"
            value={form.dateKey}
            max={todayKey()}
            onChange={e => setField('dateKey', e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)' }}>
          <Select
            label="Category"
            value={form.category}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setField('category', e.target.value)}
            options={options.map(category => ({ value: category, label: category }))}
          />
          <Select
            label="Paid from"
            value={form.mode}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setField('mode', asPrincipalMode(e.target.value))}
            options={PRINCIPAL_MODE_OPTIONS}
          />
        </div>

        <Input
          label="Paid to (person / vendor, optional)"
          placeholder="e.g. John, ABC Stores"
          value={form.paidTo}
          onChange={e => setField('paidTo', e.target.value)}
        />

        <Textarea
          label="Description"
          rows={2}
          placeholder="e.g. Emergency staff payment, June electricity bill"
          value={form.description}
          onChange={e => setField('description', e.target.value)}
        />

        {duplicateAcknowledged && (
          <div style={{
            padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
            background: 'var(--color-warning-bg)', color: 'var(--color-warning)',
            fontSize: '0.85rem', fontWeight: 500,
          }}>
            The same amount is already recorded on this date — press Save again to confirm this is a
            separate expense.
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
