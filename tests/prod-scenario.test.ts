/**
 * Sharmi's exact requirement, verified against the REAL production UKG fee
 * structure (terms 11500/3300/3300, ECA 3250 annual, no ecaMonths set, no term
 * due dates set) as of 2026-08-17.
 *
 * Her words: "In August, you have to show the balance of June and July.
 * You shouldn't show the full [year]." — and she references ~₹350/month.
 */
import { describe, it, expect } from 'vitest';
import {
  buildStudentSchedule,
  computeStudentFeeSummary,
  type FeeStructureInput,
} from '@/lib/fee-utils';

// Verbatim shape of the live UKG structure doc.
const UKG_LIVE: FeeStructureInput = {
  academicYear: '2026-27',
  terms: [
    { name: 'Term 1', amount: 11500 },
    { name: 'Term 2', amount: 3300 },
    { name: 'Term 3', amount: 3300 },
  ],
  extracurricular: 3250,
  additionalFees: [],
  busFee: 0,
  includeBusFee: false,
  busMonths: [],
  totalAmount: 21350,
};

const student = { id: 'stu-test', name: 'Test Student', classId: 'ukg' } as never;
const AUGUST_17 = new Date(2026, 7, 17); // month is 0-indexed: 7 = August

const args = (today: Date) => ({
  student,
  structure: UKG_LIVE,
  busRoutes: [],
  scholarships: [],
  academicYear: '2026-27',
  today,
});

describe("Sharmi's ECA rule against the live UKG structure", () => {
  it('splits the annual ECA into ~₹325/month across June–March', () => {
    const eca = buildStudentSchedule(args(AUGUST_17)).buckets.filter(b => b.kind === 'eca');
    expect(eca).toHaveLength(10);
    expect(eca.reduce((s, b) => s + b.amount, 0)).toBe(3250);
    expect(eca.map(b => b.amount)).toEqual([325, 325, 325, 325, 325, 325, 325, 325, 325, 325]);
  });

  it('in August shows ONLY June + July as due — never the full year', () => {
    const summary = computeStudentFeeSummary(args(AUGUST_17), []);
    const dueEca = summary.buckets.filter(b => b.kind === 'eca' && b.isDue);
    expect(dueEca.map(b => b.month)).toEqual(['June', 'July']);
    // ₹650 overdue, NOT ₹3250.
    expect(dueEca.reduce((s, b) => s + b.pendingDue, 0)).toBe(650);
  });

  it('August itself is not due until the month ends', () => {
    const aug = buildStudentSchedule(args(AUGUST_17)).buckets
      .find(b => b.kind === 'eca' && b.month === 'August');
    expect(aug?.isDue).toBe(false);
    // ...and becomes due on 1 September.
    const sep1 = buildStudentSchedule(args(new Date(2026, 8, 1))).buckets
      .find(b => b.kind === 'eca' && b.month === 'August');
    expect(sep1?.isDue).toBe(true);
  });

  it('terms without due dates are never counted overdue (live structure has none set)', () => {
    const terms = buildStudentSchedule(args(AUGUST_17)).buckets.filter(b => b.kind === 'term');
    expect(terms.every(t => !t.isDue)).toBe(true);
    // Total charged is still the full year: dues ≠ charges.
    const summary = computeStudentFeeSummary(args(AUGUST_17), []);
    expect(summary.totalCharged).toBe(21350);
    expect(summary.totalDuePending).toBe(650);
  });

  it('a ₹650 ECA payment clears the overdue amount', () => {
    const payments = [
      { id: 'p1', studentId: 'stu-test', amount: 325, category: 'ECA - June', dateKey: '2026-08-17' },
      { id: 'p2', studentId: 'stu-test', amount: 325, category: 'ECA - July', dateKey: '2026-08-17' },
    ] as never[];
    const summary = computeStudentFeeSummary(args(AUGUST_17), payments);
    expect(summary.totalDuePending).toBe(0);
    expect(summary.totalPending).toBe(21350 - 650);
  });
});
