'use client';

/* ============================================
   Principal Accounts — income & expense balance sheet
   ============================================
   Page key 'accounts' (viewAccounts capability). Daily view: fee income by
   mode vs expenses by mode on a dateKey; Cash in Hand + Bank Balance via
   fee-utils computeBalances seeded from accounts/settings openings. Monthly
   view: aggregates + income-vs-expense bar chart. Expense entry lives here
   (principal-only, doc D9) with full audit parity.
   All aggregates exclude soft-deleted docs. */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { useToast } from '@/components/ui/Toast';
import { FeePaymentsService, ExpensesService } from '@/lib/firestore-service';
import Button from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import Modal from '@/components/ui/Modal';
import { Badge, Tabs } from '@/components/ui/SharedUI';
import { PlusIcon, DownloadIcon, TrashIcon, ClockIcon } from '@/components/ui/Icons';
import {
  computeBalances, excludeDeleted, expenseDateKey, paymentDateKey, toDateKey,
} from '@/lib/fee-utils';
import {
  exportDailyBalanceSheetExcel, exportDailyBalanceSheetPdf,
  exportMonthlyBalanceSheetExcel, exportMonthlyBalanceSheetPdf,
  type DailySheetData, type MonthlySheetData, type LabeledAmount,
} from '@/lib/export-utils';
import type { AccountsSettings, Expense, FeePayment } from '@/types/models';
import {
  EXPENSE_MODE_LABELS, PAYMENT_MODE_LABELS, describeReadError, describeWriteError,
  fetchExpenseHistory, loadAccountsSettings, softDeleteExpenseWithHistory,
  type ExpenseHistoryRow,
} from './principal-shared';
import ExpenseEntryModal from './ExpenseEntryModal';
import OpeningBalancesCard from './OpeningBalancesCard';

type ViewMode = 'daily' | 'monthly';

const PAYMENT_MODES = ['cash', 'upi', 'cheque', 'bank_transfer'] as const;
const EXPENSE_MODES = ['cash', 'bank'] as const;

function sumIncomeByMode(payments: FeePayment[]): LabeledAmount[] {
  return PAYMENT_MODES.map(mode => ({
    label: PAYMENT_MODE_LABELS[mode],
    amount: payments
      .filter(p => (p.mode || 'cash') === mode)
      .reduce((s, p) => s + (Number(p.amount) || 0), 0),
  }));
}

function sumExpensesByMode(expenses: Expense[]): LabeledAmount[] {
  return EXPENSE_MODES.map(mode => ({
    label: EXPENSE_MODE_LABELS[mode],
    amount: expenses
      // Historical expenses without paymentMode default to cash (doc, scope item 4).
      .filter(e => (e.paymentMode || 'cash') === mode)
      .reduce((s, e) => s + (Number(e.amount) || 0), 0),
  }));
}

const sumAmounts = (rows: { amount?: number | null }[]): number =>
  rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

export default function PrincipalAccounts() {
  const { user, role } = useAuth();
  const { school } = useSchool();
  const { showToast } = useToast();

  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<AccountsSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const todayKey = toDateKey(new Date());
  const [view, setView] = useState<ViewMode>('daily');
  const [dateSel, setDateSel] = useState(todayKey);
  const [monthSel, setMonthSel] = useState(todayKey.slice(0, 7));

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<Expense | null>(null);
  const [historyRows, setHistoryRows] = useState<ExpenseHistoryRow[] | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!school?.academicYear) return;
    setLoadError(null);
    try {
      const [p, e, s] = await Promise.all([
        FeePaymentsService.getAll(school.academicYear),
        ExpensesService.getAll(school.academicYear),
        loadAccountsSettings(),
      ]);
      setPayments(p as unknown as FeePayment[]);
      setExpenses(e as unknown as Expense[]);
      setSettings(s);
    } catch (err) {
      console.error('Accounts load failed', err);
      setLoadError(describeReadError(err, 'the accounts dashboard'));
    }
  }, [school?.academicYear]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const livePayments = useMemo(() => excludeDeleted(payments), [payments]);
  const liveExpenses = useMemo(() => excludeDeleted(expenses), [expenses]);

  // Balances as of end of the selected day / month ('-99' > any day key).
  const cutoffKey = view === 'daily' ? dateSel : `${monthSel}-99`;
  const balances = useMemo(() => computeBalances(
    livePayments.filter(p => { const k = paymentDateKey(p); return !!k && k <= cutoffKey; }),
    liveExpenses.filter(e => { const k = expenseDateKey(e); return !!k && k <= cutoffKey; }),
    {
      openingCash: settings?.openingCash ?? 0,
      openingBank: settings?.openingBank ?? 0,
      openingAsOf: settings?.openingAsOf || null,
    },
  ), [livePayments, liveExpenses, settings, cutoffKey]);

  const dayPayments = useMemo(
    () => livePayments
      .filter(p => paymentDateKey(p) === dateSel)
      .sort((a, b) => (b.paidAt ? new Date(b.paidAt).getTime() : 0) - (a.paidAt ? new Date(a.paidAt).getTime() : 0)),
    [livePayments, dateSel],
  );
  const dayExpenses = useMemo(
    () => liveExpenses.filter(e => expenseDateKey(e) === dateSel),
    [liveExpenses, dateSel],
  );
  const monthPayments = useMemo(
    () => livePayments.filter(p => (paymentDateKey(p) || '').slice(0, 7) === monthSel),
    [livePayments, monthSel],
  );
  const monthExpenses = useMemo(
    () => liveExpenses.filter(e => (expenseDateKey(e) || '').slice(0, 7) === monthSel),
    [liveExpenses, monthSel],
  );

  // Day-by-day flows of the selected month (openings-independent — raw flows).
  const monthDays = useMemo(() => {
    const flows = computeBalances(monthPayments, monthExpenses, {});
    return Object.entries(flows.byDay)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([dateKey, f]) => ({ dateKey, ...f }));
  }, [monthPayments, monthExpenses]);

  const monthLabel = new Date(`${monthSel}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const chartData = useMemo(() => monthDays.map(d => ({
    day: d.dateKey.slice(8),
    Income: d.cashIn + d.bankIn,
    Expense: d.cashOut + d.bankOut,
  })), [monthDays]);

  /* ── Expense soft-delete + history ── */

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await softDeleteExpenseWithHistory(deleteTarget, {
        id: user?.id || '', name: user?.name || 'Principal', role: role || 'principal',
      });
      showToast('Expense removed (kept in the audit trail)');
      setDeleteTarget(null);
      await load();
    } catch (e) {
      console.error('Expense delete failed', { id: deleteTarget.id, error: e });
      showToast(describeWriteError(e, 'remove expenses', 'The deletion'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const openHistory = async (expense: Expense) => {
    setHistoryTarget(expense);
    setHistoryRows(null);
    try {
      setHistoryRows(await fetchExpenseHistory(expense.id));
    } catch (e) {
      console.error('Expense history load failed', { id: expense.id, error: e });
      showToast(describeReadError(e, 'the expense history'), 'error');
      setHistoryTarget(null);
    }
  };

  /* ── Exports (complete file or failure toast — never partial) ── */

  const buildDailyData = (): DailySheetData => ({
    schoolName: school?.name || 'School',
    academicYear: school?.academicYear || '',
    dateKey: dateSel,
    incomeByMode: sumIncomeByMode(dayPayments),
    expensesByMode: sumExpensesByMode(dayExpenses),
    payments: dayPayments.map(p => ({
      receipt: p.receiptNumber || '',
      student: p.studentName || '',
      className: p.className || '',
      category: p.category || '',
      mode: PAYMENT_MODE_LABELS[p.mode] || p.mode || '',
      amount: Number(p.amount) || 0,
    })),
    expenses: dayExpenses.map(e => ({
      category: e.category || '',
      description: e.description || '',
      mode: EXPENSE_MODE_LABELS[e.paymentMode || 'cash'],
      amount: Number(e.amount) || 0,
    })),
    totalIncome: sumAmounts(dayPayments),
    totalExpense: sumAmounts(dayExpenses),
    cashInHand: balances.cash,
    bankBalance: balances.bank,
  });

  const buildMonthlyData = (): MonthlySheetData => ({
    schoolName: school?.name || 'School',
    academicYear: school?.academicYear || '',
    monthKey: monthSel,
    monthLabel,
    days: monthDays,
    totalIncome: sumAmounts(monthPayments),
    totalExpense: sumAmounts(monthExpenses),
    cashInHand: balances.cash,
    bankBalance: balances.bank,
  });

  const handleExport = async (format: 'excel' | 'pdf') => {
    if (exporting) return;
    setExporting(true);
    try {
      if (view === 'daily') {
        if (format === 'excel') await exportDailyBalanceSheetExcel(buildDailyData());
        else await exportDailyBalanceSheetPdf(buildDailyData());
      } else {
        if (format === 'excel') await exportMonthlyBalanceSheetExcel(buildMonthlyData());
        else await exportMonthlyBalanceSheetPdf(buildMonthlyData());
      }
      showToast('Export ready — check your downloads');
    } catch (e) {
      console.error('Balance sheet export failed', { view, format, error: e });
      showToast('Export failed — no file was generated. Please retry.', 'error');
    } finally {
      setExporting(false);
    }
  };

  /* ── Render ── */

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page-container">
        <div style={{
          padding: 'var(--space-8)', textAlign: 'center', background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)',
        }}>
          <p className="text-body" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>Could not load the accounts dashboard</p>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>{loadError}</p>
          <Button variant="primary" onClick={() => { setLoading(true); load().finally(() => setLoading(false)); }}>Retry</Button>
        </div>
      </div>
    );
  }

  const isEmptyYear = payments.length === 0 && expenses.length === 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 className="text-h1">Accounts</h2>
            <Badge variant="primary">{school?.academicYear}</Badge>
          </div>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            Daily and monthly income vs expenses — strictly for the Principal.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => handleExport('excel')} disabled={exporting} icon={<DownloadIcon size={16} />}>Excel</Button>
          <Button variant="secondary" onClick={() => handleExport('pdf')} disabled={exporting} icon={<DownloadIcon size={16} />}>PDF</Button>
          <Button variant="primary" onClick={() => setExpenseModalOpen(true)} icon={<PlusIcon size={18} color="white" />}>Add Expense</Button>
        </div>
      </div>

      {isEmptyYear && (
        <div style={{
          padding: 'var(--space-4)', marginBottom: 'var(--space-4)', borderRadius: 'var(--radius-md)',
          background: 'var(--color-info-bg)', color: 'var(--color-info)', fontSize: '0.875rem',
        }}>
          No collections or expenses recorded for {school?.academicYear} yet. Payments recorded in
          Fees and expenses added here will appear on this sheet automatically.
        </div>
      )}

      {/* Balance cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <BalanceCard label="Cash in Hand" amount={balances.cash} gradient="linear-gradient(135deg,#059669,#10B981)" note={`as of ${view === 'daily' ? dateSel : `end of ${monthLabel}`}`} />
        <BalanceCard label="Bank Balance" amount={balances.bank} gradient="linear-gradient(135deg,#2563EB,#3B82F6)" note={`as of ${view === 'daily' ? dateSel : `end of ${monthLabel}`}`} />
        <BalanceCard label="Total" amount={balances.total} gradient="linear-gradient(135deg,#7C3AED,#8B5CF6)" note={settings?.openingAsOf ? `openings set as of ${settings.openingAsOf}` : 'opening balances not set yet'} />
      </div>

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Tabs
          tabs={[{ id: 'daily', label: 'Daily' }, { id: 'monthly', label: 'Monthly' }]}
          activeTab={view}
          onChange={id => setView(id as ViewMode)}
        />
      </div>

      {view === 'daily' ? (
        <DailyView
          dateSel={dateSel}
          maxDate={todayKey}
          onDateChange={setDateSel}
          payments={dayPayments}
          expenses={dayExpenses}
          onDeleteExpense={setDeleteTarget}
          onShowHistory={openHistory}
        />
      ) : (
        <MonthlyView
          monthSel={monthSel}
          maxMonth={todayKey.slice(0, 7)}
          monthLabel={monthLabel}
          onMonthChange={setMonthSel}
          incomeByMode={sumIncomeByMode(monthPayments)}
          expensesByMode={sumExpensesByMode(monthExpenses)}
          totalIncome={sumAmounts(monthPayments)}
          totalExpense={sumAmounts(monthExpenses)}
          chartData={chartData}
          days={monthDays}
        />
      )}

      <div style={{ marginTop: 'var(--space-5)' }}>
        <OpeningBalancesCard settings={settings} onSaved={load} />
      </div>

      <ExpenseEntryModal
        isOpen={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        academicYear={school?.academicYear || ''}
        expenses={expenses}
        onSaved={load}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => { if (!deleting) setDeleteTarget(null); }}
        onConfirm={handleDelete}
        title="Remove this expense?"
        message={`₹${(Number(deleteTarget?.amount) || 0).toLocaleString()} — ${deleteTarget?.description || deleteTarget?.category || ''}. It will be excluded from all totals but kept in the audit trail.`}
        confirmLabel={deleting ? 'Removing…' : 'Remove'}
      />

      <Modal isOpen={!!historyTarget} onClose={() => setHistoryTarget(null)} title="Expense History" size="md">
        {historyRows === null ? (
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading history…</p>
        ) : historyRows.length === 0 ? (
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No history entries recorded for this expense.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {historyRows.map(h => (
              <div key={h.id} style={{ padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                  <Badge variant={h.action === 'deleted' ? 'error' : h.action === 'created' ? 'success' : 'info'}>{h.action}</Badge>
                  <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
                    {h.actorName}{h.at ? ` • ${h.at.toLocaleString('en-IN')}` : ''}
                  </span>
                </div>
                {h.before && (
                  <div className="text-caption" style={{ color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>
                    Before: ₹{Number(h.before.amount || 0).toLocaleString()} • {String(h.before.category || '')} • {String(h.before.description || '')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ── Subcomponents ────────────────────────────────────────────────────── */

function BalanceCard({ label, amount, gradient, note }: {
  label: string; amount: number; gradient: string; note: string;
}) {
  return (
    <div style={{ background: gradient, borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', color: 'white' }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 500, opacity: 0.85, marginBottom: 'var(--space-2)' }}>{label}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>₹{amount.toLocaleString('en-IN')}</div>
      <div style={{ fontSize: '0.75rem', opacity: 0.75, marginTop: 4 }}>{note}</div>
    </div>
  );
}

function ModeCard({ title, rows, total, accent }: {
  title: string; rows: LabeledAmount[]; total: number; accent: string;
}) {
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: 'var(--space-4)' }}>
      <div className="text-overline" style={{ marginBottom: 'var(--space-3)' }}>{title}</div>
      {rows.map(r => (
        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--color-divider)' }}>
          <span className="text-body-sm">{r.label}</span>
          <span className="text-body-sm" style={{ fontWeight: 600 }}>₹{r.amount.toLocaleString('en-IN')}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--space-2)', marginTop: 4 }}>
        <span className="text-body" style={{ fontWeight: 700 }}>Total</span>
        <span className="text-body" style={{ fontWeight: 700, color: accent }}>₹{total.toLocaleString('en-IN')}</span>
      </div>
    </div>
  );
}

function DailyView({ dateSel, maxDate, onDateChange, payments, expenses, onDeleteExpense, onShowHistory }: {
  dateSel: string;
  maxDate: string;
  onDateChange: (key: string) => void;
  payments: FeePayment[];
  expenses: Expense[];
  onDeleteExpense: (e: Expense) => void;
  onShowHistory: (e: Expense) => void;
}) {
  const totalIncome = sumAmounts(payments);
  const totalExpense = sumAmounts(expenses);
  const net = totalIncome - totalExpense;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <input
          type="date"
          value={dateSel}
          max={maxDate}
          onChange={e => onDateChange(e.target.value || maxDate)}
          style={{
            padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
            background: 'var(--color-surface)', fontSize: '0.9rem', outline: 'none',
          }}
        />
        <span className="text-body-sm" style={{ color: net >= 0 ? '#059669' : '#DC2626', fontWeight: 700 }}>
          Net for the day: {net >= 0 ? '' : '−'}₹{Math.abs(net).toLocaleString('en-IN')}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
        <ModeCard title="Fee Income by Mode" rows={sumIncomeByMode(payments)} total={totalIncome} accent="#059669" />
        <ModeCard title="Expenses by Mode" rows={sumExpensesByMode(expenses)} total={totalExpense} accent="#DC2626" />
      </div>

      {/* Day's collections */}
      <SectionTable
        title={`Fee Collections — ${dateSel}`}
        emptyText="No fee collections on this day."
        headers={['Receipt', 'Student', 'Class', 'Category', 'Mode', 'Amount']}
        rows={payments.map(p => [
          p.receiptNumber || '—',
          p.studentName || '—',
          p.className || '—',
          p.category || '—',
          PAYMENT_MODE_LABELS[p.mode] || p.mode || '—',
          `₹${(Number(p.amount) || 0).toLocaleString('en-IN')}`,
        ])}
      />

      {/* Day's expenses (with audit actions) */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', overflowX: 'auto' }}>
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-variant)' }}>
          <span className="text-overline">Expenses — {dateSel}</span>
        </div>
        {expenses.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
            <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No expenses on this day.</span>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-variant)' }}>
                <th style={th}>Category</th>
                <th style={th}>Description</th>
                <th style={th}>Mode</th>
                <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                <th style={{ ...th, width: 76 }}></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id} style={{ borderTop: '1px solid var(--color-divider)' }}>
                  <td style={td}><Badge variant="info">{e.category}</Badge></td>
                  <td style={td}>{e.description}</td>
                  <td style={td}>{EXPENSE_MODE_LABELS[e.paymentMode || 'cash']}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#DC2626' }}>₹{(Number(e.amount) || 0).toLocaleString('en-IN')}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button onClick={() => onShowHistory(e)} title="View history" style={iconBtn}><ClockIcon size={14} /></button>
                      <button onClick={() => onDeleteExpense(e)} title="Remove (soft delete)" style={{ ...iconBtn, color: 'var(--color-error)' }}><TrashIcon size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function MonthlyView({ monthSel, maxMonth, monthLabel, onMonthChange, incomeByMode, expensesByMode, totalIncome, totalExpense, chartData, days }: {
  monthSel: string;
  maxMonth: string;
  monthLabel: string;
  onMonthChange: (key: string) => void;
  incomeByMode: LabeledAmount[];
  expensesByMode: LabeledAmount[];
  totalIncome: number;
  totalExpense: number;
  chartData: { day: string; Income: number; Expense: number }[];
  days: { dateKey: string; cashIn: number; bankIn: number; cashOut: number; bankOut: number }[];
}) {
  const net = totalIncome - totalExpense;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <input
          type="month"
          value={monthSel}
          max={maxMonth}
          onChange={e => onMonthChange(e.target.value || maxMonth)}
          style={{
            padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
            background: 'var(--color-surface)', fontSize: '0.9rem', outline: 'none',
          }}
        />
        <span className="text-body-sm" style={{ color: net >= 0 ? '#059669' : '#DC2626', fontWeight: 700 }}>
          Net for {monthLabel}: {net >= 0 ? '' : '−'}₹{Math.abs(net).toLocaleString('en-IN')}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
        <ModeCard title={`Fee Income — ${monthLabel}`} rows={incomeByMode} total={totalIncome} accent="#059669" />
        <ModeCard title={`Expenses — ${monthLabel}`} rows={expensesByMode} total={totalExpense} accent="#DC2626" />
      </div>

      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: 'var(--space-4)' }}>
        <div className="text-overline" style={{ marginBottom: 'var(--space-3)' }}>Income vs Expense — day by day</div>
        {chartData.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
            <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No activity in {monthLabel}.</span>
          </div>
        ) : (
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-divider)" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip formatter={(v) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`} />
                <Legend />
                <Bar dataKey="Income" fill="#10B981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Expense" fill="#EF4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <SectionTable
        title={`Daily totals — ${monthLabel}`}
        emptyText={`No activity in ${monthLabel}.`}
        headers={['Date', 'Cash In', 'Bank In', 'Cash Out', 'Bank Out', 'Net']}
        rows={days.map(d => [
          d.dateKey,
          `₹${d.cashIn.toLocaleString('en-IN')}`,
          `₹${d.bankIn.toLocaleString('en-IN')}`,
          `₹${d.cashOut.toLocaleString('en-IN')}`,
          `₹${d.bankOut.toLocaleString('en-IN')}`,
          `₹${(d.cashIn + d.bankIn - d.cashOut - d.bankOut).toLocaleString('en-IN')}`,
        ])}
      />
    </div>
  );
}

function SectionTable({ title, emptyText, headers, rows }: {
  title: string; emptyText: string; headers: string[]; rows: string[][];
}) {
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', overflowX: 'auto' }}>
      <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-variant)' }}>
        <span className="text-overline">{title}</span>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>{emptyText}</span>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ background: 'var(--color-surface-variant)' }}>
              {headers.map((h, i) => (
                <th key={h} style={{ ...th, textAlign: i === headers.length - 1 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} style={{ borderTop: '1px solid var(--color-divider)' }}>
                {r.map((cell, ci) => (
                  <td key={ci} style={{ ...td, textAlign: ci === r.length - 1 ? 'right' : 'left', fontWeight: ci === r.length - 1 ? 700 : 400 }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left', padding: '10px 16px',
  fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
  color: 'var(--color-text-tertiary)', borderBottom: '1px solid var(--color-border)',
};
const td: React.CSSProperties = { padding: '10px 16px' };
const iconBtn: React.CSSProperties = {
  padding: 4, background: 'none', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex',
  color: 'var(--color-text-secondary)',
};
