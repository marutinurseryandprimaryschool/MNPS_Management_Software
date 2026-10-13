/* ============================================
   CampusOS — Parent portal: shared pure logic
   ============================================
   Used by BOTH the browser bundle and the Vercel functions under /api.
   Rules for this file:
     - no `@/` imports (the functions cannot resolve the alias), relative only;
     - no Firebase, no DOM, no Node APIs — pure functions over plain data,
       so every branch here is unit-testable without an emulator.

   What lives here: login input validation, the phone-suffix + DOB match,
   sibling grouping, the rate-limit policy, the per-student record filters
   that keep one family's data out of another's response, and the fee-row
   matcher the parent fee screen and the API both use. */

import { getClassSlotIndex } from '../class-slots';

/* ── Input validation ─────────────────────────────────────────────────── */

export const LOGIN_CODE_LENGTH = 4;
export const LOGIN_DOB_LENGTH = 8; // DDMMYYYY

export interface LoginInput {
  code: string;
  dob: string;
}

/**
 * Strict shape check for the code/DOB login. Anything that is not exactly
 * four digits + a real calendar date in DDMMYYYY is rejected before any
 * lookup happens, so malformed input never reaches the database.
 */
export function parseLoginInput(raw: unknown): LoginInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const { code, dob } = raw as { code?: unknown; dob?: unknown };
  if (typeof code !== 'string' || typeof dob !== 'string') return null;
  if (!/^\d{4}$/.test(code)) return null;
  if (!/^\d{8}$/.test(dob)) return null;
  const day = Number(dob.slice(0, 2));
  const month = Number(dob.slice(2, 4));
  const year = Number(dob.slice(4));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1990 || year > 2100) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCDate() !== day || probe.getUTCMonth() !== month - 1) return null;
  return { code, dob };
}

/* ── Student matching ─────────────────────────────────────────────────── */

/** The subset of a student record the matcher needs. */
export interface MatchableStudent {
  id: string;
  phone?: string | null;
  email?: string | null;
  dob?: unknown;
  status?: string | null;
}

export const phoneDigits = (phone?: string | null): string => (phone || '').replace(/\D/g, '');
export const phoneLast4 = (phone?: string | null): string => phoneDigits(phone).slice(-4);
/**
 * Family key for a phone: the last 10 digits, so "+91 98765 43210",
 * "09876543210" and "9876543210" are the same household. Shorter numbers
 * are used as-is; empty stays empty (and never groups anyone).
 */
export const phoneKey = (phone?: string | null): string => phoneDigits(phone).slice(-10);
export const normalizeEmail = (email?: string | null): string => (email || '').trim().toLowerCase();

/**
 * DDMMYYYY key for a stored DOB. Accepts a Date, a Firestore Timestamp-like
 * ({toDate}), an ISO/`yyyy-mm-dd` string, or a pre-digitised string. Returns
 * '' when the value cannot be read, which never equals a valid input.
 */
export function dobKey(value: unknown): string {
  if (!value) return '';
  let d: Date | null = null;
  if (value instanceof Date) d = value;
  else if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    d = (value as { toDate: () => Date }).toDate();
  } else if (typeof value === 'string') {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 8 && /^\d{4}/.test(value)) {
      // 'yyyy-mm-dd' style → reorder
      return `${digits.slice(6, 8)}${digits.slice(4, 6)}${digits.slice(0, 4)}`;
    }
    if (digits.length === 8) return digits;
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) d = parsed;
  }
  if (!d || isNaN(d.getTime())) return '';
  // Read the calendar day in India time (UTC+5:30, no DST), NOT the runtime's
  // zone. The server runs in UTC, so a DOB saved as midnight IST
  // (= 18:30 UTC the day before) would otherwise come out one day early and
  // every such parent would be refused. UTC-midnight values (date inputs)
  // land at 05:30 IST — the same day — so both storage styles agree.
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  const day = String(ist.getUTCDate()).padStart(2, '0');
  const month = String(ist.getUTCMonth() + 1).padStart(2, '0');
  return `${day}${month}${ist.getUTCFullYear()}`;
}

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export interface MatchResult<S extends MatchableStudent> {
  /** The student whose phone suffix + DOB matched, or null. */
  matched: S | null;
  /** Every active student sharing the matched student's FULL phone number
      (siblings), matched first. Empty when nothing matched. */
  family: S[];
}

// Only explicitly archived/left records are excluded; blank or differently
// cased statuses still count as enrolled (the old browser login ignored status).
const INACTIVE = new Set(['archived', 'inactive', 'left']);
export const isActiveStudent = (s: { status?: string | null }) => !INACTIVE.has(String(s.status || '').trim().toLowerCase());

/**
 * Find the student for a login code + DOB. Only ACTIVE students can match.
 * A match must be unique: two active students with the same phone suffix AND
 * the same DOB (twins on one phone) resolve to BOTH in `family` but `matched`
 * is the first by id, so the result is deterministic.
 */
export function matchStudents<S extends MatchableStudent>(
  students: S[],
  input: LoginInput,
): MatchResult<S> {
  // Defence in depth: parseLoginInput already guarantees this shape, but an
  // empty code must never equal the empty suffix of a student with no phone.
  if (!/^\d{4}$/.test(input.code) || !/^\d{8}$/.test(input.dob)) return { matched: null, family: [] };
  const hits = students
    .filter(isActiveStudent)
    .filter(s => phoneLast4(s.phone) === input.code && dobKey(s.dob) === input.dob)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (hits.length === 0) return { matched: null, family: [] };
  const matched = hits[0];
  return { matched, family: siblingsOf(students, matched) };
}

/** Active students on the same household phone (phoneKey) as `anchor`, anchor first. */
export function siblingsOf<S extends MatchableStudent>(students: S[], anchor: S): S[] {
  const phone = phoneKey(anchor.phone);
  const rest = phone
    ? students.filter(s => s.id !== anchor.id && isActiveStudent(s) && phoneKey(s.phone) === phone)
    : [];
  return [anchor, ...rest.sort((a, b) => a.id.localeCompare(b.id))];
}

/** Active students whose stored email equals `email` (case/space-insensitive). */
export function studentsByEmail<S extends MatchableStudent>(students: S[], email: string): S[] {
  const key = normalizeEmail(email);
  if (!key) return [];
  return students
    .filter(isActiveStudent)
    .filter(s => normalizeEmail(s.email) === key)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/* ── Rate limiting policy ─────────────────────────────────────────────── */

export const RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  /** Attempts per client IP per window. */
  perIp: 20,
  /** Attempts against one login code per window — the brute-force target. */
  perCode: 8,
} as const;

export interface AttemptWindow {
  count: number;
  windowStart: number; // epoch ms
}

export interface RateDecision {
  allowed: boolean;
  /** Seconds until the window resets; 0 when allowed. */
  retryAfterSec: number;
  /** The window to persist (count advanced when allowed). */
  next: AttemptWindow;
}

/**
 * Fixed-window counter. Pure: the caller loads the stored window, applies
 * this, and persists `next`. A fresh or expired window restarts at 1.
 */
export function applyRateLimit(
  stored: AttemptWindow | null,
  limit: number,
  now: number,
  windowMs: number = RATE_LIMIT.windowMs,
): RateDecision {
  if (!stored || now - stored.windowStart >= windowMs) {
    return { allowed: true, retryAfterSec: 0, next: { count: 1, windowStart: now } };
  }
  if (stored.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((stored.windowStart + windowMs - now) / 1000));
    return { allowed: false, retryAfterSec, next: stored };
  }
  return { allowed: true, retryAfterSec: 0, next: { count: stored.count + 1, windowStart: stored.windowStart } };
}

/* ── Per-student data filters ─────────────────────────────────────────── */

/**
 * Keep only this student's entry in each class-wide document (attendance,
 * marks, class tests, co-scholastic: one `records[]` entry per student), and
 * drop the documents that have no entry for them at all. This is THE boundary
 * that stops classmates' marks reaching a parent's browser.
 */
export function restrictRecordsToStudent<D extends object>(docs: D[], studentId: string): D[] {
  const out: D[] = [];
  for (const doc of docs) {
    const records = (doc as { records?: unknown }).records;
    const mine = Array.isArray(records)
      ? records.filter(r => r && typeof r === 'object' && (r as { studentId?: unknown }).studentId === studentId)
      : [];
    if (mine.length === 0) continue;
    out.push({ ...doc, records: mine } as D);
  }
  return out;
}

/** Student fields a parent may see about their OWN child. Nothing else leaves the server. */
export const PARENT_VISIBLE_STUDENT_FIELDS = [
  'id', 'admissionNumber', 'name', 'nameTamil', 'dob', 'gender', 'bloodGroup',
  'photo', 'classId', 'sectionId', 'className', 'sectionName', 'academicYear',
  'status', 'phone', 'email', 'fatherName', 'motherName', 'guardianName',
  'address', 'transportType', 'routeId', 'routeName', 'dateOfJoining',
] as const;

export function sanitizeStudentForParent<T extends Record<string, unknown>>(student: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const key of PARENT_VISIBLE_STUDENT_FIELDS) {
    if (key in student && student[key] !== undefined) out[key] = student[key];
  }
  return out as Partial<T>;
}

/* ── Fee register row matching ────────────────────────────────────────── */

export interface RowLike { id: string; name: string; className?: string | null; deleted?: boolean }
export interface ChildLike { name: string; className?: string | null }

const norm = (value?: string | null): string =>
  (value || '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Alias-aware class equality ("Class 1" === "First"), falling back to text. */
export function sameClass(a?: string | null, b?: string | null): boolean {
  const slotA = getClassSlotIndex(a || '');
  const slotB = getClassSlotIndex(b || '');
  if (slotA !== -1 && slotB !== -1) return slotA === slotB;
  return norm(a) === norm(b) && norm(a) !== '';
}

/**
 * The child's register row, or null. Name + class first; a name-only match is
 * accepted ONLY when unique, so a repeated name never resolves to the wrong
 * family's fees. (The register is standalone and carries no studentId.)
 */
export function findRowForChild<R extends RowLike>(rows: R[], child: ChildLike | null): R | null {
  if (!child) return null;
  const childName = norm(child.name);
  if (!childName) return null;
  const live = rows.filter(r => !r.deleted);
  const sameName = live.filter(row => norm(row.name) === childName);
  if (sameName.length === 0) return null;
  const withClass = sameName.filter(row => sameClass(row.className, child.className));
  if (withClass.length === 1) return withClass[0];
  if (withClass.length > 1) return null; // ambiguous — never guess with money
  return sameName.length === 1 ? sameName[0] : null;
}

/* ── Token claims ─────────────────────────────────────────────────────── */

export interface ParentClaims {
  role: 'parent';
  /** Students this session may read. Checked on every data request. */
  studentIds: string[];
}

export function isParentClaims(claims: unknown): claims is ParentClaims {
  if (!claims || typeof claims !== 'object') return false;
  const c = claims as { role?: unknown; studentIds?: unknown };
  return c.role === 'parent'
    && Array.isArray(c.studentIds)
    && c.studentIds.length > 0
    && c.studentIds.every(id => typeof id === 'string' && id.length > 0 && id.length < 128);
}

export const PARENT_DATA_VIEWS = [
  'me', 'attendance', 'marks', 'weekly', 'classTests', 'reportCard',
  'assignments', 'timetable', 'fees', 'class',
] as const;
export type ParentDataView = typeof PARENT_DATA_VIEWS[number];

export function isParentDataView(value: unknown): value is ParentDataView {
  return typeof value === 'string' && (PARENT_DATA_VIEWS as readonly string[]).includes(value);
}
