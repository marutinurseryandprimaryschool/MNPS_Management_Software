/* ============================================
   /api/parent-login — handler logic with injected dependencies
   ============================================
   The HTTP entry point (../parent-login.ts) wires the real Firebase Admin
   SDK into `deps`; the unit tests wire fakes. Nothing here touches Firebase
   directly, so the enumeration/rate-limit/claims behaviour is testable.

   Two ways in, one response shape:
     { code, dob }  — Parent Login tab. Verifies the phone-suffix + DOB
                      against the student records SERVER-SIDE and mints a
                      Firebase custom token whose claims carry ONLY that
                      family's student ids.
     { idToken }    — a parent who used "Sign in with Google". Verifies the
                      Google ID token, matches its email to the student
                      records, and pins the same claims on that account.

   Failure responses are deliberately identical (status 401, same body) for
   "no such code", "wrong DOB" and "inactive student", so the endpoint does
   not confirm which 4-digit codes exist. */

import {
  applyRateLimit, matchStudents, parseLoginInput, siblingsOf, studentsByEmail,
  normalizeEmail, phoneKey, RATE_LIMIT,
  type AttemptWindow, type MatchableStudent, type ParentClaims,
} from '../../src/lib/parent-portal/core';

export interface LoginStudent extends MatchableStudent {
  name?: string;
  academicYear?: string;
}

export interface VerifiedIdToken {
  uid: string;
  email?: string;
  emailVerified: boolean;
}

export interface ParentLoginDeps {
  /** Active-year students (all fields the matcher needs). */
  loadStudents: () => Promise<LoginStudent[]>;
  /** Load + persist one rate-limit window atomically; returns the decision's allowed/retry. */
  consumeAttempt: (bucket: string, key: string, limit: number, now: number) => Promise<{ allowed: boolean; retryAfterSec: number }>;
  createCustomToken: (uid: string, claims: ParentClaims) => Promise<string>;
  verifyIdToken: (idToken: string) => Promise<VerifiedIdToken>;
  setParentClaims: (uid: string, claims: ParentClaims) => Promise<void>;
  /** Mirror the parent into users/{uid} so staff user lists still show them. */
  upsertParentUser: (uid: string, data: Record<string, unknown>) => Promise<void>;
  /** Stable, opaque uid for a code/DOB family (e.g. sha256 of the phone). */
  familyUid: (familyKey: string) => string;
  now: () => number;
  /** Small uniform delay so success and failure take about the same time. */
  settle: () => Promise<void>;
  log: (event: string, detail?: Record<string, unknown>) => void;
}

export interface LoginRequest {
  method: string;
  ip: string;
  body: unknown;
}

export interface LoginResponse {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

const INVALID: LoginResponse = {
  status: 401,
  body: { error: 'invalid_credentials', message: 'Invalid Login Code or Date of Birth. Please check and try again.' },
};

const tooMany = (retryAfterSec: number): LoginResponse => ({
  status: 429,
  headers: { 'Retry-After': String(retryAfterSec) },
  body: {
    error: 'too_many_attempts',
    retryAfterSec,
    message: `Too many login attempts. Please try again in ${Math.ceil(retryAfterSec / 60)} minute(s).`,
  },
});

const MAX_BODY_KEYS = 4;

export function createParentLoginHandler(deps: ParentLoginDeps) {
  return async function handle(req: LoginRequest): Promise<LoginResponse> {
    if (req.method !== 'POST') {
      return { status: 405, headers: { Allow: 'POST' }, body: { error: 'method_not_allowed' } };
    }
    const body = (req.body && typeof req.body === 'object') ? req.body as Record<string, unknown> : null;
    if (!body || Object.keys(body).length > MAX_BODY_KEYS) {
      return { status: 400, body: { error: 'bad_request' } };
    }
    const now = deps.now();

    // Per-IP budget covers both flows.
    const ipGate = await deps.consumeAttempt('ip', req.ip || 'unknown', RATE_LIMIT.perIp, now);
    if (!ipGate.allowed) {
      deps.log('parent_login.rate_limited_ip', { ip: req.ip });
      return tooMany(ipGate.retryAfterSec);
    }

    if (typeof body.idToken === 'string') return linkGoogleParent(deps, body.idToken, now);

    const input = parseLoginInput(body);
    if (!input) {
      // Malformed input is not an authentication attempt against a real
      // code, but it still costs the IP budget (consumed above) and gets
      // the same answer as a wrong password.
      await deps.settle();
      return INVALID;
    }

    // Per-code budget: the thing an attacker iterates DOBs against.
    const codeGate = await deps.consumeAttempt('code', input.code, RATE_LIMIT.perCode, now);
    if (!codeGate.allowed) {
      // The code itself is a phone suffix — not logged (data-minimisation).
      deps.log('parent_login.rate_limited_code', { ip: req.ip });
      return tooMany(codeGate.retryAfterSec);
    }

    const students = await deps.loadStudents();
    const { matched, family } = matchStudents(students, input);
    await deps.settle();
    if (!matched) {
      deps.log('parent_login.failed', { ip: req.ip });
      return INVALID;
    }

    const familyKey = phoneKey(matched.phone) || matched.id;
    const uid = deps.familyUid(familyKey);
    const claims: ParentClaims = { role: 'parent', studentIds: family.map(s => s.id) };
    const token = await deps.createCustomToken(uid, claims);
    await deps.setParentClaims(uid, claims);
    await deps.upsertParentUser(uid, {
      id: uid,
      uid,
      role: 'parent',
      name: parentDisplayName(family),
      phone: matched.phone || '',
      email: normalizeEmail(matched.email) || '',
      studentId: matched.id,
      studentIds: claims.studentIds,
      status: 'active',
      loginMethod: 'code',
    });
    deps.log('parent_login.ok', { uid, students: claims.studentIds.length });
    return { status: 200, body: { token, studentIds: claims.studentIds } };
  };
}

async function linkGoogleParent(deps: ParentLoginDeps, idToken: string, now: number): Promise<LoginResponse> {
  void now;
  let verified: VerifiedIdToken;
  try {
    verified = await deps.verifyIdToken(idToken);
  } catch {
    await deps.settle();
    return { status: 401, body: { error: 'invalid_token' } };
  }
  const email = normalizeEmail(verified.email);
  if (!email || !verified.emailVerified) {
    await deps.settle();
    return { status: 401, body: { error: 'not_registered' } };
  }
  const students = await deps.loadStudents();
  const byEmail = studentsByEmail(students, email);
  await deps.settle();
  if (byEmail.length === 0) {
    deps.log('parent_link.not_registered', { uid: verified.uid });
    return { status: 401, body: { error: 'not_registered' } };
  }
  // The email's students plus any sibling on the same phone as the first.
  const ids = new Set<string>();
  for (const s of byEmail) ids.add(s.id);
  for (const s of siblingsOf(students, byEmail[0])) ids.add(s.id);
  const claims: ParentClaims = { role: 'parent', studentIds: Array.from(ids) };
  await deps.setParentClaims(verified.uid, claims);
  await deps.upsertParentUser(verified.uid, {
    id: verified.uid,
    uid: verified.uid,
    role: 'parent',
    name: parentDisplayName(byEmail),
    email,
    phone: byEmail[0].phone || '',
    studentId: byEmail[0].id,
    studentIds: claims.studentIds,
    status: 'active',
    loginMethod: 'google',
  });
  deps.log('parent_link.ok', { uid: verified.uid, students: claims.studentIds.length });
  return { status: 200, body: { linked: true, studentIds: claims.studentIds } };
}

function parentDisplayName(family: LoginStudent[]): string {
  const first = family[0]?.name?.trim();
  return first ? `Parent of ${first}` : 'Parent';
}

/** Firestore-backed window update, shared by the real handler. Pure given a loader/saver. */
export async function consumeWindow(
  load: () => Promise<AttemptWindow | null>,
  save: (next: AttemptWindow) => Promise<void>,
  limit: number,
  now: number,
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const decision = applyRateLimit(await load(), limit, now);
  if (decision.allowed) await save(decision.next);
  return { allowed: decision.allowed, retryAfterSec: decision.retryAfterSec };
}
