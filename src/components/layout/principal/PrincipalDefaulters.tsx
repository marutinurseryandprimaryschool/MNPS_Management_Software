'use client';

/* ============================================
   Principal Defaulter Report — page key 'defaulters'
   ============================================
   Class-wise, month-wise arrears built ONLY from the fee-utils summarizers
   (no inline fee math). Buckets per student: Previous Balance first, terms,
   ECA months, bus months, additional fees — with the Unallocated credit
   visible (doc D13 / Addendum issue 9). Printable + Excel/PDF exports. */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSchool } from '@/context/SchoolContext';
import { useToast } from '@/components/ui/Toast';
import {
  ClassesService, StudentsService, FeeStructuresService, FeePaymentsService, BusRoutesService,
} from '@/lib/firestore-service';
import Button from '@/components/ui/Button';
import Input, { Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/SharedUI';
import { DownloadIcon, PrinterIcon } from '@/components/ui/Icons';
import {
  computeStudentFeeSummary, isDefaulter, toDateKey,
  type StudentFeeSummary,
} from '@/lib/fee-utils';
import {
  exportDefaulterListExcel, exportDefaulterListPdf,
  type DefaulterExportRow, type DefaulterExportMeta,
} from '@/lib/export-utils';
import { StudentStatus } from '@/types/enums';
import type { BusRoute, Class, FeePayment, FeeStructure, Student } from '@/types/models';
import { describeReadError } from './principal-shared';

interface DefaulterRow {
  student: Student;
  className: string;
  sectionName: string;
  hasStructure: boolean;
  scaleWarning: boolean;
  previousBalance: number;
  terms: number;
  eca: number;
  ecaMonthsDue: number;
  bus: number;
  busMonthsDue: number;
  additional: number;
  unallocated: number;
  totalDue: number;
}

function toRow(student: Student, summary: StudentFeeSummary, className: string, sectionName: string): DefaulterRow {
  const sumKind = (kind: string) => summary.buckets
    .filter(b => b.kind === kind)
    .reduce((s, b) => s + b.pendingDue, 0);
  const countKind = (kind: string) => summary.buckets
    .filter(b => b.kind === kind && b.pendingDue > 0).length;
  return {
    student,
    className,
    sectionName,
    hasStructure: summary.hasStructure,
    scaleWarning: summary.scaleWarning,
    previousBalance: sumKind('previousBalance'),
    terms: sumKind('term'),
    eca: sumKind('eca'),
    ecaMonthsDue: countKind('eca'),
    bus: sumKind('bus'),
    busMonthsDue: countKind('bus'),
    additional: sumKind('additional'),
    unallocated: summary.unallocated,
    totalDue: summary.totalDuePending,
  };
}

const inr = (n: number): string => `₹${Math.round(n).toLocaleString('en-IN')}`;

const PRINT_CSS = `
@media print {
  body * { visibility: hidden; }
  .defaulter-print-area, .defaulter-print-area * { visibility: visible; }
  .defaulter-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
  .defaulter-no-print { display: none !important; }
  .defaulter-print-area table { font-size: 11px !important; }
}
`;

export default function PrincipalDefaulters() {
  const { school } = useSchool();
  const { showToast } = useToast();

  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [busRoutes, setBusRoutes] = useState<BusRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [classFilter, setClassFilter] = useState('');
  const [minPending, setMinPending] = useState('');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!school?.academicYear) return;
    setLoadError(null);
    try {
      const [c, s, fs, p, br] = await Promise.all([
        ClassesService.getAll(school.academicYear),
        StudentsService.getAll(school.academicYear),
        FeeStructuresService.getAll(school.academicYear),
        FeePaymentsService.getAll(school.academicYear),
        BusRoutesService.getAll(),
      ]);
      setClasses(c as unknown as Class[]);
      setStudents(s as unknown as Student[]);
      setStructures(fs as unknown as FeeStructure[]);
      setPayments(p as unknown as FeePayment[]);
      setBusRoutes(br as unknown as BusRoute[]);
    } catch (err) {
      console.error('Defaulter report load failed', err);
      setLoadError(describeReadError(err, 'the defaulter report'));
    }
  }, [school?.academicYear]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // ── Engine pass: one summary per active student ──
  const allRows = useMemo(() => {
    const paymentsByStudent = new Map<string, FeePayment[]>();
    for (const p of payments) {
      const list = paymentsByStudent.get(p.studentId) || [];
      paymentsByStudent.set(p.studentId, [...list, p]);
    }
    const structureByClass = new Map(structures.map(fs => [fs.classId, fs]));
    const classById = new Map(classes.map(c => [c.id, c]));
    const scholarships = school?.settings?.scholarships || [];

    return students
      .filter(st => (st.status || StudentStatus.ACTIVE) === StudentStatus.ACTIVE)
      .map(st => {
        const cls = classById.get(st.classId);
        const summary = computeStudentFeeSummary({
          structure: structureByClass.get(st.classId) ?? null,
          student: st,
          busRoutes,
          scholarships,
          academicYear: school?.academicYear,
        }, paymentsByStudent.get(st.id) || []);
        const sectionName = st.sectionName
          || cls?.sections?.find(sec => sec.id === st.sectionId)?.name
          || '';
        return { summary, row: toRow(st, summary, st.className || cls?.name || '', sectionName) };
      })
      .filter(({ summary }) => isDefaulter(summary))
      .map(({ row }) => row);
  }, [students, payments, structures, classes, busRoutes, school?.settings?.scholarships, school?.academicYear]);

  // ── Filters ──
  const minPendingNum = Number(minPending) || 0;
  const filteredRows = useMemo(() => allRows
    .filter(r => !classFilter || r.student.classId === classFilter)
    .filter(r => r.totalDue >= minPendingNum), [allRows, classFilter, minPendingNum]);

  // ── Class-wise grouping (classes already sorted by name) ──
  const groups = useMemo(() => classes
    .map(cls => ({
      cls,
      rows: filteredRows
        .filter(r => r.student.classId === cls.id)
        .sort((a, b) => (a.sectionName + a.student.name).localeCompare(b.sectionName + b.student.name)),
    }))
    .filter(g => g.rows.length > 0), [classes, filteredRows]);

  const classesWithoutStructure = useMemo(() => {
    const withStructure = new Set(structures.map(fs => fs.classId));
    return classes.filter(c => !withStructure.has(c.id)).map(c => c.name);
  }, [classes, structures]);

  const classesMissingTermDueDates = useMemo(() => structures
    .filter(fs => (fs.terms || []).some(t => (Number(t.amount) || 0) > 0 && !fs.termDueDates?.[t.name]))
    .map(fs => fs.className || classes.find(c => c.id === fs.classId)?.name || fs.classId), [structures, classes]);

  const grandTotal = filteredRows.reduce((s, r) => s + r.totalDue, 0);

  // ── Exports ──
  const buildExport = (): { rows: DefaulterExportRow[]; meta: DefaulterExportMeta } => ({
    rows: filteredRows.map(r => ({
      admissionNumber: r.student.admissionNumber || '',
      student: r.student.name,
      className: r.className,
      section: r.sectionName,
      previousBalance: r.previousBalance,
      terms: r.terms,
      eca: r.eca,
      ecaMonthsDue: r.ecaMonthsDue,
      bus: r.bus,
      busMonthsDue: r.busMonthsDue,
      additional: r.additional,
      unallocated: r.unallocated,
      totalDue: r.totalDue,
    })),
    meta: {
      schoolName: school?.name || 'School',
      academicYear: school?.academicYear || '',
      generatedOn: toDateKey(new Date()),
      classFilter: classFilter ? classes.find(c => c.id === classFilter)?.name : undefined,
      minPending: minPendingNum > 0 ? minPendingNum : undefined,
    },
  });

  const handleExport = async (format: 'excel' | 'pdf') => {
    if (exporting) return;
    setExporting(true);
    try {
      const { rows, meta } = buildExport();
      if (format === 'excel') await exportDefaulterListExcel(rows, meta);
      else await exportDefaulterListPdf(rows, meta);
      showToast('Export ready — check your downloads');
    } catch (e) {
      console.error('Defaulter export failed', { format, error: e });
      showToast('Export failed — no file was generated. Please retry.', 'error');
    } finally {
      setExporting(false);
    }
  };

  // ── Render ──
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
        <div style={{
          padding: 'var(--space-8)', textAlign: 'center', background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)',
        }}>
          <p className="text-body" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>Could not load the defaulter report</p>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>{loadError}</p>
          <Button variant="primary" onClick={() => { setLoading(true); load().finally(() => setLoading(false)); }}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container defaulter-print-area">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 className="text-h1">Defaulter Report</h2>
            <Badge variant="primary">{school?.academicYear}</Badge>
          </div>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            {filteredRows.length} student{filteredRows.length === 1 ? '' : 's'} with dues • Total due: {inr(grandTotal)}
          </p>
        </div>
        <div className="defaulter-no-print" style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => window.print()} icon={<PrinterIcon size={16} />}>Print</Button>
          <Button variant="secondary" onClick={() => handleExport('excel')} disabled={exporting} icon={<DownloadIcon size={16} />}>Excel</Button>
          <Button variant="secondary" onClick={() => handleExport('pdf')} disabled={exporting} icon={<DownloadIcon size={16} />}>PDF</Button>
        </div>
      </div>

      {/* Setup nudges */}
      {classesWithoutStructure.length > 0 && (
        <NoticeBanner tone="warning">
          No fee structure set for: {classesWithoutStructure.join(', ')}. Students there can only
          appear via Previous Balance dues.
        </NoticeBanner>
      )}
      {classesMissingTermDueDates.length > 0 && (
        <NoticeBanner tone="info">
          Term due dates missing for: {classesMissingTermDueDates.join(', ')}. Terms without a due
          date are not counted as due yet — set them in Fee Structures.
        </NoticeBanner>
      )}

      {/* Filters */}
      <div className="defaulter-no-print" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
        <div style={{ width: 220 }}>
          <Select
            label="Class"
            value={classFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setClassFilter(e.target.value)}
            options={[{ value: '', label: 'All classes' }, ...classes.map(c => ({ value: c.id, label: c.name }))]}
          />
        </div>
        <div style={{ width: 200 }}>
          <Input
            label="Min pending (₹)"
            type="number"
            min={0}
            placeholder="0"
            value={minPending}
            onChange={e => setMinPending(e.target.value)}
          />
        </div>
      </div>

      {groups.length === 0 ? (
        <div style={{
          padding: 'var(--space-8)', textAlign: 'center', background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)',
        }}>
          <p className="text-body" style={{ fontWeight: 600 }}>No defaulters found</p>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            Every student matching the filters is up to date on due fees.
          </p>
        </div>
      ) : groups.map(({ cls, rows }) => (
        <ClassGroup key={cls.id} className={cls.name} rows={rows} />
      ))}
    </div>
  );
}

/* ── Subcomponents ────────────────────────────────────────────────────── */

function NoticeBanner({ tone, children }: { tone: 'warning' | 'info'; children: React.ReactNode }) {
  return (
    <div style={{
      padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-3)',
      borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 500,
      background: tone === 'warning' ? 'var(--color-warning-bg)' : 'var(--color-info-bg)',
      color: tone === 'warning' ? 'var(--color-warning)' : 'var(--color-info)',
    }}>
      {children}
    </div>
  );
}

function ClassGroup({ className, rows }: { className: string; rows: DefaulterRow[] }) {
  const subtotal = rows.reduce((s, r) => s + r.totalDue, 0);
  return (
    <div style={{
      background: 'var(--color-surface)', borderRadius: 'var(--radius-md)',
      border: '1px solid var(--color-border)', overflowX: 'auto', marginBottom: 'var(--space-4)',
    }}>
      <div style={{
        padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface-variant)', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap',
      }}>
        <span className="text-overline">{className} — {rows.length} defaulter{rows.length === 1 ? '' : 's'}</span>
        <span className="text-body-sm" style={{ fontWeight: 700, color: '#DC2626' }}>Due: {inr(subtotal)}</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ background: 'var(--color-surface-variant)' }}>
            <th style={th}>Adm No</th>
            <th style={th}>Student</th>
            <th style={th}>Sec</th>
            <th style={thRight}>Prev Bal</th>
            <th style={thRight}>Terms</th>
            <th style={thRight}>ECA (mo)</th>
            <th style={thRight}>Bus (mo)</th>
            <th style={thRight}>Addl</th>
            <th style={thRight}>Unalloc</th>
            <th style={thRight}>Total Due</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.student.id} style={{ borderTop: '1px solid var(--color-divider)' }}>
              <td style={td}>{r.student.admissionNumber || '—'}</td>
              <td style={{ ...td, fontWeight: 600 }}>
                {r.student.name}
                {r.scaleWarning && (
                  <span title="Fee override is larger than the standard fee — check the adjustment" style={{ marginLeft: 6 }}>⚠</span>
                )}
                {!r.hasStructure && (
                  <span title="No fee structure set for this class" style={{ marginLeft: 6, color: 'var(--color-warning)' }}>•</span>
                )}
              </td>
              <td style={td}>{r.sectionName || '—'}</td>
              <MoneyCell amount={r.previousBalance} strong />
              <MoneyCell amount={r.terms} />
              <MoneyCell amount={r.eca} suffix={r.ecaMonthsDue > 0 ? ` (${r.ecaMonthsDue})` : ''} />
              <MoneyCell amount={r.bus} suffix={r.busMonthsDue > 0 ? ` (${r.busMonthsDue})` : ''} />
              <MoneyCell amount={r.additional} />
              <td style={{ ...tdRight, color: r.unallocated > 0 ? '#7C3AED' : 'var(--color-text-tertiary)' }}>
                {r.unallocated > 0 ? `−${inr(r.unallocated)}` : '—'}
              </td>
              <td style={{ ...tdRight, fontWeight: 700, color: '#DC2626' }}>{inr(r.totalDue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MoneyCell({ amount, suffix = '', strong = false }: { amount: number; suffix?: string; strong?: boolean }) {
  if (amount <= 0) return <td style={{ ...tdRight, color: 'var(--color-text-tertiary)' }}>—</td>;
  return <td style={{ ...tdRight, fontWeight: strong ? 700 : 500 }}>{inr(amount)}{suffix}</td>;
}

const th: React.CSSProperties = {
  textAlign: 'left', padding: '8px 12px',
  fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
  color: 'var(--color-text-tertiary)', borderBottom: '1px solid var(--color-border)',
};
const thRight: React.CSSProperties = { ...th, textAlign: 'right' };
const td: React.CSSProperties = { padding: '8px 12px' };
const tdRight: React.CSSProperties = { ...td, textAlign: 'right' };
