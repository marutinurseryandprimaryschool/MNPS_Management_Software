'use client';
/* Fee overview: collection cards, engine-driven grand totals, category
   breakdown, and class/section summary cards. All numbers come from the
   fee engine's summarizers (scholarship-aware, deleted excluded). */

import React, { useMemo, useState } from 'react';
import { CreditCardIcon } from '@/components/ui/Icons';
import {
  computeClassFeeSummary, paymentDateKey, toDateKey, type StudentFeeSummary,
} from '@/lib/fee-utils';
import type { Class, FeePayment, FeeStructure, Student } from '@/types/models';

interface FeeOverviewSectionProps {
  /** Non-deleted payments only (engine's excludeDeleted applied upstream). */
  livePayments: FeePayment[];
  summaries: Map<string, StudentFeeSummary>;
  students: Student[];
  classes: Class[];
  feeStructures: FeeStructure[];
  onOpenSection: (classId: string, sectionId: string) => void;
}

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border)', padding: 'var(--space-5)',
};

export default function FeeOverviewSection({
  livePayments, summaries, students, classes, feeStructures, onOpenSection,
}: FeeOverviewSectionProps) {
  const todayKey = toDateKey(new Date());
  const currentMonthKey = todayKey.slice(0, 7);
  const [monthFilter, setMonthFilter] = useState<string>(currentMonthKey);

  const todayPayments = livePayments.filter(p => paymentDateKey(p) === todayKey);
  const todayTotal = todayPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const totalCollected = livePayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const monthPayments = livePayments.filter(p => (paymentDateKey(p) || '').slice(0, 7) === monthFilter);
  const monthTotal = monthPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const isCurrentMonth = monthFilter === currentMonthKey;
  const monthLabel = new Date(monthFilter + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // ── Engine aggregates ──
  const { grand, catTotals, unallocatedTotal } = useMemo(() => {
    const cats: Record<string, { expected: number; collected: number }> = {};
    let unallocated = 0;
    const all = [...summaries.values()];
    for (const summary of all) {
      unallocated += summary.unallocated;
      for (const bucket of summary.buckets) {
        // ECA and bus months roll up into one card each to keep the grid tight.
        const key = bucket.kind === 'eca' ? 'ECA' : bucket.kind === 'bus' ? 'Bus Fee' : bucket.category;
        const entry = cats[key] || { expected: 0, collected: 0 };
        cats[key] = { expected: entry.expected + bucket.amount, collected: entry.collected + bucket.paid };
      }
    }
    return { grand: computeClassFeeSummary(all), catTotals: cats, unallocatedTotal: unallocated };
  }, [summaries]);

  const sectionItems = useMemo(() => {
    const items: { fs: FeeStructure; sectionId: string; sectionName: string }[] = [];
    feeStructures.forEach(fs => {
      const cls = classes.find(c => c.id === fs.classId);
      const sections = cls?.sections || [];
      if (sections.length === 0) items.push({ fs, sectionId: '', sectionName: '' });
      else sections.forEach(sec => items.push({ fs, sectionId: sec.id, sectionName: sec.name }));
    });
    return items;
  }, [feeStructures, classes]);

  return (
    <>
      {/* Collection cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <div style={{ background: 'linear-gradient(135deg,#059669,#10B981)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', opacity: 0.85 }}>
            <CreditCardIcon size={18} /><span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Today&apos;s Collection</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>₹{todayTotal.toLocaleString()}</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: 4 }}>{todayPayments.length} transaction{todayPayments.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg,#2563EB,#3B82F6)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', opacity: 0.85 }}>
            <CreditCardIcon size={18} /><span style={{ fontSize: '0.85rem', fontWeight: 500 }}>All-Time Collection</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>₹{totalCollected.toLocaleString()}</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: 4 }}>{livePayments.length} total payments</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg,#7C3AED,#8B5CF6)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', opacity: 0.9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <CreditCardIcon size={18} />
              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{isCurrentMonth ? 'This Month' : monthLabel}</span>
            </div>
            <input
              type="month" value={monthFilter} max={currentMonthKey}
              onChange={e => setMonthFilter(e.target.value || currentMonthKey)}
              title="Pick a month"
              style={{ background: 'rgba(255,255,255,0.18)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 'var(--radius-sm)', padding: '2px 6px', fontSize: '0.72rem', outline: 'none', colorScheme: 'dark', cursor: 'pointer' }}
            />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>₹{monthTotal.toLocaleString()}</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: 4 }}>
            {monthPayments.length} payment{monthPayments.length !== 1 ? 's' : ''}{isCurrentMonth ? '' : ` in ${monthLabel}`}
          </div>
        </div>
      </div>

      {/* Grand summary (engine) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        <div style={CARD_STYLE}>
          <div className="text-caption" style={{ color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 'var(--space-2)' }}>Total Expected</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>₹{grand.totalCharged.toLocaleString()}</div>
        </div>
        <div style={CARD_STYLE}>
          <div className="text-caption" style={{ color: '#059669', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 'var(--space-2)' }}>Collected</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669' }}>₹{grand.totalPaid.toLocaleString()}</div>
        </div>
        <div style={CARD_STYLE}>
          <div className="text-caption" style={{ color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 'var(--space-2)' }}>Pending</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#DC2626' }}>₹{grand.totalPending.toLocaleString()}</div>
        </div>
        <div style={CARD_STYLE}>
          <div className="text-caption" style={{ color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 'var(--space-2)' }}>Due Now</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#B45309' }}>₹{grand.totalDuePending.toLocaleString()}</div>
          <div className="text-caption" style={{ color: 'var(--color-text-tertiary)', marginTop: 4 }}>{grand.defaulterCount} defaulter{grand.defaulterCount !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Category-wise breakdown (engine buckets) */}
      <div style={{ ...CARD_STYLE, marginBottom: 'var(--space-5)' }}>
        <div className="text-overline" style={{ marginBottom: 'var(--space-4)' }}>Category-wise Breakdown</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--space-4)' }}>
          {Object.entries(catTotals).map(([name, v]) => (
            <div key={name} style={{ padding: 'var(--space-3)', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-md)' }}>
              <div className="text-caption" style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-1)' }}>{name}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 4 }}>₹{v.expected.toLocaleString()}</div>
              <span className="text-caption" style={{ color: '#059669' }}>Paid: ₹{v.collected.toLocaleString()}</span>
              <div style={{ width: '100%', height: 3, borderRadius: 2, background: '#E5E7EB', marginTop: 6 }}>
                <div style={{ width: `${v.expected > 0 ? Math.min(100, (v.collected / v.expected) * 100) : 0}%`, height: '100%', borderRadius: 2, background: '#059669' }} />
              </div>
            </div>
          ))}
          {unallocatedTotal > 0 && (
            <div style={{ padding: 'var(--space-3)', background: '#EFF6FF', borderRadius: 'var(--radius-md)', border: '1px solid #BFDBFE' }}>
              <div className="text-caption" style={{ color: '#1D4ED8', marginBottom: 'var(--space-1)' }}>Unallocated</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 4, color: '#1D4ED8' }}>₹{unallocatedTotal.toLocaleString()}</div>
              <span className="text-caption" style={{ color: '#1D4ED8' }}>Counted in totals, no month bucket</span>
            </div>
          )}
        </div>
      </div>

      {/* Class/section summary cards */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <div className="text-overline" style={{ marginBottom: 'var(--space-3)' }}>Class-wise Summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
          {sectionItems.map(({ fs, sectionId, sectionName }) => {
            const sectionStudents = students.filter(s =>
              s.classId === fs.classId && (sectionId ? s.sectionId === sectionId : true));
            const cls = computeClassFeeSummary(
              sectionStudents.map(s => summaries.get(s.id)).filter((s): s is StudentFeeSummary => !!s));
            const pct = cls.totalCharged > 0 ? Math.min(100, (cls.totalPaid / cls.totalCharged) * 100) : 0;
            return (
              <div key={`${fs.id}-${sectionId}`} onClick={() => onOpenSection(fs.classId, sectionId)}
                style={{ ...CARD_STYLE, cursor: 'pointer', transition: 'all 200ms' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary-500)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.transform = 'none'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                  <div>
                    <div style={{ font: 'var(--text-body)', fontWeight: 700, fontSize: '1.05rem' }}>{fs.className}{sectionName ? ` — ${sectionName}` : ''}</div>
                    <div className="text-caption" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                      {cls.studentCount} students • ₹{(fs.totalAmount || 0).toLocaleString()}/student
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: cls.totalPending > 0 ? '#DC2626' : '#059669', fontSize: '0.9rem' }}>
                      {cls.totalPending > 0 ? `₹${cls.totalPending.toLocaleString()} pending` : '✓ Fully Paid'}
                    </div>
                    {cls.defaulterCount > 0 && (
                      <div className="text-caption" style={{ color: '#B45309', marginTop: 2 }}>
                        {cls.defaulterCount} defaulter{cls.defaulterCount !== 1 ? 's' : ''} • ₹{cls.totalDuePending.toLocaleString()} due
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ width: '100%', height: 6, borderRadius: 3, background: '#E5E7EB', marginBottom: 'var(--space-3)' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: pct >= 100 ? '#059669' : (pct > 0 ? '#F59E0B' : '#3B82F6'), transition: 'width 300ms' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Expected</span>
                    <span style={{ fontWeight: 700 }}>₹{cls.totalCharged.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Collected</span>
                    <span style={{ fontWeight: 700, color: '#059669' }}>₹{cls.totalPaid.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
