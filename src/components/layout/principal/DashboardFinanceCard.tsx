'use client';

/* ============================================
   Principal Dashboard — today's money at a glance
   ============================================
   The Principal's first screen should answer three questions before any
   clicking: what came in today, what went out, and what is in hand.

   Every figure comes from the SAME engine the Billing screen uses
   (computeDailyLedger over principalPayments + principalExpenses), so the
   dashboard and the day sheet can never disagree. Nothing is computed here.

   Loading and failure are distinct states on purpose: a Principal must never
   read "₹0 collected" when the truth is "we could not reach the database".
*/

import React, { useCallback, useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { useSchool } from '@/context/SchoolContext';
import { computeDailyLedger } from '@/lib/principal-fees';
import { PrincipalExpensesService, PrincipalPaymentsService, PrincipalSettingsService } from '@/lib/principal-service';
import { dateKeyLabel, formatINR, todayKey } from './principal-shared';
import type { DailyLedger } from '@/types/principal';

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border)',
  boxShadow: 'var(--shadow-sm)',
  padding: 'var(--space-5)',
  marginBottom: 'var(--space-6)',
};

function Figure({ label, value, color, hint }: {
  label: string;
  value: string;
  color?: string;
  hint?: string;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="text-overline" style={{ color: 'var(--color-text-tertiary)' }}>{label}</div>
      <div style={{
        font: 'var(--text-heading-2)', wordBreak: 'break-word',
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

export default function DashboardFinanceCard({ onOpen }: { onOpen: () => void }) {
  const { school } = useSchool();
  const academicYear = school?.academicYear || '';
  const dateKey = todayKey();

  const [ledger, setLedger] = useState<DailyLedger | null>(null);
  const [counts, setCounts] = useState({ payments: 0, expenses: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!academicYear) return;
    setError(null);
    try {
      const [payments, expenses, settings] = await Promise.all([
        PrincipalPaymentsService.listByYear(academicYear),
        PrincipalExpensesService.listByYear(academicYear),
        PrincipalSettingsService.get().catch(() => null),
      ]);
      setLedger(computeDailyLedger(payments, expenses, settings, dateKey));
      setCounts({
        payments: payments.filter(p => !p.deleted && p.dateKey === dateKey).length,
        expenses: expenses.filter(e => !e.deleted && e.dateKey === dateKey).length,
      });
    } catch (loadError) {
      console.error('[dashboard] today\'s finance load failed', loadError);
      // Never fall back to zeroes — that reads as "no money today".
      setLedger(null);
      setError('Could not load today\'s billing figures.');
    } finally {
      setLoading(false);
    }
  }, [academicYear, dateKey]);

  useEffect(() => { void load(); }, [load]);

  const retry = () => { setLoading(true); void load(); };

  return (
    <div style={cardStyle}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)',
      }}>
        <div>
          <h3 className="text-h3">Today&rsquo;s Money</h3>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', margin: 0 }}>
            {dateKeyLabel(dateKey)}
          </p>
        </div>
        <Button variant="primary" onClick={onOpen}>Open Billing &amp; Expenses</Button>
      </div>

      {loading ? (
        <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', margin: 0 }}>
          Loading today&rsquo;s billing…
        </p>
      ) : error || !ledger ? (
        <div>
          <p className="text-body-sm" style={{ color: 'var(--color-error)', margin: '0 0 var(--space-2)' }}>
            {error ?? 'Could not load today\'s billing figures.'}
          </p>
          <Button variant="secondary" onClick={retry}>Retry</Button>
        </div>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 'var(--space-4)',
        }}>
          <Figure
            label="Collected today"
            value={formatINR(ledger.income)}
            color="var(--color-success)"
            hint={`${counts.payments} ${counts.payments === 1 ? 'payment' : 'payments'}`}
          />
          <Figure
            label="Spent today"
            value={formatINR(ledger.expense)}
            color="var(--color-error)"
            hint={`${counts.expenses} ${counts.expenses === 1 ? 'expense' : 'expenses'}`}
          />
          <Figure
            label="Net today"
            value={formatINR(ledger.income - ledger.expense)}
            hint="collected − spent"
          />
          <Figure label="Cash in Hand" value={formatINR(ledger.cashInHand)} hint="physical cash" />
          <Figure
            label="Bank Balance"
            value={formatINR(ledger.bankBalance)}
            hint="GPay / UPI, Bank, Other"
          />
        </div>
      )}
    </div>
  );
}
