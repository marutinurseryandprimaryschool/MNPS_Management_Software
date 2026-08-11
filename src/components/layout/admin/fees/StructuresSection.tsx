'use client';
/* Fee structures grid — gated by `manageFeeStructures`. Shows term due
   dates and nudges when they are unset (defaulter tracking needs them). */

import React from 'react';
import { EditIcon, TrashIcon } from '@/components/ui/Icons';
import { ACADEMIC_MONTHS } from '@/lib/fee-utils';
import type { FeeStructure } from '@/types/models';

interface StructuresSectionProps {
  feeStructures: FeeStructure[];
  onEdit: (fs: FeeStructure) => void;
  onDelete: (fs: FeeStructure) => void;
}

/** True when the structure has a charged term with no due date set. */
export function structureMissingDueDates(fs: FeeStructure): boolean {
  return (fs.terms || []).some(t => (Number(t.amount) || 0) > 0 && !fs.termDueDates?.[t.name]);
}

const formatDueDate = (key: string | undefined): string | null => {
  if (!key) return null;
  const d = new Date(`${key}T12:00:00`);
  return isNaN(d.getTime()) ? key : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function StructuresSection({ feeStructures, onEdit, onDelete }: StructuresSectionProps) {
  const missingCount = feeStructures.filter(structureMissingDueDates).length;

  if (feeStructures.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
        <p className="text-body" style={{ fontWeight: 500 }}>No fee structures defined</p>
        <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Click &quot;Fee Structure&quot; to set up class-wise term fees.</p>
      </div>
    );
  }

  return (
    <div>
      {missingCount > 0 && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: '#92400E', marginBottom: 'var(--space-4)' }}>
          Defaulter tracking starts when term due dates are set — {missingCount} structure{missingCount !== 1 ? 's are' : ' is'} missing due dates.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 'var(--space-4)' }}>
        {feeStructures.map(fs => {
          const terms = fs.terms || [];
          const ecaMonthCount = (fs.ecaMonths && fs.ecaMonths.length > 0 ? fs.ecaMonths : ACADEMIC_MONTHS).length;
          return (
            <div key={fs.id} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4)', background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <h3 className="text-h3" style={{ margin: 0 }}>{fs.className}</h3>
                  <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>{fs.academicYear}</span>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                  <button onClick={() => onEdit(fs)} style={{ padding: 6, background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-primary-500)', display: 'flex' }}><EditIcon size={14} /></button>
                  <button onClick={() => onDelete(fs)} style={{ padding: 6, background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-error)', display: 'flex' }}><TrashIcon size={14} /></button>
                </div>
              </div>
              <div style={{ padding: 'var(--space-3) var(--space-4)' }}>
                {terms.map((t, i) => {
                  const due = formatDueDate(fs.termDueDates?.[t.name]);
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-divider)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="text-body-sm" style={{ fontWeight: 500 }}>{t.name}</span>
                        <span className="text-caption" style={{ color: due ? 'var(--color-text-tertiary)' : '#B45309', fontSize: '0.68rem' }}>
                          {due ? `Due ${due}` : (Number(t.amount) || 0) > 0 ? 'No due date set' : ''}
                        </span>
                      </div>
                      <span className="text-body-sm" style={{ fontWeight: 600 }}>₹{t.amount.toLocaleString()}</span>
                    </div>
                  );
                })}
                {fs.extracurricular > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-divider)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className="text-body-sm" style={{ fontWeight: 500, color: '#7C3AED' }}>ECA (monthly)</span>
                      <span className="text-caption" style={{ color: 'var(--color-text-tertiary)', fontSize: '0.68rem' }}>Split over {ecaMonthCount} months</span>
                    </div>
                    <span className="text-body-sm" style={{ fontWeight: 600, color: '#7C3AED' }}>₹{fs.extracurricular.toLocaleString()}</span>
                  </div>
                )}
                {fs.busFee > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-divider)' }}>
                    <span className="text-body-sm" style={{ fontWeight: 500, color: '#0EA5E9' }}>Standard Bus Fee</span>
                    <span className="text-body-sm" style={{ fontWeight: 600, color: '#0EA5E9' }}>₹{fs.busFee.toLocaleString()}</span>
                  </div>
                )}
                {(fs.additionalFees || []).map((a, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-divider)' }}>
                    <span className="text-body-sm" style={{ fontWeight: 500, color: '#D97706' }}>{a.name}</span>
                    <span className="text-body-sm" style={{ fontWeight: 600, color: '#D97706' }}>₹{a.amount.toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginTop: 4 }}>
                  <span className="text-body" style={{ fontWeight: 700 }}>Total</span>
                  <span className="text-body" style={{ fontWeight: 700, color: '#059669' }}>₹{(fs.totalAmount || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
