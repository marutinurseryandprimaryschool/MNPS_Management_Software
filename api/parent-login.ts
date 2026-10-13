/* POST /api/parent-login
   Body { code, dob } → { token, studentIds }        (Parent Login tab)
   Body { idToken }   → { linked, studentIds }       (Google-signed-in parent)
   See _lib/parent-login-core.ts for the behaviour and tests/parent-login.test.ts. */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from './_lib/admin';
import { clientIp, jsonBody, logEvent, send, settle, sha256 } from './_lib/http';
import { consumeWindow, createParentLoginHandler, type LoginStudent } from './_lib/parent-login-core';
import type { AttemptWindow } from '../src/lib/parent-portal/core';

const ATTEMPTS = 'parentLoginAttempts';

async function loadStudents(): Promise<LoginStudent[]> {
  // All students, like the original browser login. Year rollover updates the
  // same student document, so there are no per-year duplicates to confuse the
  // match, and records whose academicYear tag lags the school year still log in.
  const snap = await adminDb().collection('students').get();
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name as string | undefined,
      phone: data.phone as string | undefined,
      email: data.email as string | undefined,
      dob: data.dob,
      status: data.status as string | undefined,
      academicYear: data.academicYear as string | undefined,
    };
  });
}

const handler = createParentLoginHandler({
  loadStudents,
  consumeAttempt: async (bucket, key, limit, now) => {
    const ref = adminDb().collection(ATTEMPTS).doc(`${bucket}_${sha256(key)}`);
    return adminDb().runTransaction(tx => consumeWindow(
      async () => {
        const snap = await tx.get(ref);
        return snap.exists ? (snap.data() as AttemptWindow) : null;
      },
      async next => { tx.set(ref, { ...next, bucket, updatedAt: FieldValue.serverTimestamp() }); },
      limit,
      now,
    ));
  },
  createCustomToken: (uid, claims) => adminAuth().createCustomToken(uid, claims),
  verifyIdToken: async idToken => {
    const t = await adminAuth().verifyIdToken(idToken, true);
    return { uid: t.uid, email: t.email, emailVerified: t.email_verified === true };
  },
  setParentClaims: async (uid, claims) => {
    // A first-time code/DOB parent has no Auth user yet: the custom token
    // only creates it when the browser signs in. Create it first, otherwise
    // setCustomUserClaims fails with auth/user-not-found (HTTP 500).
    try {
      await adminAuth().setCustomUserClaims(uid, claims);
    } catch (err) {
      if ((err as { code?: string }).code !== 'auth/user-not-found') throw err;
      try {
        await adminAuth().createUser({ uid });
      } catch (createErr) {
        // Two parallel first logins: the other request created it already.
        if ((createErr as { code?: string }).code !== 'auth/uid-already-exists') throw createErr;
      }
      await adminAuth().setCustomUserClaims(uid, claims);
    }
  },
  upsertParentUser: async (uid, data) => {
    await adminDb().doc(`users/${uid}`).set(
      { ...data, updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  },
  familyUid: familyKey => `parent_${sha256(`family:${familyKey}`).slice(0, 28)}`,
  now: () => Date.now(),
  settle,
  log: logEvent,
});

export default async function parentLogin(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const out = await handler({ method: req.method || 'GET', ip: clientIp(req), body: jsonBody(req) });
    send(res, out.status, out.body, out.headers);
  } catch (err) {
    logEvent('parent_login.error', { message: (err as Error)?.message });
    send(res, 500, { error: 'server_error' });
  }
}
