/* ============================================
   CampusOS — Parent portal API client
   ============================================
   The ONLY data path for the parent role. Parents never query Firestore
   from the browser: firestore.rules denies them, and these two endpoints
   return just their own child's records (see api/parent-data.ts). */

import { auth } from './firebase';
import type { ParentDataView } from './parent-portal/core';

export class ParentApiError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfterSec = 0) {
    super(message);
    this.name = 'ParentApiError';
  }
}

async function readError(res: Response): Promise<ParentApiError> {
  let body: { error?: string; message?: string; retryAfterSec?: number } = {};
  try { body = await res.json(); } catch { /* non-JSON error page */ }
  const fallback = res.status === 429
    ? 'Too many login attempts. Please wait a few minutes and try again.'
    : res.status >= 500
      ? 'The school server is not responding. Please try again in a moment.'
      : 'Request failed.';
  return new ParentApiError(res.status, body.error || 'error', body.message || fallback, body.retryAfterSec || 0);
}

export async function parentLogin(code: string, dob: string): Promise<{ token: string; studentIds: string[] }> {
  const res = await fetch('/api/parent-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, dob }),
  });
  if (!res.ok) throw await readError(res);
  return res.json();
}

export async function linkGoogleParent(idToken: string): Promise<{ linked: boolean; studentIds: string[] }> {
  const res = await fetch('/api/parent-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw await readError(res);
  return res.json();
}

const DATE_KEYS = new Set([
  'dob', 'createdAt', 'updatedAt', 'dueDate', 'submittedAt', 'editedAt',
  'effectiveFrom', 'paidAt', 'dateOfJoining', 'publishedAt',
]);

/** Turn the ISO strings the API sends back into Dates where the UI expects Dates. */
function reviveDates<T>(value: T): T {
  if (Array.isArray(value)) return value.map(reviveDates) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = DATE_KEYS.has(k) && typeof v === 'string' ? new Date(v) : reviveDates(v);
    }
    return out as T;
  }
  return value;
}

export async function parentData<T = Record<string, unknown>>(view: ParentDataView, studentId?: string): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new ParentApiError(401, 'unauthenticated', 'Please sign in again.');
  const idToken = await user.getIdToken();
  const params = new URLSearchParams({ view });
  if (studentId) params.set('studentId', studentId);
  const res = await fetch(`/api/parent-data?${params}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw await readError(res);
  const { data } = await res.json();
  return reviveDates(data) as T;
}
