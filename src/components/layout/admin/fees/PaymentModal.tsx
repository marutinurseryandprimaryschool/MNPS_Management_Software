'use client';
/* Principal payment entry modal — gated by `enterFeePayments`.
   - Collection-date picker (default today) → paidAt + dateKey.
   - Category dropdown built from engine buckets with pending-slice autofill.
   - Hardening pack: in-flight guard, duplicate same-student+amount+dateKey
     warning, offline surfaced as NOT saved, post-write refetch via onSaved.
   - Payment + 'created' history entry written in ONE writeBatch. */

import React, { useMemo, useState } from 'react';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input, { Select } from '@/components/ui/Input';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { paymentDateKey, toDateKey, type StudentFeeSummary } from '@/lib/fee-utils';
import { buildCategoryOptions, pendingAmountFor } from './category-options';
import { recordPaymentWithHistory } from './payment-mutations';
import {
  describeWriteError, isBrowserOffline, OFFLINE_NOT_SAVED_MESSAGE,
  refreshAfterWrite, refreshFailedMessage,
} from './error-policy';
import FeeStatusPanel from './FeeStatusPanel';
import type { Class, FeePayment, Student } from '@/types/models';

const PAYMENT_PERMISSION_MESSAGE = 'Only the Principal can record fee payments.';

interface PaymentFormState {
  classId: string;
  studentId: string;
  dateKey: string;
  category: string;
  amount: string;
  mode: string;
  referenceNumber: string;
}

const emptyForm = (): PaymentFormState => ({
  classId: '', studentId: '', dateKey: toDateKey(new Date()),
  category: '', amount: '', mode: 'cash', referenceNumber: '',
});

interface PaymentModalProps {
  isOpen: boolean;
  classes: Class[];
  students: Student[];
  /** All payments (incl. deleted) — used for the duplicate-entry check. */
  payments: FeePayment[];
  getSummary: (studentId: string) => StudentFeeSummary | null;
  initialStudent?: Student | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export default function PaymentModal(props: PaymentModalProps) {
  if (!props.isOpen) return null;
  // Mounted only while open, keyed by the launch student: every open (and any
  // initial-student switch) remounts the form with fresh initial state, so no
  // reset-in-effect is needed.
  return <PaymentModalInner key={props.initialStudent?.id || 'new'} {...props} />;
}

function PaymentModalInner({
  isOpen, classes, students, payments, getSummary, initialStudent, onClose, onSaved,
}: PaymentModalProps) {
  const { user } = useAuth();
  const { school } = useSchool();
  const { showToast } = useToast();
  const [form, setForm] = useState<PaymentFormState>(() => ({
    ...emptyForm(),
    classId: initialStudent?.classId || '',
    studentId: initialStudent?.id || '',
  }));
  const [saving, setSaving] = useState(false);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);

  const todayKey = toDateKey(new Date());
  const filteredStudents = form.classId ? students.filter(s => s.classId === form.classId) : students;
  const selectedStudent = students.find(s => s.id === form.studentId) || null;
  const summary = form.studentId ? getSummary(form.studentId) : null;
  const categoryOptions = useMemo(() => buildCategoryOptions(summary), [summary]);

  const handleCategoryChange = (category: string) => {
    const pending = pendingAmountFor(summary, category);
    setForm(p => ({
      ...p,
      category,
      amount: pending !== null && pending > 0 ? String(pending) : p.amount,
    }));
  };

  const validate = (): string | null => {
    if (!form.studentId) return 'Select a student';
    const amount = parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) return 'Enter a valid amount';
    if (!form.dateKey) return 'Pick a collection date';
    if (form.dateKey > todayKey) return 'Collection date cannot be in the future';
    return null;
  };

  const isDuplicate = (): boolean => {
    const amount = parseFloat(form.amount);
    return payments.some(p =>
      p.deleted !== true &&
      p.studentId === form.studentId &&
      Number(p.amount) === amount &&
      paymentDateKey(p) === form.dateKey,
    );
  };

  const doSave = async () => {
    if (saving) return;
    if (isBrowserOffline()) { showToast(OFFLINE_NOT_SAVED_MESSAGE, 'error'); return; }
    const cls = classes.find(c => c.id === (selectedStudent?.classId || form.classId));
    // Same-day entries keep the real time; backdated entries anchor at noon
    // so the local dateKey never drifts across a timezone boundary.
    const paidAt = form.dateKey === todayKey ? new Date() : new Date(`${form.dateKey}T12:00:00`);
    setSaving(true);
    try {
      await recordPaymentWithHistory({
        type: 'payment',
        studentId: form.studentId,
        studentName: selectedStudent?.name || '',
        classId: selectedStudent?.classId || form.classId,
        className: cls?.name || selectedStudent?.className || '',
        sectionId: selectedStudent?.sectionId || '',
        sectionName: selectedStudent?.sectionName || '',
        amount: parseFloat(form.amount),
        mode: form.mode,
        category: form.category || 'Other',
        referenceNumber: form.referenceNumber,
        receiptNumber: `RCP-${Date.now().toString(36).toUpperCase()}`,
        collectedBy: user?.id || '',
        collectedByName: user?.name || 'Principal',
        collectedByEmail: user?.email || '',
        paidAt,
        dateKey: form.dateKey,
        academicYear: school?.academicYear || '',
      }, { id: user?.id || '', name: user?.name || 'Principal' });
    } catch (e) {
      console.error('Payment save failed', { studentId: form.studentId, dateKey: form.dateKey, error: e });
      showToast(describeWriteError(e, PAYMENT_PERMISSION_MESSAGE), 'error');
      setSaving(false);
      return;
    }
    // Payment IS committed from here on. A refetch failure must never read as
    // "NOT saved" — the stale list would also defeat the duplicate check, so
    // a retry would silently record a second real payment.
    const refreshed = await refreshAfterWrite(onSaved);
    showToast(
      refreshed ? 'Payment recorded!' : refreshFailedMessage('Payment saved'),
      refreshed ? 'success' : 'warning',
    );
    setForm(emptyForm());
    setSaving(false);
    onClose();
  };

  const handleSaveClick = () => {
    const error = validate();
    if (error) { showToast(error, 'warning'); return; }
    if (isDuplicate()) { setShowDuplicateConfirm(true); return; }
    void doSave();
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Record Payment" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Select label="Class" options={[{ value: '', label: 'All Classes' }, ...classes.map(c => ({ value: c.id, label: c.name }))]}
            value={form.classId} onChange={e => setForm(p => ({ ...p, classId: e.target.value, studentId: '', category: '', amount: '' }))} />

          <SearchableSelect label="Student" placeholder="Search student by name..."
            options={filteredStudents.map(s => ({ value: s.id, label: `${s.name}${s.admissionNumber ? ' (' + s.admissionNumber + ')' : ''}` }))}
            value={form.studentId} onChange={val => {
              const st = students.find(s => s.id === val);
              setForm(p => ({ ...p, studentId: val, classId: st?.classId || p.classId, category: '', amount: '' }));
            }} />

          {summary && <FeeStatusPanel summary={summary} />}

          <div className="grid-2">
            <Input label="Collection Date" type="date" max={todayKey} value={form.dateKey}
              onChange={e => setForm(p => ({ ...p, dateKey: e.target.value }))}
              hint={form.dateKey !== todayKey ? 'Backdated entry — recorded in the audit trail' : undefined} />
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
            <Button variant="primary" onClick={handleSaveClick} loading={saving}>Record Payment</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showDuplicateConfirm}
        onClose={() => setShowDuplicateConfirm(false)}
        onConfirm={() => { setShowDuplicateConfirm(false); void doSave(); }}
        title="Possible duplicate"
        message={`A payment of ₹${(parseFloat(form.amount) || 0).toLocaleString()} for ${selectedStudent?.name || 'this student'} on ${form.dateKey} already exists. Save anyway?`}
        confirmLabel="Save anyway"
        cancelLabel="Cancel"
        variant="primary"
      />
    </>
  );
}
