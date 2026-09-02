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
  DayCloseAssessment,
  ExpenseCategoryTotal,
  ExpenseReport,
  ExpenseReportFacts,
  FeeStatus,
  HeadSummary,
  LedgerFlows,
  LedgerSettingsFacts,
  ModeTotals,
  ModeTotalsRow,
  MonthCell,
  MonthlyHeadSummary,
  MonthlyLedger,
  OutstandingSummary,
  PrincipalExpenseFacts,
  PrincipalPaymentFacts,
  PrincipalPaymentMode,
  ReceiptSnapshot,
  RegisterRowFacts,
  RowSummary,
  TeacherRowFacts,
  TeacherSummary,
} from '@/types/principal';

export type {
  ClassSummary, DailyLedger, DayCloseAssessment, ExpenseCategoryTotal, ExpenseReport,
  FeeStatus, ModeTotals, ModeTotalsRow, MonthCell, MonthlyLedger, OutstandingSummary,
  ReceiptSnapshot, RowSummary, TeacherSummary,
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

/**
 * PENDING / PARTIAL / PAID for one head, from what it charges and what came in.
 *
 * Compared in WHOLE rupees so a fraction of a paisa can never leave a fully
 * settled head reading 'partial' — the same reason splitAnnualAcrossMonths
 * uses a largest-remainder split instead of raw division.
 */
export function feeStatus(
  charged: number | null | undefined,
  paid: number | null | undefined,
): FeeStatus {
  const due = Math.round(Number(charged) || 0);
  const received = Math.round(Number(paid) || 0);
  if (received <= 0) return 'pending';
  // Nothing charged but money received (a stray receipt, or an optional head
  // the row never configured): there is nothing left owing.
  if (due <= 0) return 'paid';
  return received >= due ? 'paid' : 'partial';
}

const EMPTY_HEAD: HeadSummary = { charged: 0, paid: 0, pending: 0, status: 'pending' };

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
    status: feeStatus(charged, tally.paid),
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
    status: feeStatus(schoolCharged, schoolPaid),
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

  /*
   * Money in hand that no charge has absorbed. A head's pending clamps at
   * zero, so ₹20,840 against a ₹13,500 school fee used to leave ₹7,340
   * simply unaccounted for: the totals counted it (totalPending fell) while
   * the heads did not (each still showed its own full pending), and the
   * Principal saw two different answers on one screen. Overpayment on any
   * head now behaves exactly as an 'other' receipt already did — it offsets
   * what can be chased.
   */
  const excess = Math.max(0, school.paid - school.charged)
    + Math.max(0, ecaSummary.paid - ecaSummary.charged)
    + Math.max(0, vanSummary.paid - vanSummary.charged);
  const credit = otherPaid + excess;

  return {
    school,
    eca: ecaSummary,
    van: vanSummary,
    other: { paid: otherPaid },
    credit,
    totalCharged,
    totalPaid,
    totalPending: Math.max(0, totalCharged - totalPaid),
    totalDueNow: Math.max(0, dueRaw - credit),
    status: feeStatus(totalCharged, totalPaid),
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
    credit: 0,
    totalCharged: 0,
    totalPaid: 0,
    totalPending: 0,
    totalDueNow: 0,
    status: 'pending',
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

/* ── Teacher-wise / outstanding roll-ups (Phase 2 §4, §7) ─────────────── */

export const UNASSIGNED_TEACHER = 'Unassigned';

/**
 * Payments bucketed by their register row, ready for computeRowSummary.
 * One pass, so a screen holding a flat payment list never re-scans it per row.
 */
export function groupPaymentsByRow<T extends { rowId?: string | null }>(
  payments: T[],
): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};
  for (const payment of payments) {
    const rowId = payment.rowId || '';
    if (!rowId) continue;
    (grouped[rowId] ??= []).push(payment);
  }
  return grouped;
}

/**
 * Per-teacher money for the Accounts teacher list.
 *
 * Takes an already-computed `summaryFor` rather than raw payments on purpose:
 * the caller holds one memoized summary per row, and the finance home rolls
 * the SAME summaries up three different ways (teacher, outstanding, list).
 * Recomputing here would trip §39 on a 200-student register.
 *
 * Sorted by outstanding (biggest first), so whoever needs chasing is on top;
 * ties fall back to name. Soft-deleted rows are dropped, and rows with no
 * responsible teacher roll into a single "Unassigned" group.
 */
export function computeTeacherSummaries(
  rows: TeacherRowFacts[],
  summaryFor: (rowId: string) => RowSummary,
): TeacherSummary[] {
  const byTeacher = new Map<string, TeacherSummary>();

  for (const row of excludeDeleted(rows)) {
    const uid = row.teacherUid || '';
    const summary = summaryFor(row.id ?? '');
    const current = byTeacher.get(uid) ?? {
      teacherUid: uid,
      teacherName: row.teacherName || UNASSIGNED_TEACHER,
      students: 0, charged: 0, collected: 0, outstanding: 0, dueNow: 0,
    };
    byTeacher.set(uid, {
      teacherUid: uid,
      // A later row may carry the name when an earlier one did not.
      teacherName: current.teacherName !== UNASSIGNED_TEACHER
        ? current.teacherName
        : (row.teacherName || UNASSIGNED_TEACHER),
      students: current.students + 1,
      charged: current.charged + summary.totalCharged,
      collected: current.collected + summary.totalPaid,
      outstanding: current.outstanding + summary.totalPending,
      dueNow: current.dueNow + summary.totalDueNow,
    });
  }

  return Array.from(byTeacher.values()).sort((a, b) =>
    b.outstanding - a.outstanding
    || a.teacherName.localeCompare(b.teacherName, undefined, { sensitivity: 'base' }));
}

/**
 * School-wide outstanding position: the money totals plus how many students
 * sit in each `feeStatus` state. Same `summaryFor` reuse as above.
 */
export function computeOutstandingSummary(
  rows: RegisterRowFacts[],
  summaryFor: (rowId: string) => RowSummary,
): OutstandingSummary {
  const totals: OutstandingSummary = {
    students: 0, charged: 0, collected: 0, outstanding: 0, dueNow: 0,
    pendingStudents: 0, partialStudents: 0, paidStudents: 0,
  };

  for (const row of excludeDeleted(rows)) {
    const summary = summaryFor(row.id ?? '');
    totals.students += 1;
    totals.charged += summary.totalCharged;
    totals.collected += summary.totalPaid;
    totals.outstanding += summary.totalPending;
    totals.dueNow += summary.totalDueNow;
    if (summary.status === 'paid') totals.paidStudents += 1;
    else if (summary.status === 'partial') totals.partialStudents += 1;
    else totals.pendingStudents += 1;
  }

  return totals;
}

/* ── Daily / monthly ledger ───────────────────────────────────────────── */

interface RawFlow {
  incomeCash: number;
  incomeBank: number;
  expenseCash: number;
  expenseBank: number;
}

const EMPTY_FLOW: RawFlow = { incomeCash: 0, incomeBank: 0, expenseCash: 0, expenseBank: 0 };

/**
 * Which BALANCE bucket a mode belongs to. Only physical cash moves Cash in
 * Hand; 'upi', 'bank' and 'other' all land in the bank (client decision,
 * 2026-09-01 — the drawer count must equal the cash actually in the drawer).
 * A missing/unknown mode stays cash, exactly as it was before the extra
 * channels existed, so no legacy doc changes bucket.
 */
const isBank = (mode: string | null | undefined): boolean =>
  mode === 'bank' || mode === 'upi' || mode === 'other';

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

/* ── Day close (Phase 3 §16) ──────────────────────────────────────────── */

/**
 * Counted cash vs the ledger's expectation, in whole rupees (a torn-note
 * paisa must not turn a matched drawer into a "short" one). Positive
 * difference = more cash than expected (excess), negative = short.
 */
export function computeDayCloseAssessment(
  expectedCash: number | null | undefined,
  actualCash: number | null | undefined,
): { difference: number; assessment: DayCloseAssessment } {
  const expected = Math.round(Number(expectedCash) || 0);
  const actual = Math.round(Number(actualCash) || 0);
  const difference = actual - expected;
  return {
    difference,
    assessment: difference === 0 ? 'matched' : difference < 0 ? 'short' : 'excess',
  };
}

/* ── Receipt snapshot (Phase 3 §19) ───────────────────────────────────── */

/**
 * The balance story of one payment, rebuilt from history so a receipt can be
 * reprinted months later and still show the numbers as they stood THEN.
 *
 * "Up to and including this payment" is ordered by createdAt (entry order,
 * server-stamped and rules-pinned), falling back to id — NOT by dateKey: a
 * backdated receipt printed at entry time must show the balance the Principal
 * saw at that moment, which includes everything already entered.
 *
 * Returns null when the payment is not in the list (deleted rows excluded —
 * a receipt for a soft-deleted payment would document money the totals no
 * longer count).
 */
export function computeReceiptSnapshot(
  row: RegisterRowFacts,
  payments: (PrincipalPaymentFacts & { id?: string; createdAt?: unknown })[],
  paymentId: string,
  today: Date = new Date(),
): ReceiptSnapshot | null {
  return computeReceiptSnapshots(row, payments, today).get(paymentId) ?? null;
}

/** Entry order: server `createdAt`, id as the tie-break. */
function receiptOrderKey(
  payment: { id?: string; createdAt?: unknown },
): [number, string] {
  const created = coerceDate(payment.createdAt);
  return [created ? created.getTime() : 0, payment.id ?? ''];
}

/**
 * Every live payment's balance story in ONE pass, keyed by payment id.
 *
 * The per-payment form above would re-summarise the whole history for each
 * row it is asked about; a payment history list needs them all at once, so
 * this walks the payments in entry order and summarises each prefix exactly
 * once (§28: the UI must not compute balances itself, and §31: no repeated
 * full-ledger recalculation).
 *
 * Soft-deleted payments are excluded and get no entry — their money is in no
 * total, so there is no balance story to tell.
 */
export function computeReceiptSnapshots(
  row: RegisterRowFacts,
  payments: (PrincipalPaymentFacts & { id?: string; createdAt?: unknown })[],
  today: Date = new Date(),
): Map<string, ReceiptSnapshot> {
  const ordered = [...excludeDeleted(payments)].sort((a, b) => {
    const [timeA, idA] = receiptOrderKey(a);
    const [timeB, idB] = receiptOrderKey(b);
    return timeA - timeB || idA.localeCompare(idB);
  });

  const snapshots = new Map<string, ReceiptSnapshot>();
  const prefix: typeof ordered = [];
  // Balance before the first payment: the row with nothing paid against it.
  let previousPending = computeRowSummary(row, [], today).totalPending;

  for (const payment of ordered) {
    prefix.push(payment);
    const after = computeRowSummary(row, prefix, today);
    if (payment.id) {
      snapshots.set(payment.id, {
        previousPending,
        remainingPending: after.totalPending,
        status: after.status,
      });
    }
    previousPending = after.totalPending;
  }

  return snapshots;
}

/* ── Expense report ───────────────────────────────────────────────────── */

const UNCATEGORISED = 'Uncategorised';

/** Trimmed category, or the shared placeholder for a blank one. */
export function expenseCategoryLabel(category: string | null | undefined): string {
  return (category ?? '').trim() || UNCATEGORISED;
}

/**
 * True when `dateKey` falls inside the inclusive window. Both bounds are
 * optional; ISO 'yyyy-MM-dd' sorts lexicographically, so string compare IS
 * date compare — the same trick the ledgers use for the opening cut-off.
 */
export function isWithinRange(dateKey: string, fromKey: string, toKey: string): boolean {
  if (fromKey && dateKey < fromKey) return false;
  if (toKey && dateKey > toKey) return false;
  return true;
}

/**
 * Spend between two dates, rolled up by category and split cash/bank.
 *
 * Deliberately NOT opening-cut-off aware (unlike computeDailyLedger /
 * computeMonthlyLedger): the ledgers answer "what is the balance", where
 * pre-opening money is already banked into the opening figures, while this
 * answers "what did we spend in this window" — which must count every entry
 * dated inside it. Soft-deleted and non-positive entries are excluded, matching
 * every other total in this module.
 */
export function computeExpenseReport(
  expenses: ExpenseReportFacts[],
  fromKey: string,
  toKey: string,
): ExpenseReport {
  const buckets = new Map<string, { cash: number; bank: number; count: number }>();
  let cash = 0;
  let bank = 0;
  let count = 0;

  for (const expense of excludeDeleted(expenses)) {
    const key = expense.dateKey || '';
    const amount = Number(expense.amount) || 0;
    if (!key || amount <= 0 || !isWithinRange(key, fromKey, toKey)) continue;

    const category = expenseCategoryLabel(expense.category);
    const bucket = buckets.get(category) ?? { cash: 0, bank: 0, count: 0 };
    if (isBank(expense.mode)) {
      bucket.bank += amount;
      bank += amount;
    } else {
      bucket.cash += amount;
      cash += amount;
    }
    bucket.count += 1;
    buckets.set(category, bucket);
    count += 1;
  }

  const total = cash + bank;
  const categories: ExpenseCategoryTotal[] = Array.from(buckets, ([category, bucket]) => ({
    category,
    cash: bucket.cash,
    bank: bucket.bank,
    total: bucket.cash + bucket.bank,
    count: bucket.count,
    share: total > 0 ? ((bucket.cash + bucket.bank) / total) * 100 : 0,
  })).sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));

  return { fromKey, toKey, categories, cash, bank, total, count };
}

/* ── Per-method money (Phase 1 §15) ───────────────────────────────────── */

/** Fixed display/report order for the payment channels. */
export const PRINCIPAL_MODES: readonly PrincipalPaymentMode[] = ['cash', 'upi', 'bank', 'other'];

/** Stored mode → one of the four channels; unknown/missing stays 'cash',
    mirroring isBank so every report agrees with the balances. */
export function normalizeMode(mode: string | null | undefined): PrincipalPaymentMode {
  return mode === 'upi' || mode === 'bank' || mode === 'other' ? mode : 'cash';
}

/**
 * Collected / spent / net per payment channel over an inclusive date window.
 * Same exclusions as every other total here (soft-deleted, non-positive,
 * undatable), same window semantics as computeExpenseReport — and like it, NO
 * opening cut-off: this reports what moved through each channel, not balances.
 * Payments fall back to paidAt for their date, exactly as the ledgers do.
 */
export function computeModeTotals(
  payments: PrincipalPaymentFacts[],
  expenses: ExpenseReportFacts[],
  fromKey: string,
  toKey: string,
): ModeTotals {
  const collected = new Map<PrincipalPaymentMode, number>();
  const spent = new Map<PrincipalPaymentMode, number>();

  for (const payment of excludeDeleted(payments)) {
    const key = flowDateKey(payment);
    const amount = Number(payment.amount) || 0;
    if (!key || amount <= 0 || !isWithinRange(key, fromKey, toKey)) continue;
    const mode = normalizeMode(payment.mode);
    collected.set(mode, (collected.get(mode) ?? 0) + amount);
  }

  for (const expense of excludeDeleted(expenses)) {
    const key = expense.dateKey || '';
    const amount = Number(expense.amount) || 0;
    if (!key || amount <= 0 || !isWithinRange(key, fromKey, toKey)) continue;
    const mode = normalizeMode(expense.mode);
    spent.set(mode, (spent.get(mode) ?? 0) + amount);
  }

  const rows: ModeTotalsRow[] = PRINCIPAL_MODES.map(mode => {
    const inAmt = collected.get(mode) ?? 0;
    const outAmt = spent.get(mode) ?? 0;
    return { mode, collected: inAmt, spent: outAmt, net: inAmt - outAmt };
  });

  const totalIn = rows.reduce((sum, row) => sum + row.collected, 0);
  const totalOut = rows.reduce((sum, row) => sum + row.spent, 0);
  return { fromKey, toKey, rows, collected: totalIn, spent: totalOut, net: totalIn - totalOut };
}
