'use client';

/* ============================================
   Fee Arrears Report — page key 'defaulters'
   ============================================
   Rebuilt on the STANDALONE Principal Register. It reads principalRegister +
   principalPayments through the shared register hook and takes every number
   from the pure engine (computeRowSummary) — it touches neither Firestore nor
   the legacy feePayments / feeStructures collections.

   What "arrears" means here is Sharmi's definition, not the calendar's: a
   student appears only when `totalDueNow > 0`, and a month counts only once it
   has ENDED. In August that means June and July — never the whole year. The
   "Pending" column still shows everything unpaid, so the difference between
   "owed eventually" and "chase today" is visible side by side.

   Responsive: a frozen-name-column grid on a PC, one card per student on a
   phone. Printing always uses the grid.
*/

import React, { useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';
import Input, { Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/SharedUI';
import { DownloadIcon, PrinterIcon } from '@/components/ui/Icons';
import { toDateKey } from '@/lib/fee-utils';
import { hasCapability } from '@/lib/permissions';
import {
  exportPrincipalArrearsExcel, exportPrincipalArrearsPdf,
  type DefaulterExportMeta, type PrincipalArrearsExportRow,
} from '@/lib/export-utils';
import type { MonthCell, RegisterRow, RowSummary } from '@/types/principal';
import { compareClassNames, compareStudents, inr } from './registers/register-shared';
import {
  Chip, EmptyBlock, ErrorBlock, LoadingBlock, Money, NoticeBanner, StatGrid,
  surfaceCard, table, tableScroll, td, tdRight, tdSticky, th, thRight, thSticky, useIsNarrow,
} from './registers/register-ui';
import { useRegisterData } from './registers/useRegisterData';

/** One student's arrears, already reduced to what the report prints. */
interface ArrearsRow {
  row: RegisterRow;
  school: number;
  eca: number;
  ecaMonthsDue: number;
  van: number;
  vanMonthsDue: number;
  monthsBehind: number;
  dueNow: number;
  pending: number;
}

/** Months that have ENDED and still owe money — the only ones chaseable. */
const dueMonths = (cells: MonthCell[]): MonthCell[] =>
  cells.filter(cell => cell.isDue && cell.pending > 0);

function toArrearsRow(row: RegisterRow, summary: RowSummary): ArrearsRow {
  const ecaDue = dueMonths(summary.eca.months);
  const vanDue = dueMonths(summary.van.months);
  const behind = new Set([...ecaDue, ...vanDue].map(cell => cell.month));
  return {
    row,
    school: summary.school.pending,
    eca: summary.eca.dueNow,
    ecaMonthsDue: ecaDue.length,
    van: summary.van.dueNow,
    vanMonthsDue: vanDue.length,
    monthsBehind: behind.size,
    dueNow: summary.totalDueNow,
    pending: summary.totalPending,
  };
}

const PRINT_CSS = `
@media print {
  body * { visibility: hidden; }
  .defaulter-print-area, .defaulter-print-area * { visibility: visible; }
  .defaulter-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
  .defaulter-no-print { display: none !important; }
  .defaulter-print-area table { font-size: 11px !important; }
  .defaulter-print-area section { break-inside: avoid; }
}
`;

export default function PrincipalDefaulters() {
  const { role } = useAuth();
  const { school } = useSchool();
  const { showToast } = useToast();
  const narrow = useIsNarrow();
  const data = useRegisterData(school?.academicYear);

  const canView = hasCapability(role, 'viewPrincipalRegister');

  const [classFilter, setClassFilter] = useState('');
  const [minDue, setMinDue] = useState('');
  const [exporting, setExporting] = useState(false);

  const minDueNum = Number(minDue) || 0;

  const { rows: allRows, summaryFor } = data;

  const allArrears = useMemo(
    () => allRows
      .map(row => toArrearsRow(row, summaryFor(row.id)))
      .filter(item => item.dueNow > 0),
    [allRows, summaryFor],
  );

  const classOptions = useMemo(() => Array.from(
    new Set(allRows.map(row => row.className).filter(Boolean)),
  ).sort(compareClassNames), [allRows]);

  const filtered = useMemo(() => allArrears
    .filter(item => !classFilter || item.row.className === classFilter)
    .filter(item => item.dueNow >= minDueNum),
  [allArrears, classFilter, minDueNum]);

  const groups = useMemo(() => {
    const byClass = new Map<string, ArrearsRow[]>();
    for (const item of filtered) {
      const key = item.row.className || 'Unassigned';
      byClass.set(key, [...(byClass.get(key) ?? []), item]);
    }
    return Array.from(byClass.entries())
      .map(([className, items]) => ({
        className,
        items: [...items].sort((a, b) => compareStudents(a.row, b.row)),
      }))
      .sort((a, b) => compareClassNames(a.className, b.className));
  }, [filtered]);

  const totals = useMemo(() => filtered.reduce((acc, item) => ({
    school: acc.school + item.school,
    eca: acc.eca + item.eca,
    van: acc.van + item.van,
    dueNow: acc.dueNow + item.dueNow,
    pending: acc.pending + item.pending,
  }), { school: 0, eca: 0, van: 0, dueNow: 0, pending: 0 }), [filtered]);

  const handleExport = async (format: 'excel' | 'pdf') => {
    if (exporting) return;
    setExporting(true);
    try {
      const rows: PrincipalArrearsExportRow[] = filtered.map(item => ({
        rollNo: item.row.rollNo || '',
        student: item.row.name,
        className: item.row.className || '',
        section: item.row.sectionName || '',
        school: item.school,
        eca: item.eca,
        ecaMonthsDue: item.ecaMonthsDue,
        van: item.van,
        vanMonthsDue: item.vanMonthsDue,
        monthsBehind: item.monthsBehind,
        dueNow: item.dueNow,
        pending: item.pending,
      }));
      const meta: DefaulterExportMeta = {
        schoolName: school?.name || 'School',
        academicYear: school?.academicYear || '',
        generatedOn: toDateKey(data.today.getTime() > 0 ? data.today : new Date()),
        classFilter: classFilter || undefined,
        minPending: minDueNum > 0 ? minDueNum : undefined,
      };
      if (format === 'excel') await exportPrincipalArrearsExcel(rows, meta);
      else await exportPrincipalArrearsPdf(rows, meta);
      showToast('Export ready — check your downloads');
    } catch (e) {
      console.error('[principal-register] arrears export failed', { format, error: e });
      showToast('Export failed — no file was generated. Please retry.', 'error');
    } finally {
      setExporting(false);
    }
  };

  if (!canView) {
    return (
      <div className="page-container">
        <NoticeBanner tone="warning">
          You do not have access to the arrears report. If your role changed recently,
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
          title="Could not load the arrears report"
          message={data.error}
          onRetry={() => { void data.reload(); }}
        />
      </div>
    );
  }

  return (
    <div className="page-container defaulter-print-area">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 className="text-h1">Fee Arrears</h2>
            <Badge variant="primary">{school?.academicYear}</Badge>
          </div>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            {filtered.length} student{filtered.length === 1 ? '' : 's'} to chase today
            {' • '}Due now: {inr(totals.dueNow)}
          </p>
        </div>
        <div className="defaulter-no-print" style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => window.print()} icon={<PrinterIcon size={16} />}>Print</Button>
          <Button variant="secondary" onClick={() => handleExport('excel')} disabled={exporting} icon={<DownloadIcon size={16} />}>Excel</Button>
          <Button variant="secondary" onClick={() => handleExport('pdf')} disabled={exporting} icon={<DownloadIcon size={16} />}>PDF</Button>
        </div>
      </div>

      <NoticeBanner tone="info">
        A month is counted only after it ends. In August, June and July are due — the rest of the
        year is not arrears yet. &ldquo;Pending&rdquo; shows everything still unpaid, due or not.
      </NoticeBanner>

      <div style={{ ...surfaceCard, padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <StatGrid
          stats={[
            { label: 'Students', value: String(filtered.length) },
            { label: 'School due', value: inr(totals.school), tone: 'due' },
            { label: 'ECA due', value: inr(totals.eca), tone: 'due' },
            { label: 'Van due', value: inr(totals.van), tone: 'due' },
            { label: 'Due now', value: inr(totals.dueNow), tone: 'due' },
            { label: 'Total pending', value: inr(totals.pending), tone: 'pending' },
          ]}
        />
      </div>

      <div
        className="defaulter-no-print"
        style={{
          display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end',
          flexWrap: 'wrap', marginBottom: 'var(--space-4)',
        }}
      >
        <div style={{ width: narrow ? '100%' : 220 }}>
          <Select
            label="Class"
            value={classFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setClassFilter(e.target.value)}
            options={[
              { value: '', label: 'All classes' },
              ...classOptions.map(name => ({ value: name, label: name })),
            ]}
          />
        </div>
        <div style={{ width: narrow ? '100%' : 200 }}>
          <Input
            label="Minimum due (₹)"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="0"
            value={minDue}
            onChange={e => setMinDue(e.target.value)}
          />
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyBlock
          title={allArrears.length === 0 ? 'Nobody is in arrears' : 'No student matches these filters'}
          hint={allArrears.length === 0
            ? 'Every student is up to date on the months that have ended.'
            : 'Widen the class filter or lower the minimum due.'}
        />
      ) : groups.map(group => (
        <ClassArrears key={group.className} className={group.className} items={group.items} narrow={narrow} />
      ))}
    </div>
  );
}

/* ── Per-class block ──────────────────────────────────────────────────── */

function ClassArrears({ className, items, narrow }: {
  className: string;
  items: ArrearsRow[];
  narrow: boolean;
}) {
  const subtotal = items.reduce((sum, item) => sum + item.dueNow, 0);
  return (
    <section style={{ ...surfaceCard, marginBottom: 'var(--space-4)', overflow: 'hidden' }}>
      <div style={{
        padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface-variant)', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap',
      }}>
        <span className="text-overline">
          {className} — {items.length} student{items.length === 1 ? '' : 's'} in arrears
        </span>
        <span className="text-body-sm" style={{ fontWeight: 700, color: 'var(--color-error)' }}>
          Due now: {inr(subtotal)}
        </span>
      </div>
      {narrow ? <ArrearsCards items={items} /> : <ArrearsGrid items={items} />}
    </section>
  );
}

function ArrearsGrid({ items }: { items: ArrearsRow[] }) {
  return (
    <div style={tableScroll}>
      <table style={table}>
        <thead>
          <tr>
            <th style={thSticky}>Student</th>
            <th style={th}>Sec / Roll</th>
            <th style={thRight}>School</th>
            <th style={thRight}>ECA</th>
            <th style={thRight}>Van</th>
            <th style={thRight} title="Distinct ECA and van months that have ended and are unpaid">
              Months behind
            </th>
            <th style={thRight}>Due now</th>
            <th style={thRight} title="Everything unpaid, including months that have not ended">
              Pending
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.row.id}>
              <td style={tdSticky}>
                {item.row.name}
                {item.row.isScholarship && <span style={{ marginLeft: 6 }}><Chip label="Scholarship" /></span>}
                {item.row.teacherName && (
                  <div style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--color-text-tertiary)' }}>
                    {item.row.teacherName}
                  </div>
                )}
              </td>
              <td style={td}>{[item.row.sectionName, item.row.rollNo].filter(Boolean).join(' · ') || '—'}</td>
              <td style={tdRight}><Money amount={item.school} tone="due" /></td>
              <td style={tdRight}>
                <Money amount={item.eca} tone="due" />
                {item.ecaMonthsDue > 0 && (
                  <span style={{ color: 'var(--color-text-tertiary)' }}> ({item.ecaMonthsDue})</span>
                )}
              </td>
              <td style={tdRight}>
                <Money amount={item.van} tone="due" />
                {item.vanMonthsDue > 0 && (
                  <span style={{ color: 'var(--color-text-tertiary)' }}> ({item.vanMonthsDue})</span>
                )}
              </td>
              <td style={tdRight}>{item.monthsBehind || '—'}</td>
              <td style={tdRight}><Money amount={item.dueNow} tone="due" bold /></td>
              <td style={tdRight}><Money amount={item.pending} tone="pending" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ArrearsCards({ items }: { items: ArrearsRow[] }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-2)', padding: 'var(--space-3)' }}>
      {items.map(item => (
        <div
          key={item.row.id}
          style={{ ...surfaceCard, borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}
        >
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            gap: 'var(--space-2)', marginBottom: 'var(--space-2)',
          }}>
            <div>
              <div style={{ fontWeight: 700 }}>{item.row.name}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}>
                {[item.row.sectionName, item.row.rollNo ? `Roll ${item.row.rollNo}` : '', item.row.teacherName]
                  .filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
            <Chip label={`${item.monthsBehind} mo behind`} tone={item.monthsBehind > 0 ? 'due' : 'neutral'} />
          </div>
          <StatGrid
            compact
            stats={[
              { label: 'School', value: inr(item.school), tone: 'due' },
              { label: `ECA (${item.ecaMonthsDue})`, value: inr(item.eca), tone: 'due' },
              { label: `Van (${item.vanMonthsDue})`, value: inr(item.van), tone: 'due' },
              { label: 'Due now', value: inr(item.dueNow), tone: 'due' },
              { label: 'Pending', value: inr(item.pending), tone: 'pending' },
            ]}
          />
        </div>
      ))}
    </div>
  );
}
