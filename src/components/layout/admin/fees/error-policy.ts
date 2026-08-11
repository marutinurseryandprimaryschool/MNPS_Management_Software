/* Error policy for fee-module Firestore writes
   (docs/designs/principal-role-fees-accounts.md, Addendum issue 1):
   - permission-denied → role-specific message + "refresh the app" hint
   - unavailable / offline → "Connection lost — NOT saved, retry"
   - anything else → generic failure, context logged by the caller
   NEVER silent catches; success AND failure surface as toasts. */

import { FirebaseError } from 'firebase/app';

export const OFFLINE_NOT_SAVED_MESSAGE =
  'Connection lost — NOT saved. Check your internet and retry.';

/** True when the browser reports no network — writes must be refused loudly. */
export function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Post-commit refetch guard. Call ONLY after the Firestore write has
 * committed: a refetch failure here must never surface as "NOT saved" —
 * the user would retry and create a real duplicate. Never throws.
 * Returns true when the refetch succeeded.
 */
export async function refreshAfterWrite(refetch: () => Promise<void>): Promise<boolean> {
  try {
    await refetch();
    return true;
  } catch (e) {
    console.error('Post-commit refresh failed', e);
    return false;
  }
}

/**
 * Toast text for a committed write whose post-save refetch failed.
 * `committedWhat` states what DID land, e.g. "Payment saved".
 */
export function refreshFailedMessage(committedWhat: string): string {
  return `${committedWhat} — but the list could not refresh. Reload the page to see the latest data.`;
}

/**
 * Maps a Firestore write failure to the user-visible message.
 * `permissionMessage` is the role-specific denial text, e.g.
 * "Only the Principal can record fee payments."
 */
export function describeWriteError(error: unknown, permissionMessage: string): string {
  if (error instanceof FirebaseError) {
    if (error.code === 'permission-denied') {
      return `${permissionMessage} If your role changed recently, refresh the app.`;
    }
    if (error.code === 'unavailable') {
      return OFFLINE_NOT_SAVED_MESSAGE;
    }
  }
  return 'Something went wrong — the change was NOT saved. Please retry.';
}
