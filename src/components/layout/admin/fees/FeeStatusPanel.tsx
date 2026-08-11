'use client';
/* Compact per-student fee status panel rendered from the engine's allocated
   buckets — no inline fee math. Used inside the payment entry/edit modals. */

import React from 'react';
import type { AllocatedBucket, StudentFeeSummary } from '@/lib/fee-utils';

function RowLine({ bucket }: { bucket: AllocatedBucket }) {
  const isFullyPaid = bucket.pending <= 0;
  const isPartial = bucket.paid > 0 && bucket.pending > 0;
  const status = isFullyPaid ? '✓ PAID' : isPartial ? 'PARTIAL' : bucket.isDue ? 'DUE' : 'PENDING';
  const color = isFullyPaid ? '#059669' : isPartial ? '#D97706' : bucket.isDue ? '#DC2626' : '#6B7280';
  const bg = isFullyPaid ? '#ECFDF5' : isPartial ? '#FFFBEB' : bucket.isDue ? '#FEF2F2' : 'var(--color-surface-variant)';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--color-divider)' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span className="text-body-sm" style={{ fontWeight: 600 }}>{bucket.category}</span>
        <span className="text-caption" style={{ color: isPartial ? '#D97706' : 'var(--color-text-tertiary)', fontSize: '0.7rem' }}>
          {isFullyPaid
            ? 'Fully Paid'
            : isPartial
              ? `Paid: ₹${bucket.paid.toLocaleString()} • Bal: ₹${bucket.pending.toLocaleString()}`
              : 'No payments yet'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <span className="text-body-sm" style={{ fontWeight: 600 }}>₹{bucket.amount.toLocaleString()}</span>
        <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: '0.65rem', fontWeight: 700, background: bg, color }}>{status}</span>
      </div>
    </div>
  );
}

function MonthGrid({ title, buckets, accent }: { title: string; buckets: AllocatedBucket[]; accent: string }) {
  if (buckets.length === 0) return null;
  return (
    <div style={{ marginTop: 'var(--space-3)' }}>
      <p className="text-caption" style={{ fontWeight: 600, color: accent, marginBottom: 'var(--space-2)' }}>{title}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
        {buckets.map(b => {
          const isFullyPaid = b.pending <= 0;
          return (
            <div key={b.category} style={{
              padding: '6px 10px', borderRadius: 'var(--radius-sm)',
              background: isFullyPaid ? '#ECFDF5' : b.isDue ? '#FEF2F2' : '#FFFBEB',
              border: `1px solid ${isFullyPaid ? '#A7F3D0' : b.isDue ? '#FECACA' : '#FDE68A'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isFullyPaid ? '#065F46' : b.isDue ? '#991B1B' : '#92400E' }}>{b.month}</span>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: isFullyPaid ? '#059669' : b.isDue ? '#DC2626' : '#D97706' }}>
                {isFullyPaid ? '✓' : `₹${b.pending.toLocaleString()}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FeeStatusPanel({ summary }: { summary: StudentFeeSummary }) {
  const rowBuckets = summary.buckets.filter(b =>
    b.kind === 'previousBalance' || b.kind === 'term' || b.kind === 'additional');
  const ecaBuckets = summary.buckets.filter(b => b.kind === 'eca');
  const busBuckets = summary.buckets.filter(b => b.kind === 'bus');

  return (
    <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
      <div className="text-caption" style={{ fontWeight: 600, color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)' }}>FEE STATUS</div>

      {!summary.hasStructure && (
        <div style={{ padding: 'var(--space-3)', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: '#92400E', marginBottom: 'var(--space-2)' }}>
          No fee structure set for this class — only Previous Balance (if any) is tracked.
        </div>
      )}
      {summary.scaleWarning && (
        <div style={{ padding: 'var(--space-2) var(--space-3)', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: '#92400E', marginBottom: 'var(--space-2)' }}>
          Fee override exceeds the standard total — charged at the full standard amount.
        </div>
      )}

      {rowBuckets.map(b => <RowLine key={b.category} bucket={b} />)}
      <MonthGrid title="MONTHLY ECA STATUS" buckets={ecaBuckets} accent="#7C3AED" />
      <MonthGrid title="MONTHLY BUS FEE STATUS" buckets={busBuckets} accent="#0369A1" />

      {summary.unallocated > 0 && (
        <div style={{ marginTop: 'var(--space-3)', padding: '6px 10px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: '#1D4ED8' }}>
          Unallocated payments: ₹{summary.unallocated.toLocaleString()} (counted toward total paid, not tied to a month)
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-3)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-divider)' }}>
        <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
          Charged ₹{summary.totalCharged.toLocaleString()} • Paid ₹{summary.totalPaid.toLocaleString()}
        </span>
        <span className="text-caption" style={{ fontWeight: 700, color: summary.totalDuePending > 0 ? '#DC2626' : '#059669' }}>
          {summary.totalDuePending > 0 ? `Due now: ₹${summary.totalDuePending.toLocaleString()}` : 'Nothing overdue'}
        </span>
      </div>
    </div>
  );
}
