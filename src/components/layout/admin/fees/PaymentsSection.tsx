'use client';
/* Payments register (principal-only tab): collector summary cards +
   transaction list with edit / soft-delete / history actions.
   Aggregates exclude soft-deleted payments; deleted rows stay visible
   (greyed, badged) for the audit view. */

import React, { useMemo, useState } from 'react';
import { Avatar, Badge } from '@/components/ui/SharedUI';
import { ClockIcon, EditIcon, TrashIcon } from '@/components/ui/Icons';
import { excludeDeleted, paymentDateKey } from '@/lib/fee-utils';
import type { FeePayment } from '@/types/models';

interface PaymentsSectionProps {
  /** All payments, newest first (incl. soft-deleted for the audit view). */
  payments: FeePayment[];
  canEditPayments: boolean;
  onEdit: (payment: FeePayment) => void;
  onDelete: (payment: FeePayment) => void;
  onHistory: (payment: FeePayment) => void;
}

const rowActionStyle: React.CSSProperties = {
  padding: 6, background: 'none', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center',
};

export default function PaymentsSection({
  payments, canEditPayments, onEdit, onDelete, onHistory,
}: PaymentsSectionProps) {
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const livePayments = useMemo(() => excludeDeleted(payments), [payments]);

  const staffCollections = useMemo(() => {
    return livePayments.reduce((acc, p) => {
      const staffId = p.collectedBy || 'Admin';
      if (!acc[staffId]) {
        acc[staffId] = { id: staffId, name: p.collectedByName || 'Admin', total: 0, count: 0 };
      }
      acc[staffId] = {
        ...acc[staffId],
        total: acc[staffId].total + (Number(p.amount) || 0),
        count: acc[staffId].count + 1,
      };
      return acc;
    }, {} as Record<string, { id: string; name: string; total: number; count: number }>);
  }, [livePayments]);

  const displayPayments = selectedStaffId
    ? payments.filter(p => (p.collectedBy || 'Admin') === selectedStaffId)
    : payments;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Collector summary cards (live payments only) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
        {Object.values(staffCollections).map(staff => (
          <div key={staff.id}
            onClick={() => setSelectedStaffId(selectedStaffId === staff.id ? null : staff.id)}
            style={{
              background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)',
              border: `2px solid ${selectedStaffId === staff.id ? 'var(--color-primary-500)' : 'var(--color-border)'}`,
              cursor: 'pointer', transition: 'all 200ms', boxShadow: 'var(--shadow-sm)',
            }}
            onMouseEnter={e => { if (selectedStaffId !== staff.id) e.currentTarget.style.borderColor = 'var(--color-primary-200)'; }}
            onMouseLeave={e => { if (selectedStaffId !== staff.id) e.currentTarget.style.borderColor = 'var(--color-border)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <Avatar name={staff.name} size={44} />
              <div>
                <div style={{ font: 'var(--text-body)', fontWeight: 600 }}>{staff.name}</div>
                <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>{staff.count} collections</div>
              </div>
            </div>
            <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-divider)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Total Collected</span>
              <span style={{ fontWeight: 700, color: '#059669', fontSize: '1.1rem' }}>₹{staff.total.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Transactions list */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-variant)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="text-overline" style={{ color: 'var(--color-text-tertiary)' }}>
            {selectedStaffId ? `Detailed Records — ${staffCollections[selectedStaffId]?.name || ''}` : 'All Recent Collections'}
          </span>
          {selectedStaffId && (
            <button onClick={() => setSelectedStaffId(null)}
              style={{ background: 'var(--color-primary-50)', border: '1px solid var(--color-primary-200)', color: 'var(--color-primary-600)', padding: '2px 10px', borderRadius: 'var(--radius-sm)', font: 'var(--text-caption)', fontWeight: 600, cursor: 'pointer' }}>
              Show All
            </button>
          )}
        </div>
        {displayPayments.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>No collections recorded yet.</p>
          </div>
        ) : displayPayments.map(p => {
          const isDeleted = p.deleted === true;
          return (
            <div key={p.id}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-divider)', transition: 'background 100ms', opacity: isDeleted ? 0.55 : 1 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-variant)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Avatar name={p.studentName} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span style={{ font: 'var(--text-body)', fontWeight: 500, textDecoration: isDeleted ? 'line-through' : 'none' }}>{p.studentName}</span>
                  {isDeleted && <Badge variant="error">Deleted</Badge>}
                </div>
                <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
                  {p.className} • {p.category} • {p.mode?.toUpperCase()}{p.collectedByName && ` • by ${p.collectedByName}`}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ font: 'var(--text-body)', fontWeight: 600, color: isDeleted ? 'var(--color-text-tertiary)' : 'var(--color-success)', textDecoration: isDeleted ? 'line-through' : 'none' }}>
                  ₹{Number(p.amount).toLocaleString()}
                </div>
                <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
                  {p.receiptNumber}{paymentDateKey(p) ? ` • ${paymentDateKey(p)}` : ''}
                </div>
              </div>
              {canEditPayments && (
                <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }}>
                  <button title="Payment history" onClick={() => onHistory(p)}
                    style={{ ...rowActionStyle, color: 'var(--color-text-secondary)' }}>
                    <ClockIcon size={14} />
                  </button>
                  {!isDeleted && (
                    <>
                      <button title="Edit payment" onClick={() => onEdit(p)}
                        style={{ ...rowActionStyle, color: 'var(--color-primary-500)' }}>
                        <EditIcon size={14} />
                      </button>
                      <button title="Delete payment (kept in audit history)" onClick={() => onDelete(p)}
                        style={{ ...rowActionStyle, color: 'var(--color-error)' }}>
                        <TrashIcon size={14} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
