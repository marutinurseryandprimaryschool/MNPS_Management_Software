/* ============================================
   CampusOS — Principal module shared helpers
   ============================================
   Error policy (docs/designs/principal-role-fees-accounts.md, Addendum
   issue 1), offline guard, and the batched Firestore writes (mutation +
   history entry in ONE writeBatch) used by the Principal Accounts screens.
*/

import { FirebaseError } from 'firebase/app';
import { db } from '@/lib/firebase';
import {
  collection, doc, getDoc, getDocs, serverTimestamp, setDoc, writeBatch,
} from 'firebase/firestore';
import type { AccountsSettings, Expense } from '@/types/models';

/* ── Error policy ─────────────────────────────────────────────────────── */

/** Thrown by `assertOnline` so writes are surfaced as NOT saved (no silent queue). */
export class OfflineError extends Error {
  constructor(subject: string) {
    super(`Connection lost — ${subject} was NOT saved. Check your internet and retry.`);
    this.name = 'OfflineError';
  }
}

/** Rejects up-front when the browser is offline (writeBatch would queue silently). */
export function assertOnline(subject: string): void {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new OfflineError(subject);
  }
}

/**
 * Maps a Firestore write failure to the user-visible message required by the
 * error policy. `action` reads as "Only the Principal can {action}";
 * `subject` reads as "{subject} was NOT saved".
 */
export function describeWriteError(e: unknown, action: string, subject: string): string {
  if (e instanceof OfflineError) return e.message;
  if (e instanceof FirebaseError) {
    if (e.code === 'permission-denied') {
      return `Only the Principal can ${action}. If your role changed recently, refresh the app and sign in again.`;
    }
    if (e.code === 'unavailable') {
      return `Connection lost — ${subject} was NOT saved. Check your internet and retry.`;
    }
  }
  return `Something went wrong — ${subject} was NOT saved. Please retry.`;
}

/** Read-failure variant (dashboard loads, history views). */
export function describeReadError(e: unknown, subject: string): string {
  if (e instanceof FirebaseError) {
    if (e.code === 'permission-denied') {
      return `Only the Principal can view ${subject}. If your role changed recently, refresh the app.`;
    }
    if (e.code === 'unavailable') {
      return `Connection lost — could not load ${subject}. Check your internet and retry.`;
    }
  }
  return `Could not load ${subject}. Please retry.`;
}

/* ── Firestore write plumbing ─────────────────────────────────────────── */

export interface Actor {
  id: string;
  name: string;
  role: string;
}

/** Strips undefined values (Firestore rejects them) without mutating input. */
function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

export interface NewExpenseInput {
  amount: number;
  category: string;
  description: string;
  /** Local date key 'yyyy-MM-dd' (doubles as the legacy `date` field). */
  dateKey: string;
  paymentMode: 'cash' | 'bank';
  academicYear: string;
}

/**
 * Creates an expense + its write-once 'created' history entry in ONE
 * writeBatch (atomic — audit parity with payments, Addendum issue 5).
 */
export async function createExpenseWithHistory(input: NewExpenseInput, actor: Actor): Promise<string> {
  assertOnline('The expense');
  const batch = writeBatch(db);
  const expenseRef = doc(collection(db, 'expenses'));
  batch.set(expenseRef, {
    amount: input.amount,
    category: input.category,
    description: input.description,
    date: input.dateKey,
    dateKey: input.dateKey,
    paymentMode: input.paymentMode,
    addedById: actor.id,
    addedByName: actor.name,
    addedByRole: actor.role,
    academicYear: input.academicYear,
    deleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const historyRef = doc(collection(db, 'expenses', expenseRef.id, 'history'));
  batch.set(historyRef, {
    action: 'created',
    before: null,
    actorId: actor.id,
    actorName: actor.name,
    at: serverTimestamp(),
  });
  await batch.commit();
  return expenseRef.id;
}

/**
 * Soft-deletes an expense (`deleted: true`) + a 'deleted' history entry with
 * the before-snapshot, atomically. Hard deletes are denied by rules.
 */
export async function softDeleteExpenseWithHistory(expense: Expense, actor: Actor): Promise<void> {
  assertOnline('The deletion');
  const batch = writeBatch(db);
  const expenseRef = doc(db, 'expenses', expense.id);
  batch.update(expenseRef, { deleted: true, updatedAt: serverTimestamp() });
  const historyRef = doc(collection(db, 'expenses', expense.id, 'history'));
  const before = sanitize({ ...expense } as unknown as Record<string, unknown>);
  delete before.id; // the snapshot lives under the doc — no need to repeat the id
  batch.set(historyRef, {
    action: 'deleted',
    before,
    actorId: actor.id,
    actorName: actor.name,
    at: serverTimestamp(),
  });
  await batch.commit();
}

export interface ExpenseHistoryRow {
  id: string;
  action: string;
  actorName: string;
  at: Date | null;
  before: Record<string, unknown> | null;
}

/** Loads an expense's audit history (write-once entries), oldest first. */
export async function fetchExpenseHistory(expenseId: string): Promise<ExpenseHistoryRow[]> {
  const snap = await getDocs(collection(db, 'expenses', expenseId, 'history'));
  const rows = snap.docs.map(d => {
    const data = d.data();
    const at = data.at && typeof data.at.toDate === 'function' ? data.at.toDate() : null;
    return {
      id: d.id,
      action: String(data.action || ''),
      actorName: String(data.actorName || ''),
      at,
      before: (data.before as Record<string, unknown>) ?? null,
    };
  });
  return rows.sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0));
}

/* ── accounts/settings (opening balances) ─────────────────────────────── */

const ACCOUNTS_SETTINGS_REF = () => doc(db, 'accounts', 'settings');

export async function loadAccountsSettings(): Promise<AccountsSettings | null> {
  const snap = await getDoc(ACCOUNTS_SETTINGS_REF());
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    openingCash: Number(data.openingCash) || 0,
    openingBank: Number(data.openingBank) || 0,
    openingAsOf: typeof data.openingAsOf === 'string' ? data.openingAsOf : '',
  };
}

export async function saveAccountsSettings(settings: AccountsSettings): Promise<void> {
  assertOnline('Opening balances');
  await setDoc(ACCOUNTS_SETTINGS_REF(), {
    openingCash: settings.openingCash,
    openingBank: settings.openingBank,
    openingAsOf: settings.openingAsOf,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/* ── Display helpers ──────────────────────────────────────────────────── */

export const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  cheque: 'Cheque',
  bank_transfer: 'Bank Transfer',
};

export const EXPENSE_MODE_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank',
};

export const EXPENSE_CATEGORIES = [
  'Stationery',
  'Utilities',
  'Repairs & Maintenance',
  'Salary',
  'Transport',
  'Events',
  'Cleaning',
  'Food',
  'Other',
];
