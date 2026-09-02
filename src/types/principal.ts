/* ============================================
   CampusOS — Principal Register types
   ============================================
   STANDALONE module. It shares NO data with the legacy fee module: nothing
   here ever reads or writes feePayments / feeStructures / expenses. Every
   collection is new and isolated:

     principalRegister/{rowId}      — Sharmi's paper "fees note", one row/student
     principalPayments/{paymentId}  — money received against a register row
     principalExpenses/{expenseId}  — money spent
     principalAudit/{entryId}       — write-once activity log
     principalSettings/main         — opening balances + per-year defaults

   This file is the SOURCE OF TRUTH for the document shapes.
   - The engine (src/lib/principal-fees.ts) consumes the structural `*Facts`
     types so it stays pure and trivially testable; the stored shapes are
     assignable to them.
   - The service (src/lib/principal-service.ts) is the ONLY writer.
*/

/** The three heads Sharmi keeps, plus a catch-all that belongs to no bucket. */
export type PrincipalFeeHead = 'school' | 'eca' | 'van' | 'other';

/**
 * Money movement channel. For BALANCES only 'cash' moves Cash in Hand; 'upi',
 * 'bank' and 'other' all land in Bank Balance (client decision, 2026-09-01) —
 * so the drawer count stays strictly physical cash. Reports still show each
 * channel on its own line. Legacy docs hold only 'cash' | 'bank'.
 */
export type PrincipalPaymentMode = 'cash' | 'upi' | 'bank' | 'other';

/** Who performed a mutation (stamped on the doc AND on the audit entry). */
export interface PrincipalActor {
  uid: string;
  name: string;
  role: string;
}

/* ── Stored documents ─────────────────────────────────────────────────── */

/**
 * One line of the fees note. The SAME row is what the class-wise and
 * teacher-wise registers render — they are views, never copies.
 */
export interface RegisterRow {
  id: string;
  academicYear: string;
  name: string;
  className: string;
  sectionName?: string;
  rollNo?: string;
  /** Responsible teacher — drives the teacher-wise register. */
  teacherUid?: string | null;
  teacherName?: string | null;
  /** Annual school fee, due immediately. */
  schoolFee: number;
  /** Annual ECA amount, sliced across `ecaMonths` ("in 10 months"). */
  ecaAnnual: number;
  ecaMonths: string[];
  /** Per-month van charge, applied to each month in `vanMonths`. */
  vanMonthly: number;
  vanMonths: string[];
  isScholarship?: boolean;
  notes?: string;
  deleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrincipalPayment {
  id: string;
  academicYear: string;
  rowId: string;
  /** Denormalized for registers/exports so a payment reads on its own. */
  studentName: string;
  className: string;
  head: PrincipalFeeHead;
  /** Capitalized month label — required for `eca`/`van` to fill a month cell. */
  month?: string;
  amount: number;
  /** Local date key 'yyyy-MM-dd'. The ONE key every ledger buckets on. */
  dateKey: string;
  paidAt: Date;
  mode: PrincipalPaymentMode;
  enteredByUid: string;
  enteredByName: string;
  enteredByRole: string;
  remarks?: string;
  deleted?: boolean;
  createdAt: Date;
}

export interface PrincipalExpense {
  id: string;
  academicYear: string;
  amount: number;
  category: string;
  /** Who the money went to — a staff member, vendor or shop (optional). */
  paidTo?: string;
  description?: string;
  dateKey: string;
  mode: PrincipalPaymentMode;
  enteredByUid: string;
  enteredByName: string;
  deleted?: boolean;
  createdAt: Date;
}

export type PrincipalAuditAction = 'create' | 'update' | 'delete';
export type PrincipalAuditTarget = 'register' | 'payment' | 'expense' | 'settings' | 'dayclose';

/** Write-once. Never updated, never deleted. */
export interface PrincipalAuditEntry {
  id: string;
  at: Date;
  actorUid: string;
  actorName: string;
  actorRole: string;
  action: PrincipalAuditAction;
  target: PrincipalAuditTarget;
  targetId: string;
  studentName?: string;
  summary: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/** How the counted cash compares to what the ledger expected. */
export type DayCloseAssessment = 'matched' | 'short' | 'excess';

/**
 * One business day's cash reconciliation (Phase 3 §16–§18).
 *
 *   Collection : principalDayClose/{dateKey}
 *   Doc id     : the business date 'yyyy-MM-dd' — one close per day is
 *                structural, no uniqueness check needed.
 *   Fields     : below. `expectedCash` is the ledger's Cash in Hand at the
 *                close of that day, STORED at close time so the record keeps
 *                saying what the Principal actually compared against, even if
 *                later corrections move the live number.
 *   Security   : principal-only read/write, no hard delete (firestore.rules).
 *   Purpose    : the daily "count the drawer" anchor; a 'closed' day also
 *                blocks new/edited payments and expenses on that date until
 *                the Principal reopens it (the auditable correction path).
 */
export interface PrincipalDayClose {
  /** Same as the doc id. */
  dateKey: string;
  academicYear: string;
  /** Ledger Cash in Hand at close of the day, at the moment of closing. */
  expectedCash: number;
  /** What the Principal physically counted. */
  actualCash: number;
  /** actualCash − expectedCash. */
  difference: number;
  assessment: DayCloseAssessment;
  /** 'closed' protects the day; 'reopened' lifts it for corrections. */
  status: 'closed' | 'reopened';
  /** The Principal's explanation when the count does not match. */
  note?: string;
  closedByUid: string;
  closedByName: string;
  closedAt: Date;
  updatedAt: Date;
}

export interface PrincipalSettings {
  academicYear: string;
  openingCash: number;
  openingBank: number;
  /** 'yyyy-MM-dd'. Transactions ON or AFTER this day move the balances. */
  openingAsOf: string;
  defaultEcaMonths: string[];
  defaultVanMonths: string[];
  expenseCategories: string[];
}

/* ── Create payloads (service inputs) ─────────────────────────────────── */

export type NewRegisterRow = Omit<RegisterRow, 'id' | 'deleted' | 'createdAt' | 'updatedAt'>;

/** `enteredBy*` come from the actor, never from the caller. */
export type NewPrincipalPayment = Omit<
  PrincipalPayment,
  'id' | 'deleted' | 'createdAt' | 'enteredByUid' | 'enteredByName' | 'enteredByRole'
>;

export type NewPrincipalExpense = Omit<
  PrincipalExpense,
  'id' | 'deleted' | 'createdAt' | 'enteredByUid' | 'enteredByName'
>;

/** What the Day Close screen submits; the service computes the rest. */
export interface DayCloseInput {
  dateKey: string;
  academicYear: string;
  /** Ledger Cash in Hand at close of the day, as shown to the Principal. */
  expectedCash: number;
  /** What the Principal physically counted. */
  actualCash: number;
  note?: string;
}

/* ── Engine inputs (structural — stored docs are assignable) ──────────── */

/** What the engine needs off a register row. `RegisterRow` satisfies this. */
export interface RegisterRowFacts {
  id?: string;
  academicYear?: string;
  className?: string;
  schoolFee?: number | null;
  ecaAnnual?: number | null;
  ecaMonths?: string[] | null;
  vanMonthly?: number | null;
  vanMonths?: string[] | null;
  deleted?: boolean;
}

/** What the engine needs off a payment. `PrincipalPayment` satisfies this. */
export interface PrincipalPaymentFacts {
  head?: PrincipalFeeHead | string | null;
  month?: string | null;
  amount?: number | null;
  dateKey?: string | null;
  /** Fallback source for `dateKey` on partial docs. */
  paidAt?: unknown;
  mode?: PrincipalPaymentMode | string | null;
  deleted?: boolean;
}

export interface PrincipalExpenseFacts {
  amount?: number | null;
  dateKey?: string | null;
  mode?: PrincipalPaymentMode | string | null;
  deleted?: boolean;
}

/**
 * What the expense report needs on top of the ledger facts.
 * `PrincipalExpense` satisfies this.
 */
export interface ExpenseReportFacts extends PrincipalExpenseFacts {
  category?: string | null;
}

/**
 * What the teacher roll-up needs on top of the row facts.
 * `RegisterRow` satisfies this.
 */
export interface TeacherRowFacts extends RegisterRowFacts {
  teacherUid?: string | null;
  teacherName?: string | null;
}

/** Opening-balance slice of `PrincipalSettings` the ledgers need. */
export interface LedgerSettingsFacts {
  openingCash?: number | null;
  openingBank?: number | null;
  openingAsOf?: string | null;
}

/* ── Engine outputs ───────────────────────────────────────────────────── */

/** One month column of the ECA or van schedule. */
export interface MonthCell {
  month: string;
  amount: number;
  paid: number;
  /** max(0, amount − paid) — regardless of whether the month is due yet. */
  pending: number;
  /** True once the month has ENDED (never for the current month). */
  isDue: boolean;
}

/**
 * Where a head stands once its payments are counted.
 * 'pending' nothing received · 'partial' some received · 'paid' settled.
 * A head with nothing charged reads 'pending' until money arrives against it —
 * "not applicable" is `charged === 0`, which callers test separately.
 */
export type FeeStatus = 'pending' | 'partial' | 'paid';

/** School fee: one flat charge, due immediately. */
export interface HeadSummary {
  charged: number;
  paid: number;
  pending: number;
  status: FeeStatus;
}

/** ECA / van: a month grid plus head-level totals. */
export interface MonthlyHeadSummary extends HeadSummary {
  months: MonthCell[];
  /** Σ pending of ENDED months, less any payment not tagged to a month. */
  dueNow: number;
}

export interface RowSummary {
  school: HeadSummary;
  eca: MonthlyHeadSummary;
  van: MonthlyHeadSummary;
  /** Catch-all receipts: counted in totals, owned by no bucket. */
  other: { paid: number };
  /**
   * Money the school holds that no charge has absorbed: 'other' receipts plus
   * any head paid beyond what it charges. It offsets what can be chased, so a
   * parent who overpaid one head is never asked to pay another.
   */
  credit: number;
  totalCharged: number;
  totalPaid: number;
  totalPending: number;
  /** The arrears number: what Sharmi can chase TODAY. */
  totalDueNow: number;
  /** The row as a whole, from totalCharged vs totalPaid. */
  status: FeeStatus;
}

export interface ClassSummary {
  className: string;
  students: number;
  charged: number;
  paid: number;
  pending: number;
  dueNow: number;
}

/** One teacher's money, for the Accounts teacher list (Phase 2 §7). */
export interface TeacherSummary {
  /** The teacher's AUTH uid; '' for students nobody is responsible for. */
  teacherUid: string;
  teacherName: string;
  students: number;
  charged: number;
  collected: number;
  /** Everything still unpaid, including months that have not ended. */
  outstanding: number;
  /** What can be chased today — the arrears number. */
  dueNow: number;
}

/**
 * School-wide outstanding position for the finance home (Phase 2 §4).
 * Student counts use the same three states as `feeStatus`.
 */
export interface OutstandingSummary {
  students: number;
  charged: number;
  collected: number;
  outstanding: number;
  dueNow: number;
  pendingStudents: number;
  partialStudents: number;
  paidStudents: number;
}

/** Money that moved in a period, split by channel. */
export interface LedgerFlows {
  incomeCash: number;
  incomeBank: number;
  expenseCash: number;
  expenseBank: number;
  /** incomeCash + incomeBank. */
  income: number;
  /** expenseCash + expenseBank. */
  expense: number;
  /** income − expense. */
  net: number;
}

export interface DailyLedger extends LedgerFlows {
  dateKey: string;
  /** Closing balance at the END of `dateKey`. */
  cashInHand: number;
  bankBalance: number;
  /** cashInHand + bankBalance. */
  total: number;
}

export interface MonthlyLedger extends LedgerFlows {
  /** 'yyyy-MM'. */
  monthKey: string;
  /** Closing balance at the END of the month. */
  cashInHand: number;
  bankBalance: number;
  total: number;
  /** Days with activity, oldest first, each carrying its running balance. */
  days: DailyLedger[];
}

/* ── Expense report ───────────────────────────────────────────────────── */

/** One category's spend over the reported window. */
export interface ExpenseCategoryTotal {
  /** Trimmed category, or 'Uncategorised' when the entry carries none. */
  category: string;
  cash: number;
  bank: number;
  total: number;
  /** How many entries rolled up into this line. */
  count: number;
  /** Percent (0–100) of the window's total spend. 0 when nothing was spent. */
  share: number;
}

/**
 * Spend over a date window, split by category and by mode. Unlike the daily /
 * monthly ledgers this applies NO opening-balance cut-off: a report answers
 * "what did we spend between these dates", which includes entries the balance
 * carries as opening money.
 */
export interface ExpenseReport {
  /** Inclusive 'yyyy-MM-dd' bounds actually reported on. */
  fromKey: string;
  toKey: string;
  /** Biggest spend first; ties broken by category name. */
  categories: ExpenseCategoryTotal[];
  cash: number;
  bank: number;
  total: number;
  count: number;
}

/* ── Receipt snapshot (Phase 3 §19) ───────────────────────────────────── */

/**
 * The balance story of ONE payment, reconstructed from the immutable history:
 * what the student owed before it, what remained after it, and the row's
 * status at that point. Deterministic for historical receipts — it counts
 * only payments recorded up to and including this one, so reprinting a
 * September receipt in March still shows September's numbers.
 */
export interface ReceiptSnapshot {
  previousPending: number;
  remainingPending: number;
  status: FeeStatus;
}

/* ── Per-method money (Phase 1 §15) ───────────────────────────────────── */

/** One payment channel's movement over a window: in, out, and the difference. */
export interface ModeTotalsRow {
  mode: PrincipalPaymentMode;
  collected: number;
  spent: number;
  net: number;
}

/**
 * Collected / spent / net per payment channel over an inclusive date window.
 * Always carries all four channels, in fixed order (cash, upi, bank, other),
 * so a consumer never has to guard against a missing row. Reporting only —
 * balances stay on the cash/bank buckets of the ledgers.
 */
export interface ModeTotals {
  fromKey: string;
  toKey: string;
  rows: ModeTotalsRow[];
  collected: number;
  spent: number;
  net: number;
}
