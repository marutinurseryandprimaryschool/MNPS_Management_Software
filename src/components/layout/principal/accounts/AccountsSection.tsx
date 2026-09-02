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
   Expenses view — the expense report: spend over a chosen date window rolled
                 up by category, plus every entry behind it. Exports as its own
                 Excel/PDF rather than sharing the balance-sheet files.
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
import { academicYearStartYear } from '@/lib/fee-utils';
import {
  computeDailyLedger, computeExpenseReport, computeModeTotals, computeMonthlyLedger,
  computeOutstandingSummary, computeRowSummary, emptyRowSummary, expenseCategoryLabel,
  groupPaymentsByRow, isWithinRange,
} from '@/lib/principal-fees';
import {
  PrincipalDayCloseService, PrincipalExpensesService, PrincipalPaymentsService,
  PrincipalRegisterService, PrincipalSettingsService, isDayCloseUnavailable,
} from '@/lib/principal-service';
import {
  exportDailyFinanceReportExcel, exportDailyFinanceReportPdf,
  exportMonthlyFinanceReportExcel, exportMonthlyFinanceReportPdf,
  type DailyFinanceReport, type MonthlyFinanceReport,
  exportExpenseReportExcel, exportExpenseReportPdf,
  type ExpenseReportData,
} from '@/lib/export-utils';
import {
  PRINCIPAL_MODE_LABELS, currentMonthKey, dateKeyLabel, describeReadError, formatINR,
  headLabel, modeLabel, monthKeyLabel, principalWriteError, refreshFailedMessage,
  todayKey, usePrincipalActor,
} from '../principal-shared';
import { BalanceCard } from './accounts-ui';
import AccountsDaily from './AccountsDaily';
import AccountsExpenses from './AccountsExpenses';
import AccountsHome from './AccountsHome';
import AccountsMonthly from './AccountsMonthly';
import AccountsPeople from './AccountsPeople';
import DayClosePanel from './DayClosePanel';
import ModeTotalsPanel from './ModeTotalsPanel';
import StudentDetailSheet from '../registers/StudentDetailSheet';
import RecordPaymentModal from '../registers/RecordPaymentModal';
import EditStudentFeesSheet from '../registers/EditStudentFeesSheet';
import PickStudentDialog from '../note/PickStudentDialog';
import { toActor } from '../registers/register-shared';
import AuditTrailModal from '../activity/AuditTrailModal';
import ExpenseEntryModal from '../ExpenseEntryModal';
import OpeningBalancesCard from '../OpeningBalancesCard';
import type {
  PrincipalDayClose, PrincipalExpense, PrincipalPayment, PrincipalSettings,
  RegisterRow, RowSummary,
} from '@/types/principal';

type ViewMode = 'home' | 'daily' | 'monthly' | 'people' | 'expenses';

/**
 * Clock time an entry was recorded ('09:15 am'), for the export's Time column.
 * This is the ENTRY stamp, not the business date — the date column carries
 * that, and a backdated receipt keeps its own date with the time it was typed.
 */
function entryTime(at: Date | null | undefined): string {
  if (!at || Number.isNaN(at.getTime?.() ?? NaN)) return '';
  return at.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

/** One of the four day-at-a-glance tiles on the Today tab. */
function DayStat({ label, value, hint, color }: {
  label: string;
  value: string;
  hint?: string;
  color?: string;
}) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', minWidth: 0,
    }}>
      <div className="text-overline" style={{ color: 'var(--color-text-tertiary)' }}>{label}</div>
      <div style={{
        fontSize: '1.25rem', fontWeight: 700, wordBreak: 'break-word',
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

const CASH_GRADIENT = 'linear-gradient(135deg,#059669,#10B981)';
const BANK_GRADIENT = 'linear-gradient(135deg,#2563EB,#3B82F6)';
const TOTAL_GRADIENT = 'linear-gradient(135deg,#7C3AED,#8B5CF6)';

export default function AccountsSection({ initialView = 'daily' }: { initialView?: ViewMode }) {
  const { user, role } = useAuth();
  const { school } = useSchool();
  const { showToast } = useToast();
  const actor = usePrincipalActor();
  /* The register modals stamp their own actor shape (uid/name/role from the
     session), the same one the register screens pass. */
  const registerActor = useMemo(() => toActor(user, role), [user, role]);

  const canView = hasCapability(role, 'viewPrincipalAccounts');
  const academicYear = school?.academicYear || '';

  const [payments, setPayments] = useState<PrincipalPayment[]>([]);
  const [expenses, setExpenses] = useState<PrincipalExpense[]>([]);
  const [settings, setSettings] = useState<PrincipalSettings | null>(null);
  /* Register rows power the outstanding figures and the teacher/student walk.
     Loaded in the SAME round trip as the payments this screen already fetches,
     so the finance home costs one load, not two (§39). A rows failure is NOT
     fatal — the ledgers and both balances still render without them. */
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [rowsLoaded, setRowsLoaded] = useState(false);
  /* A rows failure is non-fatal for the ledgers, but it must NEVER read as
     "still loading" or as "there are no students" — the Principal would think
     the register had emptied (§17, §18). Held separately so the outstanding
     panel and the student list can say what actually happened. */
  const [rowsError, setRowsError] = useState<string | null>(null);
  /* Day-close records for the year (Phase 3 §16). Non-fatal like rows. */
  const [dayCloses, setDayCloses] = useState<PrincipalDayClose[]>([]);
  const [closingDay, setClosingDay] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  /* The nav decides the landing tab: "Today's Billing & Expenses" opens the
     day's workspace, "Accounts (Monthly)" opens the month view. */
  const [view, setView] = useState<ViewMode>(initialView);
  /* Student drill-down, shared by the people tab and the search results. */
  const [detailRow, setDetailRow] = useState<RegisterRow | null>(null);
  const [paymentRow, setPaymentRow] = useState<RegisterRow | null>(null);
  /* Fill the fee amounts right from the student's account — the import →
     set fees → collect workflow, without a trip back to the Fees Note. */
  const [editFeesRow, setEditFeesRow] = useState<RegisterRow | null>(null);
  /* "Add Billing" on the Daily tab: pick the student, then the payment form. */
  const [pickBillingOpen, setPickBillingOpen] = useState(false);
  const [dateKey, setDateKey] = useState(todayKey);
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  /* Expense-report window. Empty means "not chosen yet" — the effective bounds
     below fall back to the academic year so far, which cannot be computed at
     mount time (the school doc, and with it academicYear, arrives later). */
  const [fromKey, setFromKey] = useState('');
  const [toKey, setToKey] = useState('');

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PrincipalExpense | null>(null);
  const [paymentDeleteTarget, setPaymentDeleteTarget] = useState<PrincipalPayment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<PrincipalExpense | null>(null);
  const [exporting, setExporting] = useState(false);

  /* ── Load (throws on failure so callers can distinguish a bad refetch) ── */

  const load = useCallback(async () => {
    if (!academicYear || !canView) return;
    const [loadedPayments, loadedExpenses, loadedSettings, loadedRows, loadedCloses] = await Promise.all([
      PrincipalPaymentsService.listByYear(academicYear),
      PrincipalExpensesService.listByYear(academicYear),
      PrincipalSettingsService.get(),
      // Never fatal: the day/month sheets and the balances do not need rows,
      // so a register failure must not blank the whole accounts screen.
      PrincipalRegisterService.listRows(academicYear).catch(error => {
        console.error('[accounts] register rows load failed', error);
        return { failed: describeReadError(error, 'the student register') };
      }),
      // A rules denial is already handled inside the service (Day Close is
      // simply unavailable until its rules ship). This catch is for the rest:
      // offline, backend down — non-fatal for the ledgers either way.
      PrincipalDayCloseService.listByYear(academicYear).catch(closeError => {
        console.warn('[accounts] day-close records could not be read', closeError);
        return null;
      }),
    ]);
    setPayments(loadedPayments);
    setExpenses(loadedExpenses);
    setSettings(loadedSettings);
    if (Array.isArray(loadedRows)) {
      setRows(loadedRows);
      setRowsLoaded(true);
      setRowsError(null);
    } else {
      // Keep whatever rows we already had on screen rather than blanking them.
      setRowsError(loadedRows.failed);
    }
    if (loadedCloses) setDayCloses(loadedCloses);
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

  /* ── Register summaries (Phase 2 §4, §7, §8) ──────────────────────────
     Computed ONCE here and handed down: the teacher roll-up, the outstanding
     figures and the student list all read the same memoized summary, so they
     can never disagree and the engine runs once per row per load. */

  const paymentsByRowId = useMemo(() => groupPaymentsByRow(payments), [payments]);

  const summaries = useMemo(() => {
    const map = new Map<string, RowSummary>();
    for (const row of rows) {
      map.set(row.id, computeRowSummary(row, paymentsByRowId[row.id] ?? [], new Date()));
    }
    return map;
  }, [rows, paymentsByRowId]);

  const summaryFor = useCallback(
    (rowId: string): RowSummary => summaries.get(rowId) ?? emptyRowSummary(),
    [summaries],
  );

  const outstanding = useMemo(
    () => (rowsLoaded ? computeOutstandingSummary(rows, summaryFor) : null),
    [rowsLoaded, rows, summaryFor],
  );

  const paymentsForRow = useCallback(
    (rowId: string): PrincipalPayment[] => paymentsByRowId[rowId] ?? [],
    [paymentsByRowId],
  );

  /* ── Expense report window (June 1 of the academic year → today by default) ── */

  const reportFrom = fromKey || `${academicYearStartYear(academicYear)}-06-01`;
  const reportTo = toKey || todayKey();

  const expenseReport = useMemo(
    () => computeExpenseReport(expenses, reportFrom, reportTo),
    [expenses, reportFrom, reportTo],
  );

  /** The entries behind the report, newest first — same filter the engine uses. */
  const rangeExpenses = useMemo(
    () => expenses
      .filter(expense => expense.deleted !== true)
      .filter(expense => !!expense.dateKey && isWithinRange(expense.dateKey, reportFrom, reportTo))
      .sort((a, b) => (b.dateKey || '').localeCompare(a.dateKey || '')),
    [expenses, reportFrom, reportTo],
  );

  /** Closing balances at the END of the report window, for the cards on top. */
  const reportEndLedger = useMemo(
    () => computeDailyLedger(payments, expenses, settings, reportTo),
    [payments, expenses, settings, reportTo],
  );

  /* ── Day close (Phase 3 §16–§18) ── */

  const dayCloseForDate = useMemo(
    () => dayCloses.find(record => record.dateKey === dateKey) ?? null,
    [dayCloses, dateKey],
  );

  /* Set once a day-close read has been denied: the collection's rules are not
     deployed yet, so the panel explains that instead of offering a close that
     would fail. Read after `loading` so it reflects the completed load. */
  const dayCloseUnavailable = !loading && isDayCloseUnavailable();

  const handleCloseDay = async (actualCash: number, note: string) => {
    if (closingDay || !actor) return;
    setClosingDay(true);
    try {
      await PrincipalDayCloseService.close({
        dateKey,
        academicYear,
        expectedCash: dailyLedger.cashInHand,
        actualCash,
        note: note || undefined,
      }, actor);
      showToast(`${dateKey} closed`);
    } catch (error) {
      console.error('[accounts] day close failed', { dateKey, error });
      showToast(principalWriteError(error, 'Only the Principal can close a day.'), 'error');
      setClosingDay(false);
      return;
    }
    try {
      await load();
    } catch (error) {
      // The close COMMITTED — a refetch failure must not read as "not closed".
      console.error('[accounts] refresh after day close failed', error);
      showToast(refreshFailedMessage(`${dateKey} closed`), 'warning');
    } finally {
      setClosingDay(false);
    }
  };

  const handleReopenDay = async () => {
    if (closingDay || !actor) return;
    setClosingDay(true);
    try {
      await PrincipalDayCloseService.reopen(dateKey, actor);
      showToast(`${dateKey} reopened — close it again when the correction is done`);
    } catch (error) {
      console.error('[accounts] day reopen failed', { dateKey, error });
      showToast(principalWriteError(error, 'Only the Principal can reopen a day.'), 'error');
      setClosingDay(false);
      return;
    }
    try {
      await load();
    } catch (error) {
      console.error('[accounts] refresh after reopen failed', error);
      showToast(refreshFailedMessage(`${dateKey} reopened`), 'warning');
    } finally {
      setClosingDay(false);
    }
  };

  /* ── Per-method money (§5, §6, §14) — one engine call per window ── */

  const monthStart = `${monthKey}-01`;
  const monthEnd = `${monthKey}-31`; // string compare: '-31' covers every month

  const dayModes = useMemo(
    () => computeModeTotals(payments, expenses, dateKey, dateKey),
    [payments, expenses, dateKey],
  );
  const monthModes = useMemo(
    () => computeModeTotals(payments, expenses, monthStart, monthEnd),
    [payments, expenses, monthStart, monthEnd],
  );
  const yearModes = useMemo(
    () => computeModeTotals(payments, expenses, '', ''),
    [payments, expenses],
  );

  const isHome = view === 'home';
  const isDaily = view === 'daily';
  const isMonthly = view === 'monthly';
  const isPeople = view === 'people';
  const isExpenses = view === 'expenses';
  const activeLedger = isDaily ? dailyLedger
    : isMonthly ? monthlyLedger
      : isExpenses ? reportEndLedger
        : dailyLedger;
  const periodNote = isMonthly
    ? `end of ${monthKeyLabel(monthKey)}`
    : isExpenses
      ? `as of ${reportTo}`
      : `as of ${dateKey}`;
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

  /* ── Payment soft-delete (same contract as expenses) ── */

  const handleDeletePayment = async () => {
    if (!paymentDeleteTarget || deleting) return;
    setDeleting(true);
    try {
      await PrincipalPaymentsService.softDelete(paymentDeleteTarget.id, actor);
    } catch (error) {
      console.error('Payment delete failed', { id: paymentDeleteTarget.id, error });
      showToast(principalWriteError(error, 'Only the Principal can delete a payment.'), 'error');
      setDeleting(false);
      return;
    }

    setPaymentDeleteTarget(null);
    try {
      await load();
      showToast('Payment removed — kept in the activity log');
    } catch (error) {
      console.error('Post-delete refresh failed', error);
      showToast(refreshFailedMessage('Payment removed'), 'warning');
    } finally {
      setDeleting(false);
    }
  };

  /* ── Exports (complete file or a failure toast — never a partial file) ── */

  /**
   * The Monthly Billing & Expense Report. Same shared-object rule as the daily
   * one, and the day-by-day table is computeMonthlyLedger().days verbatim —
   * the month and its days can never disagree because they are one calculation.
   * Built from data already in memory; no extra Firestore reads.
   */
  const buildMonthlyFinanceReport = (): MonthlyFinanceReport => ({
    schoolName: school?.name || 'School',
    academicYear,
    monthKey,
    monthLabel: monthKeyLabel(monthKey),
    periodLabel: monthlyLedger.days.length > 0
      ? `${dateKeyLabel(monthlyLedger.days[0].dateKey)} - `
        + `${dateKeyLabel(monthlyLedger.days[monthlyLedger.days.length - 1].dateKey)}`
      : monthKeyLabel(monthKey),
    generatedAt: new Date().toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }),
    preparedBy: actor.name || 'Principal',
    billing: monthPayments.map(payment => {
      const row = rows.find(candidate => candidate.id === payment.rowId);
      return {
        date: dateKeyLabel(payment.dateKey),
        student: payment.studentName || '',
        className: payment.className || '',
        section: row?.sectionName || '',
        teacher: row?.teacherName || '',
        head: headLabel(payment.head),
        month: payment.month || '',
        method: modeLabel(payment.mode),
        amount: Number(payment.amount) || 0,
      };
    }),
    expenses: monthExpenses.map(expense => ({
      date: dateKeyLabel(expense.dateKey),
      payee: expense.paidTo || '',
      purpose: expense.description || '',
      category: expense.category || '',
      method: modeLabel(expense.mode),
      amount: Number(expense.amount) || 0,
    })),
    methodRows: monthModes.rows.map(modeRow => ({
      method: PRINCIPAL_MODE_LABELS[modeRow.mode],
      billing: modeRow.collected,
      expenses: modeRow.spent,
      net: modeRow.net,
    })),
    dailyBreakdown: monthlyLedger.days.map(day => ({
      date: dateKeyLabel(day.dateKey),
      billing: day.income,
      expenses: day.expense,
      net: day.income - day.expense,
    })),
    billingTotal: monthlyLedger.income,
    expenseTotal: monthlyLedger.expense,
    netTotal: monthlyLedger.income - monthlyLedger.expense,
    cashInHand: monthlyLedger.cashInHand,
    bankBalance: monthlyLedger.bankBalance,
  });

  /**
   * The Daily Billing & Expense Report — built ONCE and handed to whichever
   * exporter the Principal picked, so the PDF and the Excel are guaranteed to
   * carry identical figures. Every number here comes from the engine
   * (computeDailyLedger / computeModeTotals); nothing is re-added.
   */
  const buildDailyFinanceReport = (): DailyFinanceReport => ({
    schoolName: school?.name || 'School',
    academicYear,
    dateKey,
    dateLabel: dateKeyLabel(dateKey),
    generatedAt: new Date().toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }),
    preparedBy: actor.name || 'Principal',
    billing: dayPayments.map(payment => {
      const row = rows.find(candidate => candidate.id === payment.rowId);
      return {
        time: entryTime(payment.createdAt),
        student: payment.studentName || '',
        className: payment.className || '',
        section: row?.sectionName || '',
        teacher: row?.teacherName || '',
        head: headLabel(payment.head),
        month: payment.month || '',
        method: modeLabel(payment.mode),
        amount: Number(payment.amount) || 0,
      };
    }),
    expenses: dayExpenses.map(expense => ({
      time: entryTime(expense.createdAt),
      payee: expense.paidTo || '',
      purpose: expense.description || '',
      category: expense.category || '',
      method: modeLabel(expense.mode),
      amount: Number(expense.amount) || 0,
    })),
    methodRows: dayModes.rows.map(modeRow => ({
      method: PRINCIPAL_MODE_LABELS[modeRow.mode],
      billing: modeRow.collected,
      expenses: modeRow.spent,
      net: modeRow.net,
    })),
    billingTotal: dailyLedger.income,
    expenseTotal: dailyLedger.expense,
    netTotal: dailyLedger.income - dailyLedger.expense,
    cashInHand: dailyLedger.cashInHand,
    bankBalance: dailyLedger.bankBalance,
  });

  /* Totals come straight off the computed report — never re-added here, so the
     file can never disagree with the screen it was exported from. */
  const buildExpenseReportData = (): ExpenseReportData => ({
    schoolName: school?.name || 'School',
    academicYear,
    fromKey: reportFrom,
    toKey: reportTo,
    categories: expenseReport.categories.map(category => ({
      category: category.category,
      count: category.count,
      cash: category.cash,
      bank: category.bank,
      total: category.total,
      share: category.share,
    })),
    entries: rangeExpenses.map(expense => ({
      dateKey: expense.dateKey || '',
      category: expenseCategoryLabel(expense.category),
      description: expense.description || '',
      mode: modeLabel(expense.mode),
      enteredBy: expense.enteredByName || '',
      amount: Number(expense.amount) || 0,
    })),
    totalCash: expenseReport.cash,
    totalBank: expenseReport.bank,
    total: expenseReport.total,
    count: expenseReport.count,
  });

  const handleExport = async (format: 'excel' | 'pdf') => {
    if (exporting) return;
    setExporting(true);
    try {
      if (isDaily) {
        // ONE report object for both formats, so the figures can never differ.
        const report = buildDailyFinanceReport();
        if (format === 'excel') await exportDailyFinanceReportExcel(report);
        else await exportDailyFinanceReportPdf(report);
      } else if (isMonthly || isHome || isPeople) {
        // Home and the student walk have no sheet of their own; the month
        // report is the sensible thing to hand someone from there.
        const report = buildMonthlyFinanceReport();
        if (format === 'excel') await exportMonthlyFinanceReportExcel(report);
        else await exportMonthlyFinanceReportPdf(report);
      } else {
        const data = buildExpenseReportData();
        if (format === 'excel') await exportExpenseReportExcel(data);
        else await exportExpenseReportPdf(data);
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
            <h2 className="text-h1">Billing &amp; Expenses</h2>
            <Badge variant="primary">{academicYear}</Badge>
          </div>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            Record money received and money spent, day by day — with Cash in Hand and Bank Balance.
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
          tabs={[
            { id: 'daily', label: 'Today' },
            { id: 'monthly', label: 'Monthly' },
            { id: 'people', label: 'Students' },
            { id: 'expenses', label: 'Expenses' },
            { id: 'home', label: 'Overview' },
          ]}
          activeTab={view}
          onChange={id => setView(
            id === 'monthly' || id === 'expenses' || id === 'people' || id === 'daily'
              ? id
              : 'home',
          )}
        />
      </div>

      {isHome ? (
        <AccountsHome
          dateKey={dateKey}
          monthKey={monthKey}
          daily={dailyLedger}
          monthly={monthlyLedger}
          outstanding={outstanding}
          outstandingError={rowsError}
          onRetryRegister={retry}
          dayModes={dayModes}
          monthModes={monthModes}
          yearModes={yearModes}
          cashInHand={dailyLedger.cashInHand}
          bankBalance={dailyLedger.bankBalance}
          onOpenStudents={() => setView('people')}
          onAddExpense={() => setExpenseModalOpen(true)}
        />
      ) : isPeople ? (
        <AccountsPeople
          rows={rows}
          summaryFor={summaryFor}
          loading={!rowsLoaded && !rowsError}
          error={rowsError}
          onRetry={retry}
          onOpenStudent={setDetailRow}
          onRecordPayment={setPaymentRow}
        />
      ) : isDaily ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* The day at a glance: income, spend, net and the drawer (§12). */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 'var(--space-3)',
          }}>
            <DayStat
              label="Income / Fees Collected"
              value={formatINR(dailyLedger.income)}
              hint={`from ${dayPayments.length} ${dayPayments.length === 1 ? 'payment' : 'payments'}`}
              color="var(--color-success)"
            />
            <DayStat
              label="Total Expenses"
              value={formatINR(dailyLedger.expense)}
              hint={`from ${dayExpenses.length} ${dayExpenses.length === 1 ? 'expense' : 'expenses'}`}
              color="var(--color-error)"
            />
            <DayStat
              label="Net Amount"
              value={formatINR(dailyLedger.income - dailyLedger.expense)}
              hint="income − expenses"
            />
            <DayStat
              label="Cash in Hand"
              value={formatINR(dailyLedger.cashInHand)}
              hint={`as of ${dateKey}`}
            />
          </div>

          {/* The day's two actions (§23). */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            <Button variant="primary" icon={<PlusIcon size={16} color="white" />} onClick={() => setPickBillingOpen(true)}>
              Add Billing
            </Button>
            <Button variant="secondary" icon={<PlusIcon size={16} />} onClick={() => setExpenseModalOpen(true)}>
              Add Expense
            </Button>
          </div>
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
            onDeletePayment={setPaymentDeleteTarget}
            openingAsOf={openingAsOf}
          />
          <ModeTotalsPanel totals={dayModes} title={`By payment method — ${dateKey}`} />
          <DayClosePanel
            dateKey={dateKey}
            cashCollected={dailyLedger.incomeCash}
            cashSpent={dailyLedger.expenseCash}
            expectedCash={dailyLedger.cashInHand}
            record={dayCloseForDate}
            unavailable={dayCloseUnavailable}
            busy={closingDay}
            onCloseDay={(actualCash, note) => void handleCloseDay(actualCash, note)}
            onReopenDay={() => void handleReopenDay()}
          />
        </div>
      ) : isMonthly ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              {monthPayments.length} {monthPayments.length === 1 ? 'payment' : 'payments'}
              {' · '}
              {monthExpenses.length} {monthExpenses.length === 1 ? 'expense' : 'expenses'} this month
            </span>
          </div>
          <AccountsMonthly
            monthKey={monthKey}
            maxMonth={currentMonthKey()}
            onMonthChange={setMonthKey}
            ledger={monthlyLedger}
            payments={monthPayments}
            expenses={monthExpenses}
            openingAsOf={openingAsOf}
          />
          <ModeTotalsPanel totals={monthModes} title={`By payment method — ${monthKeyLabel(monthKey)}`} />
        </div>
      ) : (
        <AccountsExpenses
          fromKey={reportFrom}
          toKey={reportTo}
          maxDate={todayKey()}
          onFromChange={setFromKey}
          onToChange={setToKey}
          report={expenseReport}
          entries={rangeExpenses}
          canManageExpenses={canView}
          onDeleteExpense={setDeleteTarget}
          onShowExpenseHistory={setHistoryTarget}
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

      {/* Student drill-down (§9) and payment entry (§10) — the SAME components
          the class-wise and teacher-wise registers use, so the profile, the
          history and the duplicate protection behave identically here. */}
      {detailRow && (
        <StudentDetailSheet
          row={detailRow}
          summary={summaryFor(detailRow.id)}
          payments={paymentsForRow(detailRow.id)}
          onClose={() => setDetailRow(null)}
          onRecordPayment={() => {
            const row = detailRow;
            setDetailRow(null);
            setPaymentRow(row);
          }}
          onEditFees={() => {
            const row = detailRow;
            setDetailRow(null);
            setEditFeesRow(row);
          }}
          actor={registerActor}
          canDeletePayments
          onPaymentsChanged={async () => {
            try { await load(); return true; } catch { return false; }
          }}
        />
      )}

      {editFeesRow && (
        <EditStudentFeesSheet
          row={editFeesRow}
          actor={registerActor}
          onClose={() => setEditFeesRow(null)}
          onSaved={async () => {
            try { await load(); return true; } catch { return false; }
          }}
        />
      )}

      {paymentRow && registerActor && (
        <RecordPaymentModal
          row={paymentRow}
          summary={summaryFor(paymentRow.id)}
          payments={paymentsForRow(paymentRow.id)}
          actor={registerActor}
          onClose={() => setPaymentRow(null)}
          onSaved={async () => {
            try {
              await load();
              return true;
            } catch (error) {
              // The write COMMITTED; only the refetch failed. Never report
              // this as "not saved" (§30).
              console.error('Post-payment refresh failed', error);
              return false;
            }
          }}
          onReopenDay={async (blockedKey: string) => {
            if (!actor) return false;
            try {
              await PrincipalDayCloseService.reopen(blockedKey, actor);
              await load();
              return true;
            } catch (error) {
              console.error('[accounts] reopen from payment form failed', error);
              showToast(principalWriteError(error, 'Could not reopen that day.'), 'error');
              return false;
            }
          }}
        />
      )}

      <PickStudentDialog
        isOpen={pickBillingOpen}
        rows={rows}
        onClose={() => setPickBillingOpen(false)}
        onPick={row => {
          setPickBillingOpen(false);
          setPaymentRow(row);
        }}
      />

      <ConfirmDialog
        isOpen={!!paymentDeleteTarget}
        onClose={() => { if (!deleting) setPaymentDeleteTarget(null); }}
        onConfirm={() => void handleDeletePayment()}
        title="Remove this payment?"
        message={`${formatINR(paymentDeleteTarget?.amount)} from ${paymentDeleteTarget?.studentName || 'a student'} `
          + `(${paymentDeleteTarget?.dateKey || ''}). It leaves the student's balance and every `
          + 'income total, but stays in the activity log permanently.'}
        confirmLabel="Remove payment"
      />

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
