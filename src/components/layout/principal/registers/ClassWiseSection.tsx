'use client';

/* ============================================
   Class-wise Register — page key 'principal-classes'
   ============================================
   Sharmi's second automatic register. She types a student into the fees note
   once; this screen is a VIEW of those same rows grouped by class — never a
   copy, and never a second place to edit them.

   The only mutation offered here is "Record payment", because that is the
   thing she does while standing in front of a class list. Fee amounts stay
   editable in one place only (the note, or the responsible teacher's
   register), so the two registers can never disagree.

   Classes run Pre-KG → Class 5 via the alias-aware progression in lib/utils.
*/

import React, { useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/SharedUI';
import { SearchInput } from '@/components/ui/Input';
import { hasCapability } from '@/lib/permissions';
import { computeClassSummary } from '@/lib/principal-fees';
import type { ClassSummary, RegisterRow, RowSummary } from '@/types/principal';
import { groupRowsByClass, inr, toActor } from './register-shared';
import {
  Chip, EmptyBlock, ErrorBlock, LoadingBlock, NoticeBanner, StatGrid,
  surfaceCard, useIsNarrow,
} from './register-ui';
import StudentRegisterList from './StudentRegisterList';
import StudentDetailSheet from './StudentDetailSheet';
import RecordPaymentModal from './RecordPaymentModal';
import { useRegisterData } from './useRegisterData';

export default function ClassWiseSection() {
  const { user, role } = useAuth();
  const { school } = useSchool();
  const narrow = useIsNarrow();
  const data = useRegisterData(school?.academicYear);

  const canView = hasCapability(role, 'viewPrincipalRegister');
  const canRecord = hasCapability(role, 'recordPrincipalPayments');
  const actor = useMemo(() => toActor(user, role), [user, role]);

  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [duesOnly, setDuesOnly] = useState(false);
  const [detailRowId, setDetailRowId] = useState<string | null>(null);
  const [payRowId, setPayRowId] = useState<string | null>(null);

  const term = search.trim().toLowerCase();

  const { rows: allRows, summaryFor } = data;

  const visibleRows = useMemo(() => allRows.filter(row => {
    if (duesOnly && summaryFor(row.id).totalDueNow <= 0) return false;
    if (!term) return true;
    return `${row.name} ${row.className} ${row.sectionName ?? ''} ${row.rollNo ?? ''}`
      .toLowerCase().includes(term);
  }), [allRows, summaryFor, duesOnly, term]);

  const groups = useMemo(() => groupRowsByClass(visibleRows), [visibleRows]);

  /** Group totals come from the engine, never from summing UI numbers. */
  const classTotals = useMemo(() => {
    const summaries = computeClassSummary(visibleRows, data.paymentsByRowId, data.today);
    return new Map(summaries.map(summary => [summary.className, summary]));
  }, [visibleRows, data.paymentsByRowId, data.today]);

  const overall = useMemo(() => Array.from(classTotals.values()).reduce(
    (acc, item) => ({
      students: acc.students + item.students,
      charged: acc.charged + item.charged,
      paid: acc.paid + item.paid,
      pending: acc.pending + item.pending,
      dueNow: acc.dueNow + item.dueNow,
    }),
    { students: 0, charged: 0, paid: 0, pending: 0, dueNow: 0 },
  ), [classTotals]);

  const detailRow = data.rows.find(row => row.id === detailRowId) ?? null;
  const payRow = data.rows.find(row => row.id === payRowId) ?? null;

  const allExpanded = groups.length > 0 && groups.every(group => expanded[group.className]);
  const toggleAll = () => setExpanded(
    allExpanded ? {} : Object.fromEntries(groups.map(group => [group.className, true])),
  );

  if (!canView) {
    return (
      <div className="page-container">
        <NoticeBanner tone="warning">
          You do not have access to the class-wise register. If your role changed recently,
          refresh the app.
        </NoticeBanner>
      </div>
    );
  }

  if (data.loading) return <div className="page-container"><LoadingBlock /></div>;

  if (data.error) {
    return (
      <div className="page-container">
        <ErrorBlock
          title="Could not load the class-wise register"
          message={data.error}
          onRetry={() => { void data.reload(); }}
        />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 className="text-h1">Class-wise Register</h2>
            <Badge variant="primary">{school?.academicYear}</Badge>
          </div>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            The same rows as the fees note, grouped by class. Fee amounts are edited in the note.
          </p>
        </div>
        {groups.length > 0 && (
          <Button variant="secondary" onClick={toggleAll}>
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </Button>
        )}
      </div>

      <div style={{ ...surfaceCard, padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <StatGrid
          stats={[
            { label: 'Students', value: String(overall.students) },
            { label: 'Charged', value: inr(overall.charged) },
            { label: 'Collected', value: inr(overall.paid), tone: 'paid' },
            { label: 'Pending', value: inr(overall.pending), tone: 'pending' },
            { label: 'Due now', value: inr(overall.dueNow), tone: 'due' },
          ]}
        />
      </div>

      <div style={{
        display: 'flex', gap: 'var(--space-3)', alignItems: 'center',
        flexWrap: 'wrap', marginBottom: 'var(--space-4)',
      }}>
        <div style={{ flex: narrow ? '1 1 100%' : '0 1 320px' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search student, section or roll" />
        </div>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem',
          fontWeight: 500, cursor: 'pointer',
        }}>
          <input type="checkbox" checked={duesOnly} onChange={e => setDuesOnly(e.target.checked)} />
          Only students with dues today
        </label>
      </div>

      {groups.length === 0 ? (
        <EmptyBlock
          title="Nothing to show"
          hint={data.rows.length === 0
            ? 'The fees note is still empty — add students there first.'
            : 'No student matches the current search or filter.'}
        />
      ) : groups.map(group => (
        <ClassGroup
          key={group.className}
          className={group.className}
          rows={group.rows}
          totals={classTotals.get(group.className)}
          expanded={Boolean(term) || Boolean(expanded[group.className])}
          onToggle={() => setExpanded(prev => ({ ...prev, [group.className]: !prev[group.className] }))}
          summaryFor={data.summaryFor}
          onOpen={row => setDetailRowId(row.id)}
          onRecordPayment={canRecord ? row => setPayRowId(row.id) : undefined}
        />
      ))}

      {detailRow && (
        <StudentDetailSheet
          row={detailRow}
          summary={data.summaryFor(detailRow.id)}
          payments={data.paymentsFor(detailRow.id)}
          onClose={() => setDetailRowId(null)}
          onRecordPayment={canRecord ? () => { setPayRowId(detailRow.id); setDetailRowId(null); } : undefined}
        />
      )}

      {payRow && (
        <RecordPaymentModal
          row={payRow}
          summary={data.summaryFor(payRow.id)}
          payments={data.paymentsFor(payRow.id)}
          actor={actor}
          onClose={() => setPayRowId(null)}
          onSaved={data.refreshQuietly}
        />
      )}
    </div>
  );
}

/* ── Collapsible class group ──────────────────────────────────────────── */

interface ClassGroupProps {
  className: string;
  rows: RegisterRow[];
  totals: ClassSummary | undefined;
  expanded: boolean;
  onToggle: () => void;
  summaryFor: (rowId: string) => RowSummary;
  onOpen: (row: RegisterRow) => void;
  onRecordPayment?: (row: RegisterRow) => void;
}

function ClassGroup({
  className, rows, totals, expanded, onToggle, summaryFor, onOpen, onRecordPayment,
}: ClassGroupProps) {
  const defaulters = rows.filter(row => summaryFor(row.id).totalDueNow > 0).length;

  return (
    <section style={{ ...surfaceCard, marginBottom: 'var(--space-4)', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        style={{
          width: '100%', textAlign: 'left', cursor: 'pointer', border: 'none',
          padding: 'var(--space-3) var(--space-4)', font: 'inherit',
          background: 'var(--color-surface-variant)',
          borderBottom: expanded ? '1px solid var(--color-border)' : 'none',
          display: 'grid', gap: 'var(--space-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700 }}>{expanded ? '▾' : '▸'} {className}</span>
          <Chip label={`${rows.length} student${rows.length === 1 ? '' : 's'}`} />
          {defaulters > 0 && <Chip label={`${defaulters} with dues`} tone="due" />}
        </div>
        <StatGrid
          compact
          stats={[
            { label: 'Charged', value: inr(totals?.charged ?? 0) },
            { label: 'Collected', value: inr(totals?.paid ?? 0), tone: 'paid' },
            { label: 'Pending', value: inr(totals?.pending ?? 0), tone: 'pending' },
            { label: 'Due now', value: inr(totals?.dueNow ?? 0), tone: 'due' },
          ]}
        />
      </button>

      {expanded && (
        <StudentRegisterList
          rows={rows}
          summaryFor={summaryFor}
          onOpen={onOpen}
          onRecordPayment={onRecordPayment}
        />
      )}
    </section>
  );
}
