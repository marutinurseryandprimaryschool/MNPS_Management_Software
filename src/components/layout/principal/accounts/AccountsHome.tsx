'use client';

/* ============================================
   Principal Accounts — finance home (Phase 2 §4)
   ============================================
   The first thing Sharmi sees: what came in today, what went out today, where
   the month stands, how much is still owed, and how much money sits in each
   channel. It answers "should I be chasing anyone today?" without a single
   click.

   Every number is passed in already computed by the engine
   (computeDailyLedger / computeMonthlyLedger / computeOutstandingSummary /
   computeModeTotals). This file does NO money math — it only lays numbers out.
*/

import React from 'react';
import Button from '@/components/ui/Button';
import { SearchIcon, PlusIcon } from '@/components/ui/Icons';
import {
  EXPENSE_COLOR, INCOME_COLOR, dateKeyLabel, formatINR, formatSignedINR,
  monthKeyLabel, panelHeaderStyle, panelStyle,
} from '../principal-shared';
import ModeTotalsPanel from './ModeTotalsPanel';
import type { DailyLedger, ModeTotals, MonthlyLedger, OutstandingSummary } from '@/types/principal';

/** Collection − expense = net, for one period. The §25 / §26 block. */
function NetCard({ title, subtitle, collection, expense }: {
  title: string;
  subtitle: string;
  collection: number;
  expense: number;
}) {
  const net = collection - expense;
  return (
    <div style={{ ...panelStyle, padding: 0 }}>
      <div style={panelHeaderStyle}>
        <span className="text-overline">{title}</span>
        <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>{subtitle}</span>
      </div>
      <div style={{ padding: 'var(--space-4)' }}>
        <Row label="Collection" value={formatINR(collection)} color={INCOME_COLOR} />
        <Row label="Expense" value={formatINR(expense)} color={EXPENSE_COLOR} />
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          gap: 'var(--space-2)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-2)',
          borderTop: '2px solid var(--color-border)',
        }}>
          <span className="text-body" style={{ fontWeight: 700 }}>Net</span>
          <span style={{
            fontSize: '1.35rem', fontWeight: 700, wordBreak: 'break-word',
            color: net >= 0 ? INCOME_COLOR : EXPENSE_COLOR,
          }}>
            {formatSignedINR(net)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', padding: '4px 0',
    }}>
      <span className="text-body-sm" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span className="text-body" style={{ fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

export interface AccountsHomeProps {
  dateKey: string;
  monthKey: string;
  daily: DailyLedger;
  monthly: MonthlyLedger;
  /** Null while the register rows are still loading, or when they failed. */
  outstanding: OutstandingSummary | null;
  /** Set when the register could not be read — never shown as ₹0 (§17, §18). */
  outstandingError?: string | null;
  onRetryRegister?: () => void;
  dayModes: ModeTotals;
  monthModes: ModeTotals;
  yearModes: ModeTotals;
  cashInHand: number;
  bankBalance: number;
  /** Jump to the Students tab (search / teacher list). */
  onOpenStudents: () => void;
  onAddExpense: () => void;
}

export default function AccountsHome({
  dateKey, monthKey, daily, monthly, outstanding, outstandingError, onRetryRegister,
  dayModes, monthModes, yearModes, cashInHand, bankBalance, onOpenStudents, onAddExpense,
}: AccountsHomeProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Mobile-first (§31): the two actions Sharmi needs most come first. */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <Button variant="primary" onClick={onOpenStudents} icon={<SearchIcon size={18} color="white" />}>
          Find student &amp; record payment
        </Button>
        <Button variant="secondary" onClick={onAddExpense} icon={<PlusIcon size={18} />}>
          Add expense
        </Button>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 'var(--space-4)',
      }}>
        <NetCard
          title="Today"
          subtitle={dateKeyLabel(dateKey)}
          collection={daily.income}
          expense={daily.expense}
        />
        <NetCard
          title="This month"
          subtitle={monthKeyLabel(monthKey)}
          collection={monthly.income}
          expense={monthly.expense}
        />
      </div>

      {/* ── Outstanding (§4) ── */}
      <div style={panelStyle}>
        <div style={panelHeaderStyle}>
          <span className="text-overline">Outstanding</span>
          <button
            type="button"
            onClick={onOpenStudents}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              font: 'var(--text-caption)', color: 'var(--color-primary-600)', fontWeight: 700,
            }}
          >
            View students →
          </button>
        </div>
        {outstandingError ? (
          /* Never ₹0 and never a stuck spinner: say it failed, offer a retry. */
          <div style={{ padding: 'var(--space-4)' }}>
            <p className="text-body-sm" style={{ fontWeight: 600, margin: 0 }}>
              Could not load the student register
            </p>
            <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', margin: '4px 0 var(--space-3)' }}>
              {outstandingError} Outstanding figures are hidden rather than shown as zero.
            </p>
            {onRetryRegister && (
              <Button variant="secondary" onClick={onRetryRegister}>Retry</Button>
            )}
          </div>
        ) : outstanding === null ? (
          <div style={{ padding: 'var(--space-4)' }}>
            <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              Loading the register…
            </span>
          </div>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 'var(--space-4)', padding: 'var(--space-4)',
          }}>
            <Metric
              label="Total outstanding"
              value={formatINR(outstanding.outstanding)}
              color={EXPENSE_COLOR}
              hint={`${formatINR(outstanding.dueNow)} chaseable today`}
            />
            <Metric
              label="Pending students"
              value={String(outstanding.pendingStudents)}
              hint="nothing paid yet"
            />
            <Metric
              label="Partial students"
              value={String(outstanding.partialStudents)}
              hint="part paid"
            />
            <Metric
              label="Fully paid"
              value={String(outstanding.paidStudents)}
              color={INCOME_COLOR}
              hint={`of ${outstanding.students} students`}
            />
          </div>
        )}
      </div>

      {/* ── Money position (§4) ── */}
      <div style={panelStyle}>
        <div style={panelHeaderStyle}>
          <span className="text-overline">Money position</span>
          <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
            as of {dateKey}
          </span>
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 'var(--space-4)', padding: 'var(--space-4)',
        }}>
          <Metric label="Cash in Hand" value={formatINR(cashInHand)} color={INCOME_COLOR} hint="physical cash" />
          <Metric label="Bank Balance" value={formatINR(bankBalance)} hint="incl. GPay / UPI & Other" />
          <Metric label="Total in hand" value={formatINR(cashInHand + bankBalance)} hint="cash + bank" />
        </div>
      </div>

      <ModeTotalsPanel totals={dayModes} title={`By payment method — today (${dateKey})`} />

      <ModeTotalsPanel totals={monthModes} title={`By payment method — ${monthKeyLabel(monthKey)}`} />

      <ModeTotalsPanel
        totals={yearModes}
        title="By payment method — year to date"
        note="Everything recorded this academic year, by channel. Useful for reconciling
              against bank and GPay statements."
      />
    </div>
  );
}

function Metric({ label, value, color, hint }: {
  label: string;
  value: string;
  color?: string;
  hint?: string;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="text-overline" style={{ color: 'var(--color-text-tertiary)' }}>{label}</div>
      <div style={{
        fontSize: '1.3rem', fontWeight: 700, wordBreak: 'break-word',
        color: color ?? 'var(--color-text-primary)',
      }}>
        {value}
      </div>
      {hint && (
        <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>{hint}</div>
      )}
    </div>
  );
}
