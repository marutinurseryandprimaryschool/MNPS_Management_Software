'use client';
/* ============================================
   Teacher Fee Register — READ-ONLY
   ============================================
   Scoped to the logged-in teacher's class-teacher section only
   (docs/designs/principal-role-fees-accounts.md, scope item 6).
   - No collect/entry UI: fee payments are recorded by the Principal only.
   - Loads ONLY this class-section's students + payments + fee structure
     (no school-wide loads).
   - All fee math comes from src/lib/fee-utils.ts (never inline). */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FirebaseError } from 'firebase/app';
import {
  FeePaymentsService, FeeStructuresService, StudentsService,
  TeachersService, BusRoutesService,
} from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import Button from '@/components/ui/Button';
import { CreditCardIcon } from '@/components/ui/Icons';
import {
  computeStudentFeeSummary,
  type AllocatedBucket,
  type StudentFeeSummary,
} from '@/lib/fee-utils';
import type { FeePayment, FeeStructure, Student, TeacherAssignment } from '@/types/models';

interface BusRoute { id: string; routeName: string; fee: number }

/* ── Bucket status chips (same visual language as ParentFees' bus grid) ── */

type BucketState = 'paid' | 'partial' | 'pending' | 'upcoming';

function bucketState(b: AllocatedBucket): BucketState {
  if (b.pending <= 0) return 'paid';
  if (b.paid > 0) return 'partial';
  return b.isDue ? 'pending' : 'upcoming';
}

const CHIP_COLORS: Record<BucketState, { color: string; bg: string; border: string }> = {
  paid: { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  partial: { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  pending: { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  upcoming: { color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
};

function chipLabel(b: AllocatedBucket, state: BucketState): string {
  if (state === 'paid') return '✓ PAID';
  if (state === 'partial') return `Bal ₹${b.pending.toLocaleString()}`;
  if (state === 'pending') return 'PENDING';
  return b.kind === 'term' && !b.dueDate ? 'NO DUE DATE' : 'UPCOMING';
}

function StatusChip({ bucket }: { bucket: AllocatedBucket }) {
  const state = bucketState(bucket);
  const c = CHIP_COLORS[state];
  return (
    <span style={{ padding: '1px 8px', borderRadius: 99, fontSize: '0.65rem', fontWeight: 700, background: c.bg, color: c.color, border: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>
      {chipLabel(bucket, state)}
    </span>
  );
}

function BucketRow({ bucket, labelColor }: { bucket: AllocatedBucket; labelColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', gap: 'var(--space-2)' }}>
      <span className="text-body-sm" style={{ fontWeight: 500, color: labelColor }}>{bucket.category}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span className="text-caption" style={{ fontWeight: 600 }}>₹{bucket.amount.toLocaleString()}</span>
        <StatusChip bucket={bucket} />
      </div>
    </div>
  );
}

function MonthGrid({ buckets }: { buckets: AllocatedBucket[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--space-2)', paddingTop: 4 }}>
      {buckets.map(b => (
        <div key={b.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
          <span className="text-caption" style={{ fontWeight: 600 }}>{b.month}</span>
          <StatusChip bucket={b} />
        </div>
      ))}
    </div>
  );
}

/* ── Per-student month-wise balance detail ── */

function StudentFeeDetail({ summary }: { summary: StudentFeeSummary }) {
  const pbBuckets = summary.buckets.filter(b => b.kind === 'previousBalance');
  const termBuckets = summary.buckets.filter(b => b.kind === 'term');
  const additionalBuckets = summary.buckets.filter(b => b.kind === 'additional');
  const ecaBuckets = summary.buckets.filter(b => b.kind === 'eca');
  const busBuckets = summary.buckets.filter(b => b.kind === 'bus');

  return (
    <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-variant)', borderTop: '1px dashed var(--color-border)' }}>
      {!summary.hasStructure && pbBuckets.length === 0 && (
        <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No fee structure set for this class.</p>
      )}
      {summary.scaleFactor < 1 && (
        <p className="text-caption" style={{ color: '#7C3AED', marginBottom: 4 }}>Scholarship / fee adjustment applied — amounts are scaled.</p>
      )}
      {summary.scaleWarning && (
        <p className="text-caption" style={{ color: '#D97706', marginBottom: 4 }}>Fee override exceeds the standard fee — standard amounts shown.</p>
      )}

      {pbBuckets.map(b => <BucketRow key={b.category} bucket={b} labelColor="#DC2626" />)}
      {termBuckets.map(b => <BucketRow key={b.category} bucket={b} />)}
      {additionalBuckets.map(b => <BucketRow key={b.category} bucket={b} labelColor="#D97706" />)}

      {ecaBuckets.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div className="text-caption" style={{ fontWeight: 700, color: '#7C3AED' }}>ECA (MONTH-WISE)</div>
          <MonthGrid buckets={ecaBuckets} />
        </div>
      )}
      {busBuckets.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div className="text-caption" style={{ fontWeight: 700, color: '#0369A1' }}>BUS FEE (MONTH-WISE)</div>
          <MonthGrid buckets={busBuckets} />
        </div>
      )}

      {summary.unallocated > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', marginTop: 4 }}>
          <span className="text-body-sm" style={{ color: '#059669', fontWeight: 500 }}>Payments on account</span>
          <span className="text-caption" style={{ fontWeight: 600, color: '#059669' }}>₹{summary.unallocated.toLocaleString()}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2) var(--space-4)', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--color-border)' }}>
        <span className="text-caption">Total: <strong>₹{summary.totalCharged.toLocaleString()}</strong></span>
        <span className="text-caption" style={{ color: '#059669' }}>Paid: <strong>₹{summary.totalPaid.toLocaleString()}</strong></span>
        <span className="text-caption" style={{ color: summary.totalPending > 0 ? '#DC2626' : '#059669' }}>Pending: <strong>₹{summary.totalPending.toLocaleString()}</strong></span>
        <span className="text-caption" style={{ color: summary.totalDuePending > 0 ? '#DC2626' : 'var(--color-text-tertiary)' }}>Due now: <strong>₹{summary.totalDuePending.toLocaleString()}</strong></span>
      </div>
    </div>
  );
}

/* ── Screen ── */

export default function TeacherFees() {
  const { user } = useAuth();
  const { school } = useSchool();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<TeacherAssignment | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [structure, setStructure] = useState<FeeStructure | null>(null);
  const [busRoutes, setBusRoutes] = useState<BusRoute[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user || !school?.academicYear) return;
    setLoading(true);
    setLoadError(null);
    try {
      // Resolve the logged-in teacher and their class-teacher assignment.
      let teacher = await TeachersService.getByUserId(user.uid || user.id, school.academicYear);
      if (!teacher && user.email) {
        teacher = await TeachersService.getByEmail(user.email, school.academicYear);
      }
      const assignments = (teacher?.assignedClasses || []) as TeacherAssignment[];
      const classTeacherOf = assignments.find(a => a.isClassTeacher) || null;
      setAssignment(classTeacherOf);
      if (!classTeacherOf) return; // explicit empty state below

      // Scoped loads: ONLY this class-section (no school-wide fetches).
      const [s, p, fs, br] = await Promise.all([
        classTeacherOf.sectionId
          ? StudentsService.getByClassSection(classTeacherOf.classId, classTeacherOf.sectionId, school.academicYear)
          : StudentsService.getByClass(classTeacherOf.classId, school.academicYear),
        FeePaymentsService.getByClass(classTeacherOf.classId, school.academicYear),
        FeeStructuresService.getByClass(classTeacherOf.classId, school.academicYear),
        BusRoutesService.getAll(),
      ]);
      const sectionStudents = s as unknown as Student[];
      const studentIds = new Set(sectionStudents.map(st => st.id));
      setStudents([...sectionStudents].sort((a, b) => a.name.localeCompare(b.name)));
      // Class payments filtered down to this section's students.
      setPayments((p as unknown as FeePayment[]).filter(pay => studentIds.has(pay.studentId)));
      setStructure(fs as unknown as FeeStructure | null);
      setBusRoutes(br as unknown as BusRoute[]);
    } catch (e) {
      console.error('TeacherFees load failed:', e);
      const code = e instanceof FirebaseError ? e.code : '';
      if (code === 'permission-denied') {
        setLoadError('You do not have permission to view fee records. Your access may have changed — refresh the app and sign in again.');
      } else if (code === 'unavailable') {
        setLoadError('Connection lost — the fee register could not be loaded. Check your connection and retry.');
      } else {
        setLoadError('Failed to load the fee register. Please retry.');
      }
    } finally {
      setLoading(false);
    }
  }, [user, school?.academicYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Payments grouped per student (engine expects student-scoped payments).
  const paymentsByStudent = useMemo(() => {
    const map: Record<string, FeePayment[]> = {};
    payments.forEach(p => {
      map[p.studentId] = [...(map[p.studentId] || []), p];
    });
    return map;
  }, [payments]);

  // Per-student summaries — ALL fee math via fee-utils.
  const summaries = useMemo(() => {
    const scholarships = school?.settings?.scholarships || [];
    return students.map(student => ({
      student,
      summary: computeStudentFeeSummary(
        {
          structure,
          student,
          busRoutes,
          scholarships,
          academicYear: school?.academicYear,
        },
        paymentsByStudent[student.id] || [],
      ),
    }));
  }, [students, structure, busRoutes, paymentsByStudent, school?.settings?.scholarships, school?.academicYear]);

  const classTotals = useMemo(() => summaries.reduce(
    (acc, { summary }) => ({
      paid: acc.paid + summary.totalPaid,
      pending: acc.pending + summary.totalPending,
      dueNow: acc.dueNow + summary.totalDuePending,
    }),
    { paid: 0, pending: 0, dueNow: 0 },
  ), [summaries]);

  const sectionLabel = assignment
    ? `${assignment.className || 'My Class'}${assignment.sectionName ? `-${assignment.sectionName}` : ''}`
    : '';

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page-container">
        <div className="page-header"><h2 className="text-h1">Fee Register</h2></div>
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: 'var(--space-6)', textAlign: 'center' }}>
          <p className="text-body-sm" style={{ color: 'var(--color-error)', marginBottom: 'var(--space-4)' }}>{loadError}</p>
          <Button variant="primary" onClick={fetchData}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="page-container">
        <div className="page-header"><h2 className="text-h1">Fee Register</h2></div>
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: 'var(--space-8) var(--space-6)', textAlign: 'center' }}>
          <p className="text-body" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>You are not assigned as a class teacher this year</p>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            The fee register shows the class you are class teacher of. Ask the school admin to mark you as a class teacher in teacher assignments.
          </p>
        </div>
      </div>
    );
  }

  const displayStudents = studentSearch
    ? summaries.filter(({ student }) => student.name.toLowerCase().includes(studentSearch.toLowerCase()))
    : summaries;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-h1">Fee Register</h2>
          <p className="text-body-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {sectionLabel} • read-only — fee payments are recorded by the Principal
          </p>
        </div>
      </div>

      {/* Summary header */}
      <div style={{ background: 'linear-gradient(135deg, #1E40AF, #3B82F6)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', color: 'white', marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', opacity: 0.85 }}>
          <CreditCardIcon size={18} /><span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{sectionLabel}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div><div style={{ fontSize: '0.7rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Students</div><div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{students.length}</div></div>
          <div><div style={{ fontSize: '0.7rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Collected</div><div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#86EFAC' }}>₹{classTotals.paid.toLocaleString()}</div></div>
          <div><div style={{ fontSize: '0.7rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Pending</div><div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FCA5A5' }}>₹{classTotals.pending.toLocaleString()}</div></div>
          <div><div style={{ fontSize: '0.7rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Due Now</div><div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FCD34D' }}>₹{classTotals.dueNow.toLocaleString()}</div></div>
        </div>
      </div>

      {!structure && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
          <span className="text-body-sm" style={{ color: '#92400E' }}>No fee structure set for this class — dues cannot be computed yet.</span>
        </div>
      )}

      {/* Student register */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span className="text-overline">Students</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1, maxWidth: 280 }}>
            <input
              type="text" placeholder="Search student..." value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', outline: 'none', background: 'var(--color-surface)' }}
            />
          </div>
          <span className="text-caption" style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}>{students.length} students</span>
        </div>

        {displayStudents.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
            <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              {studentSearch ? 'No students match your search.' : 'No students in this class-section.'}
            </p>
          </div>
        ) : displayStudents.map(({ student, summary }) => {
          const isExpanded = expandedId === student.id;
          const fullyPaid = summary.totalPending <= 0 && summary.totalCharged > 0;
          const paidPct = summary.totalCharged > 0 ? Math.min(100, (summary.totalPaid / summary.totalCharged) * 100) : 0;
          return (
            <div key={student.id} style={{ borderBottom: '1px solid var(--color-divider)' }}>
              <div
                onClick={() => setExpandedId(isExpanded ? null : student.id)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', cursor: 'pointer', transition: 'background 100ms' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-variant)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: 'var(--text-body)', fontWeight: 500 }}>{student.name}</div>
                  <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>{student.admissionNumber}</div>
                  {summary.totalCharged > 0 && (
                    <div style={{ width: '100%', maxWidth: 200, height: 4, borderRadius: 2, background: '#E5E7EB', marginTop: 4 }}>
                      <div style={{ width: `${paidPct}%`, height: '100%', borderRadius: 2, background: fullyPaid ? '#059669' : '#F59E0B', transition: 'width 300ms' }} />
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {summary.totalCharged > 0 ? (
                    <>
                      <div style={{ font: 'var(--text-body-sm)', fontWeight: 600, color: fullyPaid ? '#059669' : '#DC2626' }}>
                        {fullyPaid ? '✓ Fully Paid' : `₹${summary.totalPending.toLocaleString()} pending`}
                      </div>
                      <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Paid: ₹{summary.totalPaid.toLocaleString()}</div>
                    </>
                  ) : (
                    <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
                      {summary.totalPaid > 0 ? `Paid: ₹${summary.totalPaid.toLocaleString()}` : 'No dues'}
                    </div>
                  )}
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'var(--space-2)', flexShrink: 0, transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
              {isExpanded && <StudentFeeDetail summary={summary} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
