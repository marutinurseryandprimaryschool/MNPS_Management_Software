import { ExamTerm, EXAM_TERMS_ORDER, EXAM_TERM_LABELS, CoScholasticArea, CO_SCHOLASTIC_LABELS } from '@/types/enums';
import type { SubjectTermScore, TermSummary, ReportCard, GradeScale, Subject } from '@/types/models';
import { getClassSlotIndex } from './class-slots';

export function normalizeSA(sa: number, saMax: number): number {
  if (saMax === 60) return sa;
  return Math.round((sa / saMax) * 60);
}

export function calcTotal(fa: number, saNormalized: number): number {
  return Math.min(fa + saNormalized, 100);
}

export function getGrade(pct: number, scale?: GradeScale[]): string {
  if (scale && scale.length > 0) {
    for (const gs of scale) { if (pct >= gs.min && pct <= gs.max) return gs.grade; }
  }
  if (pct >= 91) return 'A1';
  if (pct >= 81) return 'A2';
  if (pct >= 71) return 'B1';
  if (pct >= 61) return 'B2';
  if (pct >= 51) return 'C1';
  if (pct >= 41) return 'C2';
  if (pct >= 33) return 'D';
  return 'E';
}

export function getGradeColor(g: string): string {
  if (['A1','A+','A'].includes(g)) return '#059669';
  if (['A2','B1','B+'].includes(g)) return '#0369A1';
  if (['B2','C1','B','C+'].includes(g)) return '#D97706';
  if (['C2','D','C'].includes(g)) return '#EA580C';
  return '#DC2626';
}

export function buildTermSummary(
  term: ExamTerm,
  subjects: Subject[],
  faScores: Record<string, number>,
  saScores: Record<string, number>,
  saMaxes: Record<string, number>,
  gradeScale?: GradeScale[]
): TermSummary {
  const subjectScores: SubjectTermScore[] = subjects.map(sub => {
    const fa = Math.min(faScores[sub.id] || 0, 40);
    const saRaw = saScores[sub.id] || 0;
    const saMax = saMaxes[sub.id] || 60;
    const saNorm = normalizeSA(saRaw, saMax);
    const total = calcTotal(fa, saNorm);
    return {
      subjectId: sub.id,
      subjectName: sub.name,
      fa, sa: saRaw, saMax, saNormalized: saNorm,
      total, grade: getGrade(total, gradeScale),
    };
  });
  const termTotal = subjectScores.reduce((s, sc) => s + sc.total, 0);
  const maxTotal = subjects.length * 100;
  const average = maxTotal > 0 ? Math.round((termTotal / maxTotal) * 100) : 0;
  return {
    term, subjectScores, termTotal, maxTotal, average,
    grade: getGrade(average, gradeScale),
  };
}

export function calcRanks(reportCards: ReportCard[], term: ExamTerm): void {
  const withScores = reportCards
    .filter(rc => rc.terms?.[term])
    .sort((a, b) => (b.terms[term]!.termTotal) - (a.terms[term]!.termTotal));
  withScores.forEach((rc, i) => {
    if (rc.terms[term]) rc.terms[term]!.rank = i + 1;
  });
}

export { EXAM_TERMS_ORDER, EXAM_TERM_LABELS, CoScholasticArea, CO_SCHOLASTIC_LABELS, ExamTerm };

/* ── Editing marks from the report card ─────────────────────────────────
   The report card reads `marks` docs (examType 'major_exam', one per
   class · section · subject · exam) whose `records[]` hold one entry per
   student — the same docs the Exam Marks screen writes. Editing on the
   report card must write that exact shape, or the two screens disagree. */

export const REPORT_FA_MAX = 40;
export const REPORT_SA_MAX = 60;

export interface ExamRecord {
  studentId: string;
  studentName?: string;
  faClassExamScore?: number;
  faProjectScore?: number;
  faReadingScore?: number;
  faTotal?: number | null;
  saScore?: number | null;
  totalMarks?: number | null;
  [key: string]: unknown;
}

/**
 * A typed mark → number, null (left blank) or 'invalid'. Accepts whole
 * numbers and halves/one decimal (4.5), within 0..max.
 */
export function parseMark(raw: string, max: number): number | null | 'invalid' {
  const text = raw.trim();
  if (text === '') return null;
  if (!/^\d+(\.\d)?$/.test(text)) return 'invalid';
  const value = Number(text);
  return value >= 0 && value <= max ? value : 'invalid';
}

/**
 * The exam doc's records with ONE student's FA/SA replaced. Other students
 * are untouched. Both blank removes the student's entry (the card shows
 * "-" again). When FA changes, the FA breakdown is kept consistent with
 * the new FA total so the Exam Marks screen shows the same number.
 */
export interface MarkExtras {
  /** STD subjects marked out of 100 with no FA/SA split (GK, Computer, Hindi). */
  total?: number | null;
  /** KG: the mark exactly as written on the card: "68", "ab", "-", "C". */
  kgMark?: string | null;
}

/**
 * The exam doc's records with ONE student's marks replaced. Other students
 * are untouched. Nothing entered removes the student's entry (the card goes
 * blank again). When FA changes, the FA breakdown is kept consistent with
 * the new FA total so the Exam Marks screen shows the same number.
 *
 * Three shapes, one record per student:
 *  - STD with FA/SA          → faTotal, saScore, totalMarks = FA + SA
 *  - STD total only          → totalMarks (faTotal / saScore null)
 *  - KG single mark          → kgMark, totalMarks = the number (or null for ab / - / a letter)
 */
export function upsertStudentMarks(
  records: ExamRecord[],
  studentId: string,
  studentName: string,
  fa: number | null,
  sa: number | null,
  extras: MarkExtras = {},
): ExamRecord[] {
  const others = records.filter(r => r.studentId !== studentId);
  const kgMark = extras.kgMark ?? null;
  const totalOnly = extras.total ?? null;
  if (fa === null && sa === null && kgMark === null && totalOnly === null) return others;
  const existing = records.find(r => r.studentId === studentId);
  const next: ExamRecord = { ...(existing ?? {}), studentId, studentName: existing?.studentName || studentName };

  if (kgMark !== null) {
    const parsed = parseKgMark(kgMark);
    next.kgMark = parsed === 'invalid' ? kgMark : parsed.value;
    next.faTotal = null;
    next.saScore = null;
    next.totalMarks = parsed === 'invalid' ? null : parsed.numeric;
    return [...others, next];
  }
  delete next.kgMark;

  if (fa === null && sa === null) {
    next.faTotal = null;
    next.saScore = null;
    next.totalMarks = totalOnly;
    return [...others, next];
  }

  const faValue = fa ?? 0;
  const project = Number(existing?.faProjectScore) || 0;
  const reading = Number(existing?.faReadingScore) || 0;
  const breakdownSum = (Number(existing?.faClassExamScore) || 0) + project + reading;
  if (!existing || breakdownSum !== faValue) {
    if (project + reading <= faValue) {
      next.faClassExamScore = round1(faValue - project - reading);
      next.faProjectScore = project;
      next.faReadingScore = reading;
    } else {
      next.faClassExamScore = faValue;
      next.faProjectScore = 0;
      next.faReadingScore = 0;
    }
  }
  next.faTotal = fa;
  next.saScore = sa;
  next.totalMarks = round1(faValue + (sa ?? 0));
  return [...others, next];
}

/* ── KG card (Pre-KG, LKG, UKG) ───────────────────────────────────────
   One mark per subject per exam, written as on the paper card: a number
   out of 100, "ab" (absent), "-" (not taken) or a grade letter (Drawing). */

/** Pre-KG / LKG / UKG (and "Nursery") use the KG card; Class 1–5 the STD card. */
export function isKgClass(className?: string | null): boolean {
  const slot = getClassSlotIndex(className || '');
  if (slot !== -1) return slot <= 2;
  return /(^|[^a-z])(pre[\s.-]*kg|l\.?\s*k\.?\s*g|u\.?\s*k\.?\s*g|kg|nursery)([^a-z]|$)/i.test(className || '');
}

export const KG_GRADE_SCALE: { grade: string; min: number; label: string }[] = [
  { grade: 'A+', min: 90, label: '90% and above' },
  { grade: 'A', min: 80, label: '80% to 89%' },
  { grade: 'B', min: 70, label: '70% to 79%' },
  { grade: 'C', min: 60, label: '60% to 69%' },
  { grade: 'D', min: 50, label: '50% to 59%' },
  { grade: 'E', min: 35, label: '35% to 49%' },
];
export const KG_PASS_MARK = 35;

export function kgGrade(pct: number): string {
  for (const band of KG_GRADE_SCALE) if (pct >= band.min) return band.grade;
  return 'F';
}

export type KgMark = { value: string | null; numeric: number | null };

/** A typed KG mark → normalised value, or 'invalid'. */
export function parseKgMark(raw: string): KgMark | 'invalid' {
  const text = raw.trim();
  if (text === '') return { value: null, numeric: null };
  if (/^ab$/i.test(text)) return { value: 'ab', numeric: null };
  if (/^[-\u2013\u2014]$/.test(text)) return { value: '-', numeric: null };
  if (/^(a\+|[a-f])$/i.test(text)) return { value: text.toUpperCase(), numeric: null };
  if (/^\d+(\.\d)?$/.test(text)) {
    const n = Number(text);
    return n <= 100 ? { value: text, numeric: n } : 'invalid';
  }
  return 'invalid';
}

/**
 * Total and grade for one KG exam column. The grade is given only when the
 * child passed in all subjects ("Grade Assessment is made only for those who
 * have passed in all Subjects"): any "ab", an "F", or a number below 35
 * leaves the grade blank. "-" (not taken) and letter-graded subjects are
 * left out of the total, exactly as on the paper card.
 */
export function kgColumnSummary(marks: Array<string | null | undefined>): { total: number | null; grade: string | null } {
  let total = 0;
  let count = 0;
  let passedAll = true;
  for (const raw of marks) {
    if (raw === null || raw === undefined || String(raw).trim() === '') continue;
    const parsed = parseKgMark(String(raw));
    if (parsed === 'invalid') continue;
    if (parsed.value === 'ab' || parsed.value === 'F') passedAll = false;
    if (parsed.numeric !== null) {
      total += parsed.numeric;
      count += 1;
      if (parsed.numeric < KG_PASS_MARK) passedAll = false;
    }
  }
  if (count === 0) return { total: null, grade: null };
  const grade = passedAll ? kgGrade((total / (count * 100)) * 100) : null;
  return { total: round1(total), grade };
}

/* ── STD card (Class 1–5) ───────────────────────────────────────────── */

/** Total, average % (whole number) and grade for one STD exam column. */
export function stdColumnSummary(totals: Array<number | null | undefined>): { total: number | null; average: number | null; grade: string | null } {
  const marks = totals.filter((t): t is number => typeof t === 'number');
  if (marks.length === 0) return { total: null, average: null, grade: null };
  const total = round1(marks.reduce((a, b) => a + b, 0));
  const average = Math.round(total / marks.length);
  return { total, average, grade: getGrade(average) };
}

/* ── Co-scholastic entries (working days, remarks, neatness, ...) ───── */

export const CO_FIELDS = [
  'workingDays', 'remarks', 'neatness', 'lifeSkills', 'attitudes', 'yoga', 'coCurricular',
] as const;
export type CoField = typeof CO_FIELDS[number];

/** The co-scholastic doc's records with ONE student's entries replaced. */
export function upsertCoRecord(
  records: Array<Record<string, unknown> & { studentId: string }>,
  studentId: string,
  studentName: string,
  fields: Partial<Record<CoField, string>>,
): Array<Record<string, unknown> & { studentId: string }> {
  const others = records.filter(r => r.studentId !== studentId);
  const existing = records.find(r => r.studentId === studentId);
  const next: Record<string, unknown> & { studentId: string } = {
    ...(existing ?? {}), studentId, studentName: (existing?.studentName as string) || studentName,
  };
  for (const key of CO_FIELDS) {
    if (fields[key] === undefined) continue;
    next[key] = String(fields[key]).trim();
  }
  // Keep presentDays in step with "present/total" working days.
  const wd = typeof next.workingDays === 'string' ? next.workingDays : '';
  const m = /^(\d+)\s*\/\s*\d+$/.exec(wd);
  if (m) next.presentDays = m[1];
  return [...others, next];
}

const round1 = (n: number): number => Math.round(n * 10) / 10;
