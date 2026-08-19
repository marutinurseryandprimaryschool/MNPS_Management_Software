'use client';

/* ============================================
   Income & Expense — page key 'principal-accounts'
   ============================================
   Income vs expense for the standalone Principal Register. Reads ONLY the
   isolated collections (principalPayments / principalExpenses /
   principalSettings) through principal-service; every figure on the screen is
   computed by computeDailyLedger / computeMonthlyLedger. Nothing here touches
   the legacy feePayments / expenses collections or fee-utils' computeBalances.

   Daily view  — the day's income and expenses split Cash/Bank, Cash in Hand
                 and Bank Balance at the close of the day, the two itemised
                 lists and the tally line proving income − expense = net.
   Monthly view — the same aggregates for a month, a day-by-day bar chart and
                 the day-by-day table with running closing balances.
*/

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { useToast } from '@/components/ui/Toast';
import { hasCapability } from '@/lib/permissions';
import Button from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Badge, Tabs } from '@/components/ui/SharedUI';
import { DownloadIcon, PlusIcon } from '@/components/ui/Icons';
import { computeDailyLedger, computeMonthlyLedger } from '@/lib/principal-fees';
import { PrincipalExpensesService, PrincipalPaymentsService, PrincipalSettingsService } from '@/lib/principal-service';
import {
  exportDailyBalanceSheetExcel, exportDailyBalanceSheetPdf,
  exportMonthlyBalanceSheetExcel, exportMonthlyBalanceSheetPdf,
  type DailySheetData, type MonthlySheetData,
} from '@/lib/export-utils';
import {
  currentMonthKey, describeReadError, formatINR, headLabel, modeLabel,
  monthKeyLabel, principalWriteError, refreshFailedMessage, todayKey, usePrincipalActor,
} from '../principal-shared';
import { BalanceCard } from './accounts-ui';
import AccountsDaily from './AccountsDaily';
import AccountsMonthly from './AccountsMonthly';
import AuditTrailModal from '../activity/AuditTrailModal';
import ExpenseEntryModal from '../ExpenseEntryModal';
import OpeningBalancesCard from '../OpeningBalancesCard';
import type { PrincipalExpense, PrincipalPayment, PrincipalSettings } from '@/types/principal';

type ViewMode = 'daily' | 'monthly';

const CASH_GRADIENT = 'linear-gradient(135deg,#059669,#10B981)';
const BANK_GRADIENT = 'linear-gradient(135deg,#2563EB,#3B82F6)';
const TOTAL_GRADIENT = 'linear-gradient(135deg,#7C3AED,#8B5CF6)';

export default function AccountsSection() {
  const { role } = useAuth();
  const { school } = useSchool();
  const { showToast } = useToast();
  const actor = usePrincipalActor();

  const canView = hasCapability(role, 'viewPrincipalAccounts');
  const academicYear = school?.academicYear || '';

  const [payments, setPayments] = useState<PrincipalPayment[]>([]);
  const [expenses, setExpenses] = useState<PrincipalExpense[]>([]);
  const [settings, setSettings] = useState<PrincipalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [view, setView] = useState<ViewMode>('daily');
  const [dateKey, setDateKey] = useState(todayKey);
  const [monthKey, setMonthKey] = useState(currentMonthKey);

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PrincipalExpense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<PrincipalExpense | null>(null);
  const [exporting, setExporting] = useState(false);

  /* ── Load (throws on failure so callers can distinguish a bad refetch) ── */

  const load = useCallback(async () => {
    if (!academicYear || !canView) return;
    const [loadedPayments, loadedExpenses, loadedSettings] = await Promise.all([
      PrincipalPaymentsService.listByYear(academicYear),
      PrincipalExpensesService.listByYear(academicYear),
      PrincipalSettingsService.get(),
    ]);
    setPayments(loadedPayments);
    setExpenses(loadedExpenses);
    setSettings(loadedSettings);
  }, [academicYear, canView]);

  /**
   * Load + error handling. `isStale` drops the result of a superseded run;
   * callers that want a spinner set `loading` BEFORE calling, because an
   * effect must not setState synchronously.
   */
  const runLoad = useCallback(async (isStale: () => boolean = () => false) => {
    try {
      await load();
      if (!isStale()) setLoadError(null);
    } catch (error) {
      console.error('Accounts load failed', error);
      if (!isStale()) setLoadError(describeReadError(error, 'the accounts sheet'));
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void runLoad(() => cancelled);
    return () => { cancelled = true; };
  }, [runLoad]);

  const retry = () => { setLoading(true); void runLoad(); };

  /* ── Ledgers (the ONLY place the numbers come from) ── */

  const dailyLedger = useMemo(
    () => computeDailyLedger(payments, expenses, settings, dateKey),
    [payments, expenses, settings, dateKey],
  );
  const monthlyLedger = useMemo(
    () => computeMonthlyLedger(payments, expenses, settings, monthKey),
    [payments, expenses, settings, monthKey],
  );

  const dayPayments = useMemo(
    () => payments.filter(payment => payment.dateKey === dateKey),
    [payments, dateKey],
  );
  const dayExpenses = useMemo(
    () => expenses.filter(expense => expense.dateKey === dateKey),
    [expenses, dateKey],
  );
  const monthPayments = useMemo(
    () => payments.filter(payment => (payment.dateKey || '').slice(0, 7) === monthKey),
    [payments, monthKey],
  );
  const monthExpenses = useMemo(
    () => expenses.filter(expense => (expense.dateKey || '').slice(0, 7) === monthKey),
    [expenses, monthKey],
  );

  const isDaily = view === 'daily';
  const activeLedger = isDaily ? dailyLedger : monthlyLedger;
  const periodNote = isDaily ? `as of ${dateKey}` : `end of ${monthKeyLabel(monthKey)}`;
  const openingAsOf = settings?.openingAsOf || '';

  /* ── Expense soft-delete ── */

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await PrincipalExpensesService.softDelete(deleteTarget.id, actor);
    } catch (error) {
      console.error('Expense delete failed', { id: deleteTarget.id, error });
      showToast(principalWriteError(error, 'Only the Principal can remove expenses.'), 'error');
      setDeleting(false);
      return;
    }

    setDeleteTarget(null);
    try {
      await load();
      showToast('Expense removed — kept in the activity log');
    } catch (error) {
      console.error('Post-delete refresh failed', error);
      showToast(refreshFailedMessage('Expense removed'), 'warning');
    } finally {
      setDeleting(false);
    }
  };

  /* ── Exports (complete file or a failure toast — never a partial file) ── */

  const buildDailyData = (): DailySheetData => ({
    schoolName: school?.name || 'School',
    academicYear,
    dateKey,
    incomeByMode: [
      { label: 'Cash', amount: dailyLedger.incomeCash },
      { label: 'Bank', amount: dailyLedger.incomeBank },
    ],
    expensesByMode: [
      { label: 'Cash', amount: dailyLedger.expenseCash },
      { label: 'Bank', amount: dailyLedger.expenseBank },
    ],
    payments: dayPayments.map(payment => ({
      student: payment.studentName || '',
      className: payment.className || '',
      head: headLabel(payment.head),
      month: payment.month || '',
      mode: modeLabel(payment.mode),
      enteredBy: payment.enteredByName || '',
      amount: Number(payment.amount) || 0,
    })),
    expenses: dayExpenses.map(expense => ({
      category: expense.category || '',
      description: expense.description || '',
      mode: modeLabel(expense.mode),
      amount: Number(expense.amount) || 0,
    })),
    totalIncome: dailyLedger.income,
    totalExpense: dailyLedger.expense,
    cashInHand: dailyLedger.cashInHand,
    bankBalance: dailyLedger.bankBalance,
  });

  const buildMonthlyData = (): MonthlySheetData => ({
    schoolName: school?.name || 'School',
    academicYear,
    monthKey,
    monthLabel: monthKeyLabel(monthKey),
    days: monthlyLedger.days.map(day => ({
      dateKey: day.dateKey,
      incomeCash: day.incomeCash,
      incomeBank: day.incomeBank,
      expenseCash: day.expenseCash,
      expenseBank: day.expenseBank,
      cashInHand: day.cashInHand,
      bankBalance: day.bankBalance,
    })),
    totalIncome: monthlyLedger.income,
    totalExpense: monthlyLedger.expense,
    cashInHand: monthlyLedger.cashInHand,
    bankBalance: monthlyLedger.bankBalance,
  });

  const handleExport = async (format: 'excel' | 'pdf') => {
    if (exporting) return;
    setExporting(true);
    try {
      if (isDaily) {
        const data = buildDailyData();
        if (format === 'excel') await exportDailyBalanceSheetExcel(data);
        else await exportDailyBalanceSheetPdf(data);
      } else {
        const data = buildMonthlyData();
        if (format === 'excel') await exportMonthlyBalanceSheetExcel(data);
        else await exportMonthlyBalanceSheetPdf(data);
      }
      showToast('Export ready — check your downloads');
    } catch (error) {
      console.error('Accounts export failed', { view, format, error });
      showToast('Export failed — no file was generated. Please retry.', 'error');
    } finally {
      setExporting(false);
    }
  };

  /* ── Render ── */

  if (!canView) {
    return (
      <div className="page-container">
        <div style={panelBox}>
          <p className="text-body" style={{ fontWeight: 600 }}>Accounts are for the Principal only</p>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>
            If your role changed recently, refresh the app and sign in again.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading…</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page-container">
        <div style={panelBox}>
          <p className="text-body" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
            Could not load the accounts sheet
          </p>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>
            {loadError}
          </p>
          <Button variant="primary" onClick={retry}>Retry</Button>
        </div>
      </div>
    );
  }

  const isEmptyYear = payments.length === 0 && expenses.length === 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 className="text-h1">Income &amp; Expense</h2>
            <Badge variant="primary">{academicYear}</Badge>
          </div>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            Daily and monthly money in vs money out, with Cash in Hand and Bank Balance.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => void handleExport('excel')} disabled={exporting} icon={<DownloadIcon size={16} />}>
            Excel
          </Button>
          <Button variant="secondary" onClick={() => void handleExport('pdf')} disabled={exporting} icon={<DownloadIcon size={16} />}>
            PDF
          </Button>
          <Button variant="primary" onClick={() => setExpenseModalOpen(true)} icon={<PlusIcon size={18} color="white" />}>
            Add Expense
          </Button>
        </div>
      </div>

      {isEmptyYear && (
        <div style={{
          padding: 'var(--space-4)', marginBottom: 'var(--space-4)', borderRadius: 'var(--radius-md)',
          background: 'var(--color-info-bg)', color: 'var(--color-info)', fontSize: '0.875rem',
        }}>
          Nothing recorded for {academicYear} yet. Fees entered in the fees note and expenses added
          here appear on this sheet automatically.
        </div>
      )}

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--space-4)', marginBottom: 'var(--space-4)',
      }}>
        <BalanceCard label="Cash in Hand" amount={activeLedger.cashInHand} gradient={CASH_GRADIENT} note={periodNote} />
        <BalanceCard label="Bank Balance" amount={activeLedger.bankBalance} gradient={BANK_GRADIENT} note={periodNote} />
        <BalanceCard
          label="Total in Hand"
          amount={activeLedger.total}
          gradient={TOTAL_GRADIENT}
          note={openingAsOf ? `counts money from ${openingAsOf}` : 'opening balances not set yet'}
        />
      </div>

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Tabs
          tabs={[{ id: 'daily', label: 'Daily' }, { id: 'monthly', label: 'Monthly' }]}
          activeTab={view}
          onChange={id => setView(id === 'monthly' ? 'monthly' : 'daily')}
        />
      </div>

      {isDaily ? (
        <AccountsDaily
          dateKey={dateKey}
          maxDate={todayKey()}
          onDateChange={setDateKey}
          ledger={dailyLedger}
          payments={dayPayments}
          expenses={dayExpenses}
          canManageExpenses={canView}
          onDeleteExpense={setDeleteTarget}
          onShowExpenseHistory={setHistoryTarget}
          openingAsOf={openingAsOf}
        />
      ) : (
        <AccountsMonthly
          monthKey={monthKey}
          maxMonth={currentMonthKey()}
          onMonthChange={setMonthKey}
          ledger={monthlyLedger}
          payments={monthPayments}
          expenses={monthExpenses}
          openingAsOf={openingAsOf}
        />
      )}

      <div style={{ marginTop: 'var(--space-5)' }}>
        <OpeningBalancesCard
          settings={settings}
          academicYear={academicYear}
          canEdit={canView}
          onSaved={load}
        />
      </div>

      <ExpenseEntryModal
        isOpen={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        academicYear={academicYear}
        categories={settings?.expenseCategories ?? []}
        expenses={expenses}
        onSaved={load}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => { if (!deleting) setDeleteTarget(null); }}
        onConfirm={handleDelete}
        title="Remove this expense?"
        message={`${formatINR(deleteTarget?.amount)} — ${deleteTarget?.description || deleteTarget?.category || ''}. It leaves every total but stays in the activity log.`}
        confirmLabel={deleting ? 'Removing…' : 'Remove'}
      />

      <AuditTrailModal
        isOpen={!!historyTarget}
        onClose={() => setHistoryTarget(null)}
        targetId={historyTarget?.id ?? null}
        title="Expense activity"
        subtitle={historyTarget
          ? `${formatINR(historyTarget.amount)} — ${historyTarget.category}${historyTarget.description ? ` · ${historyTarget.description}` : ''}`
          : undefined}
      />
    </div>
  );
}

const panelBox: React.CSSProperties = {
  padding: 'var(--space-8)', textAlign: 'center', background: 'var(--color-surface)',
  borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)',
};
