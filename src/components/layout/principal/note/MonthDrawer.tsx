'use client';

/* ============================================
   Fees Note — month drawer
   ============================================
   Expanding a student shows the ECA and van schedules month by month. The
   PAID / DUE / Upcoming state is the engine's verdict, never re-derived here:
   in August only June and July come back DUE, and the rest of the year reads
   "Upcoming" — Sharmi's exact complaint, answered on screen.

   Tapping a month opens "Record payment" prefilled with that month's pending
   amount. Desktop lays the months out as a chip grid; mobile stacks them as
   list rows, because a phone must never scroll a schedule sideways.
*/

import React from 'react';
import { formatINR } from '../principal-shared';
import {
  MONTH_STATE_LABELS, MONTH_STATE_THEME, monthState,
  type PaymentPrefill,
} from './note-helpers';
import type { MonthCell, MonthlyHeadSummary, PrincipalFeeHead } from '@/types/principal';

interface MonthDrawerProps {
  eca: MonthlyHeadSummary;
  van: MonthlyHeadSummary;
  isMobile: boolean;
  canRecord: boolean;
  onRecord: (prefill: PaymentPrefill) => void;
}

interface HeadSectionProps {
  title: string;
  head: Extract<PrincipalFeeHead, 'eca' | 'van'>;
  summary: MonthlyHeadSummary;
  emptyHint: string;
  isMobile: boolean;
  canRecord: boolean;
  onRecord: (prefill: PaymentPrefill) => void;
}

const hintStyle: React.CSSProperties = {
  font: 'var(--text-body-sm)',
  color: 'var(--color-text-tertiary)',
};

function MonthChip({
  cell, head, isMobile, canRecord, onRecord,
}: {
  cell: MonthCell;
  head: 'eca' | 'van';
  isMobile: boolean;
  canRecord: boolean;
  onRecord: (prefill: PaymentPrefill) => void;
}) {
  const state = monthState(cell);
  const theme = MONTH_STATE_THEME[state];
  const settled = cell.pending <= 0 || cell.amount <= 0;
  const clickable = canRecord && !settled;

  const body = (
    <>
      <span style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 'var(--space-2)', width: '100%',
      }}>
        <span style={{ font: 'var(--text-body-sm)', fontWeight: 600 }}>{cell.month}</span>
        <span style={{
          font: 'var(--text-overline)', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          {MONTH_STATE_LABELS[state]}
        </span>
      </span>
      <span style={{ font: 'var(--text-caption)', opacity: 0.9 }}>
        {formatINR(cell.amount)}
        {cell.paid > 0 && ` · paid ${formatINR(cell.paid)}`}
        {cell.pending > 0 && cell.amount > 0 && ` · left ${formatINR(cell.pending)}`}
      </span>
    </>
  );

  const shared: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
    padding: '8px 10px',
    borderRadius: 'var(--radius-md)',
    background: theme.bg,
    color: theme.color,
    border: `1px solid ${theme.border}`,
    textAlign: 'left',
    width: isMobile ? '100%' : undefined,
    minWidth: isMobile ? undefined : 170,
  };

  if (!clickable) {
    return <div style={shared}>{body}</div>;
  }

  return (
    <button
      type="button"
      style={{ ...shared, cursor: 'pointer' }}
      onClick={() => onRecord({ head, month: cell.month, amount: cell.pending })}
      aria-label={`Record ${cell.month} ${head === 'eca' ? 'ECA' : 'van'} payment of ${formatINR(cell.pending)}`}
    >
      {body}
    </button>
  );
}

function HeadSection({
  title, head, summary, emptyHint, isMobile, canRecord, onRecord,
}: HeadSectionProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', flexWrap: 'wrap',
      }}>
        <span style={{ font: 'var(--text-heading-3)' }}>{title}</span>
        <span style={hintStyle}>
          {formatINR(summary.charged)} charged · {formatINR(summary.paid)} paid
          {summary.dueNow > 0 && (
            <strong style={{ color: 'var(--color-error)' }}> · {formatINR(summary.dueNow)} due now</strong>
          )}
        </span>
      </div>

      {summary.months.length === 0 ? (
        <span style={hintStyle}>{emptyHint}</span>
      ) : (
        <div style={{
          display: isMobile ? 'flex' : 'grid',
          flexDirection: isMobile ? 'column' : undefined,
          gridTemplateColumns: isMobile ? undefined : 'repeat(auto-fill, minmax(170px, 1fr))',
          gap: 'var(--space-2)',
        }}>
          {summary.months.map(cell => (
            <MonthChip
              key={cell.month}
              cell={cell}
              head={head}
              isMobile={isMobile}
              canRecord={canRecord}
              onRecord={onRecord}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MonthDrawer({
  eca, van, isMobile, canRecord, onRecord,
}: MonthDrawerProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)',
      padding: 'var(--space-3)',
      background: 'var(--color-surface-dim)',
      borderRadius: 'var(--radius-md)',
    }}>
      <HeadSection
        title="ECA — month by month"
        head="eca"
        summary={eca}
        emptyHint="No ECA fee set for this student."
        isMobile={isMobile}
        canRecord={canRecord}
        onRecord={onRecord}
      />
      <HeadSection
        title="Van — month by month"
        head="van"
        summary={van}
        emptyHint="This student does not take the van."
        isMobile={isMobile}
        canRecord={canRecord}
        onRecord={onRecord}
      />
      {canRecord && (
        <span style={hintStyle}>
          Tap a month that is still owed to record that payment.
        </span>
      )}
    </div>
  );
}
