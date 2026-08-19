/* ============================================
   Fees Note — presentation helpers (pure, no React)
   ============================================
   Sharmi types into ONE register; the class-wise and teacher-wise screens are
   views of the same rows. This module holds only what the note SCREEN needs to
   present those rows: cell parsing, month-chip states, search and filtering.

   No money math lives here. Every rupee figure on the screen comes from
   src/lib/principal-fees.ts — dues, the ECA split and the "a month falls due
   only after it ends" rule are decided there and nowhere else.
*/

import { ACADEMIC_MONTHS } from '@/lib/fee-utils';
import type {
  MonthCell, NewRegisterRow, PrincipalFeeHead, RegisterRow, RowSummary,
} from '@/types/principal';

/* ── Editable columns ─────────────────────────────────────────────────── */

/** The numeric columns the desktop grid edits in place, in Tab order. */
export const EDITABLE_FIELDS = ['schoolFee', 'ecaAnnual', 'vanMonthly'] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number];

export const FIELD_LABELS: Record<EditableField, string> = {
  schoolFee: 'School',
  ecaAnnual: 'ECA (year)',
  vanMonthly: 'Van (month)',
};

/** One cell of the grid, as the keyboard model addresses it. */
export interface CellRef {
  rowId: string;
  field: EditableField;
}

export const sameCell = (a: CellRef | null, b: CellRef | null): boolean =>
  !!a && !!b && a.rowId === b.rowId && a.field === b.field;

/** A one-field patch, typed. Keeps `{ [field]: value }` out of the call sites. */
export function fieldPatch(field: EditableField, value: number): Partial<NewRegisterRow> {
  if (field === 'schoolFee') return { schoolFee: value };
  if (field === 'ecaAnnual') return { ecaAnnual: value };
  return { vanMonthly: value };
}

/* ── Cell input parsing ───────────────────────────────────────────────── */

export const amountToInput = (value: number | null | undefined): string =>
  String(Math.round(Number(value) || 0));

/**
 * Parses a typed cell. Returns null when the text is not a usable amount, so
 * the caller reverts instead of writing NaN into the register. Blank means
 * zero — clearing a cell is how a charge gets removed.
 */
export function parseAmountInput(text: string): number | null {
  const cleaned = (text || '').replace(/[₹,\s]/g, '');
  if (cleaned === '') return 0;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

/* ── Month chips ──────────────────────────────────────────────────────── */

export type MonthState = 'free' | 'paid' | 'due' | 'upcoming';

/**
 * PAID / DUE / upcoming for one month cell. `isDue` is the engine's verdict —
 * in August only June and July come back due, never the whole year.
 */
export function monthState(cell: MonthCell): MonthState {
  if (cell.amount <= 0) return 'free';
  if (cell.pending <= 0) return 'paid';
  return cell.isDue ? 'due' : 'upcoming';
}

export const MONTH_STATE_LABELS: Record<MonthState, string> = {
  free: 'No charge',
  paid: 'Paid',
  due: 'Due',
  upcoming: 'Upcoming',
};

export interface ChipTheme {
  bg: string;
  color: string;
  border: string;
}

export const MONTH_STATE_THEME: Record<MonthState, ChipTheme> = {
  free: {
    bg: 'var(--color-surface-variant)',
    color: 'var(--color-text-tertiary)',
    border: 'transparent',
  },
  paid: {
    bg: 'var(--color-success-bg)',
    color: 'var(--color-success)',
    border: 'transparent',
  },
  due: {
    bg: 'var(--color-error-bg)',
    color: 'var(--color-error)',
    border: 'var(--color-error)',
  },
  upcoming: {
    bg: 'var(--color-surface)',
    color: 'var(--color-text-secondary)',
    border: 'var(--color-border)',
  },
};

/* ── Dates ────────────────────────────────────────────────────────────── */

/**
 * 'yyyy-MM-dd' → a local Date at midday. Midday, not midnight: a backdated
 * receipt must never slip to the previous day when it is re-read.
 */
export function dateFromKey(dateKey: string): Date {
  const [year, month, day] = (dateKey || '').split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day, 12, 0, 0);
}

/* ── Month schedules ──────────────────────────────────────────────────── */

/**
 * A fee amount with no months attached charges NOTHING — the engine defaults
 * van to no months on purpose, so only actual riders are billed. Whenever an
 * amount is set on a row whose month list is empty the schedule must be filled
 * in with it, or the principal types "van ₹500" and the register silently
 * stays at zero.
 *
 * Returns the months to write, or null when the schedule needs no change.
 */
export function monthsForAmount(
  amount: number,
  currentMonths: string[] | null | undefined,
  defaults: string[] | null | undefined,
): string[] | null {
  if (amount <= 0) return null;                                // nothing charged
  if (currentMonths && currentMonths.length > 0) return null;  // already scheduled
  return defaults && defaults.length > 0 ? [...defaults] : [...ACADEMIC_MONTHS];
}

/* ── Search / filter ──────────────────────────────────────────────────── */

export function filterRows(
  rows: RegisterRow[],
  search: string,
  className: string,
): RegisterRow[] {
  const needle = search.trim().toLowerCase();
  return rows.filter(row => {
    if (className && (row.className || '') !== className) return false;
    if (!needle) return true;
    return [row.name, row.className, row.sectionName, row.rollNo, row.teacherName]
      .some(field => (field || '').toLowerCase().includes(needle));
  });
}

/** Distinct class names present in the register, numeric-aware ('2' < '10'). */
export function classOptions(rows: RegisterRow[]): string[] {
  const names = new Set(rows.map(row => row.className || '').filter(Boolean));
  return Array.from(names).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

/* ── Shared prop shapes (desktop grid ↔ mobile cards) ─────────────────── */

/** What the "Record payment" dialog opens with when a month cell is tapped. */
export interface PaymentPrefill {
  head: PrincipalFeeHead;
  month?: string;
  amount?: number;
}

/**
 * The behaviour both presentations share. Desktop and mobile differ only in
 * layout — they call exactly these callbacks against exactly this data.
 */
export interface NoteRowHandlers {
  summaryFor: (rowId: string) => RowSummary;
  /** Principal on any row; a teacher only on their own (fee fields only). */
  canEditRow: (row: RegisterRow) => boolean;
  /**
   * Principal only. Soft-delete flips `deleted`, which firestore.rules keeps
   * outside a teacher's allowed field set — so the action must not even offer
   * itself to a teacher, or it fails on click.
   */
  canDeleteRow: (row: RegisterRow) => boolean;
  canRecordFor: (row: RegisterRow) => boolean;
  onToggleMonths: (rowId: string) => void;
  onRecordPayment: (row: RegisterRow, prefill?: PaymentPrefill) => void;
  onEditRow: (row: RegisterRow) => void;
  onDeleteRow: (row: RegisterRow) => void;
}
