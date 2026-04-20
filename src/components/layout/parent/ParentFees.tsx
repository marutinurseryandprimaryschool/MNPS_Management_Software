'use client';

import React from 'react';
import { DEMO_FEE_STRUCTURES, DEMO_PAYMENTS } from '@/lib/demo-data';
import { DataCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/SharedUI';
import { Tabs } from '@/components/ui/SharedUI';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CreditCardIcon, CheckCircleIcon, ClockIcon } from '@/components/ui/Icons';

export default function ParentFees() {
  const [activeTab, setActiveTab] = React.useState('overview');
  const structure = DEMO_FEE_STRUCTURES[0];
  const payments = DEMO_PAYMENTS.filter(p => p.studentId === 'student_001');
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalFee = structure.totalAmount;
  const pending = totalFee - totalPaid;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="text-h1">Fees</h2>
      </div>

      <div className="grid-3" style={{ marginBottom: 'var(--space-4)' }}>
        <DataCard icon={<CreditCardIcon size={24} />} value={formatCurrency(totalFee)} label="Total Fee" color="var(--color-info)" />
        <DataCard icon={<CheckCircleIcon size={24} />} value={formatCurrency(totalPaid)} label="Paid" color="var(--color-success)" />
        <DataCard icon={<ClockIcon size={24} />} value={formatCurrency(pending)} label="Pending" color="var(--color-warning)" />
      </div>

      {/* Progress Bar */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
          <span className="text-body-sm" style={{ fontWeight: 500 }}>Payment Progress</span>
          <span className="text-body-sm" style={{ fontWeight: 600 }}>{Math.round((totalPaid / totalFee) * 100)}%</span>
        </div>
        <div style={{ height: 8, background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(totalPaid / totalFee) * 100}%`, background: 'var(--color-success)', borderRadius: 'var(--radius-full)', transition: 'width 500ms ease' }} />
        </div>
      </div>

      <Tabs tabs={[
        { id: 'overview', label: 'Fee Structure' },
        { id: 'payments', label: 'Payment History', count: payments.length },
      ]} activeTab={activeTab} onChange={setActiveTab} />

      <div style={{ marginTop: 'var(--space-4)' }}>
        {activeTab === 'overview' && structure && (
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            {structure.categories.map((cat, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
                <span className="text-body">{cat.name}</span>
                <span className="text-body" style={{ fontWeight: 600 }}>{formatCurrency(cat.amount)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-primary-50)', fontWeight: 600 }}>
              <span>Total</span>
              <span style={{ color: 'var(--color-primary-500)' }}>{formatCurrency(structure.totalAmount)}</span>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            {payments.map(payment => (
              <div key={payment.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
                <div>
                  <div className="text-body" style={{ fontWeight: 500 }}>{payment.category}</div>
                  <div className="text-caption">{payment.receiptNumber} • {formatDate(payment.paidAt)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="text-body" style={{ fontWeight: 600, color: 'var(--color-success)' }}>{formatCurrency(payment.amount)}</div>
                  <Badge variant="info">{payment.mode.toUpperCase()}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
