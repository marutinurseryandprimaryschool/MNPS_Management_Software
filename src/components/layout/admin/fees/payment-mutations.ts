/* Payment mutations with audit trail
   (docs/designs/principal-role-fees-accounts.md, scope item 7 / Addendum 1).

   Every mutation pairs the payment write with a write-once history entry in
   feePayments/{id}/history inside ONE writeBatch, so the pair is atomic.
   Deletes are soft (`deleted: true`) — hard deletes are denied by rules. */

import { db } from '@/lib/firebase';
import {
  collection, doc, getDocs, orderBy, query, serverTimestamp, Timestamp, writeBatch,
} from 'firebase/firestore';
import { coerceDate } from '@/lib/fee-utils';
import type { FeePayment } from '@/types/models';

export interface MutationActor {
  id: string;
  name: string;
}

/** History entry as read back for the per-payment history view. */
export interface PaymentHistoryView {
  id: string;
  action: 'created' | 'edited' | 'deleted';
  before: Partial<FeePayment> | null;
  actorId: string;
  actorName: string;
  at: Date | null;
}

/* ── Serialization ────────────────────────────────────────────────────── */

/** Drops undefined values and converts Dates → Timestamps, recursively. */
function sanitizeForWrite(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (Array.isArray(value)) return value.map(v => sanitizeForWrite(v) ?? null);
  if (value !== null && typeof value === 'object' && value.constructor === Object) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const sanitized = sanitizeForWrite(v);
      if (sanitized !== undefined) out[k] = sanitized;
    }
    return out;
  }
  return value;
}

function sanitizeRecord(data: Record<string, unknown>): Record<string, unknown> {
  return sanitizeForWrite(data) as Record<string, unknown>;
}

/** Before-snapshot of a payment for the audit trail (id excluded). */
function paymentSnapshot(p: FeePayment): Record<string, unknown> {
  return sanitizeRecord({
    studentId: p.studentId,
    studentName: p.studentName,
    classId: p.classId,
    className: p.className,
    sectionId: p.sectionId,
    sectionName: p.sectionName,
    amount: p.amount,
    mode: p.mode,
    category: p.category,
    referenceNumber: p.referenceNumber,
    receiptNumber: p.receiptNumber,
    paidAt: p.paidAt,
    dateKey: p.dateKey,
    academicYear: p.academicYear,
    deleted: p.deleted,
    collectedBy: p.collectedBy,
    collectedByName: p.collectedByName,
  });
}

function historyEntry(
  action: 'created' | 'edited' | 'deleted',
  before: Record<string, unknown> | null,
  actor: MutationActor,
): Record<string, unknown> {
  return {
    action,
    before,
    actorId: actor.id,
    actorName: actor.name,
    at: serverTimestamp(),
  };
}

/* ── Mutations (payment + history in ONE batch) ───────────────────────── */

/** Creates a payment plus its 'created' history entry atomically. */
export async function recordPaymentWithHistory(
  payment: Record<string, unknown>,
  actor: MutationActor,
): Promise<string> {
  const paymentRef = doc(collection(db, 'feePayments'));
  const historyRef = doc(collection(db, 'feePayments', paymentRef.id, 'history'));
  const batch = writeBatch(db);
  batch.set(paymentRef, {
    ...sanitizeRecord(payment),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(historyRef, historyEntry('created', null, actor));
  await batch.commit();
  return paymentRef.id;
}

/** Applies edits plus an 'edited' history entry (before-snapshot) atomically. */
export async function editPaymentWithHistory(
  before: FeePayment,
  updates: Record<string, unknown>,
  actor: MutationActor,
): Promise<void> {
  const paymentRef = doc(db, 'feePayments', before.id);
  const historyRef = doc(collection(db, 'feePayments', before.id, 'history'));
  const batch = writeBatch(db);
  batch.update(paymentRef, {
    ...sanitizeRecord(updates),
    updatedAt: serverTimestamp(),
  });
  batch.set(historyRef, historyEntry('edited', paymentSnapshot(before), actor));
  await batch.commit();
}

/** Soft delete (`deleted: true`) plus a 'deleted' history entry atomically. */
export async function softDeletePaymentWithHistory(
  before: FeePayment,
  actor: MutationActor,
): Promise<void> {
  const paymentRef = doc(db, 'feePayments', before.id);
  const historyRef = doc(collection(db, 'feePayments', before.id, 'history'));
  const batch = writeBatch(db);
  batch.update(paymentRef, { deleted: true, updatedAt: serverTimestamp() });
  batch.set(historyRef, historyEntry('deleted', paymentSnapshot(before), actor));
  await batch.commit();
}

/* ── History read (per-payment drawer) ────────────────────────────────── */

export async function fetchPaymentHistory(paymentId: string): Promise<PaymentHistoryView[]> {
  const historyQuery = query(
    collection(db, 'feePayments', paymentId, 'history'),
    orderBy('at', 'desc'),
  );
  const snap = await getDocs(historyQuery);
  return snap.docs.map(d => {
    const data = d.data();
    const before = data.before
      ? ({ ...data.before, paidAt: coerceDate(data.before.paidAt) ?? undefined } as Partial<FeePayment>)
      : null;
    return {
      id: d.id,
      action: (data.action as PaymentHistoryView['action']) || 'edited',
      before,
      actorId: String(data.actorId || ''),
      actorName: String(data.actorName || 'Unknown'),
      at: coerceDate(data.at),
    };
  });
}
