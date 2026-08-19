'use client';

/* ============================================
   Principal Accounts — presentational building blocks
   ============================================
   Every list on the Accounts screens is the SAME data in two presentations:
   a table on desktop (>= 900px) and a card per record on the phone. Nothing
   here fetches or computes — the ledger numbers arrive already computed by
   src/lib/principal-fees.ts.
*/

import React from 'react';
import {
  EXPENSE_COLOR, INCOME_COLOR, formatINR, formatSignedINR,
  panelHeaderStyle, panelStyle, tdStyle, thStyle, useIsMobile,
} from '../principal-shared';

/* ── Balance / total cards ────────────────────────────────────────────── */

export function BalanceCard({ label, amount, gradient, note }: {
  label: string;
  amount: number;
  gradient: string;
  note: string;
}) {
  return (
    <div style={{
      background: gradient, borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-5)', color: 'white', minWidth: 0,
    }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 500, opacity: 0.85, marginBottom: 'var(--space-2)' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, wordBreak: 'break-word' }}>
        {formatINR(amount)}
      </div>
      <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: 4 }}>{note}</div>
    </div>
  );
}

/** Income or expense for a period, split Cash / Bank with its own total. */
export function FlowCard({ title, cash, bank, accent }: {
  title: string;
  cash: number;
  bank: number;
  accent: string;
}) {
  const rows: [string, number][] = [['Cash', cash], ['Bank', bank]];
  return (
    <div style={{
      background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--color-border)', padding: 'var(--space-4)', minWidth: 0,
    }}>
      <div className="text-overline" style={{ marginBottom: 'var(--space-3)' }}>{title}</div>
      {rows.map(([label, amount]) => (
        <div
          key={label}
          style={{
            display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)',
            padding: '5px 0', borderBottom: '1px solid var(--color-divider)',
          }}
        >
          <span className="text-body-sm">{label}</span>
          <span className="text-body-sm" style={{ fontWeight: 600 }}>{formatINR(amount)}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', paddingTop: 'var(--space-2)', marginTop: 4 }}>
        <span className="text-body" style={{ fontWeight: 700 }}>Total</span>
        <span className="text-body" style={{ fontWeight: 700, color: accent }}>{formatINR(cash + bank)}</span>
      </div>
    </div>
  );
}

/* ── Tally line ───────────────────────────────────────────────────────── */

/**
 * The arithmetic, spelled out: income − expense = net, and whether the
 * itemised list adds up to the totals on the cards. `listedIncome` /
 * `listedExpense` are the sums of the rows actually shown below; when they
 * disagree with the ledger the sheet says so instead of quietly differing.
 */
export function TallyLine({ income, expense, listedIncome, listedExpense, periodLabel }: {
  income: number;
  expense: number;
  listedIncome: number;
  listedExpense: number;
  periodLabel: string;
}) {
  const net = income - expense;
  const tallied = Math.round(listedIncome) === Math.round(income)
    && Math.round(listedExpense) === Math.round(expense);

  return (
    <div style={{
      background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-md)',
      border: '1px solid var(--color-border)', padding: 'var(--space-3) var(--space-4)',
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2) var(--space-3)',
    }}>
      <span className="text-body-sm" style={{ fontWeight: 600 }}>Tally for {periodLabel}:</span>
      <span className="text-body-sm">
        income <strong style={{ color: INCOME_COLOR }}>{formatINR(income)}</strong>
        {' − '}
        expense <strong style={{ color: EXPENSE_COLOR }}>{formatINR(expense)}</strong>
        {' = '}
        <strong style={{ color: net >= 0 ? INCOME_COLOR : EXPENSE_COLOR }}>{formatSignedINR(net)}</strong>
      </span>
      <span
        className="text-caption"
        style={{
          marginLeft: 'auto', fontWeight: 700,
          color: tallied ? INCOME_COLOR : EXPENSE_COLOR,
        }}
      >
        {tallied
          ? '✓ Entries below add up to these totals'
          : `Mismatch — entries below add to ${formatINR(listedIncome)} in / ${formatINR(listedExpense)} out`}
      </span>
    </div>
  );
}

/* ── Opening-balance cut-off ──────────────────────────────────────────── */

/**
 * Splits rows into the ones the ledger counts and the ones it does not.
 * The engine ignores anything dated BEFORE `openingAsOf` — that money is
 * already baked into the opening balances — so the tally must be built from
 * the counted rows only, or a pre-opening entry would read as a mismatch.
 */
export function partitionByOpening<T extends { dateKey?: string | null; amount?: number | null }>(
  rows: T[],
  openingAsOf: string,
): { counted: T[]; excluded: T[]; countedTotal: number } {
  const counted: T[] = [];
  const excluded: T[] = [];
  for (const row of rows) {
    const key = row.dateKey || '';
    if (openingAsOf && key && key < openingAsOf) excluded.push(row);
    else counted.push(row);
  }
  return {
    counted,
    excluded,
    countedTotal: counted.reduce((total, row) => total + (Number(row.amount) || 0), 0),
  };
}

/** Shown only when some listed entry sits before the opening-balance date. */
export function OpeningExclusionNote({ excluded, openingAsOf }: {
  excluded: number;
  openingAsOf: string;
}) {
  if (excluded <= 0) return null;
  return (
    <div style={{
      padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)',
      background: 'var(--color-info-bg)', color: 'var(--color-info)', fontSize: '0.85rem',
    }}>
      {excluded} {excluded === 1 ? 'entry is' : 'entries are'} dated before the opening-balance
      date ({openingAsOf}). They are listed for reference but are already part of the opening
      balances, so they do not move Cash in Hand or Bank Balance.
    </div>
  );
}

/* ── Responsive record list ───────────────────────────────────────────── */

export interface RecordCell {
  /** Column header on desktop, field label on the phone card. */
  label: string;
  value: React.ReactNode;
  align?: 'left' | 'right';
  strong?: boolean;
}

export interface RecordItem {
  id: string;
  /** First column on desktop, card heading on the phone. */
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Same labels, same order, for EVERY item — they become the columns. */
  cells: RecordCell[];
  actions?: React.ReactNode;
}

interface RecordPanelProps {
  title: string;
  /** Header of the title column (desktop only). */
  titleColumn: string;
  items: RecordItem[];
  emptyText: string;
  /** Optional control rendered on the right of the panel header. */
  right?: React.ReactNode;
}

/**
 * One panel, two presentations. On the phone this NEVER produces a
 * horizontally scrolling table — each record becomes a stacked card.
 */
export function RecordPanel({ title, titleColumn, items, emptyText, right }: RecordPanelProps) {
  const isMobile = useIsMobile();
  const hasActions = items.some(item => !!item.actions);

  return (
    <div style={panelStyle}>
      <div style={panelHeaderStyle}>
        <span className="text-overline">{title}</span>
        {right}
      </div>

      {items.length === 0 ? (
        <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>{emptyText}</span>
        </div>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {items.map(item => <RecordCard key={item.id} item={item} />)}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-variant)' }}>
                <th style={thStyle}>{titleColumn}</th>
                {items[0].cells.map(cell => (
                  <th key={cell.label} style={{ ...thStyle, textAlign: cell.align === 'right' ? 'right' : 'left' }}>
                    {cell.label}
                  </th>
                ))}
                {hasActions && <th style={{ ...thStyle, width: 84 }} aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} style={{ borderTop: '1px solid var(--color-divider)' }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{item.title}</div>
                    {item.subtitle && (
                      <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>{item.subtitle}</div>
                    )}
                  </td>
                  {item.cells.map(cell => (
                    <td
                      key={cell.label}
                      style={{
                        ...tdStyle,
                        textAlign: cell.align === 'right' ? 'right' : 'left',
                        fontWeight: cell.strong ? 700 : 400,
                        whiteSpace: cell.align === 'right' ? 'nowrap' : 'normal',
                      }}
                    >
                      {cell.value}
                    </td>
                  ))}
                  {hasActions && (
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>{item.actions}</div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RecordCard({ item }: { item: RecordItem }) {
  return (
    <div style={{
      padding: 'var(--space-4)', borderTop: '1px solid var(--color-divider)',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        <div style={{ minWidth: 0 }}>
          <div className="text-body" style={{ fontWeight: 600 }}>{item.title}</div>
          {item.subtitle && (
            <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>{item.subtitle}</div>
          )}
        </div>
        {item.actions && <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>{item.actions}</div>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--space-2)' }}>
        {item.cells.map(cell => (
          <div key={cell.label}>
            <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>{cell.label}</div>
            <div className="text-body-sm" style={{ fontWeight: cell.strong ? 700 : 500 }}>{cell.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
