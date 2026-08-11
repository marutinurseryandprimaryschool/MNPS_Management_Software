import { describe, it, expect } from 'vitest';
import {
  ACADEMIC_MONTHS,
  MONTHLY_EXAM_LABELS,
  monthLabelToMonthlyExam,
  toDateKey,
  coerceDate,
  academicYearStartYear,
  academicMonthStart,
  academicMonthOrder,
  ecaCategory,
  busCategory,
  buildStudentSchedule,
  allocatePayments,
  computeStudentFeeSummary,
  computeClassFeeSummary,
  computeBalances,
  excludeDeleted,
  isDefaulter,
  resolveFeeOverride,
  type BuildScheduleArgs,
  type FeeStructureInput,
} from '@/lib/fee-utils';
import { MonthlyExam } from '@/types/enums';

/* ── Fixtures ─────────────────────────────────────────────────────────── */

const AY = '2025-2026';
// Client's authoritative example date: 10 August 2025 (local).
const TODAY = new Date(2025, 7, 10);

const baseStructure: FeeStructureInput = {
  academicYear: AY,
  terms: [
    { name: 'Term 1', amount: 4000 },
    { name: 'Term 2', amount: 3000 },
    { name: 'Term 3', amount: 3000 },
  ],
  extracurricular: 1000,
  additionalFees: [{ name: 'Books', amount: 500 }],
  busFee: 0,
  busMonths: [...ACADEMIC_MONTHS],
  includeBusFee: false,
  totalAmount: 11500,
};

const student = { id: 'stu1', classId: 'c1' };

const args = (overrides: Partial<BuildScheduleArgs> = {}): BuildScheduleArgs => ({
  structure: baseStructure,
  student,
  today: TODAY,
  ...overrides,
});

const ecaBuckets = <T extends { kind: string }>(summaryOrSchedule: { buckets: T[] }): T[] =>
  summaryOrSchedule.buckets.filter(b => b.kind === 'eca');

/* ── Month & label plumbing ───────────────────────────────────────────── */

describe('months, labels, dates', () => {
  it('ACADEMIC_MONTHS is the canonical capitalized June–March list', () => {
    expect([...ACADEMIC_MONTHS]).toEqual([
      'June', 'July', 'August', 'September', 'October', 'November',
      'December', 'January', 'February', 'March',
    ]);
  });

  it('MonthlyExam labels round-trip', () => {
    expect(MONTHLY_EXAM_LABELS[MonthlyExam.JUNE]).toBe('June');
    expect(MONTHLY_EXAM_LABELS[MonthlyExam.MARCH]).toBe('March');
    expect(monthLabelToMonthlyExam('June')).toBe(MonthlyExam.JUNE);
    expect(monthLabelToMonthlyExam('March')).toBe(MonthlyExam.MARCH);
    expect(monthLabelToMonthlyExam('April')).toBeNull(); // not an exam month
  });

  it('toDateKey formats local yyyy-MM-dd', () => {
    expect(toDateKey(new Date(2025, 7, 10))).toBe('2025-08-10');
    expect(toDateKey(new Date(2026, 0, 3))).toBe('2026-01-03');
  });

  it('coerceDate handles Date, string, epoch, Timestamp-like, invalid', () => {
    expect(coerceDate(new Date(2025, 0, 1))?.getFullYear()).toBe(2025);
    expect(coerceDate('2025-06-15')?.getUTCMonth()).toBe(5);
    expect(coerceDate({ toDate: () => new Date(2025, 2, 1) })?.getMonth()).toBe(2);
    expect(coerceDate({ seconds: 86400 })?.getTime()).toBe(86400 * 1000);
    expect(coerceDate(null)).toBeNull();
    expect(coerceDate('not-a-date')).toBeNull();
  });

  it('academicYearStartYear parses year strings and infers from today', () => {
    expect(academicYearStartYear('2025-2026')).toBe(2025);
    expect(academicYearStartYear('2025-26')).toBe(2025);
    expect(academicYearStartYear(undefined, new Date(2025, 7, 1))).toBe(2025); // Aug → same year
    expect(academicYearStartYear(undefined, new Date(2026, 1, 1))).toBe(2025); // Feb → previous year
  });

  it('maps June–December to start year and January–May to the next year', () => {
    expect(toDateKey(academicMonthStart('June', 2025)!)).toBe('2025-06-01');
    expect(toDateKey(academicMonthStart('December', 2025)!)).toBe('2025-12-01');
    expect(toDateKey(academicMonthStart('January', 2025)!)).toBe('2026-01-01');
    expect(toDateKey(academicMonthStart('March', 2025)!)).toBe('2026-03-01');
    expect(toDateKey(academicMonthStart('April', 2025)!)).toBe('2026-04-01'); // trails the core year
    expect(academicMonthStart('NotAMonth', 2025)).toBeNull();
  });

  it('academic order runs June..March then April/May', () => {
    expect(academicMonthOrder('June')).toBe(0);
    expect(academicMonthOrder('March')).toBe(9);
    expect(academicMonthOrder('April')).toBe(10);
    expect(academicMonthOrder('May')).toBe(11);
  });
});

/* ── ECA arrears: the client's exact example ──────────────────────────── */

describe('ECA month-wise arrears (client example)', () => {
  it('on 10 August only June and July ECA are due', () => {
    const summary = computeStudentFeeSummary(args(), []);
    const eca = ecaBuckets(summary);
    expect(eca).toHaveLength(10);
    expect(eca.map(b => b.category)).toContain(ecaCategory('June'));

    const due = eca.filter(b => b.isDue);
    expect(due.map(b => b.month)).toEqual(['June', 'July']);
    // Slice = 1000 / 10 = 100 → June+July pending due = 200.
    expect(due.reduce((s, b) => s + b.pendingDue, 0)).toBe(200);
    // August has ended? No — due only after month end (1 Sep).
    const august = eca.find(b => b.month === 'August')!;
    expect(august.isDue).toBe(false);
    expect(august.pendingDue).toBe(0);
    expect(august.pending).toBe(100); // owed, just not due yet
  });

  it('a month becomes due exactly on the 1st of the following month', () => {
    const onFirst = buildStudentSchedule(args({ today: new Date(2025, 8, 1) })); // 1 Sep
    const august = ecaBuckets(onFirst).find(b => b.month === 'August')!;
    expect(august.isDue).toBe(true);

    const onLastDay = buildStudentSchedule(args({ today: new Date(2025, 7, 31) })); // 31 Aug
    const augustNotYet = ecaBuckets(onLastDay).find(b => b.month === 'August')!;
    expect(augustNotYet.isDue).toBe(false);
  });

  it('slices honor a custom ecaMonths list', () => {
    const schedule = buildStudentSchedule(
      args({ structure: { ...baseStructure, ecaMonths: ['June', 'July', 'August'] } }),
    );
    const eca = ecaBuckets(schedule);
    expect(eca.map(b => b.month)).toEqual(['June', 'July', 'August']);
  });
});

/* ── Rounding remainder ───────────────────────────────────────────────── */

describe('ECA slice rounding', () => {
  it('puts the remainder on the first month and sums exactly to the annual', () => {
    const schedule = buildStudentSchedule(
      args({ structure: { ...baseStructure, extracurricular: 1000, ecaMonths: ['June', 'July', 'August'] } }),
    );
    const eca = ecaBuckets(schedule);
    expect(eca.map(b => b.amount)).toEqual([334, 333, 333]); // round(333.33)=333, remainder → June
    expect(eca.reduce((s, b) => s + b.amount, 0)).toBe(1000);
  });

  it('never overshoots: floor-based slices keep the remainder non-negative', () => {
    const schedule = buildStudentSchedule(
      args({ structure: { ...baseStructure, extracurricular: 200, ecaMonths: ['June', 'July', 'August'] } }),
    );
    const eca = ecaBuckets(schedule);
    expect(eca.map(b => b.amount)).toEqual([68, 66, 66]); // floor(66.67)=66, remainder +2 → June
    expect(eca.reduce((s, b) => s + b.amount, 0)).toBe(200);
  });

  it('tiny annuals charge exactly the annual, never more', () => {
    const schedule = buildStudentSchedule(
      args({ structure: { ...baseStructure, extracurricular: 5, ecaMonths: [...ACADEMIC_MONTHS] } }),
    );
    const eca = ecaBuckets(schedule);
    // floor(5/10)=0 → zero-amount months dropped, June carries the whole ₹5.
    expect(eca.reduce((s, b) => s + b.amount, 0)).toBe(5);
  });
});

/* ── Term due dates ───────────────────────────────────────────────────── */

describe('term due dates', () => {
  const withDueDates: FeeStructureInput = {
    ...baseStructure,
    termDueDates: { 'Term 1': '2025-07-15', 'Term 2': '2025-08-10' },
    // Term 3 has no due date → not yet due.
  };

  it('a term is due strictly after its due date passes', () => {
    const summary = computeStudentFeeSummary(args({ structure: withDueDates }), []);
    const term1 = summary.buckets.find(b => b.category === 'Term 1')!;
    const term2 = summary.buckets.find(b => b.category === 'Term 2')!;
    const term3 = summary.buckets.find(b => b.category === 'Term 3')!;

    expect(term1.isDue).toBe(true); // 15 Jul passed
    expect(term1.pendingDue).toBe(4000);
    expect(term2.isDue).toBe(false); // due date IS today — not passed yet
    expect(term3.isDue).toBe(false); // no due date set
    expect(term3.pending).toBe(3000); // still owed, just not due

    // Term 1 + June/July ECA + Books (additional fees are due immediately).
    expect(summary.totalDuePending).toBe(4000 + 200 + 500);
  });

  it('a term with no due date never surfaces as a defaulter amount', () => {
    const summary = computeStudentFeeSummary(args(), []); // no termDueDates at all
    const termDue = summary.buckets.filter(b => b.kind === 'term' && b.isDue);
    expect(termDue).toHaveLength(0);
  });
});

/* ── FIFO allocation of legacy lumps ──────────────────────────────────── */

describe('legacy "Extracurricular" FIFO allocation', () => {
  it('fills oldest ECA months first with partial coverage', () => {
    const summary = computeStudentFeeSummary(args(), [
      { amount: 250, category: 'Extracurricular', paidAt: new Date(2025, 6, 1) },
    ]);
    const eca = ecaBuckets(summary);
    expect(eca.find(b => b.month === 'June')!.paid).toBe(100);
    expect(eca.find(b => b.month === 'July')!.paid).toBe(100);
    expect(eca.find(b => b.month === 'August')!.paid).toBe(50);
    expect(eca.find(b => b.month === 'September')!.paid).toBe(0);
    expect(summary.unallocated).toBe(0);
  });

  it('multiple lumps continue where the previous left off (chronological)', () => {
    const summary = computeStudentFeeSummary(args(), [
      { amount: 150, category: 'Extracurricular', paidAt: new Date(2025, 7, 1) },
      { amount: 250, category: 'Extracurricular', paidAt: new Date(2025, 6, 1) }, // older — processed first
    ]);
    const eca = ecaBuckets(summary);
    expect(eca.find(b => b.month === 'June')!.paid).toBe(100);
    expect(eca.find(b => b.month === 'July')!.paid).toBe(100);
    expect(eca.find(b => b.month === 'August')!.paid).toBe(100); // 50 + 50
    expect(eca.find(b => b.month === 'September')!.paid).toBe(100);
    expect(eca.find(b => b.month === 'October')!.paid).toBe(0);
  });

  it('skips months already covered by month-tagged payments', () => {
    const summary = computeStudentFeeSummary(args(), [
      { amount: 100, category: ecaCategory('June'), paidAt: new Date(2025, 5, 15) },
      { amount: 150, category: 'Extracurricular', paidAt: new Date(2025, 6, 1) },
    ]);
    const eca = ecaBuckets(summary);
    expect(eca.find(b => b.month === 'June')!.paid).toBe(100);
    expect(eca.find(b => b.month === 'July')!.paid).toBe(100);
    expect(eca.find(b => b.month === 'August')!.paid).toBe(50);
  });

  it('overflow past all ECA months goes to Unallocated', () => {
    const summary = computeStudentFeeSummary(args(), [
      { amount: 1100, category: 'Extracurricular', paidAt: new Date(2025, 6, 1) },
    ]);
    expect(ecaBuckets(summary).every(b => b.paid === b.amount)).toBe(true);
    expect(summary.unallocated).toBe(100);
  });
});

/* ── Scholarship / feeAdjustment scaling ──────────────────────────────── */

describe('scholarship & feeAdjustment scaling', () => {
  const scalableSum = (summary: { buckets: { kind: string; amount: number }[] }) =>
    summary.buckets
      .filter(b => b.kind === 'term' || b.kind === 'eca' || b.kind === 'additional')
      .reduce((s, b) => s + b.amount, 0);

  it('sum-invariant: scaled buckets sum EXACTLY to the override (property-style)', () => {
    // Basis = 4000+3000+3000 + 1000 + 500 = 11500.
    for (const override of [1, 7, 500, 999, 4999, 7321, 9871, 11499, 11500]) {
      const schedule = buildStudentSchedule(
        args({ student: { ...student, feeAdjustment: { amount: override } } }),
      );
      expect(scalableSum(schedule), `override=${override}`).toBe(override);
      expect(schedule.scaleWarning).toBe(false);
    }
  });

  it('resolves scholarship overrides via amountsByClass', () => {
    const schedule = buildStudentSchedule(
      args({
        student: { ...student, scholarshipId: 'rte' },
        scholarships: [{ id: 'rte', active: true, amountsByClass: { c1: 5750 } }],
      }),
    );
    expect(schedule.scaleFactor).toBeCloseTo(0.5);
    expect(scalableSum(schedule)).toBe(5750);
  });

  it('feeAdjustment takes precedence over scholarship', () => {
    expect(
      resolveFeeOverride(
        { ...student, feeAdjustment: { amount: 100 }, scholarshipId: 'rte' },
        [{ id: 'rte', active: true, amountsByClass: { c1: 5000 } }],
      ),
    ).toBe(100);
  });

  it('inactive scholarships do not apply', () => {
    expect(
      resolveFeeOverride({ ...student, scholarshipId: 'rte' }, [
        { id: 'rte', active: false, amountsByClass: { c1: 5000 } },
      ]),
    ).toBeNull();
  });

  it('clamps the factor to 1 with a warning when override > standard total', () => {
    const schedule = buildStudentSchedule(
      args({ student: { ...student, feeAdjustment: { amount: 20000 } } }),
    );
    expect(schedule.scaleFactor).toBe(1);
    expect(schedule.scaleWarning).toBe(true);
    expect(scalableSum(schedule)).toBe(11500); // unscaled
  });

  it('standard total 0 → factor 1, nothing due, no division blow-up', () => {
    const schedule = buildStudentSchedule(
      args({
        structure: { ...baseStructure, terms: [], extracurricular: 0, additionalFees: [] },
        student: { ...student, feeAdjustment: { amount: 5000 } },
      }),
    );
    expect(schedule.scaleFactor).toBe(1);
    expect(schedule.scaleWarning).toBe(false);
    expect(schedule.totalAmount).toBe(0);
  });

  it('never scales bus fees or Previous Balance', () => {
    const schedule = buildStudentSchedule(
      args({
        student: {
          ...student,
          previousBalance: 700,
          transportType: 'bus',
          routeId: 'r1',
          feeAdjustment: { amount: 5750 },
        },
        structure: { ...baseStructure, includeBusFee: true, busMonths: ['June', 'July'] },
        busRoutes: [{ id: 'r1', fee: 300 }],
      }),
    );
    const bus = schedule.buckets.filter(b => b.kind === 'bus');
    expect(bus.map(b => b.amount)).toEqual([300, 300]); // unscaled
    expect(schedule.buckets.find(b => b.kind === 'previousBalance')!.amount).toBe(700);
    expect(scalableSum(schedule)).toBe(5750);
  });
});

/* ── Previous Balance netting ─────────────────────────────────────────── */

describe('Previous Balance bucket', () => {
  it('is due immediately, listed first, and netted by PB payments', () => {
    const summary = computeStudentFeeSummary(
      args({ student: { ...student, previousBalance: 500 } }),
      [{ amount: 200, category: 'Previous Balance', paidAt: new Date(2025, 5, 20) }],
    );
    const pbBucket = summary.buckets[0];
    expect(pbBucket.kind).toBe('previousBalance');
    expect(pbBucket.isDue).toBe(true);
    expect(pbBucket.paid).toBe(200);
    expect(pbBucket.pending).toBe(300); // netted — no double count
    // Rollover carry = total unpaid, net of PB payments.
    expect(summary.totalCharged).toBe(11500 + 500);
    expect(summary.totalPending).toBe(11500 + 500 - 200);
  });

  it('exists even when the structure is missing (independent bucket)', () => {
    const summary = computeStudentFeeSummary(
      args({ structure: null, student: { ...student, previousBalance: 400 } }),
      [],
    );
    expect(summary.hasStructure).toBe(false);
    expect(summary.buckets).toHaveLength(1);
    expect(summary.totalDuePending).toBe(400);
  });

  it('missing structure and no PB → zero schedule', () => {
    const summary = computeStudentFeeSummary(args({ structure: null }), []);
    expect(summary.hasStructure).toBe(false);
    expect(summary.buckets).toHaveLength(0);
    expect(summary.totalCharged).toBe(0);
    expect(isDefaulter(summary)).toBe(false);
  });
});

/* ── Unallocated bucket ───────────────────────────────────────────────── */

describe('Unallocated ("Other"/unknown) payments', () => {
  it('reduce overall and due pending but fill no bucket', () => {
    const withoutOther = computeStudentFeeSummary(args(), []);
    const summary = computeStudentFeeSummary(args(), [
      { amount: 150, category: 'Other', paidAt: new Date(2025, 6, 5) },
      { amount: 50, category: 'Long Gone Category', paidAt: new Date(2025, 6, 6) },
    ]);
    expect(summary.unallocated).toBe(200);
    expect(summary.buckets.every(b => b.paid === 0)).toBe(true);
    expect(summary.totalPaid).toBe(200);
    expect(summary.totalPending).toBe(summary.totalCharged - 200);
    // Due before: June+July ECA (200) + Books (500) = 700 → offset by 200.
    expect(withoutOther.totalDuePending).toBe(700);
    expect(summary.totalDuePending).toBe(500);
  });

  it('clamps due pending at zero when unallocated exceeds it', () => {
    const summary = computeStudentFeeSummary(args(), [
      { amount: 100000, category: 'Other', paidAt: new Date(2025, 6, 5) },
    ]);
    expect(summary.totalDuePending).toBe(0);
    expect(summary.totalPending).toBe(0);
  });
});

/* ── Admission-month proration ────────────────────────────────────────── */

describe('mid-year admission proration', () => {
  it('drops ECA and bus months before the admission month', () => {
    const summary = computeStudentFeeSummary(
      args({
        student: {
          ...student,
          dateOfJoining: new Date(2025, 8, 10), // 10 Sep 2025
          transportType: 'bus',
          routeId: 'r1',
        },
        structure: { ...baseStructure, includeBusFee: true },
        busRoutes: [{ id: 'r1', fee: 250 }],
      }),
      [],
    );
    const eca = ecaBuckets(summary);
    expect(eca.map(b => b.month)).toEqual([
      'September', 'October', 'November', 'December', 'January', 'February', 'March',
    ]);
    const bus = summary.buckets.filter(b => b.kind === 'bus');
    expect(bus).toHaveLength(7);
    // Nothing due on 10 Aug: no post-admission month has ended, terms have no
    // due dates, and Books becomes due at the admission month (Sep).
    const books = summary.buckets.find(b => b.category === 'Books')!;
    expect(books.isDue).toBe(false);
    expect(summary.totalDuePending).toBe(0);
  });

  it('the admission month itself IS owed', () => {
    const schedule = buildStudentSchedule(
      args({ student: { ...student, dateOfJoining: new Date(2025, 8, 25) } }),
    );
    expect(ecaBuckets(schedule).map(b => b.month)).toContain('September');
  });

  it('terms and additional fees are not dropped by proration', () => {
    const schedule = buildStudentSchedule(
      args({ student: { ...student, dateOfJoining: new Date(2025, 8, 10) } }),
    );
    expect(schedule.buckets.filter(b => b.kind === 'term')).toHaveLength(3);
    expect(schedule.buckets.filter(b => b.kind === 'additional')).toHaveLength(1);
  });

  it('no dateOfJoining → full schedule from academic year start', () => {
    const schedule = buildStudentSchedule(args());
    expect(ecaBuckets(schedule)).toHaveLength(10);
  });
});

/* ── Bus months ───────────────────────────────────────────────────────── */

describe('bus month buckets', () => {
  it('prices from the student\'s current route and accepts April/May', () => {
    const schedule = buildStudentSchedule(
      args({
        student: { ...student, transportType: 'bus', routeId: 'r2' },
        structure: { ...baseStructure, includeBusFee: true, busMonths: ['June', 'July', 'April'] },
        busRoutes: [{ id: 'r2', fee: 400 }],
      }),
    );
    const bus = schedule.buckets.filter(b => b.kind === 'bus');
    expect(bus.map(b => b.month)).toEqual(['June', 'July', 'April']); // April sorts last
    expect(bus.every(b => b.amount === 400)).toBe(true);
    expect(bus.map(b => b.category)).toContain(busCategory('April'));
    // On 10 Aug 2025: June & July (2025) due; April 2026 not.
    expect(bus.map(b => b.isDue)).toEqual([true, true, false]);
  });

  it('non-bus students and missing routes get no bus buckets', () => {
    const walker = buildStudentSchedule(
      args({ structure: { ...baseStructure, includeBusFee: true }, busRoutes: [{ id: 'r1', fee: 300 }] }),
    );
    expect(walker.buckets.filter(b => b.kind === 'bus')).toHaveLength(0);

    const noRoute = buildStudentSchedule(
      args({
        student: { ...student, transportType: 'bus', routeId: 'missing' },
        structure: { ...baseStructure, includeBusFee: true },
        busRoutes: [{ id: 'r1', fee: 300 }],
      }),
    );
    expect(noRoute.buckets.filter(b => b.kind === 'bus')).toHaveLength(0);
  });
});

/* ── Deleted exclusion ────────────────────────────────────────────────── */

describe('soft-delete exclusion', () => {
  it('excludeDeleted filters deleted docs without mutating the input', () => {
    const docs = [{ id: 'a' }, { id: 'b', deleted: true }, { id: 'c', deleted: false }];
    const out = excludeDeleted(docs);
    expect(out.map(d => d.id)).toEqual(['a', 'c']);
    expect(docs).toHaveLength(3);
  });

  it('deleted payments count nowhere in allocation', () => {
    const summary = computeStudentFeeSummary(args(), [
      { amount: 4000, category: 'Term 1', paidAt: new Date(2025, 5, 20), deleted: true },
      { amount: 100, category: ecaCategory('June'), paidAt: new Date(2025, 5, 20) },
    ]);
    expect(summary.totalPaid).toBe(100);
    expect(summary.buckets.find(b => b.category === 'Term 1')!.paid).toBe(0);
  });
});

/* ── Class summarizer ─────────────────────────────────────────────────── */

describe('class summary / defaulters', () => {
  it('aggregates students and counts defaulters', () => {
    const defaulter = computeStudentFeeSummary(args(), []); // ECA + Books due
    const paidUp = computeStudentFeeSummary(args(), [
      { amount: 100, category: ecaCategory('June'), paidAt: new Date(2025, 6, 1) },
      { amount: 100, category: ecaCategory('July'), paidAt: new Date(2025, 7, 1) },
      { amount: 500, category: 'Books', paidAt: new Date(2025, 6, 1) },
    ]);
    expect(isDefaulter(defaulter)).toBe(true);
    expect(isDefaulter(paidUp)).toBe(false);

    const cls = computeClassFeeSummary([defaulter, paidUp]);
    expect(cls.studentCount).toBe(2);
    expect(cls.defaulterCount).toBe(1);
    expect(cls.totalDuePending).toBe(700); // defaulter: June+July ECA + Books
    expect(cls.totalPaid).toBe(700);
    expect(cls.totalCharged).toBe(23000);
  });
});

/* ── computeBalances (Accounts module) ────────────────────────────────── */

describe('computeBalances', () => {
  const payments = [
    { amount: 1000, mode: 'cash', dateKey: '2025-06-30' },        // ON openingAsOf → excluded
    { amount: 2000, mode: 'cash', dateKey: '2025-07-01' },        // strictly after → cash in
    { amount: 500, mode: 'upi', dateKey: '2025-07-01' },          // bank in
    { amount: 300, mode: 'cheque', dateKey: '2025-07-02' },       // bank in
    { amount: 200, mode: 'bank_transfer', dateKey: '2025-08-05' },// bank in
    { amount: 400, mode: 'cash', dateKey: '2025-08-05', deleted: true }, // excluded
    { amount: 150, paidAt: new Date(2025, 6, 3) },                // no dateKey → derived 2025-07-03; no mode → cash
  ];
  const expenses = [
    { amount: 250, paymentMode: 'cash', date: '2025-07-01', dateKey: '2025-07-01' },
    { amount: 100, paymentMode: 'bank', dateKey: '2025-07-02' },
    { amount: 75, date: '2025-08-05' },                            // legacy: no paymentMode → cash, key from `date`
    { amount: 900, paymentMode: 'cash', dateKey: '2025-06-15' },   // before openingAsOf → excluded
    { amount: 60, paymentMode: 'cash', dateKey: '2025-07-04', deleted: true }, // excluded
  ];
  const opening = { openingCash: 10000, openingBank: 5000, openingAsOf: '2025-06-30' };

  it('splits modes, honors the strict openingAsOf boundary, excludes deleted', () => {
    const result = computeBalances(payments, expenses, opening);
    // cash: 10000 + (2000 + 150) − (250 + 75) = 11825
    expect(result.cash).toBe(11825);
    // bank: 5000 + (500 + 300 + 200) − 100 = 5900
    expect(result.bank).toBe(5900);
    expect(result.total).toBe(11825 + 5900);
  });

  it('buckets flows by dateKey and month', () => {
    const result = computeBalances(payments, expenses, opening);
    expect(result.byDay['2025-07-01']).toEqual({ cashIn: 2000, bankIn: 500, cashOut: 250, bankOut: 0 });
    expect(result.byDay['2025-07-03']).toEqual({ cashIn: 150, bankIn: 0, cashOut: 0, bankOut: 0 });
    expect(result.byDay['2025-06-30']).toBeUndefined(); // on the boundary
    expect(result.byMonth['2025-07']).toEqual({ cashIn: 2150, bankIn: 800, cashOut: 250, bankOut: 100 });
    expect(result.byMonth['2025-08']).toEqual({ cashIn: 0, bankIn: 200, cashOut: 75, bankOut: 0 });
  });

  it('works with no opening settings (sums everything, zero openings)', () => {
    const result = computeBalances(
      [{ amount: 100, mode: 'cash', dateKey: '2025-06-01' }],
      [{ amount: 40, paymentMode: 'cash', dateKey: '2025-06-02' }],
    );
    expect(result.cash).toBe(60);
    expect(result.bank).toBe(0);
  });

  it('accepts a Date openingAsOf', () => {
    const result = computeBalances(
      [
        { amount: 100, mode: 'cash', dateKey: '2025-06-30' },
        { amount: 100, mode: 'cash', dateKey: '2025-07-01' },
      ],
      [],
      { openingCash: 0, openingBank: 0, openingAsOf: new Date(2025, 5, 30) },
    );
    expect(result.cash).toBe(100);
  });
});

/* ── allocatePayments direct API ──────────────────────────────────────── */

describe('allocatePayments (direct)', () => {
  it('exact category matches map straight onto buckets', () => {
    const schedule = buildStudentSchedule(args());
    const summary = allocatePayments(schedule, [
      { amount: 4000, category: 'Term 1', paidAt: new Date(2025, 5, 20) },
      { amount: 500, category: 'Books', paidAt: new Date(2025, 5, 21) },
    ]);
    expect(summary.buckets.find(b => b.category === 'Term 1')!.pending).toBe(0);
    expect(summary.buckets.find(b => b.category === 'Books')!.pending).toBe(0);
    expect(summary.unallocated).toBe(0);
    expect(summary.totalPending).toBe(11500 - 4500);
  });

  it('does not mutate the schedule or the payments', () => {
    const schedule = buildStudentSchedule(args());
    const before = JSON.stringify(schedule);
    const paymentDocs = [{ amount: 100, category: ecaCategory('June'), paidAt: new Date(2025, 5, 20) }];
    allocatePayments(schedule, paymentDocs);
    expect(JSON.stringify(schedule)).toBe(before);
    expect(paymentDocs).toHaveLength(1);
  });
});
