/* Principal Register engine — unit suite.

   The authoritative scenario is the client's: "in August only June and July
   count as due — never the whole year". Everything else hangs off that. */

import { describe, it, expect } from 'vitest';
import { ACADEMIC_MONTHS } from '@/lib/fee-utils';
import {
  computeClassSummary,
  computeDailyLedger,
  computeMonthlyLedger,
  computeRowSummary,
  emptyRowSummary,
  resolveMonths,
  splitAnnualAcrossMonths,
} from '@/lib/principal-fees';
import type {
  LedgerSettingsFacts,
  PrincipalExpenseFacts,
  PrincipalPaymentFacts,
  RegisterRowFacts,
} from '@/types/principal';

/* ── Fixtures ─────────────────────────────────────────────────────────── */

const AY = '2025-2026';
/** Sharmi's authoritative example date: 10 August 2025 (local). */
const AUGUST_10 = new Date(2025, 7, 10);

const MONTHS = [...ACADEMIC_MONTHS];

const row = (overrides: Partial<RegisterRowFacts> = {}): RegisterRowFacts => ({
  id: 'row1',
  academicYear: AY,
  className: 'Class 5',
  schoolFee: 0,
  ecaAnnual: 0,
  ecaMonths: MONTHS,
  vanMonthly: 0,
  vanMonths: [],
  ...overrides,
});

const pay = (overrides: Partial<PrincipalPaymentFacts> = {}): PrincipalPaymentFacts => ({
  head: 'school',
  amount: 0,
  dateKey: '2025-08-10',
  mode: 'cash',
  ...overrides,
});

const dueMonths = (cells: { month: string; isDue: boolean }[]): string[] =>
  cells.filter(c => c.isDue).map(c => c.month);

/* ── ECA split: exact, never overshooting ─────────────────────────────── */

describe('splitAnnualAcrossMonths', () => {
  it('splits an even annual into equal months', () => {
    expect(splitAnnualAcrossMonths(10000, 10)).toEqual(Array(10).fill(1000));
  });

  it('sums EXACTLY to the annual when it does not divide evenly', () => {
    const slices = splitAnnualAcrossMonths(1005, 10);
    expect(slices.reduce((s, v) => s + v, 0)).toBe(1005);
    // Largest remainder: the first five months carry the extra rupee.
    expect(slices).toEqual([101, 101, 101, 101, 101, 100, 100, 100, 100, 100]);
  });

  it('never overshoots on a tiny annual', () => {
    const slices = splitAnnualAcrossMonths(5, 10);
    expect(slices.reduce((s, v) => s + v, 0)).toBe(5);
    expect(Math.min(...slices)).toBe(0);
    expect(Math.max(...slices)).toBe(1);
  });

  it('handles zero, blank and zero-month inputs without producing money', () => {
    expect(splitAnnualAcrossMonths(0, 10)).toEqual(Array(10).fill(0));
    expect(splitAnnualAcrossMonths(null, 10).reduce((s, v) => s + v, 0)).toBe(0);
    expect(splitAnnualAcrossMonths(1000, 0)).toEqual([]);
  });

  it('sums exactly for every annual across every month count', () => {
    for (let annual = 0; annual <= 120; annual += 7) {
      for (let count = 1; count <= 10; count += 1) {
        const slices = splitAnnualAcrossMonths(annual, count);
        expect(slices.reduce((s, v) => s + v, 0)).toBe(annual);
        expect(Math.min(...slices)).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('resolveMonths', () => {
  it('sorts into academic order and drops duplicates', () => {
    expect(resolveMonths(['July', 'June', 'July'], [])).toEqual(['June', 'July']);
  });

  it('falls back only when the list is empty', () => {
    expect(resolveMonths([], MONTHS)).toEqual(MONTHS);
    expect(resolveMonths(null, [])).toEqual([]);
  });
});

/* ── Sharmi's arrears rule ────────────────────────────────────────────── */

describe('ECA arrears — a month is due only AFTER it ends', () => {
  const ecaRow = row({ ecaAnnual: 10000, ecaMonths: MONTHS });

  it('charges only June + July in August — NEVER the whole year', () => {
    const summary = computeRowSummary(ecaRow, [], AUGUST_10);
    expect(summary.eca.charged).toBe(10000);
    expect(summary.eca.dueNow).toBe(2000);
    expect(summary.eca.dueNow).not.toBe(10000);
    expect(dueMonths(summary.eca.months)).toEqual(['June', 'July']);
    expect(summary.totalDueNow).toBe(2000);
    expect(summary.totalPending).toBe(10000);
  });

  it('holds July back until July has actually ended', () => {
    expect(computeRowSummary(ecaRow, [], new Date(2025, 6, 31)).eca.dueNow).toBe(1000);
    expect(computeRowSummary(ecaRow, [], new Date(2025, 7, 1)).eca.dueNow).toBe(2000);
  });

  it('never counts the current month, even in March', () => {
    const march31 = computeRowSummary(ecaRow, [], new Date(2026, 2, 31));
    expect(dueMonths(march31.eca.months)).not.toContain('March');
    expect(march31.eca.dueNow).toBe(9000);
    const april1 = computeRowSummary(ecaRow, [], new Date(2026, 3, 1));
    expect(april1.eca.dueNow).toBe(10000);
  });

  it('nothing is due before the year starts', () => {
    expect(computeRowSummary(ecaRow, [], new Date(2025, 5, 15)).eca.dueNow).toBe(0);
  });

  it('defaults to the ten academic months when none are stored', () => {
    const summary = computeRowSummary(row({ ecaAnnual: 10000, ecaMonths: [] }), [], AUGUST_10);
    expect(summary.eca.months).toHaveLength(10);
    expect(summary.eca.charged).toBe(10000);
  });
});

/* ── School fee ───────────────────────────────────────────────────────── */

describe('school fee', () => {
  it('is due immediately, on day one of the year', () => {
    const summary = computeRowSummary(row({ schoolFee: 5000 }), [], new Date(2025, 5, 1));
    expect(summary.school).toEqual({ charged: 5000, paid: 0, pending: 5000 });
    expect(summary.totalDueNow).toBe(5000);
  });

  it('is knocked down by school payments only', () => {
    const summary = computeRowSummary(
      row({ schoolFee: 5000, ecaAnnual: 10000 }),
      [pay({ head: 'school', amount: 2000 })],
      AUGUST_10,
    );
    expect(summary.school.paid).toBe(2000);
    expect(summary.school.pending).toBe(3000);
    expect(summary.eca.paid).toBe(0);
    expect(summary.totalDueNow).toBe(3000 + 2000);
  });
});

/* ── Van fee ──────────────────────────────────────────────────────────── */

describe('van fee', () => {
  it('charges vanMonthly for each listed month and follows the arrears rule', () => {
    const summary = computeRowSummary(row({ vanMonthly: 500, vanMonths: MONTHS }), [], AUGUST_10);
    expect(summary.van.charged).toBe(5000);
    expect(summary.van.dueNow).toBe(1000);
    expect(summary.van.months.every(c => c.amount === 500)).toBe(true);
  });

  it('charges nothing when the student has no van months', () => {
    const summary = computeRowSummary(row({ vanMonthly: 500, vanMonths: [] }), [], AUGUST_10);
    expect(summary.van.charged).toBe(0);
    expect(summary.van.months).toEqual([]);
    expect(summary.totalCharged).toBe(0);
  });

  it('supports a part-year van rider', () => {
    const summary = computeRowSummary(
      row({ vanMonthly: 500, vanMonths: ['August', 'June', 'July'] }),
      [],
      AUGUST_10,
    );
    expect(summary.van.months.map(c => c.month)).toEqual(['June', 'July', 'August']);
    expect(summary.van.charged).toBe(1500);
    expect(summary.van.dueNow).toBe(1000);
  });
});

/* ── Payment matching ─────────────────────────────────────────────────── */

describe('payment matching (head + month)', () => {
  const ecaRow = row({ ecaAnnual: 10000, ecaMonths: MONTHS });

  it('fills the month cell it is tagged to', () => {
    const summary = computeRowSummary(ecaRow, [pay({ head: 'eca', month: 'June', amount: 1000 })], AUGUST_10);
    const june = summary.eca.months.find(c => c.month === 'June');
    expect(june).toMatchObject({ amount: 1000, paid: 1000, pending: 0, isDue: true });
    expect(summary.eca.dueNow).toBe(1000); // July only
    expect(summary.eca.pending).toBe(9000);
  });

  it('lets an untagged head payment clear arrears without filling a cell', () => {
    const summary = computeRowSummary(ecaRow, [pay({ head: 'eca', amount: 2000 })], AUGUST_10);
    expect(summary.eca.months.every(c => c.paid === 0)).toBe(true);
    expect(summary.eca.paid).toBe(2000);
    expect(summary.eca.pending).toBe(8000);
    expect(summary.eca.dueNow).toBe(0);
  });

  it('treats a month outside the schedule as untagged money', () => {
    const summary = computeRowSummary(
      row({ vanMonthly: 500, vanMonths: ['June'] }),
      [pay({ head: 'van', month: 'July', amount: 500 })],
      AUGUST_10,
    );
    expect(summary.van.months.find(c => c.month === 'June')?.paid).toBe(0);
    expect(summary.van.paid).toBe(500);
    expect(summary.van.dueNow).toBe(0);
  });

  it('never drives a cell or a total negative on overpayment', () => {
    const summary = computeRowSummary(ecaRow, [pay({ head: 'eca', month: 'June', amount: 5000 })], AUGUST_10);
    const june = summary.eca.months.find(c => c.month === 'June');
    expect(june?.paid).toBe(5000);
    expect(june?.pending).toBe(0);
    expect(summary.eca.pending).toBe(5000);
    expect(summary.totalPending).toBe(5000);
    expect(summary.totalDueNow).toBe(0);
  });

  it('ignores zero and negative amounts', () => {
    const summary = computeRowSummary(ecaRow, [
      pay({ head: 'eca', month: 'June', amount: 0 }),
      pay({ head: 'eca', month: 'June', amount: -500 }),
    ], AUGUST_10);
    expect(summary.eca.paid).toBe(0);
    expect(summary.totalPaid).toBe(0);
  });
});

/* ── 'other' receipts ─────────────────────────────────────────────────── */

describe("'other' payments", () => {
  const mixedRow = row({ schoolFee: 5000, ecaAnnual: 10000 });

  it('reduce the totals but belong to no bucket', () => {
    const summary = computeRowSummary(mixedRow, [pay({ head: 'other', amount: 1500 })], AUGUST_10);
    expect(summary.other.paid).toBe(1500);
    expect(summary.school.paid).toBe(0);
    expect(summary.eca.paid).toBe(0);
    expect(summary.eca.months.every(c => c.paid === 0)).toBe(true);
    expect(summary.totalPaid).toBe(1500);
    expect(summary.totalCharged).toBe(15000);
    expect(summary.totalPending).toBe(13500);
    // school 5000 + eca (June+July) 2000 − 1500 unallocated
    expect(summary.totalDueNow).toBe(5500);
  });

  it('collect any unrecognised head so no money is lost', () => {
    const summary = computeRowSummary(
      mixedRow,
      [pay({ head: 'stationery', amount: 200 }), pay({ head: null, amount: 100 })],
      AUGUST_10,
    );
    expect(summary.other.paid).toBe(300);
    expect(summary.totalPaid).toBe(300);
  });
});

/* ── Soft deletes ─────────────────────────────────────────────────────── */

describe('soft-deleted payments', () => {
  it('are excluded from every bucket and every total', () => {
    const summary = computeRowSummary(row({ schoolFee: 5000, ecaAnnual: 10000 }), [
      pay({ head: 'school', amount: 5000, deleted: true }),
      pay({ head: 'eca', month: 'June', amount: 1000, deleted: true }),
      pay({ head: 'other', amount: 900, deleted: true }),
      pay({ head: 'school', amount: 1000 }),
    ], AUGUST_10);
    expect(summary.school.paid).toBe(1000);
    expect(summary.eca.months.find(c => c.month === 'June')?.paid).toBe(0);
    expect(summary.other.paid).toBe(0);
    expect(summary.totalPaid).toBe(1000);
    expect(summary.totalDueNow).toBe(4000 + 2000);
  });
});

/* ── Purity ───────────────────────────────────────────────────────────── */

describe('purity', () => {
  it('does not mutate its inputs', () => {
    const input = row({ ecaAnnual: 1005, ecaMonths: ['July', 'June'] });
    const payments = [pay({ head: 'eca', month: 'June', amount: 100 })];
    const snapshot = JSON.stringify({ input, payments });
    computeRowSummary(input, payments, AUGUST_10);
    expect(JSON.stringify({ input, payments })).toBe(snapshot);
  });

  it('emptyRowSummary hands back independent month arrays', () => {
    const summary = emptyRowSummary();
    expect(summary.eca.months).not.toBe(summary.van.months);
    expect(summary.totalDueNow).toBe(0);
  });
});

/* ── Class-wise roll-up ───────────────────────────────────────────────── */

describe('computeClassSummary', () => {
  const rows: RegisterRowFacts[] = [
    row({ id: 'a', className: 'Class 10', schoolFee: 5000, ecaAnnual: 10000 }),
    row({ id: 'b', className: 'Class 2', schoolFee: 3000, ecaAnnual: 0 }),
    row({ id: 'c', className: 'Class 2', schoolFee: 3000, ecaAnnual: 0 }),
    row({ id: 'd', className: 'Class 2', schoolFee: 9999, deleted: true }),
  ];
  const payments: Record<string, PrincipalPaymentFacts[]> = {
    a: [pay({ head: 'school', amount: 5000 })],
    b: [pay({ head: 'school', amount: 1000 })],
  };

  it('aggregates per class, skipping soft-deleted rows', () => {
    const summaries = computeClassSummary(rows, payments, AUGUST_10);
    expect(summaries.map(s => s.className)).toEqual(['Class 2', 'Class 10']); // numeric sort
    const two = summaries[0];
    expect(two).toEqual({
      className: 'Class 2', students: 2, charged: 6000, paid: 1000, pending: 5000, dueNow: 5000,
    });
    const ten = summaries[1];
    expect(ten).toEqual({
      className: 'Class 10', students: 1, charged: 15000, paid: 5000, pending: 10000, dueNow: 2000,
    });
  });

  it('treats a row with no payments and no class safely', () => {
    const summaries = computeClassSummary([row({ id: 'z', className: '' })], {}, AUGUST_10);
    expect(summaries).toEqual([
      { className: 'Unassigned', students: 1, charged: 0, paid: 0, pending: 0, dueNow: 0 },
    ]);
  });
});

/* ── Ledgers ──────────────────────────────────────────────────────────── */

describe('daily and monthly ledger', () => {
  const settings: LedgerSettingsFacts = {
    openingCash: 1000,
    openingBank: 5000,
    openingAsOf: '2025-08-01',
  };

  const payments: PrincipalPaymentFacts[] = [
    pay({ amount: 999, dateKey: '2025-07-31', mode: 'cash' }),   // before opening — ignored
    pay({ amount: 500, dateKey: '2025-08-01', mode: 'cash' }),   // ON opening — counted
    pay({ amount: 2000, dateKey: '2025-08-05', mode: 'bank' }),
    pay({ amount: 300, dateKey: '2025-08-05', mode: 'cash' }),
    pay({ amount: 700, dateKey: '2025-09-02', mode: 'cash' }),   // next month
    pay({ amount: 250, dateKey: '2025-08-05', mode: 'cash', deleted: true }),
  ];

  const expenses: PrincipalExpenseFacts[] = [
    { amount: 100, dateKey: '2025-08-05', mode: 'cash' },
    { amount: 400, dateKey: '2025-08-06', mode: 'bank' },
    { amount: 5000, dateKey: '2025-07-20', mode: 'cash' },       // before opening — ignored
    { amount: 800, dateKey: '2025-08-06', mode: 'cash', deleted: true },
  ];

  it('reports the day and the closing balances for that day', () => {
    const day = computeDailyLedger(payments, expenses, settings, '2025-08-05');
    expect(day).toMatchObject({
      dateKey: '2025-08-05',
      incomeCash: 300, incomeBank: 2000, expenseCash: 100, expenseBank: 0,
      income: 2300, expense: 100, net: 2200,
    });
    expect(day.cashInHand).toBe(1000 + 500 + 300 - 100);
    expect(day.bankBalance).toBe(5000 + 2000);
    expect(day.total).toBe(day.cashInHand + day.bankBalance);
  });

  it('counts a transaction dated ON openingAsOf, not one dated before it', () => {
    const openingDay = computeDailyLedger(payments, expenses, settings, '2025-08-01');
    expect(openingDay.incomeCash).toBe(500);
    expect(openingDay.cashInHand).toBe(1500);

    const beforeOpening = computeDailyLedger(payments, expenses, settings, '2025-07-31');
    expect(beforeOpening.income).toBe(0);
    expect(beforeOpening.cashInHand).toBe(1000);
    expect(beforeOpening.bankBalance).toBe(5000);
  });

  it('falls back to paidAt when a payment has no dateKey', () => {
    const day = computeDailyLedger(
      [pay({ amount: 400, dateKey: null, paidAt: new Date(2025, 7, 12), mode: 'cash' })],
      [], settings, '2025-08-12',
    );
    expect(day.incomeCash).toBe(400);
  });

  it('treats an unknown mode as cash', () => {
    const day = computeDailyLedger(
      [pay({ amount: 60, dateKey: '2025-08-09', mode: 'upi' })],
      [], settings, '2025-08-09',
    );
    expect(day.incomeCash).toBe(60);
    expect(day.incomeBank).toBe(0);
  });

  it('totals the month and closes with the month-end balances', () => {
    const month = computeMonthlyLedger(payments, expenses, settings, '2025-08');
    expect(month).toMatchObject({
      monthKey: '2025-08',
      incomeCash: 800, incomeBank: 2000, expenseCash: 100, expenseBank: 400,
      income: 2800, expense: 500, net: 2300,
    });
    expect(month.cashInHand).toBe(1000 + 800 - 100);
    expect(month.bankBalance).toBe(5000 + 2000 - 400);
    expect(month.total).toBe(1700 + 6600);
  });

  it('lists one row per active day with a running balance', () => {
    const month = computeMonthlyLedger(payments, expenses, settings, '2025-08');
    expect(month.days.map(d => d.dateKey)).toEqual(['2025-08-01', '2025-08-05', '2025-08-06']);
    expect(month.days[0].cashInHand).toBe(1500);
    expect(month.days[1].cashInHand).toBe(1700);
    expect(month.days[1].bankBalance).toBe(7000);
    expect(month.days[2]).toMatchObject({ expenseBank: 400, expenseCash: 0 });
    expect(month.days[2].bankBalance).toBe(6600);
  });

  it('carries earlier months into the balance but never into the totals', () => {
    const september = computeMonthlyLedger(payments, expenses, settings, '2025-09');
    expect(september.income).toBe(700);
    expect(september.days.map(d => d.dateKey)).toEqual(['2025-09-02']);
    // August's closing cash (1700) rolled forward, plus September's 700.
    expect(september.cashInHand).toBe(2400);
    expect(september.bankBalance).toBe(6600);
  });

  it('keeps later months out of an earlier month’s closing balance', () => {
    const july = computeMonthlyLedger(payments, expenses, { openingCash: 1000, openingBank: 5000 }, '2025-07');
    // No openingAsOf cut-off, so July's own transactions count and August's do not.
    expect(july.income).toBe(999);
    expect(july.expense).toBe(5000);
    expect(july.cashInHand).toBe(1000 + 999 - 5000);
  });

  it('works with no settings at all', () => {
    const day = computeDailyLedger(payments, expenses, null, '2025-08-05');
    expect(day.cashInHand).toBe(999 + 500 + 300 - 5000 - 100);
    expect(day.incomeBank).toBe(2000);
  });
});
