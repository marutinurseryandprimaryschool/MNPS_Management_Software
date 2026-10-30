import { ExamTerm, EXAM_TERMS_ORDER, EXAM_TERM_LABELS, CoScholasticArea, CO_SCHOLASTIC_LABELS } from '@/types/enums';
import type { SubjectTermScore, TermSummary, ReportCard, GradeScale, Subject } from '@/types/models';

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
export function upsertStudentMarks(
  records: ExamRecord[],
  studentId: string,
  studentName: string,
  fa: number | null,
  sa: number | null,
): ExamRecord[] {
  const others = records.filter(r => r.studentId !== studentId);
  if (fa === null && sa === null) return others;
  const existing = records.find(r => r.studentId === studentId);
  const next: ExamRecord = { ...(existing ?? {}), studentId, studentName: existing?.studentName || studentName };

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

const round1 = (n: number): number => Math.round(n * 10) / 10;
