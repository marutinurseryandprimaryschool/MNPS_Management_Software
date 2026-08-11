'use client';
/* Class/section drill-down: per-student fee status from the engine
   (scholarship-aware totals, due-now amounts). Pay/adjust affordances are
   capability-gated by the parent. */

import React, { useState } from 'react';
import { Avatar } from '@/components/ui/SharedUI';
import { EditIcon } from '@/components/ui/Icons';
import type { StudentFeeSummary } from '@/lib/fee-utils';
import type { Class, FeeStructure, Scholarship, Student } from '@/types/models';

interface ClassDrilldownProps {
  classId: string;
  sectionId: string | null;
  classes: Class[];
  students: Student[];
  feeStructures: FeeStructure[];
  summaries: Map<string, StudentFeeSummary>;
  scholarships: Scholarship[];
  canEnterPayments: boolean;
  canManageScholarships: boolean;
  onBack: () => void;
  onPay: (student: Student) => void;
  onAdjust: (student: Student) => void;
}

export default function ClassDrilldown({
  classId, sectionId, classes, students, feeStructures, summaries, scholarships,
  canEnterPayments, canManageScholarships, onBack, onPay, onAdjust,
}: ClassDrilldownProps) {
  const [studentSearch, setStudentSearch] = useState('');

  const fs = feeStructures.find(f => f.classId === classId);
  const cls = classes.find(c => c.id === classId);
  const section = cls?.sections.find(s => s.id === sectionId);
  const classStudents = students.filter(s =>
    s.classId === classId && (sectionId ? s.sectionId === sectionId : true));
  const filteredStudents = classStudents.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.admissionNumber?.toLowerCase().includes(studentSearch.toLowerCase()));

  return (
    <div style={{ background: 'var(--color-surface)', minHeight: '80vh', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0', border: '1px solid var(--color-border)', borderBottom: 'none', padding: 'var(--space-6)', marginTop: 'var(--space-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <button onClick={onBack}
          style={{ padding: 'var(--space-2)', background: 'var(--color-surface-variant)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
        </button>
        <div style={{ flex: 1 }}>
          <h2 className="text-h2" style={{ margin: 0 }}>
            {cls?.name || 'Class'}{section ? ` — ${section.name}` : ''} — Student Fee Status
          </h2>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            {classStudents.length} Students{fs ? ` • Structure: ₹${(fs.totalAmount || 0).toLocaleString()}` : ''}
          </p>
        </div>
        <div style={{ position: 'relative', width: 250 }}>
          <input
            type="text" placeholder="Search student..." value={studentSearch}
            onChange={e => setStudentSearch(e.target.value)}
            style={{ width: '100%', padding: '10px 16px', paddingLeft: 40, borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)', fontSize: '0.9rem', outline: 'none' }}
          />
          <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        </div>
      </div>

      {!fs && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: '#92400E', marginBottom: 'var(--space-4)' }}>
          No fee structure set for this class — only Previous Balance dues are tracked.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-3)' }}>
        {filteredStudents.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>No students found matching your search.</div>
        ) : filteredStudents.map(st => {
          const summary = summaries.get(st.id);
          const paid = summary?.totalPaid ?? 0;
          const pending = summary?.totalPending ?? 0;
          const dueNow = summary?.totalDuePending ?? 0;
          const charged = summary?.totalCharged ?? 0;
          const fullyPaid = pending <= 0 && charged > 0;
          const isAdjusted = !!(st.feeAdjustment && typeof st.feeAdjustment.amount === 'number');
          const scholarship = !isAdjusted && st.scholarshipId
            ? scholarships.find(x => x.id === st.scholarshipId && x.active)
            : null;
          const scholarshipApplied = !!(scholarship && typeof scholarship.amountsByClass?.[st.classId] === 'number');
          const badgeLabel = isAdjusted
            ? (st.feeAdjustment?.reason || 'Adjusted')
            : (scholarshipApplied ? (scholarship!.name || 'Scholarship') : '');
          const showBadge = isAdjusted || scholarshipApplied;

          return (
            <div key={st.id} onClick={() => { if (canEnterPayments) onPay(st); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4)',
                background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
                cursor: canEnterPayments ? 'pointer' : 'default', transition: 'all 200ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary-300)'; e.currentTarget.style.background = 'var(--color-surface-variant)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'var(--color-surface)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <Avatar name={st.name} size={40} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ font: 'var(--text-body)', fontWeight: 600 }}>{st.name}</span>
                    {showBadge && (
                      <span
                        title={isAdjusted ? (st.feeAdjustment?.reason || 'Custom fee amount') : `${scholarship?.name} scholarship`}
                        style={{ padding: '2px 8px', borderRadius: 'var(--radius-full)', background: isAdjusted ? '#FEF3C7' : '#DBEAFE', color: isAdjusted ? '#B45309' : '#1D4ED8', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}
                      >
                        {badgeLabel}
                      </span>
                    )}
                  </div>
                  <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
                    Adm: {st.admissionNumber || 'N/A'} • Sec: {st.sectionName} • Charged ₹{charged.toLocaleString()}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
                <div style={{ textAlign: 'right' }}>
                  <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Collected</div>
                  <div style={{ fontWeight: 700, color: '#059669' }}>₹{paid.toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 100 }}>
                  <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Pending</div>
                  <div style={{ fontWeight: 700, color: fullyPaid ? '#059669' : '#DC2626' }}>
                    {fullyPaid ? '✓ PAID' : `₹${pending.toLocaleString()}`}
                  </div>
                  {dueNow > 0 && (
                    <div className="text-caption" style={{ color: '#B45309', fontWeight: 600 }}>Due now: ₹{dueNow.toLocaleString()}</div>
                  )}
                </div>
                {canManageScholarships && (
                  <button
                    onClick={e => { e.stopPropagation(); onAdjust(st); }}
                    title="Adjust this student's fee (scholarship, etc.)"
                    style={{ padding: 8, background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-primary-500)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <EditIcon size={16} />
                  </button>
                )}
                {canEnterPayments && (
                  <div style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', background: 'var(--color-primary-500)', color: 'white', fontSize: '0.85rem', fontWeight: 600 }}>
                    Pay
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
