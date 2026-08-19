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

/** Money movement channel. Anything unknown is treated as cash. */
export type PrincipalPaymentMode = 'cash' | 'bank';

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
  description?: string;
  dateKey: string;
  mode: PrincipalPaymentMode;
  enteredByUid: string;
  enteredByName: string;
  deleted?: boolean;
  createdAt: Date;
}

export type PrincipalAuditAction = 'create' | 'update' | 'delete';
export type PrincipalAuditTarget = 'register' | 'payment' | 'expense' | 'settings';

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

/** School fee: one flat charge, due immediately. */
export interface HeadSummary {
  charged: number;
  paid: number;
  pending: number;
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
  totalCharged: number;
  totalPaid: number;
  totalPending: number;
  /** The arrears number: what Sharmi can chase TODAY. */
  totalDueNow: number;
}

export interface ClassSummary {
  className: string;
  students: number;
  charged: number;
  paid: number;
  pending: number;
  dueNow: number;
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
