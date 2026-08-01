'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ExpensesService } from '@/lib/firestore-service';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import Input from '@/components/ui/Input';
import { Select } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Badge } from '@/components/ui/SharedUI';
import { useToast } from '@/components/ui/Toast';
import { PlusIcon, TrashIcon } from '@/components/ui/Icons';
import type { Expense } from '@/types/models';

const CATEGORIES = [
  'Stationery',
  'Utilities',
  'Repairs & Maintenance',
  'Salary',
  'Transport',
  'Events',
  'Cleaning',
  'Food',
  'Other',
];

export default function SharedExpense() {
  const { user, role } = useAuth();
  const { school } = useSchool();
  const { showToast } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const [monthFilter, setMonthFilter] = useState<string>(currentMonth);

  const [form, setForm] = useState({
    amount: '', category: CATEGORIES[0], description: '', date: today,
  });

  const refresh = async () => {
    if (!school?.academicYear) return;
    try {
      const data = await ExpensesService.getAll(school.academicYear);
      const list = (data as unknown as Expense[]).sort((a, b) => (a.date < b.date ? 1 : -1));
      setExpenses(list);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [school?.academicYear]);

  const filtered = useMemo(() =>
    expenses.filter(e => (e.date || '').slice(0, 7) === monthFilter),
  [expenses, monthFilter]);

  const monthTotal = filtered.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const allTimeTotal = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const todayTotal = expenses.filter(e => e.date === today).reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const handleAdd = async () => {
    const amt = Number(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) { showToast('Enter a valid amount'); return; }
    if (!form.description.trim()) { showToast('Add a short description'); return; }
    setSaving(true);
    try {
      await ExpensesService.create({
        amount: amt,
        category: form.category,
        description: form.description.trim(),
        date: form.date || today,
        addedById: user?.id || '',
        addedByName: user?.name || 'Unknown',
        addedByRole: role || 'unknown',
        academicYear: school.academicYear,
      });
      showToast('Expense recorded');
      setAddOpen(false);
      setForm({ amount: '', category: CATEGORIES[0], description: '', date: today });
      await refresh();
    } catch (e) {
      console.error(e);
      showToast('Failed to record expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense entry?')) return;
    try {
      await ExpensesService.delete(id);
      await refresh();
      showToast('Deleted');
    } catch (e) {
      console.error(e);
      showToast('Failed to delete');
    }
  };

  const isCurrentMonth = monthFilter === currentMonth;
  const monthLabel = new Date(monthFilter + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  if (loading) {
    return <div className="page-container"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span></div></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 className="text-h1">Expenses</h2>
            <Badge variant="primary">{school?.academicYear}</Badge>
          </div>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            Record and review outflows — anyone on staff can add.
          </p>
        </div>
        <Button variant="primary" onClick={() => setAddOpen(true)} icon={<PlusIcon size={18} color="white" />}>
          Add Expense
        </Button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <div style={{ background: 'linear-gradient(135deg,#DC2626,#F87171)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', color: 'white' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 500, opacity: 0.85, marginBottom: 'var(--space-2)' }}>Today</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>₹{todayTotal.toLocaleString()}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg,#7C3AED,#8B5CF6)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 500, opacity: 0.9 }}>{isCurrentMonth ? 'This Month' : monthLabel}</span>
            <input
              type="month"
              value={monthFilter}
              max={currentMonth}
              onChange={e => setMonthFilter(e.target.value || currentMonth)}
              title="Pick a month"
              style={{
                background: 'rgba(255,255,255,0.18)', color: 'white', border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 'var(--radius-sm)', padding: '2px 6px', fontSize: '0.72rem', outline: 'none',
                colorScheme: 'dark', cursor: 'pointer',
              }}
            />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>₹{monthTotal.toLocaleString()}</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: 4 }}>
            {filtered.length} entr{filtered.length === 1 ? 'y' : 'ies'}{isCurrentMonth ? '' : ` in ${monthLabel}`}
          </div>
        </div>
        <div style={{ background: 'linear-gradient(135deg,#059669,#10B981)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', color: 'white' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 500, opacity: 0.85, marginBottom: 'var(--space-2)' }}>All-Time</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>₹{allTimeTotal.toLocaleString()}</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: 4 }}>{expenses.length} total entries</div>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            No expenses recorded for {isCurrentMonth ? 'this month' : monthLabel} yet.
          </p>
        </div>
      ) : (
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-variant)' }}>
                <th style={th}>Date</th>
                <th style={th}>Category</th>
                <th style={th}>Description</th>
                <th style={th}>Added by</th>
                <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                <th style={{ ...th, width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} style={{ borderTop: '1px solid var(--color-divider)' }}>
                  <td style={td}>{new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td style={td}><Badge variant="info">{e.category}</Badge></td>
                  <td style={td}>{e.description}</td>
                  <td style={{ ...td, color: 'var(--color-text-tertiary)' }}>{e.addedByName} <span style={{ opacity: 0.6 }}>· {e.addedByRole}</span></td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#DC2626' }}>₹{Number(e.amount).toLocaleString()}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    {(e.addedById === user?.id || role === 'admin' || role === 'principal' || role === 'correspondent') && (
                      <button
                        onClick={() => handleDelete(e.id)}
                        style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', display: 'flex' }}
                        title="Delete"
                      >
                        <TrashIcon size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add expense modal */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Expense" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <Input label="Amount (₹)" type="number" min={0} value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
            <Input label="Date" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
          </div>
          <Select
            label="Category"
            value={form.category}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(p => ({ ...p, category: e.target.value }))}
            options={CATEGORIES.map(c => ({ value: c, label: c }))}
          />
          <Input label="Description" placeholder="e.g. Chalk boxes, June electricity bill" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={handleAdd} disabled={saving}>{saving ? 'Saving…' : 'Add'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left', padding: '10px 16px',
  fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
  color: 'var(--color-text-tertiary)', borderBottom: '1px solid var(--color-border)',
};
const td: React.CSSProperties = { padding: '10px 16px' };
