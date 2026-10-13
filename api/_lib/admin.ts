/* Firebase Admin SDK bootstrap for the Vercel functions.

   FIREBASE_SERVICE_ACCOUNT holds the service-account JSON (raw or base64).
   It is a full-access credential: it lives ONLY in Vercel's environment
   variables, never in the repo, never in the browser bundle. */

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let app: App | null = null;

function loadServiceAccount(): Record<string, string> {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const parsed = JSON.parse(text) as Record<string, string>;
  if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is missing project_id / private_key / client_email');
  }
  return parsed;
}

export function adminApp(): App {
  if (app) return app;
  if (getApps().length) { app = getApps()[0]; return app; }
  const sa = loadServiceAccount();
  app = initializeApp({ credential: cert(sa), projectId: sa.project_id });
  return app;
}

export const adminAuth = () => getAuth(adminApp());
export const adminDb = () => getFirestore(adminApp());
