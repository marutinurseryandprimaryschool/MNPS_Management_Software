'use client';
/* Add/Edit fee structure modal — gated by `manageFeeStructures`.
   Adds ecaMonths multi-select (default June–March) and per-term due-date
   inputs; nudges when term due dates are unset (defaulter tracking starts
   only once due dates exist). */

import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input, { Select } from '@/components/ui/Input';
import { TrashIcon } from '@/components/ui/Icons';
import { useToast } from '@/components/ui/Toast';
import { FeeStructuresService } from '@/lib/firestore-service';
import { ACADEMIC_MONTHS, academicMonthOrder } from '@/lib/fee-utils';
import {
  describeWriteError, isBrowserOffline, OFFLINE_NOT_SAVED_MESSAGE,
  refreshAfterWrite, refreshFailedMessage,
} from './error-policy';
import type { Class, FeeStructure } from '@/types/models';

const TERM_NAMES = ['Term 1', 'Term 2', 'Term 3'] as const;
/** Bus months may include the summer trailer months (spec: any calendar month). */
const BUS_MONTH_CHOICES = [...ACADEMIC_MONTHS, 'April', 'May'];
const STRUCTURE_PERMISSION_MESSAGE =
  'Only admin, principal, or correspondent can manage fee structures.';

interface StructureFormState {
  classId: string;
  termAmounts: string[];             // aligned with TERM_NAMES
  termDueDates: string[];            // 'yyyy-MM-dd' or '' — aligned with TERM_NAMES
  extracurricular: string;
  ecaMonths: string[];
  includeBusFee: boolean;
  busMonths: string[];
  additionalFees: { name: string; amount: string }[];
}

const emptyForm = (): StructureFormState => ({
  classId: '',
  termAmounts: ['', '', ''],
  termDueDates: ['', '', ''],
  extracurricular: '',
  ecaMonths: [...ACADEMIC_MONTHS],
  includeBusFee: false,
  busMonths: [...ACADEMIC_MONTHS],
  additionalFees: [],
});

const formFromStructure = (fs: FeeStructure): StructureFormState => ({
  classId: fs.classId,
  termAmounts: TERM_NAMES.map((_, i) => String(fs.terms?.[i]?.amount || '')),
  termDueDates: TERM_NAMES.map(name => fs.termDueDates?.[name] || ''),
  extracurricular: String(fs.extracurricular || ''),
  ecaMonths: fs.ecaMonths && fs.ecaMonths.length > 0 ? [...fs.ecaMonths] : [...ACADEMIC_MONTHS],
  includeBusFee: fs.includeBusFee ?? ((Number(fs.busFee) || 0) > 0),
  busMonths: fs.busMonths && fs.busMonths.length > 0 ? [...fs.busMonths] : [...ACADEMIC_MONTHS],
  additionalFees: (fs.additionalFees || []).map(a => ({ name: a.name, amount: String(a.amount) })),
});

const sortMonths = (months: string[]): string[] =>
  [...months].sort((a, b) => academicMonthOrder(a) - academicMonthOrder(b));

/* Reserved category names: the payment allocator matches buckets by category
   string, so an additional fee named like a built-in bucket (or a month-tagged
   prefix) would swallow payments meant for that bucket. */
const RESERVED_FEE_NAMES = new Set([
  'previous balance', 'extracurricular', 'other',
  ...TERM_NAMES.map(n => n.toLowerCase()),
]);
const isReservedFeeName = (name: string): boolean => {
  const n = name.trim().toLowerCase();
  return RESERVED_FEE_NAMES.has(n) || n.startsWith('eca - ') || n.startsWith('bus fee - ');
};

interface StructureModalProps {
  isOpen: boolean;
  editing: FeeStructure | null;
  classes: Class[];
  academicYear: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export default function StructureModal(props: StructureModalProps) {
  if (!props.isOpen) return null;
  // Mounted only while open, keyed by the structure being edited: every open
  // (add ↔ edit switches included) remounts the form with fresh initial
  // state, so no reset-in-effect is needed.
  return <StructureModalInner key={props.editing?.id || 'new'} {...props} />;
}

function StructureModalInner({
  isOpen, editing, classes, academicYear, onClose, onSaved,
}: StructureModalProps) {
  const { showToast } = useToast();
  const [form, setForm] = useState<StructureFormState>(
    () => (editing ? formFromStructure(editing) : emptyForm()),
  );
  const [saving, setSaving] = useState(false);

  const parsedTerms = form.termAmounts.map(v => parseFloat(v) || 0);
  const ecaAmount = parseFloat(form.extracurricular) || 0;
  const additionalTotal = form.additionalFees.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
  const total = parsedTerms.reduce((s, v) => s + v, 0) + ecaAmount + additionalTotal;
  const missingDueDates = TERM_NAMES.some((_, i) => parsedTerms[i] > 0 && !form.termDueDates[i]);
  const ecaSlice = ecaAmount > 0 && form.ecaMonths.length > 0
    ? Math.round(ecaAmount / form.ecaMonths.length)
    : 0;

  const setTermAmount = (i: number, value: string) => {
    setForm(p => ({ ...p, termAmounts: p.termAmounts.map((v, idx) => (idx === i ? value : v)) }));
  };
  const setTermDueDate = (i: number, value: string) => {
    setForm(p => ({ ...p, termDueDates: p.termDueDates.map((v, idx) => (idx === i ? value : v)) }));
  };
  const toggleMonth = (field: 'ecaMonths' | 'busMonths', month: string) => {
    setForm(p => ({
      ...p,
      [field]: p[field].includes(month)
        ? p[field].filter(m => m !== month)
        : [...p[field], month],
    }));
  };

  const handleSave = async () => {
    if (saving) return;
    if (!form.classId) { showToast('Select a class', 'warning'); return; }
    if (isBrowserOffline()) { showToast(OFFLINE_NOT_SAVED_MESSAGE, 'error'); return; }
    const cls = classes.find(c => c.id === form.classId);
    const additional = form.additionalFees
      .filter(a => a.name.trim())
      .map(a => ({ name: a.name.trim(), amount: parseFloat(a.amount) || 0 }));
    const reserved = additional.find(a => isReservedFeeName(a.name));
    if (reserved) {
      showToast(`"${reserved.name}" is a reserved fee name — please pick a different name`, 'warning');
      return;
    }
    const lowerNames = additional.map(a => a.name.toLowerCase());
    if (lowerNames.some((n, i) => lowerNames.indexOf(n) !== i)) {
      showToast('Two additional fees share the same name — names must be unique', 'warning');
      return;
    }
    const termDueDates: Record<string, string> = {};
    TERM_NAMES.forEach((name, i) => {
      if (form.termDueDates[i]) termDueDates[name] = form.termDueDates[i];
    });
    const payload = {
      classId: form.classId,
      className: cls?.name || '',
      academicYear,
      terms: TERM_NAMES.map((name, i) => ({ name, amount: parsedTerms[i] })),
      termDueDates,
      extracurricular: ecaAmount,
      ecaMonths: sortMonths(form.ecaMonths),
      additionalFees: additional,
      busFee: 0, // Bus fee comes from the student's assigned route
      includeBusFee: form.includeBusFee,
      busMonths: sortMonths(form.busMonths),
      totalAmount: total,
    };
    setSaving(true);
    try {
      if (editing?.id) await FeeStructuresService.update(editing.id, payload);
      else await FeeStructuresService.create(payload);
    } catch (e) {
      console.error('Fee structure save failed', { classId: form.classId, error: e });
      showToast(describeWriteError(e, STRUCTURE_PERMISSION_MESSAGE), 'error');
      setSaving(false);
      return;
    }
    // Structure IS committed — a refetch failure must not read as "not saved".
    const refreshed = await refreshAfterWrite(onSaved);
    showToast(
      refreshed
        ? (editing ? 'Fee structure updated!' : 'Fee structure created!')
        : refreshFailedMessage('Fee structure saved'),
      refreshed ? 'success' : 'warning',
    );
    setSaving(false);
    onClose();
  };

  const monthGrid = (field: 'ecaMonths' | 'busMonths', choices: string[]) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {choices.map(month => (
        <label key={month} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--color-surface-variant)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form[field].includes(month)}
            onChange={() => toggleMonth(field, month)}
          />
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{month}</span>
        </label>
      ))}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? 'Edit Fee Structure' : 'Add Fee Structure'} size="xl">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {missingDueDates && (
          <div style={{ padding: 'var(--space-3) var(--space-4)', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: '#92400E' }}>
            Defaulter tracking starts when term due dates are set. Terms without a due date are never counted as overdue.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
          {/* Left column: academic fees */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Select label="Class" options={[{ value: '', label: 'Select Class' }, ...classes.map(c => ({ value: c.id, label: c.name }))]}
              value={form.classId} onChange={e => setForm(p => ({ ...p, classId: e.target.value }))} />

            <div style={{ padding: 'var(--space-3) var(--space-4)', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 'var(--radius-md)' }}>
              <span className="text-caption" style={{ color: '#0369A1', fontWeight: 600 }}>Academic Fees (per year)</span>
            </div>

            {TERM_NAMES.map((name, i) => (
              <div key={name} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <Input label={`${name} (₹)`} type="number" placeholder="5000"
                  value={form.termAmounts[i]} onChange={e => setTermAmount(i, e.target.value)} />
                <Input label={`${name} due date`} type="date"
                  value={form.termDueDates[i]} onChange={e => setTermDueDate(i, e.target.value)} />
              </div>
            ))}

            <Input label="Extracurricular Fee (₹, annual)" type="number" placeholder="2000"
              value={form.extracurricular} onChange={e => setForm(p => ({ ...p, extracurricular: e.target.value }))} />

            {ecaAmount > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <label className="text-caption" style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>ECA MONTHS</label>
                  <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
                    {form.ecaMonths.length > 0 ? `≈ ₹${ecaSlice.toLocaleString()}/month over ${form.ecaMonths.length} months` : 'None selected — defaults to June–March'}
                  </span>
                </div>
                {monthGrid('ecaMonths', [...ACADEMIC_MONTHS])}
              </div>
            )}

            {/* Additional fees */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <span className="text-body-sm" style={{ fontWeight: 600 }}>Additional Fees</span>
                <button onClick={() => setForm(p => ({ ...p, additionalFees: [...p.additionalFees, { name: '', amount: '' }] }))}
                  style={{ padding: '4px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-primary-500)', background: 'var(--color-primary-50)', color: 'var(--color-primary-500)', cursor: 'pointer', font: 'var(--text-caption)', fontWeight: 600 }}>+ Add</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {form.additionalFees.map((af, i) => (
                  <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <Input label={i === 0 ? 'Name' : ''} placeholder="e.g. Diary" value={af.name}
                        onChange={e => setForm(p => ({ ...p, additionalFees: p.additionalFees.map((a, idx) => idx === i ? { ...a, name: e.target.value } : a) }))} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <Input label={i === 0 ? 'Amount (₹)' : ''} type="number" placeholder="200" value={af.amount}
                        onChange={e => setForm(p => ({ ...p, additionalFees: p.additionalFees.map((a, idx) => idx === i ? { ...a, amount: e.target.value } : a) }))} />
                    </div>
                    <button onClick={() => setForm(p => ({ ...p, additionalFees: p.additionalFees.filter((_, idx) => idx !== i) }))}
                      style={{ padding: 8, background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-error)', display: 'flex', marginBottom: 2 }}>
                      <TrashIcon size={14} />
                    </button>
                  </div>
                ))}
                {form.additionalFees.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 'var(--space-4)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-tertiary)', fontSize: '0.8rem' }}>
                    No additional fees added
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column: bus fees */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ padding: 'var(--space-4)', background: form.includeBusFee ? '#F0FDF4' : 'var(--color-surface-variant)', border: `1.5px solid ${form.includeBusFee ? '#86EFAC' : 'var(--color-border)'}`, borderRadius: 'var(--radius-md)' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9rem' }}>Include Bus Fee</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                    {form.includeBusFee
                      ? 'Fees are auto-fetched from student routes, charged per selected month'
                      : 'Enable to apply route-based bus fees'}
                  </div>
                </div>
                <div
                  onClick={() => setForm(p => ({ ...p, includeBusFee: !p.includeBusFee }))}
                  style={{ width: 44, height: 24, borderRadius: 12, flexShrink: 0, background: form.includeBusFee ? '#10B981' : '#D1D5DB', position: 'relative', transition: 'background 0.2s', cursor: 'pointer' }}
                >
                  <div style={{ position: 'absolute', top: 3, left: form.includeBusFee ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                </div>
              </label>
            </div>

            {form.includeBusFee ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <label className="text-caption" style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>ACTIVE BUS MONTHS</label>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button type="button" onClick={() => setForm(p => ({ ...p, busMonths: [...ACADEMIC_MONTHS] }))}
                      style={{ padding: '2px 8px', fontSize: '0.7rem', fontWeight: 600, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>June–March</button>
                    <button type="button" onClick={() => setForm(p => ({ ...p, busMonths: [] }))}
                      style={{ padding: '2px 8px', fontSize: '0.7rem', fontWeight: 600, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>Clear</button>
                  </div>
                </div>
                {monthGrid('busMonths', BUS_MONTH_CHOICES)}
              </div>
            ) : (
              <div style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center', background: 'var(--color-surface-variant)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ opacity: 0.5, marginBottom: 'var(--space-2)' }}>🚌</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-tertiary)' }}>Toggle to configure bus fee schedule for this class</div>
              </div>
            )}
          </div>
        </div>

        {/* Total preview */}
        <div style={{ padding: 'var(--space-3) var(--space-4)', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between' }}>
          <span className="text-body" style={{ fontWeight: 600 }}>Total (excl. bus)</span>
          <span className="text-body" style={{ fontWeight: 700, color: '#059669' }}>₹{total.toLocaleString()}</span>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>{editing ? 'Update' : 'Create'}</Button>
        </div>
      </div>
    </Modal>
  );
}
