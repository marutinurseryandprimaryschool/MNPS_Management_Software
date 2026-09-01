/* ============================================
   Principal activity log — formatting (pure)
   ============================================
   Turns a raw `principalAudit` entry into something Sharmi can read: who
   changed what, and the before → after of the fields that actually moved.

   PURE module: no React, no Firestore. Audit `before`/`after` blobs are
   whatever the doc held, so every value here is treated as untrusted —
   Firestore Timestamps, arrays, nested objects and nulls all render safely.
*/

import type {
  PrincipalAuditAction, PrincipalAuditEntry, PrincipalAuditTarget,
} from '@/types/principal';

export const ACTION_LABELS: Record<PrincipalAuditAction, string> = {
  create: 'Added',
  update: 'Edited',
  delete: 'Removed',
};

export const ACTION_VARIANTS: Record<PrincipalAuditAction, 'success' | 'info' | 'error'> = {
  create: 'success',
  update: 'info',
  delete: 'error',
};

export const TARGET_LABELS: Record<PrincipalAuditTarget, string> = {
  register: 'Fees note',
  payment: 'Payment',
  expense: 'Expense',
  settings: 'Settings',
  dayclose: 'Day close',
};

/** Human labels for the fields that appear in a before/after blob. */
const FIELD_LABELS: Record<string, string> = {
  name: 'Student',
  className: 'Class',
  sectionName: 'Section',
  rollNo: 'Roll no',
  teacherUid: 'Teacher (id)',
  teacherName: 'Teacher',
  schoolFee: 'School fee',
  ecaAnnual: 'ECA (annual)',
  ecaMonths: 'ECA months',
  vanMonthly: 'Van (per month)',
  vanMonths: 'Van months',
  isScholarship: 'Scholarship',
  notes: 'Notes',
  studentName: 'Student',
  head: 'Fee head',
  month: 'Month',
  amount: 'Amount',
  dateKey: 'Date',
  paidAt: 'Paid at',
  mode: 'Mode',
  remarks: 'Remarks',
  category: 'Category',
  description: 'Description',
  academicYear: 'Academic year',
  openingCash: 'Opening cash',
  openingBank: 'Opening bank',
  openingAsOf: 'Opening as of',
  defaultEcaMonths: 'Default ECA months',
  defaultVanMonths: 'Default van months',
  expenseCategories: 'Expense categories',
  deleted: 'Removed',
};

/** camelCase → 'Camel case', so an unmapped field is still readable. */
export function fieldLabel(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  const spaced = field.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Fields that carry no information for a reader of the log. */
const NOISE_FIELDS = new Set(['createdAt', 'updatedAt', 'enteredByUid', 'academicYear']);

/** The identity fields worth showing when a whole document was removed. */
const DELETE_FIELDS = [
  'name', 'studentName', 'className', 'head', 'month',
  'amount', 'dateKey', 'category', 'description', 'schoolFee', 'ecaAnnual', 'vanMonthly',
];

export const EMPTY_VALUE = '—';

/** True for the `{ seconds, nanoseconds }` / `{ toDate() }` shapes Firestore returns. */
function asDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value && typeof value === 'object') {
    const candidate = value as { toDate?: () => Date; seconds?: number };
    if (typeof candidate.toDate === 'function') {
      try {
        const date = candidate.toDate();
        return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
      } catch {
        return null;
      }
    }
    if (typeof candidate.seconds === 'number') return new Date(candidate.seconds * 1000);
  }
  return null;
}

/** Renders ANY stored value as one short, safe line of text. */
export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return EMPTY_VALUE;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('en-IN') : EMPTY_VALUE;
  if (typeof value === 'string') return value;
  const date = asDate(value);
  if (date) return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  if (Array.isArray(value)) {
    return value.length === 0 ? EMPTY_VALUE : value.map(item => formatAuditValue(item)).join(', ');
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return EMPTY_VALUE;
    return entries.map(([key, item]) => `${fieldLabel(key)}: ${formatAuditValue(item)}`).join(' · ');
  }
  return String(value);
}

export interface AuditChange {
  field: string;
  label: string;
  before: string;
  after: string;
}

/** How many field rows an entry shows before it is truncated. */
export const MAX_CHANGES_SHOWN = 10;

const record = (value: unknown): Record<string, unknown> =>
  (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});

/**
 * The before → after rows for one entry:
 * - create → the fields the new record was born with;
 * - update → only the patched fields (the service snapshots exactly those);
 * - delete → the identity fields of the record that left the totals.
 */
export function diffAuditEntry(entry: PrincipalAuditEntry): AuditChange[] {
  const before = record(entry.before);
  const after = record(entry.after);

  const fields = entry.action === 'delete'
    ? DELETE_FIELDS.filter(field => before[field] !== undefined && before[field] !== null && before[field] !== '')
    : Array.from(new Set([...Object.keys(after), ...Object.keys(before)]))
      .filter(field => !NOISE_FIELDS.has(field));

  return fields.map(field => ({
    field,
    label: fieldLabel(field),
    before: formatAuditValue(before[field]),
    after: entry.action === 'delete' ? EMPTY_VALUE : formatAuditValue(after[field]),
  }))
    .filter(change => change.before !== change.after || entry.action === 'create');
}

/** 'yyyy-MM-dd' of when the change happened — the date filter buckets on it. */
export function auditDateKey(entry: PrincipalAuditEntry): string {
  const at = asDate(entry.at);
  if (!at) return '';
  const month = `${at.getMonth() + 1}`.padStart(2, '0');
  const day = `${at.getDate()}`.padStart(2, '0');
  return `${at.getFullYear()}-${month}-${day}`;
}

/** 'Wed, 19 Aug 2026, 4:05 pm' — or an em dash when the stamp is missing. */
export function formatAuditTime(entry: PrincipalAuditEntry): string {
  const at = asDate(entry.at);
  if (!at) return EMPTY_VALUE;
  return at.toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}
