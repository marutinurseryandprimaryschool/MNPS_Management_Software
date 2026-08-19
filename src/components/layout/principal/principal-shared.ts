'use client';

/* ============================================
   CampusOS — Principal Register shared helpers
   ============================================
   Display helpers, the responsive breakpoint hook and the error-message
   mapping shared by every Principal Register screen.

   This module holds NO Firestore plumbing: `src/lib/principal-service.ts` is
   the only writer, and it already returns user-safe messages via
   `PrincipalServiceError`. Nothing here touches the legacy
   feePayments / feeStructures / expenses collections.
*/

import { useMemo, useSyncExternalStore, type CSSProperties } from 'react';
import { FirebaseError } from 'firebase/app';
import { useAuth } from '@/context/AuthContext';
import { PrincipalServiceError } from '@/lib/principal-service';
import { toDateKey } from '@/lib/fee-utils';
import type {
  PrincipalActor, PrincipalFeeHead, PrincipalPaymentMode,
} from '@/types/principal';

/* ── Responsive ───────────────────────────────────────────────────────── */

/**
 * Sharmi uses BOTH a phone and a PC. Below this width the register screens
 * MUST NOT render a horizontally scrolling spreadsheet — they switch to a
 * card-per-record layout instead.
 */
export const MOBILE_BREAKPOINT = 900;

const NARROW_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribeToWidth(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const media = window.matchMedia(NARROW_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/**
 * True on phone-width viewports. The SINGLE responsive switch for every
 * Principal Register screen — note, registers and accounts alike. Nothing
 * else may hard-code a width, or the two layouts drift apart.
 *
 * useSyncExternalStore keeps the static export honest: it hydrates with the
 * desktop snapshot and switches in the same commit, so there is no hydration
 * mismatch and no first-paint flash.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeToWidth,
    () => (typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(NARROW_QUERY).matches
      : false),
    () => false,
  );
}

/** Alias used by the register screens, which read better as "narrow". */
export const useIsNarrow = useIsMobile;

/* ── Actor ────────────────────────────────────────────────────────────── */

/**
 * Who is making the change — stamped on the doc AND on its audit entry.
 * Memoized so it is safe in a dependency array.
 */
export function usePrincipalActor(): PrincipalActor {
  const { user, role } = useAuth();
  return useMemo<PrincipalActor>(() => ({
    uid: user?.uid || user?.id || '',
    name: user?.name || 'Unknown user',
    role: role || 'unknown',
  }), [user?.uid, user?.id, user?.name, role]);
}

/* ── Error messages ───────────────────────────────────────────────────── */

/**
 * User-visible text for a failed mutation. `PrincipalServiceError` already
 * carries a role-specific, user-safe message (permission-denied → "… refresh
 * the app"; unavailable → "Connection lost — NOT saved, retry"), so it is
 * passed straight through. Never returns an empty string, never swallows.
 */
export function principalWriteError(error: unknown, fallback: string): string {
  if (error instanceof PrincipalServiceError) return error.message;
  if (error instanceof FirebaseError) {
    if (error.code === 'permission-denied') {
      return `${fallback} If your role changed recently, refresh the app.`;
    }
    if (error.code === 'unavailable') {
      return 'Connection lost — NOT saved. Check your internet and retry.';
    }
  }
  return 'Something went wrong — the change was NOT saved. Please retry.';
}

/** Read-failure variant. `subject` reads as "could not load {subject}". */
export function describeReadError(error: unknown, subject: string): string {
  if (error instanceof PrincipalServiceError) return error.message;
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

/**
 * Message for a write that COMMITTED but whose refetch failed. It must never
 * read as "not saved" — the user would retry and double-book the money.
 */
export function refreshFailedMessage(committedWhat: string): string {
  return `${committedWhat} — but the screen could not refresh. Reload the page to see the latest figures.`;
}

/* ── Labels ───────────────────────────────────────────────────────────── */

export const PRINCIPAL_MODE_LABELS: Record<PrincipalPaymentMode, string> = {
  cash: 'Cash',
  bank: 'Bank',
};

export const PRINCIPAL_HEAD_LABELS: Record<PrincipalFeeHead, string> = {
  school: 'School fee',
  eca: 'ECA fee',
  van: 'Van fee',
  other: 'Other',
};

/** Anything not explicitly 'bank' is cash — same rule as the ledger engine. */
export const modeLabel = (mode: string | null | undefined): string =>
  (mode === 'bank' ? PRINCIPAL_MODE_LABELS.bank : PRINCIPAL_MODE_LABELS.cash);

export const headLabel = (head: string | null | undefined): string =>
  PRINCIPAL_HEAD_LABELS[(head || 'other') as PrincipalFeeHead] ?? 'Other';

/** Seeded into `principalSettings.expenseCategories` on first save. */
export const DEFAULT_EXPENSE_CATEGORIES: readonly string[] = [
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

/* ── Formatting ───────────────────────────────────────────────────────── */

export const formatINR = (amount: number | null | undefined): string =>
  `₹${Math.round(Number(amount) || 0).toLocaleString('en-IN')}`;

/** Negative amounts render with a true minus sign, not a hyphen. */
export function formatSignedINR(amount: number | null | undefined): string {
  const value = Math.round(Number(amount) || 0);
  return `${value < 0 ? '−' : ''}${formatINR(Math.abs(value))}`;
}

export const todayKey = (): string => toDateKey(new Date());

export const currentMonthKey = (): string => todayKey().slice(0, 7);

/** 'yyyy-MM' → 'August 2026'. Falls back to the raw key if unparseable. */
export function monthKeyLabel(monthKey: string): string {
  const [year, month] = (monthKey || '').split('-').map(Number);
  if (!year || !month) return monthKey || '';
  return new Date(year, month - 1, 1)
    .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

/** 'yyyy-MM-dd' → 'Wed, 19 Aug 2026'. Falls back to the raw key. */
export function dateKeyLabel(dateKey: string): string {
  const [year, month, day] = (dateKey || '').split('-').map(Number);
  if (!year || !month || !day) return dateKey || '';
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

/* ── Shared inline styles (house style: inline objects + CSS vars) ────── */

export const surfaceCardStyle: CSSProperties = {
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border)',
  padding: 'var(--space-4)',
};

export const panelStyle: CSSProperties = {
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  overflow: 'hidden',
};

export const panelHeaderStyle: CSSProperties = {
  padding: 'var(--space-3) var(--space-4)',
  borderBottom: '1px solid var(--color-border)',
  background: 'var(--color-surface-variant)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-2)',
  flexWrap: 'wrap',
};

export const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '10px 16px',
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--color-text-tertiary)',
  borderBottom: '1px solid var(--color-border)',
  whiteSpace: 'nowrap',
};

export const tdStyle: CSSProperties = { padding: '10px 16px' };

export const iconButtonStyle: CSSProperties = {
  padding: 6,
  background: 'none',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  color: 'var(--color-text-secondary)',
};

export const pickerStyle: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
  fontSize: '0.9rem',
  outline: 'none',
  minWidth: 150,
};

/* Money colours — income green, expense red, used consistently everywhere. */
export const INCOME_COLOR = '#059669';
export const EXPENSE_COLOR = '#DC2626';
export const INCOME_BAR = '#10B981';
export const EXPENSE_BAR = '#EF4444';
