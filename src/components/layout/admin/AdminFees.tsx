'use client';

import React, { useState } from 'react';
import { DEMO_FEE_STRUCTURES, DEMO_PAYMENTS, DEMO_STUDENTS, DEMO_CLASSES } from '@/lib/demo-data';
import { DataCard } from '@/components/ui/Card';
import { Tabs, Badge, Avatar } from '@/components/ui/SharedUI';
import { SearchInput, Select } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatDate, generateReceiptNumber } from '@/lib/utils';
import { CreditCardIcon, CheckCircleIcon, ClockIcon, AlertTriangleIcon, BarChartIcon } from '@/components/ui/Icons';

export default function AdminFees() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [search, setSearch] = useState('');
  const { showToast } = useToast();

  const totalCollected = DEMO_PAYMENTS.reduce((sum, p) => sum + p.amount, 0);
  const totalStructure = DEMO_FEE_STRUCTURES.reduce((sum, s) => sum + s.totalAmount, 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-h1">Fee Management</h2>
          <p className="text-body-sm">Academic Year: 2026-27</p>
        </div>
        <Button variant="primary" onClick={() => setShowPaymentModal(true)} icon={<CreditCardIcon size={20} color="white" />}>Record Payment</Button>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 'var(--space-4)' }}>
        <DataCard icon={<CheckCircleIcon size={24} />} value={formatCurrency(totalCollected)} label="Collected" color="var(--color-success)" />
        <DataCard icon={<ClockIcon size={24} />} value={formatCurrency(560000)} label="Pending" color="var(--color-warning)" />
        <DataCard icon={<AlertTriangleIcon size={24} />} value={formatCurrency(120000)} label="Overdue" color="var(--color-error)" />
        <DataCard icon={<BarChartIcon size={24} />} value="72%" label="Collection Rate" color="var(--color-info)" />
      </div>

      <Tabs tabs={[
        { id: 'overview', label: 'Fee Structure', count: DEMO_FEE_STRUCTURES.length },
        { id: 'payments', label: 'Recent Payments', count: DEMO_PAYMENTS.length },
        { id: 'defaulters', label: 'Defaulters', count: 5 },
      ]} activeTab={activeTab} onChange={setActiveTab} />

      <div style={{ marginTop: 'var(--space-4)' }}>
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {DEMO_FEE_STRUCTURES.map(structure => (
              <div key={structure.id} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                  <h3 className="text-h3">{structure.className}</h3>
                  <span className="text-h3" style={{ color: 'var(--color-primary-500)' }}>{formatCurrency(structure.totalAmount)}</span>
                </div>
                {structure.categories.map((cat, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: i < structure.categories.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
                    <span className="text-body-sm">{cat.name}</span>
                    <span className="text-body-sm" style={{ fontWeight: 600 }}>{formatCurrency(cat.amount)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'payments' && (
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            {DEMO_PAYMENTS.map(payment => (
              <div key={payment.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
                <Avatar name={payment.studentName} size={36} />
                <div style={{ flex: 1 }}>
                  <div className="text-body" style={{ fontWeight: 500 }}>{payment.studentName}</div>
                  <div className="text-caption">{payment.receiptNumber} • {payment.category}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="text-body" style={{ fontWeight: 600, color: 'var(--color-success)' }}>{formatCurrency(payment.amount)}</div>
                  <Badge variant="info">{payment.mode.toUpperCase()}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'defaulters' && (
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            {DEMO_STUDENTS.slice(6, 11).map(student => (
              <div key={student.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
                <Avatar name={student.name} size={36} />
                <div style={{ flex: 1 }}>
                  <div className="text-body" style={{ fontWeight: 500 }}>{student.name}</div>
                  <div className="text-caption">{student.className}-{student.sectionName}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="text-body" style={{ fontWeight: 600, color: 'var(--color-error)' }}>{formatCurrency(Math.floor(Math.random() * 30000) + 10000)}</div>
                  <Badge variant="error">Overdue</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Record Fee Payment" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Select label="Student" options={DEMO_STUDENTS.slice(0, 10).map(s => ({ value: s.id, label: `${s.name} (${s.className}-${s.sectionName})` }))} placeholder="Select student" />
          <Input label="Amount" type="number" placeholder="₹ Amount" />
          <Select label="Category" options={[
            { value: 'tuition', label: 'Tuition Fee' }, { value: 'transport', label: 'Transport Fee' },
            { value: 'lab', label: 'Lab Fee' }, { value: 'full', label: 'Full Year' },
          ]} placeholder="Select category" />
          <Select label="Payment Mode" options={[
            { value: 'cash', label: 'Cash' }, { value: 'upi', label: 'UPI' },
            { value: 'cheque', label: 'Cheque' }, { value: 'bank_transfer', label: 'Bank Transfer' },
          ]} placeholder="Select mode" />
          <Input label="Reference Number" placeholder="Optional for Cash" />
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => { setShowPaymentModal(false); showToast(`Payment recorded! Receipt: ${generateReceiptNumber()}`); }}>Record Payment</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
