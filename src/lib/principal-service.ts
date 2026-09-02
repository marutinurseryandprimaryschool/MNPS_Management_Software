/* ============================================
   CampusOS — Principal Register service
   ============================================
   The ONLY writer for the standalone Principal Register collections. Screens
   never touch Firestore directly, and nothing here reads or writes the legacy
   feePayments / feeStructures / expenses collections.

   Guarantees:
   - EVERY mutation writes its principalAudit entry in the SAME writeBatch as
     the change, so a change can never exist without its audit trail.
   - Deletes are SOFT (`deleted: true`) for rows, payments and expenses. Hard
     deletes are denied by firestore.rules — the audit log is permanent.
   - No silent catches. Failures throw a PrincipalServiceError whose message is
     already user-safe (permission-denied → role-specific text + "refresh the
     app"; unavailable → "Connection lost — NOT saved, retry").
   - Reads exclude soft-deleted docs and sort in memory, so no composite index
     is required beyond the single-field ones Firestore creates automatically.
*/

import { FirebaseError } from 'firebase/app';
import {
  collection, doc, getDoc, getDocs, limit as limitTo, orderBy, query, serverTimestamp,
  Timestamp, where, writeBatch,
  type DocumentData, type QueryConstraint, type WriteBatch,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { coerceDate, excludeDeleted } from './fee-utils';
import { computeDayCloseAssessment } from './principal-fees';
import {
  describeWriteError, isBrowserOffline, OFFLINE_NOT_SAVED_MESSAGE,
} from '@/components/layout/admin/fees/error-policy';
import type {
  DayCloseInput, NewPrincipalExpense, NewPrincipalPayment, NewRegisterRow,
  PrincipalActor, PrincipalAuditAction, PrincipalAuditEntry, PrincipalAuditTarget,
  PrincipalDayClose, PrincipalExpense, PrincipalPayment, PrincipalSettings, RegisterRow,
} from '@/types/principal';

/* ── Collections ──────────────────────────────────────────────────────── */

export const PRINCIPAL_COLLECTIONS = {
  register: 'principalRegister',
  payments: 'principalPayments',
  expenses: 'principalExpenses',
  audit: 'principalAudit',
  settings: 'principalSettings',
  /** Phase 3 §16: one doc per business date, the doc id IS the 'yyyy-MM-dd'. */
  dayClose: 'principalDayClose',
} as const;

const SETTINGS_DOC_ID = 'main';
const DEFAULT_AUDIT_LIMIT = 100;

/* ── Errors ───────────────────────────────────────────────────────────── */

/** Carries an already user-safe message plus the raw cause for the console. */
export class PrincipalServiceError extends Error {
  readonly code: string;
  readonly sourceError: unknown;

  constructor(message: string, code: string, sourceError?: unknown) {
    super(message);
    this.name = 'PrincipalServiceError';
    this.code = code;
    this.sourceError = sourceError;
  }
}

function describeReadFailure(error: unknown, subject: string): string {
  if (error instanceof FirebaseError) {
    if (error.code === 'permission-denied') {
      return `You do not have access to ${subject}. If your role changed recently, refresh the app.`;
    }
    if (error.code === 'unavailable') {
      return `Connection lost — could not load ${subject}. Check your internet and retry.`;
    }
  }
  return `Could not load ${subject}. Please retry.`;
}

const errorCode = (error: unknown): string =>
  error instanceof FirebaseError ? error.code : 'unknown';

/**
 * Wraps a mutation: refuses up-front when the browser is offline (a batch
 * would otherwise queue silently and read as saved), then maps any failure
 * onto the shared error policy. `permissionMessage` is the role-specific
 * denial text for this operation.
 */
async function runWrite<T>(permissionMessage: string, fn: () => Promise<T>): Promise<T> {
  if (isBrowserOffline()) throw new PrincipalServiceError(OFFLINE_NOT_SAVED_MESSAGE, 'unavailable');
  try {
    return await fn();
  } catch (error) {
    if (error instanceof PrincipalServiceError) throw error;
    console.error('[principal-service] write failed', error);
    throw new PrincipalServiceError(describeWriteError(error, permissionMessage), errorCode(error), error);
  }
}

async function runRead<T>(subject: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[principal-service] could not load ${subject}`, error);
    throw new PrincipalServiceError(describeReadFailure(error, subject), errorCode(error), error);
  }
}

/* ── Attribution ──────────────────────────────────────────────────────── */

const NO_SESSION_MESSAGE =
  'Your session has no signed-in user — sign in again before recording anything.';

/**
 * The uid every money record and audit entry is stamped with.
 *
 * Read from the Firebase session, NEVER from the caller-supplied actor: a
 * screen could pass any uid it liked, and firestore.rules now pins
 * `enteredByUid` / `actorUid` to `request.auth.uid`, so a mismatched actor
 * would be rejected server-side anyway. Failing here gives the user a sentence
 * instead of a permission-denied.
 */
function signedInUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new PrincipalServiceError(NO_SESSION_MESSAGE, 'unauthenticated');
  return uid;
}

/* ── Serialization ────────────────────────────────────────────────────── */

/** Drops undefined (Firestore rejects it) and converts Dates → Timestamps. */
function sanitizeValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (Array.isArray(value)) return value.map(item => sanitizeValue(item) ?? null);
  if (value !== null && typeof value === 'object' && value.constructor === Object) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const sanitized = sanitizeValue(item);
      if (sanitized !== undefined) out[key] = sanitized;
    }
    return out;
  }
  return value; // primitives + FieldValue sentinels (serverTimestamp) pass through
}

const sanitize = (data: Record<string, unknown>): Record<string, unknown> =>
  sanitizeValue(data) as Record<string, unknown>;

const TIMESTAMP_FIELDS = ['createdAt', 'updatedAt', 'paidAt', 'at', 'closedAt'] as const;

/** Firestore doc → app shape: id attached, known Timestamps coerced to Dates. */
function fromFirestore<T>(data: DocumentData, id: string): T {
  const out: DocumentData = { ...data, id };
  for (const field of TIMESTAMP_FIELDS) {
    if (out[field] !== undefined && out[field] !== null) out[field] = coerceDate(out[field]);
  }
  return out as T;
}

async function listDocs<T>(collectionName: string, ...constraints: QueryConstraint[]): Promise<T[]> {
  const ref = collection(db, collectionName);
  const snap = await getDocs(constraints.length > 0 ? query(ref, ...constraints) : ref);
  return snap.docs.map(d => fromFirestore<T>(d.data(), d.id));
}

/* ── Audit (same batch as the change, always) ─────────────────────────── */

interface AuditInput {
  actor: PrincipalActor;
  action: PrincipalAuditAction;
  target: PrincipalAuditTarget;
  targetId: string;
  summary: string;
  studentName?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

function appendAudit(batch: WriteBatch, entry: AuditInput): void {
  const ref = doc(collection(db, PRINCIPAL_COLLECTIONS.audit));
  batch.set(ref, sanitize({
    // `at` is the SERVER's clock and actorUid the SESSION's uid — both pinned
    // by firestore.rules. A client-set `at` could otherwise bury every genuine
    // entry below a forged one in the activity log's `orderBy('at')` window.
    at: serverTimestamp(),
    actorUid: signedInUid(),
    actorName: entry.actor.name,
    actorRole: entry.actor.role,
    action: entry.action,
    target: entry.target,
    targetId: entry.targetId,
    studentName: entry.studentName,
    summary: entry.summary,
    before: entry.before ?? null,
    after: entry.after ?? null,
  }));
}

/** Pre-change values of exactly the patched keys — a compact, readable diff. */
function pickKeys(source: DocumentData, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) out[key] = source[key] ?? null;
  return out;
}

interface PatchDescription {
  summary: string;
  studentName?: string;
}

/**
 * Read-then-batch update: fetches the doc for its before-snapshot, then writes
 * the patch and the audit entry atomically. A 'delete' action snapshots the
 * WHOLE doc (it is leaving every total, so the log must hold all of it).
 */
async function patchWithAudit(
  collectionName: string,
  target: PrincipalAuditTarget,
  id: string,
  patch: Record<string, unknown>,
  actor: PrincipalActor,
  describe: (before: DocumentData) => PatchDescription,
  action: PrincipalAuditAction = 'update',
): Promise<void> {
  const ref = doc(db, collectionName, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new PrincipalServiceError('That record no longer exists — refresh the app.', 'not-found');
  }
  const existing = snap.data();
  const payload = sanitize(patch);
  const { summary, studentName } = describe(existing);

  const batch = writeBatch(db);
  batch.update(ref, { ...payload, updatedAt: serverTimestamp() });
  appendAudit(batch, {
    actor, action, target, targetId: id, summary, studentName,
    before: action === 'delete' ? { ...existing } : pickKeys(existing, Object.keys(patch)),
    after: payload,
  });
  await batch.commit();
}

/* ── Register rows ────────────────────────────────────────────────────── */

const CANNOT_EDIT_REGISTER = 'Only the Principal can edit the fees note.';

const byClassThenName = (a: RegisterRow, b: RegisterRow): number =>
  (a.className || '').localeCompare(b.className || '', undefined, { numeric: true, sensitivity: 'base' })
  || (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });

export const PrincipalRegisterService = {
  /** Live rows for the year, sorted by class then student name. */
  listRows: (year: string): Promise<RegisterRow[]> =>
    runRead('the fees note', async () => {
      const rows = await listDocs<RegisterRow>(
        PRINCIPAL_COLLECTIONS.register, where('academicYear', '==', year));
      return excludeDeleted(rows).sort(byClassThenName);
    }),

  createRow: (data: NewRegisterRow, actor: PrincipalActor): Promise<string> =>
    runWrite(CANNOT_EDIT_REGISTER, async () => {
      const ref = doc(collection(db, PRINCIPAL_COLLECTIONS.register));
      const payload = sanitize({ ...data, deleted: false });
      const batch = writeBatch(db);
      batch.set(ref, { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      appendAudit(batch, {
        actor, action: 'create', target: 'register', targetId: ref.id,
        studentName: data.name,
        summary: `Added ${data.name} (${data.className}) to the fees note`,
        before: null, after: payload,
      });
      await batch.commit();
      return ref.id;
    }),

  updateRow: (id: string, patch: Partial<NewRegisterRow>, actor: PrincipalActor): Promise<void> =>
    runWrite(CANNOT_EDIT_REGISTER, () => patchWithAudit(
      PRINCIPAL_COLLECTIONS.register, 'register', id, patch as Record<string, unknown>, actor,
      before => ({
        studentName: String(before.name ?? ''),
        summary: `Updated ${before.name ?? 'a student'} — ${Object.keys(patch).join(', ') || 'no fields'}`,
      }),
    )),

  softDeleteRow: (id: string, actor: PrincipalActor): Promise<void> =>
    runWrite(CANNOT_EDIT_REGISTER, () => patchWithAudit(
      PRINCIPAL_COLLECTIONS.register, 'register', id, { deleted: true }, actor,
      before => ({
        studentName: String(before.name ?? ''),
        summary: `Removed ${before.name ?? 'a student'} from the fees note (kept in the activity log)`,
      }),
      'delete',
    )),

  /** Sets (or clears, with `null`) the teacher whose register this row shows in. */
  assignTeacher: (
    id: string,
    teacher: { uid: string; name: string } | null,
    actor: PrincipalActor,
  ): Promise<void> =>
    runWrite('Only the Principal can assign teachers.', () => patchWithAudit(
      PRINCIPAL_COLLECTIONS.register, 'register', id,
      { teacherUid: teacher?.uid ?? null, teacherName: teacher?.name ?? null }, actor,
      before => ({
        studentName: String(before.name ?? ''),
        summary: teacher
          ? `Assigned ${teacher.name} as the teacher for ${before.name ?? 'a student'}`
          : `Cleared the teacher for ${before.name ?? 'a student'}`,
      }),
    )),
};

/* ── Payments ─────────────────────────────────────────────────────────── */

const CANNOT_RECORD_PAYMENT = 'Only the Principal and the responsible teacher can record payments.';

const HEAD_LABELS: Record<string, string> = {
  school: 'school fee', eca: 'ECA fee', van: 'van fee', other: 'other',
};

const paymentSummary = (p: NewPrincipalPayment): string => {
  const head = HEAD_LABELS[p.head] ?? p.head;
  const month = p.month ? ` (${p.month})` : '';
  return `Recorded ₹${p.amount} ${head}${month} for ${p.studentName} on ${p.dateKey}`;
};

const newestFirst = (a: PrincipalPayment, b: PrincipalPayment): number =>
  (b.dateKey || '').localeCompare(a.dateKey || '')
  || (b.paidAt?.getTime() ?? 0) - (a.paidAt?.getTime() ?? 0);

export const PrincipalPaymentsService = {
  listByYear: (year: string): Promise<PrincipalPayment[]> =>
    runRead('the payments', async () => {
      const rows = await listDocs<PrincipalPayment>(
        PRINCIPAL_COLLECTIONS.payments, where('academicYear', '==', year));
      return excludeDeleted(rows).sort(newestFirst);
    }),

  listByRow: (rowId: string): Promise<PrincipalPayment[]> =>
    runRead('this student’s payments', async () => {
      const rows = await listDocs<PrincipalPayment>(
        PRINCIPAL_COLLECTIONS.payments, where('rowId', '==', rowId));
      return excludeDeleted(rows).sort(newestFirst);
    }),

  create: (data: NewPrincipalPayment, actor: PrincipalActor): Promise<string> =>
    runWrite(CANNOT_RECORD_PAYMENT, async () => {
      const ref = doc(collection(db, PRINCIPAL_COLLECTIONS.payments));
      const payload = sanitize({
        ...data,
        // Attribution comes from the signed-in session. A teacher recording a
        // receipt cannot stamp it "entered by the Principal".
        enteredByUid: signedInUid(),
        enteredByName: actor.name,
        enteredByRole: actor.role,
        deleted: false,
      });
      const batch = writeBatch(db);
      batch.set(ref, { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      appendAudit(batch, {
        actor, action: 'create', target: 'payment', targetId: ref.id,
        studentName: data.studentName, summary: paymentSummary(data),
        before: null, after: payload,
      });
      await batch.commit();
      return ref.id;
    }),

  update: (id: string, patch: Partial<NewPrincipalPayment>, actor: PrincipalActor): Promise<void> =>
    runWrite('Only the Principal can edit a recorded payment.', () => patchWithAudit(
      PRINCIPAL_COLLECTIONS.payments, 'payment', id, patch as Record<string, unknown>, actor,
      before => ({
        studentName: String(before.studentName ?? ''),
        summary: `Edited a payment for ${before.studentName ?? 'a student'} — ${Object.keys(patch).join(', ') || 'no fields'}`,
      }),
    )),

  softDelete: (id: string, actor: PrincipalActor): Promise<void> =>
    runWrite('Only the Principal can delete a payment.', () => patchWithAudit(
      PRINCIPAL_COLLECTIONS.payments, 'payment', id, { deleted: true }, actor,
      before => ({
        studentName: String(before.studentName ?? ''),
        summary: `Deleted a ₹${before.amount ?? 0} payment for ${before.studentName ?? 'a student'} (kept in the activity log)`,
      }),
      'delete',
    )),
};

/* ── Expenses ─────────────────────────────────────────────────────────── */

const CANNOT_MANAGE_EXPENSES = 'Only the Principal can manage expenses.';

export const PrincipalExpensesService = {
  listByYear: (year: string): Promise<PrincipalExpense[]> =>
    runRead('the expenses', async () => {
      const rows = await listDocs<PrincipalExpense>(
        PRINCIPAL_COLLECTIONS.expenses, where('academicYear', '==', year));
      return excludeDeleted(rows).sort((a, b) => (b.dateKey || '').localeCompare(a.dateKey || ''));
    }),

  create: (data: NewPrincipalExpense, actor: PrincipalActor): Promise<string> =>
    runWrite(CANNOT_MANAGE_EXPENSES, async () => {
      const ref = doc(collection(db, PRINCIPAL_COLLECTIONS.expenses));
      const payload = sanitize({
        ...data, enteredByUid: signedInUid(), enteredByName: actor.name, deleted: false,
      });
      const batch = writeBatch(db);
      batch.set(ref, { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      appendAudit(batch, {
        actor, action: 'create', target: 'expense', targetId: ref.id,
        summary: `Recorded ₹${data.amount} expense — ${data.category} on ${data.dateKey}`,
        before: null, after: payload,
      });
      await batch.commit();
      return ref.id;
    }),

  update: (id: string, patch: Partial<NewPrincipalExpense>, actor: PrincipalActor): Promise<void> =>
    runWrite(CANNOT_MANAGE_EXPENSES, () => patchWithAudit(
      PRINCIPAL_COLLECTIONS.expenses, 'expense', id, patch as Record<string, unknown>, actor,
      before => ({
        summary: `Edited a ₹${before.amount ?? 0} expense (${before.category ?? 'uncategorised'}) — ${Object.keys(patch).join(', ') || 'no fields'}`,
      }),
    )),

  softDelete: (id: string, actor: PrincipalActor): Promise<void> =>
    runWrite(CANNOT_MANAGE_EXPENSES, () => patchWithAudit(
      PRINCIPAL_COLLECTIONS.expenses, 'expense', id, { deleted: true }, actor,
      before => ({
        summary: `Deleted a ₹${before.amount ?? 0} expense (${before.category ?? 'uncategorised'}) — kept in the activity log`,
      }),
      'delete',
    )),
};

/* ── Day close (Phase 3 §16–§18) ──────────────────────────────────────── */

/**
 * A day-close write is denied for exactly one reason in practice: the rules
 * block for principalDayClose has not been deployed yet. Saying "only the
 * Principal can do this" to the Principal herself is simply wrong — this text
 * names the real cause and the real fix.
 */
const CANNOT_CLOSE_DAY =
  'Day close is not switched on yet — the updated security rules still need to be '
  + 'deployed to Firebase. Everything else on this page keeps working.';

const dayCloseRef = (dateKey: string) => doc(db, PRINCIPAL_COLLECTIONS.dayClose, dateKey);

/**
 * Day close is the newest collection, and its firestore.rules block may not be
 * deployed yet. Until it is, EVERY read of it is denied — an expected state,
 * not a failure, so it must not shout in the console on every accounts load.
 *
 * A denial is swallowed here (before runRead's error path) and recorded on
 * this flag, so the UI can say "Day close needs the updated security rules"
 * instead of silently pretending every day is open. Any OTHER failure —
 * offline, backend down — still throws and is still reported.
 */
let dayCloseDenied = false;

/** True once a day-close read has been denied by the security rules. */
export const isDayCloseUnavailable = (): boolean => dayCloseDenied;

function swallowDayCloseDenial<T>(error: unknown, fallback: T): T {
  if (error instanceof FirebaseError && error.code === 'permission-denied') {
    dayCloseDenied = true;
    return fallback;
  }
  throw error;
}

export const PrincipalDayCloseService = {
  /** The close record for one business date, or null when the day is open
      (also null while the rules for this collection are undeployed). */
  get: (dateKey: string): Promise<PrincipalDayClose | null> =>
    runRead('the day-close record', async () => {
      try {
        const snap = await getDoc(dayCloseRef(dateKey));
        if (!snap.exists()) return null;
        return fromFirestore<PrincipalDayClose>(snap.data(), snap.id);
      } catch (error) {
        return swallowDayCloseDenial(error, null);
      }
    }),

  /** Every close for the year — the calendars and guards read this once. */
  listByYear: (year: string): Promise<PrincipalDayClose[]> =>
    runRead('the day-close records', async () => {
      try {
        const docs = await listDocs<PrincipalDayClose>(
          PRINCIPAL_COLLECTIONS.dayClose, where('academicYear', '==', year));
        return docs.sort((a, b) => (b.dateKey || '').localeCompare(a.dateKey || ''));
      } catch (error) {
        return swallowDayCloseDenial(error, [] as PrincipalDayClose[]);
      }
    }),

  /**
   * Close (or re-close after a reopen) one business date. The arithmetic is
   * recomputed here AND re-checked by firestore.rules, and the whole record
   * lands in the same batch as its audit entry. Whole rupees only — the
   * drawer is counted in notes and coins, not paisa.
   */
  close: (input: DayCloseInput, actor: PrincipalActor): Promise<void> =>
    runWrite(CANNOT_CLOSE_DAY, async () => {
      const expectedCash = Math.round(Number(input.expectedCash) || 0);
      const actualCash = Math.round(Number(input.actualCash) || 0);
      const { difference, assessment } = computeDayCloseAssessment(expectedCash, actualCash);

      const ref = dayCloseRef(input.dateKey);
      const existing = await getDoc(ref);
      const isReClose = existing.exists();

      const payload = sanitize({
        dateKey: input.dateKey,
        academicYear: input.academicYear,
        expectedCash,
        actualCash,
        difference,
        assessment,
        status: 'closed',
        note: input.note?.trim() || undefined,
        closedByUid: signedInUid(),
        closedByName: actor.name,
      });

      const differenceText = difference === 0
        ? 'matched'
        : `${assessment} by ₹${Math.abs(difference)}`;
      const batch = writeBatch(db);
      batch.set(ref, { ...payload, closedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      appendAudit(batch, {
        actor,
        action: isReClose ? 'update' : 'create',
        target: 'dayclose',
        targetId: input.dateKey,
        summary: `${isReClose ? 'Re-closed' : 'Closed'} ${input.dateKey} — counted ₹${actualCash} `
          + `against expected ₹${expectedCash} (${differenceText})`
          + (input.note?.trim() ? ` — ${input.note.trim()}` : ''),
        before: isReClose ? { ...existing.data() } : null,
        after: payload,
      });
      await batch.commit();
    }),

  /**
   * Reopen a closed date so a correction can be recorded — the §18 workflow
   * is reopen → correct → close again, every step audited. The count that was
   * standing stays on the record until the re-close overwrites it.
   */
  reopen: (dateKey: string, actor: PrincipalActor): Promise<void> =>
    runWrite(CANNOT_CLOSE_DAY, () => patchWithAudit(
      PRINCIPAL_COLLECTIONS.dayClose, 'dayclose', dateKey, { status: 'reopened' }, actor,
      () => ({ summary: `Reopened ${dateKey} for corrections — close it again when done` }),
    )),
};

/* ── Settings ─────────────────────────────────────────────────────────── */

const settingsRef = () => doc(db, PRINCIPAL_COLLECTIONS.settings, SETTINGS_DOC_ID);

export const PrincipalSettingsService = {
  get: (): Promise<PrincipalSettings | null> =>
    runRead('the register settings', async () => {
      const snap = await getDoc(settingsRef());
      if (!snap.exists()) return null;
      return fromFirestore<PrincipalSettings>(snap.data(), SETTINGS_DOC_ID);
    }),

  /** Merge-write (the doc may not exist yet) + audit entry, atomically. */
  save: (patch: Partial<PrincipalSettings>, actor: PrincipalActor): Promise<void> =>
    runWrite('Only the Principal can change the register settings.', async () => {
      const ref = settingsRef();
      const existing = await getDoc(ref);
      const payload = sanitize({ ...patch });
      const before = existing.exists()
        ? pickKeys(existing.data(), Object.keys(patch))
        : null;

      const batch = writeBatch(db);
      batch.set(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
      appendAudit(batch, {
        actor, action: existing.exists() ? 'update' : 'create',
        target: 'settings', targetId: SETTINGS_DOC_ID,
        summary: `Updated register settings — ${Object.keys(patch).join(', ') || 'no fields'}`,
        before, after: payload,
      });
      await batch.commit();
    }),
};

/* ── Audit log (read-only; write-once entries) ────────────────────────── */

export const PrincipalAuditService = {
  listRecent: (max: number = DEFAULT_AUDIT_LIMIT): Promise<PrincipalAuditEntry[]> =>
    runRead('the activity log', () => listDocs<PrincipalAuditEntry>(
      PRINCIPAL_COLLECTIONS.audit, orderBy('at', 'desc'), limitTo(max))),

  /**
   * Every entry for one record, newest first. Sorted in memory on purpose:
   * `where + orderBy` on different fields would demand a composite index.
   */
  listForTarget: (targetId: string): Promise<PrincipalAuditEntry[]> =>
    runRead('the activity log', async () => {
      const rows = await listDocs<PrincipalAuditEntry>(
        PRINCIPAL_COLLECTIONS.audit, where('targetId', '==', targetId));
      return rows.sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0));
    }),
};
