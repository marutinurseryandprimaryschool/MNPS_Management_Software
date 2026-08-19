'use client';

/* ============================================
   Principal Register — shared presentation primitives
   ============================================
   Sharmi works on BOTH a phone and a PC, so every register screen renders
   two layouts off the SAME data and the SAME service calls:
     - >= 900px : a data grid with a frozen student column
     - <  900px : one card per student, no horizontal scrolling anywhere
   `useIsNarrow` is the single switch; nothing else may hard-code a width.
*/

import React from 'react';
import Button from '@/components/ui/Button';
import { inr } from './register-shared';

/* The responsive switch lives in ONE place for the whole Principal Register
   (`principal-shared`), so the note, register and accounts screens can never
   disagree about where the phone layout starts. Re-exported here because the
   register screens import their primitives from this module. */
export { MOBILE_BREAKPOINT, useIsNarrow } from '../principal-shared';

/* ── Blocks ───────────────────────────────────────────────────────────── */

export const surfaceCard: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
};

export function LoadingBlock({ label = 'Loading...' }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
      <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>{label}</span>
    </div>
  );
}

export function ErrorBlock({ title, message, onRetry }: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div style={{ ...surfaceCard, padding: 'var(--space-8)', textAlign: 'center' }}>
      <p className="text-body" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>{title}</p>
      <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>{message}</p>
      {onRetry && <Button variant="primary" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function EmptyBlock({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ ...surfaceCard, padding: 'var(--space-8)', textAlign: 'center' }}>
      <p className="text-body" style={{ fontWeight: 600 }}>{title}</p>
      {hint && <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>{hint}</p>}
    </div>
  );
}

export type NoticeTone = 'info' | 'warning' | 'success' | 'error';

const NOTICE_COLORS: Record<NoticeTone, { bg: string; fg: string }> = {
  info: { bg: 'var(--color-info-bg)', fg: 'var(--color-info-text)' },
  warning: { bg: 'var(--color-warning-bg)', fg: 'var(--color-warning-text)' },
  success: { bg: 'var(--color-success-bg)', fg: 'var(--color-success-text)' },
  error: { bg: 'var(--color-error-bg)', fg: 'var(--color-error-text)' },
};

export function NoticeBanner({ tone = 'info', children }: {
  tone?: NoticeTone;
  children: React.ReactNode;
}) {
  const colors = NOTICE_COLORS[tone];
  return (
    <div style={{
      padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-3)',
      borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 500,
      background: colors.bg, color: colors.fg,
    }}>
      {children}
    </div>
  );
}

/* ── Numbers ──────────────────────────────────────────────────────────── */

export type StatTone = 'neutral' | 'paid' | 'pending' | 'due';

const STAT_COLORS: Record<StatTone, string> = {
  neutral: 'var(--color-text-primary)',
  paid: 'var(--color-success)',
  pending: 'var(--color-warning)',
  due: 'var(--color-error)',
};

export const statColor = (tone: StatTone): string => STAT_COLORS[tone];

export interface Stat {
  label: string;
  value: string;
  tone?: StatTone;
}

/**
 * The summary numbers on every group header and student card. Auto-fits to two
 * columns on a phone and spreads out on a PC — it never scrolls sideways.
 */
export function StatGrid({ stats, compact = false }: { stats: Stat[]; compact?: boolean }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(${compact ? 88 : 108}px, 1fr))`,
      gap: 'var(--space-2)',
      width: '100%',
    }}>
      {stats.map(stat => (
        <div key={stat.label}>
          <div style={{
            fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.04em', color: 'var(--color-text-tertiary)',
          }}>
            {stat.label}
          </div>
          <div style={{
            fontSize: compact ? '0.85rem' : '0.95rem', fontWeight: 700,
            color: statColor(stat.tone ?? 'neutral'),
          }}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Money, or an em dash when there is nothing to show. */
export function Money({ amount, tone = 'neutral', bold = false }: {
  amount: number;
  tone?: StatTone;
  bold?: boolean;
}) {
  if (!amount) return <span style={{ color: 'var(--color-text-tertiary)' }}>&mdash;</span>;
  return <span style={{ color: statColor(tone), fontWeight: bold ? 700 : 500 }}>{inr(amount)}</span>;
}

export function Chip({ label, tone = 'neutral', title }: {
  label: string;
  tone?: StatTone;
  title?: string;
}) {
  const background = tone === 'due' ? 'var(--color-error-bg)'
    : tone === 'pending' ? 'var(--color-warning-bg)'
      : tone === 'paid' ? 'var(--color-success-bg)'
        : 'var(--color-surface-variant)';
  return (
    <span
      title={title}
      style={{
        display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius-full)',
        fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap',
        color: statColor(tone), background,
      }}
    >
      {label}
    </span>
  );
}

/* ── Table styles (desktop grid only) ─────────────────────────────────── */

/** The scroll container. Only the grid scrolls — never the page body. */
export const tableScroll: React.CSSProperties = { overflowX: 'auto', width: '100%' };

export const table: React.CSSProperties = {
  width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.85rem',
};

export const th: React.CSSProperties = {
  textAlign: 'left', padding: '8px 12px', whiteSpace: 'nowrap',
  fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
  color: 'var(--color-text-tertiary)', background: 'var(--color-surface-variant)',
  borderBottom: '1px solid var(--color-border)',
};
export const thRight: React.CSSProperties = { ...th, textAlign: 'right' };

/** Frozen student-name header cell. */
export const thSticky: React.CSSProperties = {
  ...th, position: 'sticky', left: 0, zIndex: 3,
  borderRight: '1px solid var(--color-border)',
};

export const td: React.CSSProperties = {
  padding: '8px 12px', borderTop: '1px solid var(--color-divider)', verticalAlign: 'middle',
};
export const tdRight: React.CSSProperties = { ...td, textAlign: 'right', whiteSpace: 'nowrap' };

/** Frozen student-name body cell — opaque so the grid slides under it. */
export const tdSticky: React.CSSProperties = {
  ...td, position: 'sticky', left: 0, zIndex: 2, fontWeight: 600,
  background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)',
  minWidth: 160, maxWidth: 220,
};
