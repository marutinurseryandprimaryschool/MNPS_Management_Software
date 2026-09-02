/* ============================================
   Principal Register engine — Phase 1 + Phase 2 money math
   ============================================
   Covers the finance scenarios in the Phase 2 spec (§37) against the PURE
   engine, which is where every screen gets its numbers from:

     Test 1/2  school fee partial → completion       (feeStatus, computeRowSummary)
     Test 3/4  ECA and van partial                   (month schedules)
     Test 5    the four payment modes                (computeModeTotals)
     Test 6    cash collected − cash spent           (computeModeTotals)
     Test 7    daily / monthly buckets use paymentDate (computeDailyLedger…)
     plus      the Phase 2 roll-ups                  (teacher / outstanding)

   Test 8 (double-click save) is a UI guard, not engine behavior — it lives in
   RecordPaymentModal's in-flight `saving` check and its duplicate warning.
*/

import { describe, it, expect } from 'vitest';
import {
  computeDailyLedger,
  computeDayCloseAssessment,
  computeModeTotals,
  computeMonthlyLedger,
  computeOutstandingSummary,
  computeReceiptSnapshot,
  computeReceiptSnapshots,
  computeRowSummary,
  computeTeacherSummaries,
  feeStatus,
  groupPaymentsByRow,
  normalizeMode,
} from '@/lib/principal-fees';
import type {
  PrincipalExpenseFacts, PrincipalPaymentFacts, RegisterRowFacts, RowSummary, TeacherRowFacts,
} from '@/types/principal';

/* ── Fixtures ─────────────────────────────────────────────────────────── */

const YEAR = '2026-27';
/** Mid-September: June, July and August have ENDED; September has not. */
const TODAY = new Date(2026, 8, 15);

const ram: TeacherRowFacts = {
  id: 'row-ram',
  academicYear: YEAR,
  className: 'Class 5',
  teacherUid: 'uid-anita',
  teacherName: 'Mrs. Anita',
  schoolFee: 10000,
  ecaAnnual: 5000,
  ecaMonths: ['June', 'July', 'August', 'September', 'October',
    'November', 'December', 'January', 'February', 'March'],
  vanMonthly: 600,
  vanMonths: ['June', 'July', 'August', 'September', 'October',
    'November', 'December', 'January', 'February', 'March'],
};

/** No ECA, no van — the "not every student has these" case (§11, §19). */
const arun: TeacherRowFacts = {
  id: 'row-arun',
  academicYear: YEAR,
  className: 'Class 5',
  teacherUid: 'uid-anita',
  teacherName: 'Mrs. Anita',
  schoolFee: 8000,
  ecaAnnual: 0,
  ecaMonths: [],
  vanMonthly: 0,
  vanMonths: [],
};

const pay = (over: Partial<PrincipalPaymentFacts> = {}): PrincipalPaymentFacts => ({
  head: 'school', amount: 1000, dateKey: '2026-09-01', mode: 'cash', ...over,
});

const spend = (over: Partial<PrincipalExpenseFacts> = {}): PrincipalExpenseFacts => ({
  amount: 1000, dateKey: '2026-09-01', mode: 'cash', ...over,
});

/* ── feeStatus (§17) ──────────────────────────────────────────────────── */

describe('feeStatus', () => {
  it('is PENDING when nothing has been received', () => {
    expect(feeStatus(10000, 0)).toBe('pending');
  });

  it('is PARTIAL when some but not all has been received', () => {
    expect(feeStatus(10000, 3000)).toBe('partial');
  });

  it('is PAID when the full amount has been received', () => {
    expect(feeStatus(10000, 10000)).toBe('paid');
  });

  it('is PAID when more than the due amount has been received', () => {
    expect(feeStatus(500, 700)).toBe('paid');
  });

  it('compares in whole rupees so a paisa cannot leave a settled head PARTIAL', () => {
    expect(feeStatus(500, 499.6)).toBe('paid');
  });

  it('is PENDING for a head that charges nothing and received nothing', () => {
    expect(feeStatus(0, 0)).toBe('pending');
  });
});

/* ── Overpayment on one head (the Aadvik case) ────────────────────────── */

describe('a head paid beyond its charge credits the rest of the row', () => {
  /* Real production row: school 13,500 + ECA 3,500 + van 5,000/yr = 22,000
     charged, with 20,840 recorded entirely against SCHOOL fee. */
  const aadvik: RegisterRowFacts = {
    id: 'row-aadvik',
    academicYear: YEAR,
    className: 'Class 5',
    schoolFee: 13500,
    ecaAnnual: 3500,
    ecaMonths: ['June', 'July', 'August', 'September', 'October',
      'November', 'December', 'January', 'February', 'March'],
    vanMonthly: 500,
    vanMonths: ['June', 'July', 'August', 'September', 'October',
      'November', 'December', 'January', 'February', 'March'],
  };
  const overpaid = [pay({ head: 'school', amount: 20840, month: 'Term 1' })];

  it('totals stay internally consistent (charged − paid = pending)', () => {
    const summary = computeRowSummary(aadvik, overpaid, TODAY);
    expect(summary.totalCharged).toBe(22000);
    expect(summary.totalPaid).toBe(20840);
    expect(summary.totalPending).toBe(1160);
  });

  it('the surplus is reported as credit rather than vanishing', () => {
    const summary = computeRowSummary(aadvik, overpaid, TODAY);
    // 20,840 paid against a 13,500 school fee.
    expect(summary.credit).toBe(7340);
  });

  it('nothing is chaseable while the credit exceeds the arrears', () => {
    const summary = computeRowSummary(aadvik, overpaid, TODAY);
    // Ended months (Jun/Jul/Aug): ECA 1,050 + van 1,500 = 2,550 raw arrears,
    // fully covered by the 7,340 already in hand.
    expect(summary.totalDueNow).toBe(0);
  });

  it('a row paid exactly to its charge carries no credit', () => {
    const summary = computeRowSummary(aadvik, [pay({ head: 'school', amount: 13500 })], TODAY);
    expect(summary.credit).toBe(0);
    expect(summary.totalPending).toBe(8500);
  });

  it('partial credit reduces the arrears without going negative', () => {
    // 15,000 on school = 1,500 surplus against 2,550 of ended arrears.
    const summary = computeRowSummary(aadvik, [pay({ head: 'school', amount: 15000 })], TODAY);
    expect(summary.credit).toBe(1500);
    expect(summary.totalDueNow).toBe(1050);
  });

  it("an 'other' receipt still credits the row, as it always did", () => {
    const summary = computeRowSummary(aadvik, [pay({ head: 'other', amount: 3000 })], TODAY);
    expect(summary.credit).toBe(3000);
    // School fee is due from day one, so 13,500 + 1,050 ECA + 1,500 van of
    // ended arrears = 16,050 raw, less the 3,000 in hand.
    expect(summary.totalDueNow).toBe(13050);
  });
});

/* ── Tests 1–4: partial payments (§37) ────────────────────────────────── */

describe('school fee — partial then complete (§37 tests 1 & 2)', () => {
  it('Test 1: ₹3,000 against ₹10,000 leaves ₹7,000 PARTIAL', () => {
    const summary = computeRowSummary(ram, [pay({ amount: 3000 })], TODAY);
    expect(summary.school.charged).toBe(10000);
    expect(summary.school.paid).toBe(3000);
    expect(summary.school.pending).toBe(7000);
    expect(summary.school.status).toBe('partial');
  });

  it('Test 2: a further ₹7,000 settles it, and BOTH receipts remain', () => {
    const payments = [pay({ amount: 3000 }), pay({ amount: 7000, dateKey: '2026-09-10' })];
    const summary = computeRowSummary(ram, payments, TODAY);
    expect(summary.school.paid).toBe(10000);
    expect(summary.school.pending).toBe(0);
    expect(summary.school.status).toBe('paid');
    // The engine never merges or drops history — it sums what it is given.
    expect(payments).toHaveLength(2);
  });
});

describe('monthly heads — ECA and van (§37 tests 3 & 4, §18, §19)', () => {
  it('Test 3: ₹300 of a ₹500 ECA month is PARTIAL for that month', () => {
    const summary = computeRowSummary(
      ram, [pay({ head: 'eca', month: 'September', amount: 300 })], TODAY,
    );
    const september = summary.eca.months.find(cell => cell.month === 'September');
    expect(september?.amount).toBe(500);
    expect(september?.paid).toBe(300);
    expect(september?.pending).toBe(200);
    // September has not ended on 15 Sep, so it is not chaseable yet.
    expect(september?.isDue).toBe(false);
  });

  it('Test 4: ₹2,000 against van keeps the remaining months pending', () => {
    const summary = computeRowSummary(
      ram, [pay({ head: 'van', month: 'June', amount: 400 })], TODAY,
    );
    const june = summary.van.months.find(cell => cell.month === 'June');
    expect(june?.amount).toBe(600);
    expect(june?.paid).toBe(400);
    expect(june?.pending).toBe(200);
    expect(june?.isDue).toBe(true); // June ended
    expect(summary.van.status).toBe('partial');
  });

  it('keeps August and September separate rather than one blurred balance', () => {
    const summary = computeRowSummary(ram, [
      pay({ head: 'eca', month: 'August', amount: 500 }),
      pay({ head: 'eca', month: 'September', amount: 300 }),
    ], TODAY);
    const august = summary.eca.months.find(cell => cell.month === 'August');
    const september = summary.eca.months.find(cell => cell.month === 'September');
    expect(august?.pending).toBe(0);
    expect(september?.pending).toBe(200);
  });

  it('charges no ECA or van to a student who carries neither', () => {
    const summary = computeRowSummary(arun, [], TODAY);
    expect(summary.eca.charged).toBe(0);
    expect(summary.van.charged).toBe(0);
    expect(summary.totalCharged).toBe(8000);
  });
});

/* ── Test 5 & 6: payment modes (§14, §15, §37) ────────────────────────── */

describe('computeModeTotals (§37 tests 5 & 6)', () => {
  const payments = [
    pay({ amount: 3000, mode: 'cash' }),
    pay({ amount: 300, mode: 'upi' }),
    pay({ amount: 2000, mode: 'bank' }),
    pay({ amount: 500, mode: 'other' }),
  ];

  it('Test 5: files each receipt under its own channel', () => {
    const totals = computeModeTotals(payments, [], '', '');
    const by = Object.fromEntries(totals.rows.map(row => [row.mode, row.collected]));
    expect(by.cash).toBe(3000);
    expect(by.upi).toBe(300);
    expect(by.bank).toBe(2000);
    expect(by.other).toBe(500);
    expect(totals.collected).toBe(5800);
  });

  it('always reports all four channels, in a fixed order', () => {
    const totals = computeModeTotals([], [], '', '');
    expect(totals.rows.map(row => row.mode)).toEqual(['cash', 'upi', 'bank', 'other']);
  });

  it('Test 6: ₹10,000 cash in less ₹2,000 cash out leaves ₹8,000 available', () => {
    const totals = computeModeTotals(
      [pay({ amount: 10000, mode: 'cash' })],
      [spend({ amount: 2000, mode: 'cash' })],
      '', '',
    );
    const cash = totals.rows.find(row => row.mode === 'cash');
    expect(cash?.collected).toBe(10000);
    expect(cash?.spent).toBe(2000);
    expect(cash?.net).toBe(8000);
  });

  it('honours the date window and ignores soft-deleted receipts', () => {
    const totals = computeModeTotals([
      pay({ amount: 1000, dateKey: '2026-09-01' }),
      pay({ amount: 500, dateKey: '2026-10-01' }),
      pay({ amount: 999, dateKey: '2026-09-02', deleted: true }),
    ], [], '2026-09-01', '2026-09-30');
    expect(totals.collected).toBe(1000);
  });

  it('treats an unknown or missing mode as cash, like the ledgers do', () => {
    expect(normalizeMode(undefined)).toBe('cash');
    expect(normalizeMode('cheque')).toBe('cash');
    expect(normalizeMode('upi')).toBe('upi');
  });
});

/* ── Test 7: dates drive the ledgers (§12) ────────────────────────────── */

describe('ledgers bucket on the payment date, not the entry date (§37 test 7)', () => {
  const payments = [
    pay({ amount: 3000, dateKey: '2026-09-01' }),
    pay({ amount: 2000, dateKey: '2026-09-10' }),
    pay({ amount: 1500, dateKey: '2026-10-02' }),
  ];

  it('a day sheet counts only that day', () => {
    const day = computeDailyLedger(payments, [], null, '2026-09-01');
    expect(day.income).toBe(3000);
  });

  it('a month sheet counts only that month', () => {
    const month = computeMonthlyLedger(payments, [], null, '2026-09');
    expect(month.income).toBe(5000);
  });

  it('UPI, bank and other settle into the bank balance; only cash moves cash', () => {
    const day = computeDailyLedger([
      pay({ amount: 1000, mode: 'cash', dateKey: '2026-09-01' }),
      pay({ amount: 100, mode: 'upi', dateKey: '2026-09-01' }),
      pay({ amount: 200, mode: 'bank', dateKey: '2026-09-01' }),
      pay({ amount: 300, mode: 'other', dateKey: '2026-09-01' }),
    ], [], null, '2026-09-01');
    expect(day.incomeCash).toBe(1000);
    expect(day.incomeBank).toBe(600);
    expect(day.cashInHand).toBe(1000);
    expect(day.bankBalance).toBe(600);
  });
});

/* ── Phase 2 roll-ups (§4, §7) ────────────────────────────────────────── */

describe('groupPaymentsByRow', () => {
  it('buckets payments by their row and drops rowless ones', () => {
    const grouped = groupPaymentsByRow([
      { rowId: 'row-ram', amount: 1 },
      { rowId: 'row-ram', amount: 2 },
      { rowId: '', amount: 3 },
    ]);
    expect(grouped['row-ram']).toHaveLength(2);
    expect(Object.keys(grouped)).toEqual(['row-ram']);
  });
});

describe('computeTeacherSummaries (§7)', () => {
  const rows: TeacherRowFacts[] = [ram, arun, {
    ...arun, id: 'row-priya', teacherUid: '', teacherName: null, schoolFee: 6000,
  }];

  const summaries = new Map<string, RowSummary>([
    ['row-ram', computeRowSummary(ram, [pay({ amount: 3000 })], TODAY)],
    ['row-arun', computeRowSummary(arun, [pay({ amount: 8000 })], TODAY)],
    ['row-priya', computeRowSummary({ ...arun, schoolFee: 6000 }, [], TODAY)],
  ]);
  const summaryFor = (id: string) => summaries.get(id)!;

  it('groups students under their responsible teacher', () => {
    const teachers = computeTeacherSummaries(rows, summaryFor);
    const anita = teachers.find(teacher => teacher.teacherUid === 'uid-anita');
    expect(anita?.teacherName).toBe('Mrs. Anita');
    expect(anita?.students).toBe(2);
    expect(anita?.collected).toBe(11000);
  });

  it('rolls students with no teacher into one Unassigned group', () => {
    const teachers = computeTeacherSummaries(rows, summaryFor);
    const unassigned = teachers.find(teacher => teacher.teacherUid === '');
    expect(unassigned?.teacherName).toBe('Unassigned');
    expect(unassigned?.students).toBe(1);
    expect(unassigned?.outstanding).toBe(6000);
  });

  it('puts the biggest outstanding first', () => {
    const teachers = computeTeacherSummaries(rows, summaryFor);
    expect(teachers[0].outstanding).toBeGreaterThanOrEqual(teachers[1].outstanding);
  });
});

describe('computeOutstandingSummary (§4)', () => {
  const rows: RegisterRowFacts[] = [ram, arun, { ...arun, id: 'row-priya', schoolFee: 6000 }];
  const summaries = new Map<string, RowSummary>([
    ['row-ram', computeRowSummary(ram, [pay({ amount: 3000 })], TODAY)],   // partial
    ['row-arun', computeRowSummary(arun, [pay({ amount: 8000 })], TODAY)], // paid
    ['row-priya', computeRowSummary({ ...arun, schoolFee: 6000 }, [], TODAY)], // pending
  ]);
  const summaryFor = (id: string) => summaries.get(id)!;

  it('counts students in each status and totals what is owed', () => {
    const totals = computeOutstandingSummary(rows, summaryFor);
    expect(totals.students).toBe(3);
    expect(totals.paidStudents).toBe(1);
    expect(totals.partialStudents).toBe(1);
    expect(totals.pendingStudents).toBe(1);
    expect(totals.collected).toBe(11000);
    expect(totals.outstanding).toBe(totals.charged - totals.collected);
  });

  it('ignores soft-deleted rows', () => {
    const totals = computeOutstandingSummary(
      [...rows, { ...arun, id: 'row-gone', deleted: true }],
      (id: string) => summaries.get(id) ?? summaries.get('row-priya')!,
    );
    expect(totals.students).toBe(3);
  });
});

/* ── Day close (Phase 3 §16, §34 tests 19–24) ─────────────────────────── */

describe('computeDayCloseAssessment', () => {
  it('MATCHED when the count equals the expectation', () => {
    expect(computeDayCloseAssessment(25000, 25000)).toEqual({ difference: 0, assessment: 'matched' });
  });

  it('SHORT when less cash was counted (spec example: −₹500)', () => {
    expect(computeDayCloseAssessment(25000, 24500)).toEqual({ difference: -500, assessment: 'short' });
  });

  it('EXCESS when more cash was counted', () => {
    expect(computeDayCloseAssessment(25000, 25200)).toEqual({ difference: 200, assessment: 'excess' });
  });

  it('compares in whole rupees, so paisa noise cannot break a match', () => {
    expect(computeDayCloseAssessment(24999.6, 25000)).toEqual({ difference: 0, assessment: 'matched' });
  });

  it('treats missing values as zero', () => {
    expect(computeDayCloseAssessment(undefined, 100)).toEqual({ difference: 100, assessment: 'excess' });
  });
});

/* ── Receipt snapshot (Phase 3 §19, §34 tests 25–31) ──────────────────── */

describe('computeReceiptSnapshot', () => {
  // Arun: school fee only, ₹8,000. Two payments in entry order.
  const history = [
    { id: 'p1', head: 'school', amount: 3000, dateKey: '2026-09-01', mode: 'cash', createdAt: new Date(2026, 8, 1, 10) },
    { id: 'p2', head: 'school', amount: 2000, dateKey: '2026-09-10', mode: 'upi', createdAt: new Date(2026, 8, 10, 10) },
    { id: 'p3', head: 'school', amount: 3000, dateKey: '2026-09-20', mode: 'bank', createdAt: new Date(2026, 8, 20, 10) },
  ];

  it('shows the balance before and after the FIRST payment', () => {
    const snap = computeReceiptSnapshot(arun, history, 'p1', TODAY);
    expect(snap).toEqual({ previousPending: 8000, remainingPending: 5000, status: 'partial' });
  });

  it('a MIDDLE payment counts everything recorded before it', () => {
    const snap = computeReceiptSnapshot(arun, history, 'p2', TODAY);
    expect(snap).toEqual({ previousPending: 5000, remainingPending: 3000, status: 'partial' });
  });

  it('the settling payment reads PAID with a zero balance', () => {
    const snap = computeReceiptSnapshot(arun, history, 'p3', TODAY);
    expect(snap).toEqual({ previousPending: 3000, remainingPending: 0, status: 'paid' });
  });

  it('a reprint is deterministic — later payments never change an old receipt', () => {
    const withOnlyTwo = history.slice(0, 2);
    expect(computeReceiptSnapshot(arun, withOnlyTwo, 'p1', TODAY))
      .toEqual(computeReceiptSnapshot(arun, history, 'p1', TODAY));
  });

  it('orders by ENTRY (createdAt), so a backdated payment entered later does not rewrite older receipts', () => {
    const withBackdated = [
      ...history,
      // Money from 20 Aug, typed in on 25 Sep — after p1..p3 were entered.
      { id: 'p4', head: 'school', amount: 500, dateKey: '2026-08-20', mode: 'cash', createdAt: new Date(2026, 8, 25, 10) },
    ];
    // p1's receipt still shows the numbers as they stood when p1 was entered.
    expect(computeReceiptSnapshot(arun, withBackdated, 'p1', TODAY))
      .toEqual({ previousPending: 8000, remainingPending: 5000, status: 'partial' });
  });

  it('returns null for an unknown or soft-deleted payment', () => {
    expect(computeReceiptSnapshot(arun, history, 'nope', TODAY)).toBeNull();
    const withDeleted = [...history, { id: 'p9', head: 'school', amount: 100, dateKey: '2026-09-21', mode: 'cash', deleted: true, createdAt: new Date(2026, 8, 21) }];
    expect(computeReceiptSnapshot(arun, withDeleted, 'p9', TODAY)).toBeNull();
  });

  /* The payment-history list reads every snapshot at once (§18). The one-pass
     form must agree exactly with the single-payment form it replaced. */
  it('computeReceiptSnapshots agrees with the single-payment form for every row', () => {
    const all = computeReceiptSnapshots(arun, history, TODAY);
    for (const payment of history) {
      expect(all.get(payment.id)).toEqual(
        computeReceiptSnapshot(arun, history, payment.id, TODAY),
      );
    }
  });

  it('computeReceiptSnapshots chains the balances: each starts where the last ended', () => {
    const all = computeReceiptSnapshots(arun, history, TODAY);
    expect(all.get('p1')!.remainingPending).toBe(all.get('p2')!.previousPending);
    expect(all.get('p2')!.remainingPending).toBe(all.get('p3')!.previousPending);
    expect(all.get('p3')!.remainingPending).toBe(0);
  });

  it('computeReceiptSnapshots is order-independent and skips deleted payments', () => {
    const shuffled = [history[2], history[0], history[1]];
    const all = computeReceiptSnapshots(arun, shuffled, TODAY);
    expect(all.get('p1')).toEqual({ previousPending: 8000, remainingPending: 5000, status: 'partial' });
    expect(all.size).toBe(3);

    const withDeleted = [...history, { id: 'pX', head: 'school', amount: 999, dateKey: '2026-09-22', mode: 'cash', deleted: true, createdAt: new Date(2026, 8, 22) }];
    expect(computeReceiptSnapshots(arun, withDeleted, TODAY).has('pX')).toBe(false);
  });
});
