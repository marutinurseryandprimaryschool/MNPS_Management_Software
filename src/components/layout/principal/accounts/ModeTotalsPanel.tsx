'use client';

/* ============================================
   Principal Accounts — money by payment channel (Phase 2 §14)
   ============================================
   Cash / GPay-UPI / Bank / Other, each with what came IN, what went OUT and
   what is left. Every figure arrives already computed by computeModeTotals()
   — nothing is re-added here, so this panel can never disagree with the day
   sheet or the month sheet it sits next to.

   BALANCE MAPPING NOTE (Phase 1 decision, unchanged): only 'cash' moves Cash
   in Hand; upi/bank/other all land in Bank Balance. This panel reports the
   four CHANNELS separately, which is a different question from where the two
   balances sit — the footnote on the panel says so, so nobody reads
   "GPay available" as a third balance.
*/

import React from 'react';
import {
  EXPENSE_COLOR, INCOME_COLOR, PRINCIPAL_MODE_LABELS, formatINR, formatSignedINR,
  panelHeaderStyle, panelStyle,
} from '../principal-shared';
import type { ModeTotals } from '@/types/principal';

/** Accent per channel, so the four cards stay distinguishable at a glance. */
const MODE_ACCENT: Record<string, string> = {
  cash: '#059669',
  upi: '#7C3AED',
  bank: '#2563EB',
  other: '#6B7280',
};

export default function ModeTotalsPanel({ totals, title, note }: {
  totals: ModeTotals;
  title: string;
  note?: string;
}) {
  return (
    <div style={panelStyle}>
      <div style={panelHeaderStyle}>
        <span className="text-overline">{title}</span>
        <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
          {formatINR(totals.collected)} in · {formatINR(totals.spent)} out
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 'var(--space-3)',
        padding: 'var(--space-3)',
      }}>
        {totals.rows.map(row => (
          <div
            key={row.mode}
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3)',
              borderTop: `3px solid ${MODE_ACCENT[row.mode] ?? 'var(--color-border)'}`,
              minWidth: 0,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 'var(--space-2)' }}>
              {PRINCIPAL_MODE_LABELS[row.mode]}
            </div>

            <Line label="Collected" value={formatINR(row.collected)} color={INCOME_COLOR} />
            <Line label="Expenses" value={formatINR(row.spent)} color={EXPENSE_COLOR} />

            <div style={{
              display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)',
              paddingTop: 'var(--space-2)', marginTop: 4,
              borderTop: '1px solid var(--color-divider)',
            }}>
              <span className="text-body-sm" style={{ fontWeight: 700 }}>Available</span>
              <span
                className="text-body-sm"
                style={{ fontWeight: 700, color: row.net >= 0 ? INCOME_COLOR : EXPENSE_COLOR }}
              >
                {formatSignedINR(row.net)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        padding: '0 var(--space-3) var(--space-3)',
        font: 'var(--text-caption)', color: 'var(--color-text-tertiary)',
      }}>
        {note ?? 'Money that moved through each channel in this period. Cash in Hand counts '
          + 'physical cash only — GPay / UPI, Bank and Other all settle into the bank balance.'}
      </div>
    </div>
  );
}

function Line({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)',
      padding: '3px 0',
    }}>
      <span className="text-body-sm" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span className="text-body-sm" style={{ fontWeight: 600, color }}>{value}</span>
    </div>
  );
}
