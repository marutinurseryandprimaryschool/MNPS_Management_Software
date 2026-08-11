'use client';
/* Per-student fee adjustment (scholarship / custom fee) — gated by
   `manageScholarships`. Writes Student.feeAdjustment; the fee engine
   pro-rates the override across terms + ECA + additional fees. */

import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { StudentsService } from '@/lib/firestore-service';
import {
  describeWriteError, isBrowserOffline, OFFLINE_NOT_SAVED_MESSAGE,
  refreshAfterWrite, refreshFailedMessage,
} from './error-policy';
import type { FeeStructure, Student } from '@/types/models';

const ADJUST_PERMISSION_MESSAGE =
  'Only admin, principal, or correspondent can adjust student fees.';

interface FeeAdjustModalProps {
  student: Student | null;
  structures: FeeStructure[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export default function FeeAdjustModal({ student, structures, onClose, onSaved }: FeeAdjustModalProps) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ amount: '', reason: '' });
  const [saving, setSaving] = useState(false);

  const structure = student ? structures.find(s => s.classId === student.classId) : null;
  const structureAmount = structure?.totalAmount ?? 0;

  useEffect(() => {
    if (!student) return;
    const current = typeof student.feeAdjustment?.amount === 'number'
      ? student.feeAdjustment.amount
      : structureAmount;
    setForm({ amount: String(current), reason: student.feeAdjustment?.reason || '' });
    // structureAmount is derived from the student's class — student is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student]);

  const handleSave = async () => {
    if (!student || saving) return;
    const parsed = Number(form.amount);
    if (!Number.isFinite(parsed) || parsed < 0) { showToast('Enter a valid amount', 'warning'); return; }
    if (isBrowserOffline()) { showToast(OFFLINE_NOT_SAVED_MESSAGE, 'error'); return; }
    setSaving(true);
    // Amount equal to the class structure with no reason = no override.
    const shouldClear = parsed === structureAmount && !form.reason.trim();
    try {
      const updates: Record<string, unknown> = shouldClear
        ? { feeAdjustment: null }
        : { feeAdjustment: { amount: parsed, reason: form.reason.trim() || null } };
      await StudentsService.update(student.id, updates);
    } catch (e) {
      console.error('Fee adjustment save failed', { studentId: student.id, error: e });
      showToast(describeWriteError(e, ADJUST_PERMISSION_MESSAGE), 'error');
      setSaving(false);
      return;
    }
    // Adjustment IS committed — a refetch failure must not read as "not saved".
    const savedMessage = shouldClear ? 'Fee adjustment removed' : 'Fee updated';
    const refreshed = await refreshAfterWrite(onSaved);
    showToast(
      refreshed ? savedMessage : refreshFailedMessage(savedMessage),
      refreshed ? 'success' : 'warning',
    );
    setSaving(false);
    onClose();
  };

  const handleReset = async () => {
    if (!student || saving) return;
    if (isBrowserOffline()) { showToast(OFFLINE_NOT_SAVED_MESSAGE, 'error'); return; }
    setSaving(true);
    try {
      await StudentsService.update(student.id, { feeAdjustment: null });
    } catch (e) {
      console.error('Fee adjustment reset failed', { studentId: student.id, error: e });
      showToast(describeWriteError(e, ADJUST_PERMISSION_MESSAGE), 'error');
      setSaving(false);
      return;
    }
    // Reset IS committed — a refetch failure must not read as "not saved".
    const refreshed = await refreshAfterWrite(onSaved);
    showToast(
      refreshed ? 'Fee reset to class default' : refreshFailedMessage('Fee reset to class default'),
      refreshed ? 'success' : 'warning',
    );
    setSaving(false);
    onClose();
  };

  return (
    <Modal isOpen={!!student} onClose={onClose} title={student ? `Adjust Fee — ${student.name}` : ''} size="md">
      {student && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ padding: 'var(--space-3) var(--space-4)', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: '#0369A1', lineHeight: 1.5 }}>
            Use this for scholarship students or any student whose class fee
            differs from the standard structure. The override is spread
            proportionally across terms, ECA months, and additional fees.
            Bus fees stay unchanged (they follow the assigned route).
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div style={{ padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-variant)' }}>
              <div className="text-caption" style={{ color: 'var(--color-text-tertiary)', marginBottom: 2 }}>Class default</div>
              <div style={{ fontWeight: 700 }}>₹{structureAmount.toLocaleString()}</div>
            </div>
            <div style={{ padding: 'var(--space-3)', border: '1px solid var(--color-primary-300)', borderRadius: 'var(--radius-md)', background: 'var(--color-primary-50)' }}>
              <div className="text-caption" style={{ color: 'var(--color-primary-700)', marginBottom: 2 }}>This student pays</div>
              <div style={{ fontWeight: 700, color: 'var(--color-primary-700)' }}>
                ₹{(Number(form.amount) || 0).toLocaleString()}
              </div>
            </div>
          </div>

          <Input label="Custom class fee (₹)" type="number" min={0} value={form.amount}
            onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
          <Input label="Reason (optional)" placeholder="e.g. Scholarship, Sibling discount" value={form.reason}
            onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} />

          <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={handleReset} disabled={saving || !student.feeAdjustment}>
              Reset to default
            </Button>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} loading={saving}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
