'use client';

/* ============================================
   Parent Fee View — the Principal Register, read-only
   ============================================
   REWIRED onto the standalone Principal Register. This screen reads
   principalRegister + principalPayments ONLY; it never touches the legacy
   feePayments / feeStructures / expenses collections, and it never computes
   money itself — every number comes from computeRowSummary in
   src/lib/principal-fees.ts, the same engine the Principal's own screens use.

   The register is standalone, so a row is matched to the child by name +
   class rather than by studentId. When no row matches we say so plainly:
   showing zeros would read as "you owe nothing", which is a lie the school
   would have to answer for.

   READ-ONLY. There is no write path on this screen at all.
*/

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { StudentsService } from '@/lib/firestore-service';
import { PrincipalRegisterService, PrincipalPaymentsService } from '@/lib/principal-service';
import { computeRowSummary } from '@/lib/principal-fees';
import { describeReadError } from '@/components/layout/principal/principal-shared';
import { isParentOfStudent, getClassSlotIndex } from '@/lib/utils';
import type { Student } from '@/types/models';
import type {
  MonthCell, PrincipalPayment, RegisterRow, RowSummary,
} from '@/types/principal';

/* ── Matching the child to a register row ─────────────────────────────── */

const norm = (value?: string | null): string =>
  (value || '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Alias-aware class equality ("Class 1" === "First"), falling back to text. */
function sameClass(a?: string | null, b?: string | null): boolean {
  const slotA = getClassSlotIndex(a || '');
  const slotB = getClassSlotIndex(b || '');
  if (slotA !== -1 && slotB !== -1) return slotA === slotB;
  return norm(a) === norm(b) && norm(a) !== '';
}

/**
 * The child's row, or null. Name + class first; a name-only match is accepted
 * ONLY when it is unique, so a repeated name never resolves to the wrong
 * family's fees.
 */
export function findRowForChild(rows: RegisterRow[], child: Student | null): RegisterRow | null {
  if (!child) return null;
  const childName = norm(child.name);
  if (!childName) return null;

  const sameName = rows.filter(row => norm(row.name) === childName);
  if (sameName.length === 0) return null;

  const withClass = sameName.filter(row => sameClass(row.className, child.className));
  if (withClass.length === 1) return withClass[0];
  if (withClass.length > 1) return null; // ambiguous — never guess with money
  return sameName.length === 1 ? sameName[0] : null;
}

/* ── Status chips (same visual language as the previous parent view) ───── */

type CellState = 'paid' | 'partial' | 'due' | 'upcoming';

function cellState(cell: MonthCell): CellState {
  if (cell.pending <= 0) return 'paid';
  if (cell.paid > 0) return 'partial';
  return cell.isDue ? 'due' : 'upcoming';
}

const CHIP_COLORS: Record<CellState, { color: string; bg: string; border: string }> = {
  paid: { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  partial: { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  due: { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  upcoming: { color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
};

function chipLabel(cell: MonthCell, state: CellState): string {
  if (state === 'paid') return '✓ PAID';
  if (state === 'partial') return `Bal ₹${cell.pending.toLocaleString()}`;
  return state === 'due' ? 'DUE' : 'UPCOMING';
}

const inr = (value: number): string => `₹${Math.round(value || 0).toLocaleString()}`;

/* ── Presentational pieces ────────────────────────────────────────────── */

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-4)', border: '1px solid var(--color-border)',
      textAlign: 'center', minWidth: 0,
    }}>
      <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>{label}</div>
      <div className="text-h2" style={{ color }}>{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--color-border)', overflow: 'hidden', minWidth: 0,
    }}>
      <div style={{
        padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-variant)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <span className="text-overline">{title}</span>
      </div>
      {children}
    </div>
  );
}

/** One head line: charged / paid / balance. */
function HeadRow({ label, accent, charged, paid, pending }: {
  label: string; accent: string; charged: number; paid: number; pending: number;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      gap: 'var(--space-2)', padding: 'var(--space-3)',
      borderBottom: '1px solid var(--color-divider)', flexWrap: 'wrap',
    }}>
      <div style={{ minWidth: 0 }}>
        <div className="text-body-sm" style={{ fontWeight: 600, color: accent }}>{label}</div>
        <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
          Paid {inr(paid)} of {inr(charged)}
        </div>
      </div>
      <span className="text-body-sm" style={{
        fontWeight: 700,
        color: pending > 0 ? 'var(--color-error)' : 'var(--color-success)',
        whiteSpace: 'nowrap',
      }}>
        {pending > 0 ? `${inr(pending)} balance` : 'Fully paid'}
      </span>
    </div>
  );
}

/**
 * Month grid for ECA / van. Cards, never a wide table — this has to read on a
 * phone as well as it does on a PC.
 */
function MonthGrid({ title, accent, headerBg, headerBorder, months }: {
  title: string; accent: string; headerBg: string; headerBorder: string; months: MonthCell[];
}) {
  if (months.length === 0) return null;
  return (
    <div style={{
      marginTop: 'var(--space-6)', background: 'var(--color-surface)',
      borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden',
    }}>
      <div style={{
        padding: 'var(--space-3) var(--space-4)', background: headerBg,
        borderBottom: `1px solid ${headerBorder}`,
      }}>
        <span className="text-overline" style={{ color: accent }}>{title}</span>
      </div>
      <div style={{
        padding: 'var(--space-4)', display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 'var(--space-3)',
      }}>
        {months.map(cell => {
          const state = cellState(cell);
          const c = CHIP_COLORS[state];
          return (
            <div key={cell.month} style={{
              padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
              background: state === 'paid' ? 'var(--color-success-bg)' : 'var(--color-surface-variant)',
              border: `1px solid ${state === 'paid' ? 'var(--color-success)' : 'var(--color-border)'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: 6, minWidth: 0,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{cell.month}</div>
                <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
                  {inr(cell.amount)}
                </div>
              </div>
              <span style={{
                color: c.color, fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap',
              }}>
                {chipLabel(cell, state)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Notice({ tone, children }: { tone: 'error' | 'info'; children: React.ReactNode }) {
  const c = tone === 'error'
    ? { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626' }
    : { bg: 'var(--color-surface-variant)', border: 'var(--color-border)', text: 'var(--color-text-secondary)' };
  return (
    <div style={{
      padding: 'var(--space-3) var(--space-4)', background: c.bg,
      border: `1px solid ${c.border}`, borderRadius: 'var(--radius-md)',
      marginBottom: 'var(--space-4)',
    }}>
      <span className="text-body-sm" style={{ color: c.text }}>{children}</span>
    </div>
  );
}

const HEAD_LABELS: Record<string, string> = {
  school: 'School Fee', eca: 'ECA Fee', van: 'Van Fee', other: 'Other',
};

/* ── Screen ───────────────────────────────────────────────────────────── */

export default function ParentFees() {
  const { user } = useAuth();
  const { school } = useSchool();
  const [child, setChild] = useState<Student | null>(null);
  const [row, setRow] = useState<RegisterRow | null>(null);
  const [payments, setPayments] = useState<PrincipalPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const academicYear = school?.academicYear;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user || !academicYear) return;
      setLoading(true);
      setLoadError(null);
      try {
        const [students, rows] = await Promise.all([
          StudentsService.getAll(academicYear),
          PrincipalRegisterService.listRows(academicYear),
        ]);
        const myChild = (students as unknown as Student[]).find(s => isParentOfStudent(user, s)) || null;
        const myRow = findRowForChild(rows, myChild);
        const myPayments = myRow ? await PrincipalPaymentsService.listByRow(myRow.id) : [];

        if (cancelled) return;
        setChild(myChild);
        setRow(myRow);
        setPayments(myPayments);
      } catch (error) {
        console.error('ParentFees load failed:', error);
        if (!cancelled) setLoadError(describeReadError(error, 'the fee details'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user, academicYear]);

  // Every number on this screen comes from the engine — nothing is recomputed
  // here, so the parent can never see a total the Principal does not.
  const summary: RowSummary | null = useMemo(
    () => (row ? computeRowSummary(row, payments) : null),
    [row, payments],
  );

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="text-h1">Fee Details</h2>
        {child && (
          <p className="text-body-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {child.name}{child.className ? ` • Class ${child.className}` : ''}
          </p>
        )}
      </div>

      {loadError && <Notice tone="error">{loadError}</Notice>}

      {!child && !loadError && (
        <Panel title="No student linked">
          <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
            <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              No student record is linked to this account. Please contact the school office.
            </p>
          </div>
        </Panel>
      )}

      {child && !row && !loadError && (
        <Panel title="Fees not published">
          <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
            <p className="text-body-sm" style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              Fee details are not published yet.
            </p>
            <p className="text-caption" style={{ color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>
              The school has not added {child.name} to this year&apos;s fee register. Please check
              back later or contact the school office.
            </p>
          </div>
        </Panel>
      )}

      {row && summary && (
        <>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 'var(--space-4)', marginBottom: 'var(--space-6)',
          }}>
            <StatCard label="Total Fees" value={inr(summary.totalCharged)} />
            <StatCard label="Total Paid" value={inr(summary.totalPaid)} color="var(--color-success)" />
            <StatCard
              label="Balance"
              value={inr(summary.totalPending)}
              color={summary.totalPending > 0 ? 'var(--color-error)' : 'var(--color-success)'}
            />
            <StatCard
              label="Due Now"
              value={inr(summary.totalDueNow)}
              color={summary.totalDueNow > 0 ? 'var(--color-error)' : 'var(--color-success)'}
            />
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 'var(--space-6)',
          }}>
            <Panel title="Fee Breakdown">
              <div style={{ padding: 'var(--space-2)' }}>
                <HeadRow
                  label="School Fee" accent="var(--color-text-secondary)"
                  charged={summary.school.charged} paid={summary.school.paid} pending={summary.school.pending}
                />
                <HeadRow
                  label="ECA Fee (month-wise below)" accent="#7C3AED"
                  charged={summary.eca.charged} paid={summary.eca.paid} pending={summary.eca.pending}
                />
                <HeadRow
                  label="Van Fee (month-wise below)" accent="#0369A1"
                  charged={summary.van.charged} paid={summary.van.paid} pending={summary.van.pending}
                />
                {summary.other.paid > 0 && (
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: 'var(--space-3)', borderBottom: '1px solid var(--color-divider)',
                  }}>
                    <span className="text-body-sm" style={{ color: 'var(--color-success)' }}>
                      Other payments received
                    </span>
                    <span className="text-body-sm" style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                      {inr(summary.other.paid)}
                    </span>
                  </div>
                )}
                <div style={{
                  marginTop: 'var(--space-2)', padding: 'var(--space-3)',
                  background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-sm)',
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <span className="text-body-sm" style={{ fontWeight: 700 }}>Total</span>
                  <span className="text-body-sm" style={{ fontWeight: 700 }}>{inr(summary.totalCharged)}</span>
                </div>
                <p className="text-caption" style={{
                  color: 'var(--color-text-tertiary)', padding: 'var(--space-2) var(--space-3) 0',
                }}>
                  A month becomes due only after it has ended — &ldquo;Due Now&rdquo; never counts
                  months still to come.
                </p>
              </div>
            </Panel>

            <Panel title="Payment History">
              {payments.length === 0 ? (
                <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                  <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                    No payments recorded yet.
                  </p>
                </div>
              ) : (
                <div style={{ padding: 'var(--space-2)' }}>
                  {payments.map(p => (
                    <div key={p.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)',
                      borderBottom: '1px solid var(--color-divider)',
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="text-body-sm" style={{ fontWeight: 600 }}>
                          {HEAD_LABELS[p.head] || 'Payment'}{p.month ? ` — ${p.month}` : ''}
                        </div>
                        <div className="text-caption" style={{ color: 'var(--color-text-tertiary)', fontSize: '0.7rem' }}>
                          {(p.mode || 'cash').toUpperCase()} • {p.dateKey || '—'}
                        </div>
                      </div>
                      <div className="text-body-sm" style={{ fontWeight: 600, color: 'var(--color-success)', whiteSpace: 'nowrap' }}>
                        {inr(p.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <MonthGrid
            title="Monthly ECA Fee Status"
            accent="#7C3AED" headerBg="#F5F3FF" headerBorder="#DDD6FE"
            months={summary.eca.months}
          />
          <MonthGrid
            title="Monthly Van Fee Status"
            accent="#0369A1" headerBg="#F0F9FF" headerBorder="#BAE6FD"
            months={summary.van.months}
          />
        </>
      )}
    </div>
  );
}
