/* ============================================
   CampusOS — Principal Register engine (pure functions)
   ============================================
   The ONLY place the Principal Register's money math lives. Screens must not
   compute dues, splits or balances inline.

   Rules implemented (from Sharmi's recorded call):
   - Three heads: School fee, ECA, Van. ECA is written "in 10 months".
   - ARREARS RULE (her exact complaint): in August only June + July count as
     due — NEVER the whole year. A month becomes due only AFTER it has ended,
     i.e. on the 1st of the following month. The school fee is due immediately.
   - ECA month amount = largest-remainder split of `ecaAnnual` across
     `ecaMonths`: the slices sum EXACTLY to the annual and never overshoot it,
     even for a tiny annual (5 across 10 months → five ₹1 months, not ₹0.5).
   - Van month amount = `vanMonthly` for each month in `vanMonths`.
   - Payments match by head + month (month tag required for eca/van).
     A head payment with no/unknown month still reduces that head's pending
     and its `dueNow` (no false arrears) but fills no month cell.
   - 'other' receipts reduce totalPaid / totalPending / totalDueNow but belong
     to no bucket.
   - Soft-deleted payments, expenses and rows are excluded from EVERY total.
   - Balances count only transactions ON or AFTER settings.openingAsOf.

   PURE module: no Firestore imports, no mutation of inputs. Month and date
   math is imported from fee-utils — it is never re-implemented here.
*/

import {
  ACADEMIC_MONTHS,
  academicMonthOrder,
  academicMonthStart,
  academicYearStartYear,
  coerceDate,
  excludeDeleted,
  toDateKey,
} from './fee-utils';
import type {
  ClassSummary,
  DailyLedger,
  HeadSummary,
  LedgerFlows,
  LedgerSettingsFacts,
  MonthCell,
  MonthlyHeadSummary,
  MonthlyLedger,
  PrincipalExpenseFacts,
  PrincipalPaymentFacts,
  RegisterRowFacts,
  RowSummary,
} from '@/types/principal';

export type {
  ClassSummary, DailyLedger, MonthCell, MonthlyLedger, RowSummary,
} from '@/types/principal';

/* ── Month helpers ────────────────────────────────────────────────────── */

/**
 * De-duplicates and sorts month labels into academic order (June → March).
 * Duplicates MUST go: a repeated month would double-charge van and skew the
 * ECA split. Falls back to `fallback` when the list is empty/missing.
 */
export function resolveMonths(months: string[] | null | undefined, fallback: readonly string[]): string[] {
  const source = months && months.length > 0 ? months : fallback;
  const unique = Array.from(new Set(source));
  return unique.sort((a, b) => academicMonthOrder(a) - academicMonthOrder(b));
}

/** Whole rupees, never negative. All register money is integer rupees. */
function rupees(value: number | null | undefined): number {
  return Math.max(0, Math.round(Number(value) || 0));
}

/**
 * Largest-remainder split of `annual` across `count` months.
 * Every slice is `floor(annual / count)`, and the first `remainder` months
 * (academic order — the tie-break, since all fractional parts are equal) take
 * one extra rupee. Sums EXACTLY to `annual`; can never overshoot it.
 */
export function splitAnnualAcrossMonths(annual: number | null | undefined, count: number): number[] {
  if (count <= 0) return [];
  const total = rupees(annual);
  const base = Math.floor(total / count);
  const remainder = total - base * count; // 0 … count-1
  return Array.from({ length: count }, (_value, i) => base + (i < remainder ? 1 : 0));
}

/**
 * True once the month has ENDED — it falls due on the 1st of the FOLLOWING
 * month. This is the whole of Sharmi's arrears complaint in one line.
 */
function isMonthEnded(month: string, startYear: number, todayKey: string): boolean {
  const start = academicMonthStart(month, startYear);
  if (!start) return false; // unknown label — never due, never chased
  const dueDate = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return todayKey >= toDateKey(dueDate);
}

/* ── Per-row summary ──────────────────────────────────────────────────── */

const EMPTY_HEAD: HeadSummary = { charged: 0, paid: 0, pending: 0 };

interface HeadTally {
  paid: number;
  byMonth: Map<string, number>;
}

const newTally = (): HeadTally => ({ paid: 0, byMonth: new Map() });

function buildMonthlyHead(
  months: string[],
  amounts: number[],
  tally: HeadTally,
  startYear: number,
  todayKey: string,
): MonthlyHeadSummary {
  const cells: MonthCell[] = months.map((month, i) => {
    const amount = amounts[i] ?? 0;
    const paid = tally.byMonth.get(month) ?? 0;
    return {
      month,
      amount,
      paid,
      pending: Math.max(0, amount - paid),
      isDue: isMonthEnded(month, startYear, todayKey),
    };
  });

  const charged = cells.reduce((sum, c) => sum + c.amount, 0);
  // What the month cells actually absorb. Anything a cell cannot absorb —
  // money tagged to no month, tagged to a month outside this row's schedule,
  // or paid OVER a month's amount — is surplus. Surplus fills no cell, but it
  // must still knock down this head's arrears, otherwise a lump payment or an
  // advance reads as a defaulter.
  const consumed = cells.reduce((sum, c) => sum + Math.min(c.paid, c.amount), 0);
  const unallocated = Math.max(0, tally.paid - consumed);
  const duePending = cells.reduce((sum, c) => sum + (c.isDue ? c.pending : 0), 0);

  return {
    months: cells,
    charged,
    paid: tally.paid,
    pending: Math.max(0, charged - tally.paid),
    dueNow: Math.max(0, duePending - unallocated),
  };
}

/**
 * Everything one register row owes and has paid, as of `today`.
 *
 * `payments` must already be scoped to this row. Soft-deleted payments and
 * non-positive amounts are ignored. An unrecognised `head` is treated as
 * 'other' so no money is ever lost from the totals.
 *
 * Month defaults differ by head, deliberately:
 * - ECA falls back to all ten academic months ("ECA is in 10 months").
 * - Van falls back to NO months — only students who actually ride the van
 *   carry van months, so defaulting would invent a charge for everyone.
 */
export function computeRowSummary(
  row: RegisterRowFacts,
  payments: PrincipalPaymentFacts[],
  today: Date = new Date(),
): RowSummary {
  const todayKey = toDateKey(today);
  const startYear = academicYearStartYear(row.academicYear, today);

  const eca = newTally();
  const van = newTally();
  let schoolPaid = 0;
  let otherPaid = 0;

  for (const payment of excludeDeleted(payments)) {
    const amount = Number(payment.amount) || 0;
    if (amount <= 0) continue;
    const tally = payment.head === 'eca' ? eca : payment.head === 'van' ? van : null;
    if (tally) {
      tally.paid += amount;
      const month = payment.month || '';
      if (month) tally.byMonth.set(month, (tally.byMonth.get(month) ?? 0) + amount);
      continue;
    }
    if (payment.head === 'school') schoolPaid += amount;
    else otherPaid += amount; // 'other' + anything unrecognised
  }

  const schoolCharged = rupees(row.schoolFee);
  const school: HeadSummary = {
    charged: schoolCharged,
    paid: schoolPaid,
    pending: Math.max(0, schoolCharged - schoolPaid),
  };

  const ecaMonths = resolveMonths(row.ecaMonths, ACADEMIC_MONTHS);
  const ecaSummary = buildMonthlyHead(
    ecaMonths,
    splitAnnualAcrossMonths(row.ecaAnnual, ecaMonths.length),
    eca,
    startYear,
    todayKey,
  );

  const vanMonths = resolveMonths(row.vanMonths, []);
  const vanPerMonth = rupees(row.vanMonthly);
  const vanSummary = buildMonthlyHead(
    vanMonths,
    vanMonths.map(() => vanPerMonth),
    van,
    startYear,
    todayKey,
  );

  const totalCharged = school.charged + ecaSummary.charged + vanSummary.charged;
  const totalPaid = school.paid + ecaSummary.paid + vanSummary.paid + otherPaid;
  // The school fee is due immediately, so its pending is arrears on day one.
  const dueRaw = school.pending + ecaSummary.dueNow + vanSummary.dueNow;

  return {
    school,
    eca: ecaSummary,
    van: vanSummary,
    other: { paid: otherPaid },
    totalCharged,
    totalPaid,
    totalPending: Math.max(0, totalCharged - totalPaid),
    totalDueNow: Math.max(0, dueRaw - otherPaid),
  };
}

/** Convenience: a row with nothing charged and nothing paid. */
export function emptyRowSummary(): RowSummary {
  const emptyMonthly = (): MonthlyHeadSummary => ({ ...EMPTY_HEAD, months: [], dueNow: 0 });
  return {
    school: { ...EMPTY_HEAD },
    eca: emptyMonthly(),
    van: emptyMonthly(),
    other: { paid: 0 },
    totalCharged: 0,
    totalPaid: 0,
    totalPending: 0,
    totalDueNow: 0,
  };
}

/* ── Class-wise roll-up ───────────────────────────────────────────────── */

const UNASSIGNED_CLASS = 'Unassigned';

/**
 * Per-class totals for the class-wise register, sorted by class name with
 * numeric collation ('Class 2' before 'Class 10'). Soft-deleted rows are
 * dropped; rows with no class land under "Unassigned". Rows missing from
 * `paymentsByRowId` are treated as having no payments.
 */
export function computeClassSummary(
  rows: RegisterRowFacts[],
  paymentsByRowId: Record<string, PrincipalPaymentFacts[]>,
  today: Date = new Date(),
): ClassSummary[] {
  const byClass = new Map<string, ClassSummary>();

  for (const row of excludeDeleted(rows)) {
    const className = row.className || UNASSIGNED_CLASS;
    const summary = computeRowSummary(row, paymentsByRowId[row.id ?? ''] ?? [], today);
    const current = byClass.get(className) ?? {
      className, students: 0, charged: 0, paid: 0, pending: 0, dueNow: 0,
    };
    byClass.set(className, {
      className,
      students: current.students + 1,
      charged: current.charged + summary.totalCharged,
      paid: current.paid + summary.totalPaid,
      pending: current.pending + summary.totalPending,
      dueNow: current.dueNow + summary.totalDueNow,
    });
  }

  return Array.from(byClass.values()).sort((a, b) =>
    a.className.localeCompare(b.className, undefined, { numeric: true, sensitivity: 'base' }));
}

/* ── Daily / monthly ledger ───────────────────────────────────────────── */

interface RawFlow {
  incomeCash: number;
  incomeBank: number;
  expenseCash: number;
  expenseBank: number;
}

const EMPTY_FLOW: RawFlow = { incomeCash: 0, incomeBank: 0, expenseCash: 0, expenseBank: 0 };

/** Anything that is not explicitly 'bank' is cash — matches the paper book. */
const isBank = (mode: string | null | undefined): boolean => mode === 'bank';

/** Stored dateKey, else derived from paidAt. Null when the doc is undatable. */
function flowDateKey(doc: { dateKey?: string | null; paidAt?: unknown }): string | null {
  if (doc.dateKey) return doc.dateKey;
  const paid = coerceDate(doc.paidAt);
  return paid ? toDateKey(paid) : null;
}

/**
 * Buckets every live transaction onto its local dateKey.
 * Transactions dated BEFORE `openingKey` are excluded entirely — they are
 * already baked into the opening balances, so counting them again would
 * double-book. An empty `openingKey` means "no opening cut-off".
 */
function collectFlows(
  payments: PrincipalPaymentFacts[],
  expenses: PrincipalExpenseFacts[],
  openingKey: string,
): Map<string, RawFlow> {
  const byDay = new Map<string, RawFlow>();
  const add = (key: string, field: keyof RawFlow, amount: number): void => {
    const day = byDay.get(key) ?? EMPTY_FLOW;
    byDay.set(key, { ...day, [field]: day[field] + amount });
  };

  for (const payment of excludeDeleted(payments)) {
    const key = flowDateKey(payment);
    const amount = Number(payment.amount) || 0;
    if (!key || amount <= 0 || key < openingKey) continue;
    add(key, isBank(payment.mode) ? 'incomeBank' : 'incomeCash', amount);
  }

  for (const expense of excludeDeleted(expenses)) {
    const key = expense.dateKey ?? null;
    const amount = Number(expense.amount) || 0;
    if (!key || amount <= 0 || key < openingKey) continue;
    add(key, isBank(expense.mode) ? 'expenseBank' : 'expenseCash', amount);
  }

  return byDay;
}

function toFlows(raw: RawFlow): LedgerFlows {
  const income = raw.incomeCash + raw.incomeBank;
  const expense = raw.expenseCash + raw.expenseBank;
  return { ...raw, income, expense, net: income - expense };
}

const addRaw = (a: RawFlow, b: RawFlow): RawFlow => ({
  incomeCash: a.incomeCash + b.incomeCash,
  incomeBank: a.incomeBank + b.incomeBank,
  expenseCash: a.expenseCash + b.expenseCash,
  expenseBank: a.expenseBank + b.expenseBank,
});

const openingOf = (settings: LedgerSettingsFacts | null | undefined) => ({
  cash: Number(settings?.openingCash) || 0,
  bank: Number(settings?.openingBank) || 0,
  key: settings?.openingAsOf || '',
});

/**
 * The day sheet: what came in and went out on `dateKey`, plus the Cash in
 * Hand and Bank Balance at the CLOSE of that day (opening balances rolled
 * forward through every transaction on or before it).
 */
export function computeDailyLedger(
  payments: PrincipalPaymentFacts[],
  expenses: PrincipalExpenseFacts[],
  settings: LedgerSettingsFacts | null | undefined,
  dateKey: string,
): DailyLedger {
  const opening = openingOf(settings);
  const byDay = collectFlows(payments, expenses, opening.key);

  let running: RawFlow = EMPTY_FLOW;
  for (const [key, flow] of byDay) {
    if (key <= dateKey) running = addRaw(running, flow);
  }

  const cashInHand = opening.cash + running.incomeCash - running.expenseCash;
  const bankBalance = opening.bank + running.incomeBank - running.expenseBank;

  return {
    dateKey,
    ...toFlows(byDay.get(dateKey) ?? EMPTY_FLOW),
    cashInHand,
    bankBalance,
    total: cashInHand + bankBalance,
  };
}

/**
 * The month sheet: month totals, the closing Cash in Hand / Bank Balance at
 * month end, and one row per day that actually saw activity (each carrying
 * its own running closing balance). Later months never leak into either.
 */
export function computeMonthlyLedger(
  payments: PrincipalPaymentFacts[],
  expenses: PrincipalExpenseFacts[],
  settings: LedgerSettingsFacts | null | undefined,
  monthKey: string,
): MonthlyLedger {
  const opening = openingOf(settings);
  const byDay = collectFlows(payments, expenses, opening.key);
  const keys = Array.from(byDay.keys()).sort();

  let cashInHand = opening.cash;
  let bankBalance = opening.bank;
  let monthTotal: RawFlow = EMPTY_FLOW;
  const days: DailyLedger[] = [];

  for (const key of keys) {
    const keyMonth = key.slice(0, 7);
    if (keyMonth > monthKey) break; // sorted — nothing later can belong here
    const flow = byDay.get(key) ?? EMPTY_FLOW;
    cashInHand += flow.incomeCash - flow.expenseCash;
    bankBalance += flow.incomeBank - flow.expenseBank;
    if (keyMonth !== monthKey) continue; // earlier day: balance only
    monthTotal = addRaw(monthTotal, flow);
    days.push({
      dateKey: key,
      ...toFlows(flow),
      cashInHand,
      bankBalance,
      total: cashInHand + bankBalance,
    });
  }

  return {
    monthKey,
    ...toFlows(monthTotal),
    cashInHand,
    bankBalance,
    total: cashInHand + bankBalance,
    days,
  };
}
