'use client';

/* ============================================
   Principal Accounts — the expense report
   ============================================
   Spend over a chosen date window: the cash/bank split, a category roll-up
   showing where the money actually went, and the itemised entries behind it.

   Every figure comes from computeExpenseReport() — nothing is re-added here,
   which is what keeps the screen and the Excel/PDF export in agreement.

   Unlike the Daily and Monthly tabs this applies NO opening-balance cut-off:
   a report answers "what did we spend between these dates", so an entry dated
   before the opening date is still spend that happened. That also means the
   totals here are NOT expected to move Cash in Hand by the same amount, and
   the note at the top of the panel says so.
*/

import React from 'react';
import { ClockIcon, TrashIcon } from '@/components/ui/Icons';
import { Badge } from '@/components/ui/SharedUI';
import {
  EXPENSE_COLOR, dateKeyLabel, formatINR, iconButtonStyle, modeLabel, pickerStyle,
} from '../principal-shared';
import { FlowCard, RecordPanel, type RecordItem } from './accounts-ui';
import type { ExpenseReport, PrincipalExpense } from '@/types/principal';

interface AccountsExpensesProps {
  fromKey: string;
  toKey: string;
  /** Upper bound for both pickers — the report never runs into the future. */
  maxDate: string;
  onFromChange: (key: string) => void;
  onToChange: (key: string) => void;
  report: ExpenseReport;
  /** Entries already narrowed to the window, newest first. */
  entries: PrincipalExpense[];
  /** Principal only — teachers never reach this screen. */
  canManageExpenses: boolean;
  onDeleteExpense: (expense: PrincipalExpense) => void;
  onShowExpenseHistory: (expense: PrincipalExpense) => void;
  /** 'yyyy-MM-dd' cut-off from settings; '' when no opening date is set. */
  openingAsOf: string;
}

/** Proportion bar behind a category's share of the window's spend. */
function ShareBar({ share }: { share: number }) {
  const width = Math.max(0, Math.min(100, share));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
      <div
        style={{
          width: 56, height: 6, borderRadius: 3, flexShrink: 0,
          background: 'var(--color-surface-variant)', overflow: 'hidden',
        }}
        aria-hidden="true"
      >
        <div style={{ width: `${width}%`, height: '100%', background: EXPENSE_COLOR }} />
      </div>
      <span style={{ minWidth: 42, textAlign: 'right' }}>{share.toFixed(1)}%</span>
    </div>
  );
}

export default function AccountsExpenses({
  fromKey, toKey, maxDate, onFromChange, onToChange, report, entries,
  canManageExpenses, onDeleteExpense, onShowExpenseHistory, openingAsOf,
}: AccountsExpensesProps) {
  const rangeInverted = !!fromKey && !!toKey && fromKey > toKey;

  const categoryItems: RecordItem[] = report.categories.map(category => ({
    id: category.category,
    title: category.category,
    cells: [
      { label: 'Entries', value: String(category.count) },
      { label: 'Cash', value: formatINR(category.cash) },
      { label: 'Bank', value: formatINR(category.bank) },
      {
        label: 'Total',
        value: <span style={{ color: EXPENSE_COLOR }}>{formatINR(category.total)}</span>,
        align: 'right',
        strong: true,
      },
      { label: 'Share', value: <ShareBar share={category.share} />, align: 'right' },
    ],
  }));

  const entryItems: RecordItem[] = entries.map(expense => ({
    id: expense.id,
    title: expense.category || 'Uncategorised',
    subtitle: expense.description || undefined,
    cells: [
      { label: 'Date', value: expense.dateKey || '—' },
      { label: 'Mode', value: modeLabel(expense.mode) },
      { label: 'Entered by', value: expense.enteredByName || '—' },
      {
        label: 'Amount',
        value: <span style={{ color: EXPENSE_COLOR }}>{formatINR(expense.amount)}</span>,
        align: 'right',
        strong: true,
      },
    ],
    actions: canManageExpenses ? (
      <>
        <button
          type="button"
          onClick={() => onShowExpenseHistory(expense)}
          title="View this expense's activity log"
          aria-label="View activity log"
          style={iconButtonStyle}
        >
          <ClockIcon size={14} />
        </button>
        <button
          type="button"
          onClick={() => onDeleteExpense(expense)}
          title="Remove this expense"
          aria-label="Remove expense"
          style={{ ...iconButtonStyle, color: 'var(--color-error)' }}
        >
          <TrashIcon size={14} />
        </button>
      </>
    ) : undefined,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <label className="text-body-sm" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          From
          <input
            type="date"
            aria-label="Report start date"
            value={fromKey}
            max={maxDate}
            onChange={e => onFromChange(e.target.value || fromKey)}
            style={pickerStyle}
          />
        </label>
        <label className="text-body-sm" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          To
          <input
            type="date"
            aria-label="Report end date"
            value={toKey}
            max={maxDate}
            onChange={e => onToChange(e.target.value || toKey)}
            style={pickerStyle}
          />
        </label>
        <Badge variant="info">
          {dateKeyLabel(fromKey)} → {dateKeyLabel(toKey)}
        </Badge>
        <Badge variant="default">{report.count} {report.count === 1 ? 'entry' : 'entries'}</Badge>
      </div>

      {rangeInverted && (
        <div style={{
          padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)',
          background: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontSize: '0.85rem',
        }}>
          The start date is after the end date, so nothing falls inside the window.
          Move &ldquo;From&rdquo; back to {toKey} or earlier.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
        <FlowCard
          title="Spent — cash vs bank"
          cash={report.cash}
          bank={report.bank}
          accent={EXPENSE_COLOR}
        />
        <div style={{
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)', padding: 'var(--space-4)', minWidth: 0,
        }}>
          <div className="text-overline" style={{ marginBottom: 'var(--space-3)' }}>
            Biggest spend
          </div>
          {report.categories.length === 0 ? (
            <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              Nothing spent in this window.
            </span>
          ) : (
            <>
              <div className="text-body" style={{ fontWeight: 700 }}>{report.categories[0].category}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: EXPENSE_COLOR, marginTop: 4 }}>
                {formatINR(report.categories[0].total)}
              </div>
              <div className="text-caption" style={{ color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                {report.categories[0].share.toFixed(1)}% of {formatINR(report.total)} across{' '}
                {report.categories.length} {report.categories.length === 1 ? 'category' : 'categories'}
              </div>
            </>
          )}
        </div>
      </div>

      {openingAsOf && fromKey < openingAsOf && (
        <div style={{
          padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)',
          background: 'var(--color-info-bg)', color: 'var(--color-info)', fontSize: '0.85rem',
        }}>
          This window starts before the opening-balance date ({openingAsOf}). Entries dated earlier
          are counted here as spend, but they are already inside the opening balances — so this
          total will not match the drop in Cash in Hand.
        </div>
      )}

      <RecordPanel
        title="Where the money went"
        titleColumn="Category"
        items={categoryItems}
        emptyText="No expenses recorded in this window."
      />

      <RecordPanel
        title={`All entries — ${fromKey} to ${toKey}`}
        titleColumn="Category"
        items={entryItems}
        emptyText="No expenses recorded in this window."
      />
    </div>
  );
}
