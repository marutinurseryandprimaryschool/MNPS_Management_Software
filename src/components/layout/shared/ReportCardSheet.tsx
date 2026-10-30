'use client';
/* eslint-disable @typescript-eslint/no-explicit-any -- report data comes from untyped Firestore docs, as in SharedReportCard. */

/* ============================================
   Report card sheet — the printed table, in the school's two paper formats
   ============================================
   KG (Pre-KG, LKG, UKG): one mark per subject per exam, grouped I / II / III
   Term; rows Total, Grade, Neatness, Working days, Remarks, signatures; the
   grade range printed underneath. A mark may be a number, "ab", "-" or a
   grade letter, written exactly as on the card.

   STD (Class 1–5): FA 40 / SA 60 / Total 100 / Grade per exam; subjects
   without an FA/SA split (GK, Computer, Hindi) carry a total only; rows
   Total, Average, Grade, then the co-scholastic rows and signatures.

   Presentation only. The parent screen owns loading, drafts and saving.
*/

import React from 'react';
import {
  getGrade, kgColumnSummary, stdColumnSummary, parseKgMark, parseMark,
  KG_GRADE_SCALE, KG_PASS_MARK, REPORT_FA_MAX, REPORT_SA_MAX, type CoField,
} from '@/lib/report-card-utils';

export const EXAM_COLUMNS = [
  { value: 'i_mid_term', label: 'I MID TERM', kgLabel: 'I MID Term' },
  { value: 'quarterly', label: 'QUARTERLY', kgLabel: 'Quarterly Examination' },
  { value: 'ii_mid_term', label: 'II MID TERM', kgLabel: 'II MID Term' },
  { value: 'half_yearly', label: 'HALF YEARLY', kgLabel: 'Half Yearly Examination' },
  { value: 'iii_mid_term', label: 'III MID TERM', kgLabel: 'III MID Term' },
  { value: 'annual', label: 'ANNUAL', kgLabel: 'Annual Examination' },
] as const;

const KG_TERMS = [
  { label: 'I Term', exams: ['i_mid_term', 'quarterly'] },
  { label: 'II Term', exams: ['ii_mid_term', 'half_yearly'] },
  { label: 'III Term', exams: ['iii_mid_term', 'annual'] },
];

export type MarkDraft = { fa: string; sa: string; total: string; kg: string };
export type CoDraft = Record<CoField, string>;

/* Rows below the marks, in the order of each paper card. */
const STD_CO_ROWS: { field: CoField; label: string }[] = [
  { field: 'workingDays', label: 'NO OF WORKING DAYS' },
  { field: 'remarks', label: 'REMARKS' },
  { field: 'neatness', label: 'NEATNESS' },
  { field: 'lifeSkills', label: 'LIFE SKILLS' },
  { field: 'attitudes', label: 'ATTITUDES AND VALUES' },
  { field: 'yoga', label: 'YOGA, HEALTH AND WELLNESS' },
  { field: 'coCurricular', label: 'CO-CURRICULAR ACTIVITIES' },
];
const KG_CO_ROWS: { field: CoField; label: string }[] = [
  { field: 'neatness', label: 'Neatness' },
  { field: 'workingDays', label: 'No. of Working days' },
  { field: 'remarks', label: 'Remarks' },
];

interface Props {
  isKG: boolean;
  subjects: { id: string; name: string }[];
  /** subjectId → examId → the student's stored record (or null). */
  matrix: Record<string, Record<string, any>>;
  /** examId → the student's co-scholastic record (or null). */
  coData: Record<string, any>;
  editing: boolean;
  drafts: Record<string, MarkDraft>;
  coDrafts: Record<string, CoDraft>;
  onMark: (key: string, part: keyof MarkDraft, value: string) => void;
  onCo: (examId: string, field: CoField, value: string) => void;
}

const show = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

const inputStyle = (bad: boolean, width: number | string): React.CSSProperties => ({
  width, padding: '2px', textAlign: 'center', fontSize: 12,
  border: `1px solid ${bad ? 'var(--color-error)' : 'var(--color-border)'}`,
  borderRadius: 4, background: bad ? '#fef2f2' : '#fff',
});

/** The STD total a draft cell stands for: FA+SA when either is typed, else the typed total. */
function stdDraftTotal(d: MarkDraft): number | null {
  const fa = parseMark(d.fa, REPORT_FA_MAX);
  const sa = parseMark(d.sa, REPORT_SA_MAX);
  if (fa === 'invalid' || sa === 'invalid') return null;
  if (fa !== null || sa !== null) return Math.round(((fa ?? 0) + (sa ?? 0)) * 10) / 10;
  const total = parseMark(d.total, 100);
  return total === 'invalid' ? null : total;
}


/* KG card: like the pink paper card. Equal exam columns, larger marks,
   roomy rows, printed on A4 PORTRAIT (the STD card stays landscape). */
const KG_STYLE = `
  .kg-table { table-layout: fixed; font-size: 13px; }
  .kg-table th { font-size: 12px; line-height: 1.25; }
  .kg-table td { height: 30px; }
  .kg-table .kg-mark { font-size: 15px; font-weight: 700; }
  .kg-table .kg-subject { font-size: 13px; font-weight: 700; padding-left: 8px; }
  .kg-table .kg-co { font-size: 13px; font-weight: 600; }
  .kg-scale { font-size: 12px; }
  @media print {
    @page { size: A4 portrait; margin: 0; }
    html, body { width: 210mm !important; }
    .printable-report .kg-table { font-size: 11px !important; }
    .printable-report .kg-table td { height: 24px; padding: 2px 4px; }
    .printable-report .kg-table .kg-mark { font-size: 13px; }
    .printable-report .kg-table .kg-subject,
    .printable-report .kg-table .kg-co { font-size: 11px; }
    .printable-report .kg-table .signature-row td { height: 30px !important; }
  }
`;

export default function ReportCardSheet(props: Props) {
  return props.isKG ? <KgSheet {...props} /> : <StdSheet {...props} />;
}

/* ── KG ──────────────────────────────────────────────────────────────── */

function KgSheet({ subjects, matrix, coData, editing, drafts, coDrafts, onMark, onCo }: Props) {
  const valueOf = (subId: string, examId: string): string => {
    if (editing) return drafts[`${subId}|${examId}`]?.kg ?? '';
    const cell = matrix[subId]?.[examId];
    return show(cell?.kgMark ?? cell?.totalMarks);
  };
  const examIds = KG_TERMS.flatMap(t => t.exams);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: KG_STYLE }} />
      <table className="report-table kg-table">
        {/* Subject column, then six equal exam columns, as on the paper card. */}
        <colgroup>
          <col style={{ width: '19%' }} />
          {examIds.map(id => <col key={id} style={{ width: `${81 / 6}%` }} />)}
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2} className="text-left kg-subject">Subject</th>
            {KG_TERMS.map(t => <th key={t.label} colSpan={2}>{t.label}</th>)}
          </tr>
          <tr>
            {examIds.map(id => (
              <th key={id}>{EXAM_COLUMNS.find(e => e.value === id)?.kgLabel}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {subjects.map(sub => (
            <tr key={sub.id}>
              <td className="text-left kg-subject">{sub.name}</td>
              {examIds.map(examId => {
                const key = `${sub.id}|${examId}`;
                const value = valueOf(sub.id, examId);
                if (editing) {
                  const bad = parseKgMark(value) === 'invalid';
                  return (
                    <td key={examId}>
                      <input
                        aria-label={`${sub.name} ${examId} mark`}
                        value={value}
                        onChange={e => onMark(key, 'kg', e.target.value)}
                        placeholder="—"
                        style={inputStyle(bad, 52)}
                      />
                    </td>
                  );
                }
                const absent = value.toLowerCase() === 'ab';
                return (
                  <td key={examId} className="kg-mark" style={absent ? { color: '#dc2626' } : undefined}>
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}

          <tr>
            <td className="text-left kg-subject">Total</td>
            {examIds.map(examId => {
              const s = kgColumnSummary(subjects.map(sub => valueOf(sub.id, examId)));
              return <td key={examId} className="total-text kg-mark">{s.total ?? ''}</td>;
            })}
          </tr>
          <tr>
            <td className="text-left kg-subject">Grade</td>
            {examIds.map(examId => {
              const s = kgColumnSummary(subjects.map(sub => valueOf(sub.id, examId)));
              // A total but no grade = not passed in all subjects (absent or below the pass mark).
              return <td key={examId} className="grade-text kg-mark">{s.grade ?? (s.total !== null ? '—' : '')}</td>;
            })}
          </tr>

          {KG_CO_ROWS.map(row => (
            <CoRow key={row.field} row={row} examIds={examIds} span={1} labelClass="text-left kg-subject" cellClass="kg-co"
              coData={coData} editing={editing} coDrafts={coDrafts} onCo={onCo} />
          ))}

          <SignatureRows examIds={examIds} span={1} height={36} labelClass="text-left kg-subject" labels={[
            'Signature of Class Teacher', 'Signature of Principal', 'Signature of Parent',
          ]} />
        </tbody>
      </table>

      <div className="kg-scale" style={{ marginTop: 12, display: 'flex', gap: 28, alignItems: 'flex-start' }}>
        <div style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Range of Marks in each Grade :</div>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            {KG_GRADE_SCALE.map(b => {
              const [from, , to] = b.label.split(' ');
              const open = b.label.includes('above');
              return (
                <tr key={b.grade}>
                  <td style={{ padding: '1px 18px 1px 0', fontWeight: 700 }}>{b.grade}</td>
                  <td style={{ padding: '1px 18px 1px 0' }}>{from}</td>
                  <td style={{ padding: '1px 18px 1px 0' }}>{open ? 'And' : 'to'}</td>
                  <td style={{ padding: '1px 0' }}>{open ? 'above' : to}</td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={2} style={{ padding: '1px 18px 1px 0', fontWeight: 700 }}>Below {KG_PASS_MARK}%</td>
              <td colSpan={2}>Fail - F</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="kg-scale" style={{ marginTop: 8, fontWeight: 700 }}>
        Grade Assessment is made only for those who have passed in all Subjects
      </div>
    </>
  );
}

/* ── STD ─────────────────────────────────────────────────────────────── */

function StdSheet({ subjects, matrix, coData, editing, drafts, coDrafts, onMark, onCo }: Props) {
  const examIds = EXAM_COLUMNS.map(e => e.value as string);
  const totalOf = (subId: string, examId: string): number | null => {
    if (editing) return stdDraftTotal(drafts[`${subId}|${examId}`] || { fa: '', sa: '', total: '', kg: '' });
    const t = matrix[subId]?.[examId]?.totalMarks;
    return typeof t === 'number' ? t : null;
  };

  return (
    <table className="report-table">
      <thead>
        <tr>
          <th rowSpan={2} style={{ minWidth: 120 }}>SUBJECT</th>
          {EXAM_COLUMNS.map(ex => <th key={ex.value} colSpan={4}>{ex.label}</th>)}
        </tr>
        <tr>
          {EXAM_COLUMNS.map(ex => (
            <React.Fragment key={ex.value + '_sub'}>
              <th className="col-sub">FA<br />40</th>
              <th className="col-sub">SA<br />60</th>
              <th className="col-sub">Total<br />100</th>
              <th className="col-sub">Grade</th>
            </React.Fragment>
          ))}
        </tr>
      </thead>
      <tbody>
        {subjects.map(sub => (
          <tr key={sub.id}>
            <td className="text-left text-bold" style={{ textTransform: 'uppercase' }}>{sub.name}</td>
            {EXAM_COLUMNS.map(ex => {
              const key = `${sub.id}|${ex.value}`;
              if (editing) {
                const d = drafts[key] || { fa: '', sa: '', total: '', kg: '' };
                const split = d.fa.trim() !== '' || d.sa.trim() !== '';
                const total = stdDraftTotal(d);
                return (
                  <React.Fragment key={key}>
                    <td><input aria-label={`${sub.name} ${ex.label} FA out of 40`} inputMode="decimal" value={d.fa}
                      onChange={e => onMark(key, 'fa', e.target.value)}
                      style={inputStyle(parseMark(d.fa, REPORT_FA_MAX) === 'invalid', 34)} /></td>
                    <td><input aria-label={`${sub.name} ${ex.label} SA out of 60`} inputMode="decimal" value={d.sa}
                      onChange={e => onMark(key, 'sa', e.target.value)}
                      style={inputStyle(parseMark(d.sa, REPORT_SA_MAX) === 'invalid', 34)} /></td>
                    <td>
                      {split
                        ? <span className="total-text text-bold">{total ?? ''}</span>
                        : (
                          // Subjects marked out of 100 with no FA/SA split (GK, Computer, Hindi).
                          <input aria-label={`${sub.name} ${ex.label} total out of 100`} inputMode="decimal" value={d.total}
                            onChange={e => onMark(key, 'total', e.target.value)}
                            style={inputStyle(parseMark(d.total, 100) === 'invalid', 38)} />
                        )}
                    </td>
                    <td className="grade-text text-bold">{total !== null ? getGrade(total) : ''}</td>
                  </React.Fragment>
                );
              }
              const cell = matrix[sub.id]?.[ex.value];
              const total = typeof cell?.totalMarks === 'number' ? cell.totalMarks : null;
              return (
                <React.Fragment key={key}>
                  <td>{show(cell?.faTotal)}</td>
                  <td>{show(cell?.saScore)}</td>
                  <td className="total-text text-bold">{total ?? ''}</td>
                  <td className="grade-text text-bold">{total !== null ? getGrade(total) : ''}</td>
                </React.Fragment>
              );
            })}
          </tr>
        ))}

        {(['TOTAL', 'AVERAGE', 'GRADE'] as const).map(label => (
          <tr key={label}>
            <td className="text-left text-bold">{label}</td>
            {examIds.map(examId => {
              const s = stdColumnSummary(subjects.map(sub => totalOf(sub.id, examId)));
              const text = label === 'TOTAL' ? s.total : label === 'AVERAGE' ? (s.average !== null ? `${s.average}%` : null) : s.grade;
              return (
                <td key={examId} colSpan={4} className={`text-bold ${label === 'GRADE' ? 'grade-text' : 'total-text'}`}>
                  {text ?? ''}
                </td>
              );
            })}
          </tr>
        ))}

        {STD_CO_ROWS.map(row => (
          <CoRow key={row.field} row={row} examIds={examIds} span={4}
            coData={coData} editing={editing} coDrafts={coDrafts} onCo={onCo} />
        ))}

        <SignatureRows examIds={examIds} span={4} labels={[
          'SIGNATURE OF THE CLASS TEACHER', 'SIGNATURE OF THE PRINCIPAL', 'SIGNATURE OF THE PARENT',
        ]} />
      </tbody>
    </table>
  );
}

/* ── Shared rows ─────────────────────────────────────────────────────── */

function CoRow({ row, examIds, span, coData, editing, coDrafts, onCo, labelClass = 'text-left text-bold', cellClass = 'text-bold' }: {
  row: { field: CoField; label: string };
  labelClass?: string;
  cellClass?: string;
  examIds: string[];
  span: number;
  coData: Record<string, any>;
  editing: boolean;
  coDrafts: Record<string, CoDraft>;
  onCo: (examId: string, field: CoField, value: string) => void;
}) {
  return (
    <tr>
      <td className={labelClass}>{row.label}</td>
      {examIds.map(examId => (
        <td key={examId} colSpan={span} className={cellClass}>
          {editing ? (
            <input
              aria-label={`${row.label} ${examId}`}
              value={coDrafts[examId]?.[row.field] ?? ''}
              onChange={e => onCo(examId, row.field, e.target.value)}
              placeholder={row.field === 'workingDays' ? '44/48' : ''}
              style={inputStyle(false, '95%')}
            />
          ) : show(coData[examId]?.[row.field])}
        </td>
      ))}
    </tr>
  );
}

function SignatureRows({ examIds, span, labels, height = 44, labelClass = 'text-left text-bold' }: {
  examIds: string[]; span: number; labels: string[]; height?: number; labelClass?: string;
}) {
  return (
    <>
      {labels.map(label => (
        <tr key={label} className="signature-row">
          <td className={labelClass} style={{ height, verticalAlign: 'middle' }}>{label}</td>
          {examIds.map(examId => <td key={examId} colSpan={span} />)}
        </tr>
      ))}
    </>
  );
}
