'use client';

/* ============================================
   Principal Accounts — the day sheet
   ============================================
   One day's money: income split Cash/Bank, expenses split Cash/Bank, the
   tally line proving income − expense = the day's net, and the two itemised
   lists behind those totals. Every figure comes from
   computeDailyLedger() — nothing is re-added here.
*/

import React from 'react';
import { ClockIcon, TrashIcon } from '@/components/ui/Icons';
import { Badge } from '@/components/ui/SharedUI';
import {
  EXPENSE_COLOR, INCOME_COLOR, dateKeyLabel, formatINR, headLabel,
  iconButtonStyle, modeLabel, pickerStyle,
} from '../principal-shared';
import {
  FlowCard, OpeningExclusionNote, RecordPanel, TallyLine,
  partitionByOpening, type RecordItem,
} from './accounts-ui';
import type { DailyLedger, PrincipalExpense, PrincipalPayment } from '@/types/principal';

/** 'yyyy-MM-dd' shifted by whole days, built from parts (never UTC parsing). */
function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return dateKey;
  const shifted = new Date(year, month - 1, day + days);
  const mm = `${shifted.getMonth() + 1}`.padStart(2, '0');
  const dd = `${shifted.getDate()}`.padStart(2, '0');
  return `${shifted.getFullYear()}-${mm}-${dd}`;
}

interface AccountsDailyProps {
  dateKey: string;
  maxDate: string;
  onDateChange: (key: string) => void;
  ledger: DailyLedger;
  payments: PrincipalPayment[];
  expenses: PrincipalExpense[];
  /** Principal only — teachers never reach this screen. */
  canManageExpenses: boolean;
  onDeleteExpense: (expense: PrincipalExpense) => void;
  onShowExpenseHistory: (expense: PrincipalExpense) => void;
  /** Removes a wrongly-entered receipt right where it shows (soft delete). */
  onDeletePayment?: (payment: PrincipalPayment) => void;
  /** 'yyyy-MM-dd' cut-off from settings; '' when no opening date is set. */
  openingAsOf: string;
}

export default function AccountsDaily({
  dateKey, maxDate, onDateChange, ledger, payments, expenses,
  canManageExpenses, onDeleteExpense, onShowExpenseHistory, onDeletePayment, openingAsOf,
}: AccountsDailyProps) {
  const countedPayments = partitionByOpening(payments, openingAsOf);
  const countedExpenses = partitionByOpening(expenses, openingAsOf);
  const excludedCount = countedPayments.excluded.length + countedExpenses.excluded.length;

  const paymentItems: RecordItem[] = payments.map(payment => ({
    id: payment.id,
    title: payment.studentName || '—',
    subtitle: payment.className || undefined,
    cells: [
      { label: 'Head', value: headLabel(payment.head) },
      { label: 'Month', value: payment.month || '—' },
      { label: 'Mode', value: modeLabel(payment.mode) },
      { label: 'Received by', value: payment.enteredByName || '—' },
      {
        label: 'Amount',
        value: <span style={{ color: INCOME_COLOR }}>{formatINR(payment.amount)}</span>,
        align: 'right',
        strong: true,
      },
    ],
    actions: onDeletePayment ? (
      <button
        type="button"
        onClick={() => onDeletePayment(payment)}
        title="Remove this payment (kept in the activity log)"
        aria-label="Remove payment"
        style={{ ...iconButtonStyle, color: 'var(--color-error)' }}
      >
        <TrashIcon size={14} />
      </button>
    ) : undefined,
  }));

  const expenseItems: RecordItem[] = expenses.map(expense => ({
    id: expense.id,
    title: expense.category || 'Uncategorised',
    subtitle: expense.description || undefined,
    cells: [
      { label: 'Paid to', value: expense.paidTo || '—' },
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
        <input
          type="date"
          aria-label="Sheet date"
          value={dateKey}
          max={maxDate}
          onChange={e => onDateChange(e.target.value || maxDate)}
          style={pickerStyle}
        />
        {/* Jumping back a day or two is the common case — no typing needed. */}
        {[
          { label: 'Today', offset: 0 },
          { label: 'Yesterday', offset: -1 },
          { label: '2 days ago', offset: -2 },
        ].map(({ label, offset }) => {
          const target = shiftDateKey(maxDate, offset);
          return (
            <button
              key={label}
              type="button"
              onClick={() => onDateChange(target)}
              style={{
                padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.78rem',
                fontWeight: 600, minHeight: 34, cursor: 'pointer',
                border: `1px solid ${dateKey === target ? 'var(--color-text-primary)' : 'var(--color-border)'}`,
                background: dateKey === target ? 'var(--color-text-primary)' : 'var(--color-surface)',
                color: dateKey === target ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
              }}
            >
              {label}
            </button>
          );
        })}
        <Badge variant="info">{dateKeyLabel(dateKey)}</Badge>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
        <FlowCard title="Income — cash vs bank" cash={ledger.incomeCash} bank={ledger.incomeBank} accent={INCOME_COLOR} />
        <FlowCard title="Expenses — cash vs bank" cash={ledger.expenseCash} bank={ledger.expenseBank} accent={EXPENSE_COLOR} />
      </div>

      <TallyLine
        income={ledger.income}
        expense={ledger.expense}
        listedIncome={countedPayments.countedTotal}
        listedExpense={countedExpenses.countedTotal}
        periodLabel={dateKeyLabel(dateKey)}
      />

      <OpeningExclusionNote excluded={excludedCount} openingAsOf={openingAsOf} />

      <RecordPanel
        title={`Fees received — ${dateKey}`}
        titleColumn="Student"
        items={paymentItems}
        emptyText="No fees received on this day."
      />

      <RecordPanel
        title={`Expenses — ${dateKey}`}
        titleColumn="Category"
        items={expenseItems}
        emptyText="No expenses on this day."
      />
    </div>
  );
}
