/* ============================================
   CampusOS — Fee Engine (pure functions)
   ============================================
   The ONLY place fee math lives. Screens must not compute dues inline.

   Rules implemented (see docs/designs/principal-role-fees-accounts.md):
   - Canonical 10-month academic year June–March (capitalized labels).
   - ECA annual amount sliced across `ecaMonths`; a month is due only AFTER
     it ends. Slice = round(annual / n), remainder on the first month.
   - Terms carry optional due dates; a term with NO due date is not yet due.
   - Bus months due after month end, priced from the student's CURRENT route.
     Any calendar month (incl. April/May) is accepted.
   - additionalFees and Previous Balance are due immediately.
   - Scholarship / feeAdjustment overrides pro-rate across terms + ECA +
     additionalFees with largest-remainder rounding (sum EXACTLY equals the
     override); factor clamped ≤ 1 with a warning flag; bus fees never scaled.
   - Mid-year admissions: month-sliced dues start at the admission month.
   - Legacy "Extracurricular" lump payments allocate FIFO across ECA months.
   - Unknown/"Other" payments feed an Unallocated total that reduces overall
     pending but belongs to no month bucket.
   - Soft-deleted docs are excluded from every aggregate.
   - Daily/monthly cash-bank aggregation buckets on local dateKey.

   PURE module: no Firestore imports, no mutation of inputs.
*/

import { format } from 'date-fns';
import { MonthlyExam } from '@/types/enums';

/* ── Canonical months ─────────────────────────────────────────────────── */

/** Canonical academic-year month labels, June → March (10 months). */
export const ACADEMIC_MONTHS = [
  'June', 'July', 'August', 'September', 'October', 'November',
  'December', 'January', 'February', 'March',
] as const;

/** MonthlyExam enum value → capitalized month label ('june' → 'June'). */
export const MONTHLY_EXAM_LABELS: Record<MonthlyExam, string> = {
  [MonthlyExam.JUNE]: 'June',
  [MonthlyExam.JULY]: 'July',
  [MonthlyExam.AUGUST]: 'August',
  [MonthlyExam.SEPTEMBER]: 'September',
  [MonthlyExam.OCTOBER]: 'October',
  [MonthlyExam.NOVEMBER]: 'November',
  [MonthlyExam.DECEMBER]: 'December',
  [MonthlyExam.JANUARY]: 'January',
  [MonthlyExam.FEBRUARY]: 'February',
  [MonthlyExam.MARCH]: 'March',
};

/** Capitalized month label → MonthlyExam enum value, or null if unknown. */
export function monthLabelToMonthlyExam(label: string): MonthlyExam | null {
  const lower = label.toLowerCase();
  return (Object.values(MonthlyExam) as string[]).includes(lower)
    ? (lower as MonthlyExam)
    : null;
}

/* ── Payment category conventions ─────────────────────────────────────── */

export const ECA_CATEGORY_PREFIX = 'ECA - ';
export const BUS_CATEGORY_PREFIX = 'Bus Fee - ';
/** Legacy annual-lump ECA category; readable for history, feeds FIFO. */
export const LEGACY_ECA_CATEGORY = 'Extracurricular';
export const PREVIOUS_BALANCE_CATEGORY = 'Previous Balance';
/** Catch-all category; lands in the Unallocated total. */
export const OTHER_CATEGORY = 'Other';

/** Month-tagged ECA payment category, e.g. "ECA - June". */
export const ecaCategory = (month: string): string => `${ECA_CATEGORY_PREFIX}${month}`;
/** Month-tagged bus payment category, e.g. "Bus Fee - June". */
export const busCategory = (month: string): string => `${BUS_CATEGORY_PREFIX}${month}`;

/* ── Dates ────────────────────────────────────────────────────────────── */

/** Local date key 'yyyy-MM-dd' (the ONE convention for daily bucketing). */
export function toDateKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Best-effort Date coercion: Date | ISO string | epoch | Firestore Timestamp. */
export function coerceDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object') {
    const v = value as { toDate?: () => Date; seconds?: number };
    if (typeof v.toDate === 'function') return v.toDate();
    if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// Calendar-month index by capitalized label (January = 0).
const MONTH_INDEX: Record<string, number> = {
  January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
};

/**
 * Position of a month within the academic year: June = 0 … March = 9,
 * April = 10, May = 11 (April/May trail the June–March core).
 * Unknown labels sort last.
 */
export function academicMonthOrder(label: string): number {
  const idx = MONTH_INDEX[label];
  if (idx === undefined) return 99;
  return (idx - 5 + 12) % 12;
}

/**
 * Start calendar year of an academic year string (first 4-digit run, e.g.
 * '2025-2026' → 2025). Falls back to inferring from `today` (June boundary).
 */
export function academicYearStartYear(academicYear: string | undefined, today: Date = new Date()): number {
  const m = academicYear?.match(/\d{4}/);
  if (m) return parseInt(m[0], 10);
  return today.getMonth() >= 5 ? today.getFullYear() : today.getFullYear() - 1;
}

/**
 * First day of the given academic month. June–December fall in the start
 * year; January–May fall in the following year (so April/May trail the
 * June–March core). Returns null for unknown labels.
 */
export function academicMonthStart(label: string, startYear: number): Date | null {
  const idx = MONTH_INDEX[label];
  if (idx === undefined) return null;
  const year = idx >= 5 ? startYear : startYear + 1;
  return new Date(year, idx, 1);
}

/* ── Input shapes (structural — model types are assignable) ───────────── */

export interface TermFeeInput { name: string; amount: number }
export interface AdditionalFeeInput { name: string; amount: number }

export interface FeeStructureInput {
  academicYear?: string;
  terms?: TermFeeInput[] | null;
  extracurricular?: number | null;
  /** Capitalized labels ECA is sliced over; default ACADEMIC_MONTHS. */
  ecaMonths?: string[] | null;
  /** Term name → due date key 'yyyy-MM-dd'. Missing = term not yet due. */
  termDueDates?: Record<string, string> | null;
  additionalFees?: AdditionalFeeInput[] | null;
  busFee?: number | null;
  busMonths?: string[] | null;
  includeBusFee?: boolean;
  totalAmount?: number;
}

export interface StudentFeeFacts {
  id?: string;
  classId?: string;
  previousBalance?: number | null;
  dateOfJoining?: unknown;
  feeAdjustment?: { amount: number; reason?: string | null } | null;
  scholarshipId?: string | null;
  transportType?: string | null;
  routeId?: string | null;
}

export interface ScholarshipInput {
  id: string;
  active: boolean;
  amountsByClass?: Record<string, number>;
}

export interface BusRouteInput { id: string; fee?: number | null }

export interface PaymentInput {
  amount?: number | null;
  category?: string | null;
  paidAt?: unknown;
  dateKey?: string | null;
  mode?: string | null;
  deleted?: boolean;
}

export interface ExpenseInput {
  amount?: number | null;
  date?: string | null;
  dateKey?: string | null;
  paymentMode?: string | null;
  deleted?: boolean;
}

/* ── Buckets & schedule ───────────────────────────────────────────────── */

export type FeeBucketKind = 'previousBalance' | 'term' | 'eca' | 'additional' | 'bus';

export interface FeeBucket {
  /** Exact payment-category string that maps onto this bucket. */
  category: string;
  kind: FeeBucketKind;
  /** Capitalized month label for eca/bus buckets. */
  month?: string;
  /** Amount owed (post scholarship scaling for term/eca/additional). */
  amount: number;
  /** When the bucket becomes due; null = immediate (PB/additional) or no due date set (term). */
  dueDate: Date | null;
  /** Whether the bucket counts as due as of `today`. */
  isDue: boolean;
}

export interface StudentSchedule {
  /** Order: Previous Balance first, then terms, ECA months, additional, bus. */
  buckets: FeeBucket[];
  hasStructure: boolean;
  /** Applied scale factor (1 when no override / clamped). */
  scaleFactor: number;
  /** True when override > standard total (factor clamped to 1). */
  scaleWarning: boolean;
  /** Σ bucket amounts (post scaling/proration). */
  totalAmount: number;
}

export interface BuildScheduleArgs {
  structure?: FeeStructureInput | null;
  student: StudentFeeFacts;
  /** Bus routes for pricing bus months from the student's current route. */
  busRoutes?: BusRouteInput[];
  /** school.settings.scholarships — resolved via student.scholarshipId. */
  scholarships?: ScholarshipInput[];
  /** e.g. '2025-2026'; default structure.academicYear. */
  academicYear?: string;
  /** "Now" for due computations; default new Date(). */
  today?: Date;
}

/* ── Override resolution ──────────────────────────────────────────────── */

/**
 * Per-student flat fee override replacing terms + ECA + additionalFees.
 * Priority: feeAdjustment.amount → active scholarship amountsByClass[classId].
 * Returns null when no override applies.
 */
export function resolveFeeOverride(
  student: StudentFeeFacts,
  scholarships?: ScholarshipInput[],
): number | null {
  if (student.feeAdjustment && typeof student.feeAdjustment.amount === 'number') {
    return student.feeAdjustment.amount;
  }
  if (student.scholarshipId) {
    const scholarship = (scholarships || []).find(s => s.id === student.scholarshipId && s.active);
    const amt = scholarship?.amountsByClass?.[student.classId || ''];
    if (typeof amt === 'number') return amt;
  }
  return null;
}

/* ── Largest-remainder scaling ────────────────────────────────────────── */

/**
 * Scales `amounts` by `factor` to whole rupees, distributing rounding so the
 * result sums EXACTLY to `target` (largest fractional remainders win; ties
 * resolved by index for determinism).
 */
function scaleWithLargestRemainder(amounts: number[], factor: number, target: number): number[] {
  const raw = amounts.map(a => a * factor);
  const floors = raw.map(Math.floor);
  const out = [...floors];
  let deficit = target - floors.reduce((s, v) => s + v, 0);
  if (deficit <= 0 || amounts.length === 0) return out;
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => (b.frac - a.frac) || (a.i - b.i));
  let k = 0;
  while (deficit > 0) {
    out[order[k % order.length].i] += 1;
    deficit -= 1;
    k += 1;
  }
  return out;
}

/* ── Schedule builder ─────────────────────────────────────────────────── */

const sortByAcademicOrder = (months: string[]): string[] =>
  [...months].sort((a, b) => academicMonthOrder(a) - academicMonthOrder(b));

/**
 * Builds the per-category dues schedule for one student.
 *
 * - Previous Balance bucket first (due immediately, never scaled).
 * - Terms: due strictly AFTER their due date passes; no due date = not due.
 * - ECA: monthly slices over `ecaMonths` (default June–March); slice =
 *   round(annual/n) with the remainder on the first month (academic order);
 *   a month is due once it has ended.
 * - additionalFees: due immediately at year start, or at the admission month
 *   for mid-year admits.
 * - Bus: per `busMonths`, priced from the student's current route; due after
 *   month end; never scaled. Enabled when structure.includeBusFee (legacy
 *   fallback: busFee > 0) and student.transportType === 'bus'.
 * - Mid-year admission (dateOfJoining): eca/bus months BEFORE the admission
 *   month are dropped (dues start at the admission month).
 * - Scholarship/feeAdjustment override: factor = override ÷ standard total
 *   (terms + ECA + additionalFees, full-year basis), clamped ≤ 1 with
 *   `scaleWarning`; scaled buckets sum exactly to round(factor × included
 *   unscaled sum) via largest-remainder rounding — with no proration that is
 *   exactly the override. Standard total 0 → factor 1 (nothing due).
 * - Missing structure: zero schedule (`hasStructure: false`) — the Previous
 *   Balance bucket is still emitted since it is independent of the structure.
 */
export function buildStudentSchedule(args: BuildScheduleArgs): StudentSchedule {
  const { structure, student, busRoutes, scholarships } = args;
  const today = args.today ?? new Date();
  const todayKey = toDateKey(today);
  const startYear = academicYearStartYear(args.academicYear ?? structure?.academicYear, today);

  const joinDate = coerceDate(student.dateOfJoining);
  const admissionMonthStart = joinDate
    ? new Date(joinDate.getFullYear(), joinDate.getMonth(), 1)
    : null;

  const buckets: FeeBucket[] = [];

  // ── Previous Balance (first; independent of structure) ──
  const pb = Number(student.previousBalance) || 0;
  if (pb > 0) {
    buckets.push({
      category: PREVIOUS_BALANCE_CATEGORY,
      kind: 'previousBalance',
      amount: pb,
      dueDate: null,
      isDue: true,
    });
  }

  if (structure) {
    // ── Terms ──
    for (const term of structure.terms || []) {
      const amount = Number(term.amount) || 0;
      if (amount <= 0) continue;
      const dueKeyRaw = structure.termDueDates?.[term.name];
      const dueDate = dueKeyRaw ? coerceDate(dueKeyRaw) : null;
      const dueKey = dueDate ? toDateKey(dueDate) : null;
      buckets.push({
        category: term.name,
        kind: 'term',
        amount,
        dueDate,
        // Due strictly AFTER the due date passes; no due date = not yet due.
        isDue: dueKey !== null && todayKey > dueKey,
      });
    }

    // Builds month buckets shared by ECA and bus.
    const pushMonthBuckets = (
      kind: 'eca' | 'bus',
      months: string[],
      amountFor: (month: string, i: number) => number,
      categoryFor: (month: string) => string,
    ): void => {
      sortByAcademicOrder(months).forEach((month, i) => {
        const monthStart = academicMonthStart(month, startYear);
        if (!monthStart) return; // unknown label — skip defensively
        if (admissionMonthStart && monthStart < admissionMonthStart) return; // proration
        const amount = amountFor(month, i);
        if (amount <= 0) return;
        // Due once the month has ENDED: first day of the following month.
        const dueDate = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
        buckets.push({
          category: categoryFor(month),
          kind,
          month,
          amount,
          dueDate,
          isDue: todayKey >= toDateKey(dueDate),
        });
      });
    };

    // ── ECA monthly slices ──
    const ecaAnnual = Number(structure.extracurricular) || 0;
    if (ecaAnnual > 0) {
      const months = sortByAcademicOrder(
        structure.ecaMonths && structure.ecaMonths.length > 0
          ? structure.ecaMonths
          : [...ACADEMIC_MONTHS],
      );
      const n = months.length;
      const slice = Math.round(ecaAnnual / n);
      // Remainder lands on the first month (academic order). If proration
      // drops that month, the remainder is simply not owed.
      const firstSlice = slice + (ecaAnnual - slice * n);
      pushMonthBuckets('eca', months, (_m, i) => (i === 0 ? firstSlice : slice), ecaCategory);
    }

    // ── Additional fees (due immediately at year start, or at the
    //    admission month for mid-year admits) ──
    for (const fee of structure.additionalFees || []) {
      const amount = Number(fee.amount) || 0;
      if (amount <= 0) continue;
      buckets.push({
        category: fee.name,
        kind: 'additional',
        amount,
        dueDate: admissionMonthStart,
        isDue: !admissionMonthStart || todayKey >= toDateKey(admissionMonthStart),
      });
    }

    // ── Bus months (priced from CURRENT route; never scaled) ──
    const busEnabled = structure.includeBusFee ?? ((Number(structure.busFee) || 0) > 0);
    if (busEnabled && student.transportType === 'bus') {
      const route = (busRoutes || []).find(r => r.id === student.routeId);
      const routeFee = Number(route?.fee) || 0;
      if (routeFee > 0) {
        const months = structure.busMonths && structure.busMonths.length > 0
          ? structure.busMonths
          : [...ACADEMIC_MONTHS];
        pushMonthBuckets('bus', months, () => routeFee, busCategory);
      }
    }
  }

  // ── Scholarship / feeAdjustment scaling ──
  let scaleFactor = 1;
  let scaleWarning = false;
  let finalBuckets = buckets;
  const override = resolveFeeOverride(student, scholarships);
  if (override !== null && structure) {
    const basis =
      (structure.terms || []).reduce((s, t) => s + (Number(t.amount) || 0), 0) +
      (Number(structure.extracurricular) || 0) +
      (structure.additionalFees || []).reduce((s, a) => s + (Number(a.amount) || 0), 0);
    if (basis > 0) {
      const rawFactor = override / basis;
      scaleWarning = rawFactor > 1;
      scaleFactor = Math.min(1, rawFactor);
      if (scaleFactor < 1) {
        const scalable = buckets.filter(b => b.kind === 'term' || b.kind === 'eca' || b.kind === 'additional');
        const includedSum = scalable.reduce((s, b) => s + b.amount, 0);
        const target = Math.round(scaleFactor * includedSum);
        const scaled = scaleWithLargestRemainder(scalable.map(b => b.amount), scaleFactor, target);
        const scaledByBucket = new Map<FeeBucket, number>(scalable.map((b, i) => [b, scaled[i]]));
        finalBuckets = buckets
          .map(b => (scaledByBucket.has(b) ? { ...b, amount: scaledByBucket.get(b)! } : b))
          .filter(b => b.amount > 0);
      }
    }
    // basis === 0 → factor stays 1 (nothing due, no division).
  }

  return {
    buckets: finalBuckets,
    hasStructure: !!structure,
    scaleFactor,
    scaleWarning,
    totalAmount: finalBuckets.reduce((s, b) => s + b.amount, 0),
  };
}

/* ── Soft delete ──────────────────────────────────────────────────────── */

/** Filters out soft-deleted docs. EVERY aggregate must run through this. */
export function excludeDeleted<T extends { deleted?: boolean }>(docs: T[]): T[] {
  return docs.filter(d => d.deleted !== true);
}

/* ── Date keys for historical docs ────────────────────────────────────── */

/** Payment date key: stored dateKey, else derived from paidAt. Null if undatable. */
export function paymentDateKey(p: PaymentInput): string | null {
  if (p.dateKey) return p.dateKey;
  const d = coerceDate(p.paidAt);
  return d ? toDateKey(d) : null;
}

/** Expense date key: stored dateKey, else the legacy `date` field. */
export function expenseDateKey(e: ExpenseInput): string | null {
  if (e.dateKey) return e.dateKey;
  if (e.date) return e.date;
  return null;
}

/* ── Payment allocation (FIFO) ────────────────────────────────────────── */

export interface AllocatedBucket extends FeeBucket {
  paid: number;
  /** max(0, amount − paid) — pending regardless of due state. */
  pending: number;
  /** Pending only when the bucket is due (0 otherwise). */
  pendingDue: number;
}

export interface StudentFeeSummary {
  buckets: AllocatedBucket[];
  hasStructure: boolean;
  scaleFactor: number;
  scaleWarning: boolean;
  /** Payments whose category maps to no bucket ('Other', unknown, overflow). */
  unallocated: number;
  /** Σ bucket amounts. */
  totalCharged: number;
  /** Σ non-deleted payment amounts (allocated + unallocated). */
  totalPaid: number;
  /** max(0, totalCharged − totalPaid). Unallocated reduces this — no false defaulters. */
  totalPending: number;
  /** max(0, Σ due-bucket pending − unallocated) — the defaulter number. */
  totalDuePending: number;
}

/**
 * Allocates a student's payments onto a schedule (oldest first by dateKey,
 * then paidAt):
 * - Exact category match (terms, "ECA - {month}", "Bus Fee - {month}",
 *   "Previous Balance", additional-fee names) → that bucket.
 * - Legacy "Extracurricular" lumps → FIFO across ECA month buckets (oldest
 *   unpaid month first); overflow past all ECA buckets → Unallocated.
 * - "Other"/unknown categories → Unallocated: counts toward totals paid and
 *   reduces overall/due pending, but never fills a month bucket.
 * Soft-deleted payments are excluded. Inputs are not mutated.
 */
export function allocatePayments(
  schedule: StudentSchedule,
  payments: PaymentInput[],
): StudentFeeSummary {
  const live = excludeDeleted(payments);
  const sorted = [...live].sort((a, b) => {
    const ka = paymentDateKey(a) ?? '';
    const kb = paymentDateKey(b) ?? '';
    if (ka !== kb) return ka < kb ? -1 : 1;
    const ta = coerceDate(a.paidAt)?.getTime() ?? 0;
    const tb = coerceDate(b.paidAt)?.getTime() ?? 0;
    return ta - tb;
  });

  const paidByCategory: Record<string, number> = {};
  const bucketCategories = new Set(schedule.buckets.map(b => b.category));
  const ecaBuckets = schedule.buckets.filter(b => b.kind === 'eca');
  let unallocated = 0;
  let totalPaid = 0;

  for (const p of sorted) {
    const amount = Number(p.amount) || 0;
    if (amount <= 0) continue;
    totalPaid += amount;
    const category = p.category || '';

    if (bucketCategories.has(category)) {
      paidByCategory[category] = (paidByCategory[category] || 0) + amount;
      continue;
    }

    if (category === LEGACY_ECA_CATEGORY) {
      let remaining = amount;
      for (const bucket of ecaBuckets) {
        if (remaining <= 0) break;
        const already = paidByCategory[bucket.category] || 0;
        const capacity = bucket.amount - already;
        if (capacity <= 0) continue;
        const take = Math.min(remaining, capacity);
        paidByCategory[bucket.category] = already + take;
        remaining -= take;
      }
      unallocated += remaining; // overflow past all ECA months
      continue;
    }

    unallocated += amount; // 'Other' / unknown / month no longer in schedule
  }

  const buckets: AllocatedBucket[] = schedule.buckets.map(b => {
    const paid = paidByCategory[b.category] || 0;
    const pending = Math.max(0, b.amount - paid);
    return { ...b, paid, pending, pendingDue: b.isDue ? pending : 0 };
  });

  const totalCharged = buckets.reduce((s, b) => s + b.amount, 0);
  const duePendingRaw = buckets.reduce((s, b) => s + b.pendingDue, 0);

  return {
    buckets,
    hasStructure: schedule.hasStructure,
    scaleFactor: schedule.scaleFactor,
    scaleWarning: schedule.scaleWarning,
    unallocated,
    totalCharged,
    totalPaid,
    totalPending: Math.max(0, totalCharged - totalPaid),
    totalDuePending: Math.max(0, duePendingRaw - unallocated),
  };
}

/**
 * One-stop per-student summary: builds the schedule and allocates payments.
 * `payments` must already be scoped to this student.
 */
export function computeStudentFeeSummary(
  args: BuildScheduleArgs,
  payments: PaymentInput[],
): StudentFeeSummary {
  return allocatePayments(buildStudentSchedule(args), payments);
}

/* ── Class / defaulter summarizers ────────────────────────────────────── */

/** A student is a defaulter when they have due, unpaid amounts. */
export function isDefaulter(summary: StudentFeeSummary): boolean {
  return summary.totalDuePending > 0;
}

export interface ClassFeeSummary {
  studentCount: number;
  defaulterCount: number;
  totalCharged: number;
  totalPaid: number;
  totalPending: number;
  totalDuePending: number;
}

/** Aggregates per-student summaries into class-level totals. */
export function computeClassFeeSummary(summaries: StudentFeeSummary[]): ClassFeeSummary {
  return summaries.reduce<ClassFeeSummary>(
    (acc, s) => ({
      studentCount: acc.studentCount + 1,
      defaulterCount: acc.defaulterCount + (isDefaulter(s) ? 1 : 0),
      totalCharged: acc.totalCharged + s.totalCharged,
      totalPaid: acc.totalPaid + s.totalPaid,
      totalPending: acc.totalPending + s.totalPending,
      totalDuePending: acc.totalDuePending + s.totalDuePending,
    }),
    { studentCount: 0, defaulterCount: 0, totalCharged: 0, totalPaid: 0, totalPending: 0, totalDuePending: 0 },
  );
}

/* ── Cash / bank balances (Accounts module) ───────────────────────────── */

/** Payment modes that credit the bank balance; everything else is cash. */
export const BANK_PAYMENT_MODES = ['upi', 'cheque', 'bank_transfer'] as const;

export interface BalanceOptions {
  openingCash?: number;
  openingBank?: number;
  /** Date key or Date. Transactions STRICTLY AFTER this day are summed. */
  openingAsOf?: string | Date | null;
}

export interface FlowTotals {
  cashIn: number;
  bankIn: number;
  cashOut: number;
  bankOut: number;
}

export interface BalancesResult {
  /** openingCash + Σ cash payments − Σ cash expenses (after openingAsOf). */
  cash: number;
  /** openingBank + Σ upi/cheque/bank_transfer payments − Σ bank expenses. */
  bank: number;
  total: number;
  /** Flows bucketed by dateKey ('yyyy-MM-dd'), post-openingAsOf only. */
  byDay: Record<string, FlowTotals>;
  /** Flows bucketed by month key ('yyyy-MM'), post-openingAsOf only. */
  byMonth: Record<string, FlowTotals>;
}

const EMPTY_FLOW: FlowTotals = { cashIn: 0, bankIn: 0, cashOut: 0, bankOut: 0 };

/**
 * Daily/monthly cash-vs-bank aggregation for the Principal's balance sheet.
 * - Payment mode 'cash' → cash; upi/cheque/bank_transfer → bank (unknown
 *   modes default to cash).
 * - Expense paymentMode 'bank' → bank; missing/legacy → cash.
 * - Sums STRICTLY after `openingAsOf` (a transaction dated ON that day is
 *   part of the opening balances, not the flows).
 * - Buckets on dateKey; soft-deleted and undatable docs are excluded.
 */
export function computeBalances(
  payments: PaymentInput[],
  expenses: ExpenseInput[],
  options: BalanceOptions = {},
): BalancesResult {
  const openingCash = Number(options.openingCash) || 0;
  const openingBank = Number(options.openingBank) || 0;
  const openingKey = typeof options.openingAsOf === 'string'
    ? options.openingAsOf
    : options.openingAsOf instanceof Date
      ? toDateKey(options.openingAsOf)
      : null;

  const byDay: Record<string, FlowTotals> = {};
  const add = (key: string, field: keyof FlowTotals, amount: number): void => {
    const day = byDay[key] ?? EMPTY_FLOW;
    byDay[key] = { ...day, [field]: day[field] + amount };
  };

  for (const p of excludeDeleted(payments)) {
    const key = paymentDateKey(p);
    const amount = Number(p.amount) || 0;
    if (!key || amount <= 0) continue;
    if (openingKey && key <= openingKey) continue;
    const isBank = (BANK_PAYMENT_MODES as readonly string[]).includes(p.mode || '');
    add(key, isBank ? 'bankIn' : 'cashIn', amount);
  }

  for (const e of excludeDeleted(expenses)) {
    const key = expenseDateKey(e);
    const amount = Number(e.amount) || 0;
    if (!key || amount <= 0) continue;
    if (openingKey && key <= openingKey) continue;
    add(key, e.paymentMode === 'bank' ? 'bankOut' : 'cashOut', amount);
  }

  const byMonth: Record<string, FlowTotals> = {};
  for (const [key, flow] of Object.entries(byDay)) {
    const monthKey = key.slice(0, 7);
    const prev = byMonth[monthKey] ?? EMPTY_FLOW;
    byMonth[monthKey] = {
      cashIn: prev.cashIn + flow.cashIn,
      bankIn: prev.bankIn + flow.bankIn,
      cashOut: prev.cashOut + flow.cashOut,
      bankOut: prev.bankOut + flow.bankOut,
    };
  }

  const totals = Object.values(byDay).reduce(
    (acc, f) => ({
      cashIn: acc.cashIn + f.cashIn,
      bankIn: acc.bankIn + f.bankIn,
      cashOut: acc.cashOut + f.cashOut,
      bankOut: acc.bankOut + f.bankOut,
    }),
    EMPTY_FLOW,
  );

  const cash = openingCash + totals.cashIn - totals.cashOut;
  const bank = openingBank + totals.bankIn - totals.bankOut;
  return { cash, bank, total: cash + bank, byDay, byMonth };
}
