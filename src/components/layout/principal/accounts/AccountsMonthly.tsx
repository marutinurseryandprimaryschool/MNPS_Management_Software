'use client';

/* ============================================
   Principal Accounts — the month sheet
   ============================================
   The same figures as the day sheet, rolled up over a month: income vs
   expense split Cash/Bank, the tally line, a day-by-day bar chart and the
   day-by-day table behind it. All of it comes from computeMonthlyLedger().
*/

import React from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/SharedUI';
import {
  EXPENSE_BAR, EXPENSE_COLOR, INCOME_BAR, INCOME_COLOR,
  formatINR, formatSignedINR, monthKeyLabel, panelHeaderStyle, panelStyle, pickerStyle,
} from '../principal-shared';
import {
  FlowCard, OpeningExclusionNote, RecordPanel, TallyLine,
  partitionByOpening, type RecordItem,
} from './accounts-ui';
import type { MonthlyLedger, PrincipalExpense, PrincipalPayment } from '@/types/principal';

interface AccountsMonthlyProps {
  monthKey: string;
  maxMonth: string;
  onMonthChange: (key: string) => void;
  ledger: MonthlyLedger;
  payments: PrincipalPayment[];
  expenses: PrincipalExpense[];
  openingAsOf: string;
}

/** Keeps the bars readable on a phone: the chart scrolls, it never squashes. */
const CHART_HEIGHT = 260;
const MIN_BAR_SLOT = 46;

export default function AccountsMonthly({
  monthKey, maxMonth, onMonthChange, ledger, payments, expenses, openingAsOf,
}: AccountsMonthlyProps) {
  const label = monthKeyLabel(monthKey);
  const countedPayments = partitionByOpening(payments, openingAsOf);
  const countedExpenses = partitionByOpening(expenses, openingAsOf);
  const excludedCount = countedPayments.excluded.length + countedExpenses.excluded.length;

  const chartData = ledger.days.map(day => ({
    day: day.dateKey.slice(8),
    Income: day.income,
    Expense: day.expense,
  }));
  const chartWidth = Math.max(320, chartData.length * MIN_BAR_SLOT);

  const dayItems: RecordItem[] = ledger.days.map(day => ({
    id: day.dateKey,
    title: day.dateKey,
    cells: [
      { label: 'Cash in', value: formatINR(day.incomeCash), align: 'right' },
      { label: 'Bank in', value: formatINR(day.incomeBank), align: 'right' },
      { label: 'Cash out', value: formatINR(day.expenseCash), align: 'right' },
      { label: 'Bank out', value: formatINR(day.expenseBank), align: 'right' },
      {
        label: 'Net',
        value: (
          <span style={{ color: day.net >= 0 ? INCOME_COLOR : EXPENSE_COLOR }}>
            {formatSignedINR(day.net)}
          </span>
        ),
        align: 'right',
        strong: true,
      },
      { label: 'Closing cash', value: formatINR(day.cashInHand), align: 'right' },
      { label: 'Closing bank', value: formatINR(day.bankBalance), align: 'right' },
    ],
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <input
          type="month"
          aria-label="Sheet month"
          value={monthKey}
          max={maxMonth}
          onChange={e => onMonthChange(e.target.value || maxMonth)}
          style={pickerStyle}
        />
        <Badge variant="info">{label}</Badge>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
        <FlowCard title={`Income — ${label}`} cash={ledger.incomeCash} bank={ledger.incomeBank} accent={INCOME_COLOR} />
        <FlowCard title={`Expenses — ${label}`} cash={ledger.expenseCash} bank={ledger.expenseBank} accent={EXPENSE_COLOR} />
      </div>

      <TallyLine
        income={ledger.income}
        expense={ledger.expense}
        listedIncome={countedPayments.countedTotal}
        listedExpense={countedExpenses.countedTotal}
        periodLabel={label}
      />

      <OpeningExclusionNote excluded={excludedCount} openingAsOf={openingAsOf} />

      <div style={panelStyle}>
        <div style={panelHeaderStyle}>
          <span className="text-overline">Income vs expense — day by day</span>
        </div>
        {chartData.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
            <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              No money moved in {label}.
            </span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', padding: 'var(--space-4)' }}>
            <div style={{ width: chartWidth, minWidth: '100%', height: CHART_HEIGHT }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-divider)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    width={52}
                    tickFormatter={(value: number) => (value >= 1000 ? `${Math.round(value / 1000)}k` : String(value))}
                  />
                  <Tooltip formatter={(value) => formatINR(Number(value ?? 0))} />
                  <Legend />
                  <Bar dataKey="Income" fill={INCOME_BAR} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Expense" fill={EXPENSE_BAR} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <RecordPanel
        title={`Day by day — ${label}`}
        titleColumn="Date"
        items={dayItems}
        emptyText={`No money moved in ${label}.`}
        right={(
          <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
            Closing balances roll forward from the opening balances
          </span>
        )}
      />
    </div>
  );
}
