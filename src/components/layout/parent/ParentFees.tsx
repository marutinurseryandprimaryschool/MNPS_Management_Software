/* ============================================
   Parent Fee View
   ============================================
   Migrated onto src/lib/fee-utils.ts (the ONLY place fee math lives):
   - scholarship / feeAdjustment-adjusted totals (fixes the wrong-total bug),
   - month-wise ECA + term + bus dues with paid/pending status,
   - Previous Balance bucket, Unallocated shown as "Payments on account",
   - soft-deleted payments excluded from every number. */
import React, { useState, useEffect, useMemo } from 'react';
import { FirebaseError } from 'firebase/app';
import { FeePaymentsService, StudentsService, FeeStructuresService, BusRoutesService } from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { isParentOfStudent } from '@/lib/utils';
import {
  computeStudentFeeSummary, excludeDeleted, paymentDateKey,
  type AllocatedBucket,
} from '@/lib/fee-utils';
import type { FeePayment, Student, FeeStructure } from '@/types/models';

interface BusRoute { id: string; routeName: string; fee: number }

/* ── Bucket status chips (extends the existing bus-grid visual pattern) ── */

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

/** Month grid card section (bus / ECA), same look as the original bus grid. */
function MonthGridSection({ title, accent, headerBg, headerBorder, buckets }: {
  title: string; accent: string; headerBg: string; headerBorder: string; buckets: AllocatedBucket[];
}) {
  if (buckets.length === 0) return null;
  return (
    <div style={{ marginTop: 'var(--space-6)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
      <div style={{ padding: 'var(--space-3) var(--space-4)', background: headerBg, borderBottom: `1px solid ${headerBorder}` }}>
        <span className="text-overline" style={{ color: accent }}>{title}</span>
      </div>
      <div style={{ padding: 'var(--space-4)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
        {buckets.map(b => {
          const state = bucketState(b);
          const c = CHIP_COLORS[state];
          return (
            <div key={b.category} style={{
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              background: state === 'paid' ? 'var(--color-success-bg)' : 'var(--color-surface-variant)',
              border: `1px solid ${state === 'paid' ? 'var(--color-success)' : 'var(--color-border)'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 6,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{b.month}</div>
                <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>₹{b.amount.toLocaleString()}</div>
              </div>
              <span style={{ color: c.color, fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{chipLabel(b, state)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Screen ── */

export default function ParentFees() {
  const { user } = useAuth();
  const { school } = useSchool();
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [child, setChild] = useState<Student | null>(null);
  const [structure, setStructure] = useState<FeeStructure | null>(null);
  const [busRoutes, setBusRoutes] = useState<BusRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        if (!user || !school?.academicYear) return;
        setLoadError(null);
        const [allStudents, allStructures] = await Promise.all([
          StudentsService.getAll(school.academicYear),
          FeeStructuresService.getAll(school.academicYear),
        ]);

        const myChild = (allStudents as unknown as Student[]).find(s => isParentOfStudent(user, s));
        setChild(myChild || null);

        if (myChild) {
          const myStructure = (allStructures as unknown as FeeStructure[]).find(fs => fs.classId === myChild.classId) || null;
          const [myPayments, routes] = await Promise.all([
            FeePaymentsService.getByStudent(myChild.id, school.academicYear),
            // Route pricing needed for the bus month grid.
            myChild.transportType === 'bus' ? BusRoutesService.getAll() : Promise.resolve([]),
          ]);
          setPayments(myPayments as unknown as FeePayment[]);
          setStructure(myStructure);
          setBusRoutes(routes as unknown as BusRoute[]);
        }
      } catch (error) {
        console.error('ParentFees load failed:', error);
        const code = error instanceof FirebaseError ? error.code : '';
        if (code === 'permission-denied') {
          setLoadError('Unable to load fee details — your session may have expired. Refresh the app and sign in again.');
        } else if (code === 'unavailable') {
          setLoadError('Connection lost — fee details could not be loaded. Check your connection and try again.');
        } else {
          setLoadError('Failed to load fee details. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user, school?.academicYear]);

  // ALL fee math via the engine: scholarship-adjusted totals, month-wise
  // dues, PB bucket, Unallocated, deleted excluded.
  const summary = useMemo(() => {
    if (!child) return null;
    return computeStudentFeeSummary(
      {
        structure,
        student: child,
        busRoutes,
        scholarships: school?.settings?.scholarships || [],
        academicYear: school?.academicYear,
      },
      payments,
    );
  }, [child, structure, busRoutes, payments, school?.settings?.scholarships, school?.academicYear]);

  // History list: soft-deleted excluded, newest first.
  const visiblePayments = useMemo(
    () => [...excludeDeleted(payments)].sort((a, b) => (paymentDateKey(b) || '').localeCompare(paymentDateKey(a) || '')),
    [payments],
  );

  if (loading) {
    return <div className="page-container"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span></div></div>;
  }

  const pbBuckets = summary?.buckets.filter(b => b.kind === 'previousBalance') || [];
  const termBuckets = summary?.buckets.filter(b => b.kind === 'term') || [];
  const additionalBuckets = summary?.buckets.filter(b => b.kind === 'additional') || [];
  const ecaBuckets = summary?.buckets.filter(b => b.kind === 'eca') || [];
  const busBuckets = summary?.buckets.filter(b => b.kind === 'bus') || [];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="text-h1">Fee Details</h2>
      </div>

      {loadError && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
          <span className="text-body-sm" style={{ color: '#DC2626' }}>{loadError}</span>
        </div>
      )}

      {child && summary && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', border: '1px solid var(--color-border)', textAlign: 'center' }}>
              <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Total Fees</div>
              <div className="text-h2">₹{summary.totalCharged.toLocaleString()}</div>
            </div>
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', border: '1px solid var(--color-border)', textAlign: 'center' }}>
              <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Total Paid</div>
              <div className="text-h2" style={{ color: 'var(--color-success)' }}>₹{summary.totalPaid.toLocaleString()}</div>
            </div>
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', border: '1px solid var(--color-border)', textAlign: 'center' }}>
              <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>Remaining Balance</div>
              <div className="text-h2" style={{ color: summary.totalPending > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>₹{summary.totalPending.toLocaleString()}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
            {/* Fee Breakdown — engine buckets */}
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
              <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-overline">Fee Breakdown</span>
              </div>
              {!summary.hasStructure && pbBuckets.length === 0 ? (
                <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                  <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No fee structure found for Class {child.className}.</p>
                </div>
              ) : (
                <div style={{ padding: 'var(--space-2)' }}>
                  {summary.scaleFactor < 1 && (
                    <div style={{ padding: 'var(--space-2) var(--space-3)' }}>
                      <span className="text-caption" style={{ color: '#7C3AED' }}>Scholarship / fee adjustment applied — amounts shown are your adjusted fees.</span>
                    </div>
                  )}
                  {pbBuckets.map(b => (
                    <div key={b.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-divider)' }}>
                      <span className="text-body-sm" style={{ color: '#DC2626', fontWeight: 600 }}>Previous Balance</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span className="text-body-sm" style={{ fontWeight: 600 }}>₹{b.amount.toLocaleString()}</span>
                        <StatusChip bucket={b} />
                      </div>
                    </div>
                  ))}
                  {termBuckets.map(b => (
                    <div key={b.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-divider)' }}>
                      <span className="text-body-sm" style={{ color: 'var(--color-text-secondary)' }}>{b.category}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span className="text-body-sm" style={{ fontWeight: 600 }}>₹{b.amount.toLocaleString()}</span>
                        <StatusChip bucket={b} />
                      </div>
                    </div>
                  ))}
                  {additionalBuckets.map(b => (
                    <div key={b.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-divider)' }}>
                      <span className="text-body-sm" style={{ color: '#D97706' }}>{b.category}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span className="text-body-sm" style={{ fontWeight: 600, color: '#D97706' }}>₹{b.amount.toLocaleString()}</span>
                        <StatusChip bucket={b} />
                      </div>
                    </div>
                  ))}
                  {ecaBuckets.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-divider)' }}>
                      <span className="text-body-sm" style={{ color: '#7C3AED' }}>ECA (month-wise below)</span>
                      <span className="text-body-sm" style={{ fontWeight: 600, color: '#7C3AED' }}>₹{ecaBuckets.reduce((s, b) => s + b.amount, 0).toLocaleString()}</span>
                    </div>
                  )}
                  {busBuckets.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-divider)' }}>
                      <span className="text-body-sm" style={{ color: '#0369A1' }}>Bus Fee (month-wise below)</span>
                      <span className="text-body-sm" style={{ fontWeight: 600, color: '#0369A1' }}>₹{busBuckets.reduce((s, b) => s + b.amount, 0).toLocaleString()}</span>
                    </div>
                  )}
                  {summary.unallocated > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-divider)' }}>
                      <span className="text-body-sm" style={{ color: 'var(--color-success)' }}>Payments on account</span>
                      <span className="text-body-sm" style={{ fontWeight: 600, color: 'var(--color-success)' }}>₹{summary.unallocated.toLocaleString()}</span>
                    </div>
                  )}
                  <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-3)', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-body-sm" style={{ fontWeight: 700 }}>Total</span>
                    <span className="text-body-sm" style={{ fontWeight: 700 }}>₹{summary.totalCharged.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Payment History */}
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
              <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-overline">Payment History</span>
              </div>
              {visiblePayments.length === 0 ? (
                <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                  <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No payment records found.</p>
                </div>
              ) : (
                <div style={{ padding: 'var(--space-2)' }}>
                  {visiblePayments.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
                      <div>
                        <div style={{ font: 'var(--text-body-sm)', fontWeight: 600 }}>{p.category || 'Payment'}</div>
                        <div className="text-caption" style={{ color: 'var(--color-text-tertiary)', fontSize: '0.7rem' }}>{p.mode?.toUpperCase()} • {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : 'N/A'}</div>
                      </div>
                      <div style={{ font: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--color-success)' }}>₹{Number(p.amount).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <MonthGridSection
            title="Monthly ECA Fee Status"
            accent="#7C3AED" headerBg="#F5F3FF" headerBorder="#DDD6FE"
            buckets={ecaBuckets}
          />
          <MonthGridSection
            title="Monthly Bus Fee Status"
            accent="#0369A1" headerBg="#F0F9FF" headerBorder="#BAE6FD"
            buckets={busBuckets}
          />
        </>
      )}

      {!child && !loadError && (
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: 'var(--space-6)', textAlign: 'center' }}>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No student record linked to this account.</p>
        </div>
      )}
    </div>
  );
}
