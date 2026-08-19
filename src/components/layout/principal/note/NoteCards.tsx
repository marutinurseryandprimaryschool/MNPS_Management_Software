'use client';

/* ============================================
   Fees Note — mobile cards (< 900px)
   ============================================
   Sharmi works the note from her phone too. A phone gets ONE card per student
   — name, class, paid vs balance, and a "due now" chip when months have gone
   overdue — never a ten-column spreadsheet dragged sideways.

   Tapping the card opens the edit sheet; "Months" expands the same month
   drawer the desktop grid uses; "Pay" opens the same payment dialog.
*/

import React from 'react';
import { Badge } from '@/components/ui/SharedUI';
import { ChevronDownIcon, ChevronRightIcon } from '@/components/ui/Icons';
import { formatINR } from '../principal-shared';
import MonthDrawer from './MonthDrawer';
import { FIELD_LABELS, type NoteRowHandlers } from './note-helpers';
import type { RegisterRow } from '@/types/principal';

interface NoteCardsProps {
  rows: RegisterRow[];
  expandedRowId: string | null;
  handlers: NoteRowHandlers;
}

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
  padding: 'var(--space-3)',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
};

const actionStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 10px',
  font: 'var(--text-body-sm)',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  background: 'var(--color-surface-variant)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
};

const feeLineStyle: React.CSSProperties = {
  font: 'var(--text-caption)',
  color: 'var(--color-text-tertiary)',
};

export default function NoteCards({ rows, expandedRowId, handlers }: NoteCardsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {rows.map(row => {
        const summary = handlers.summaryFor(row.id);
        const editable = handlers.canEditRow(row);
        const removable = handlers.canDeleteRow(row);
        const canRecord = handlers.canRecordFor(row);
        const expanded = expandedRowId === row.id;

        return (
          <div key={row.id} style={cardStyle}>
            <button
              type="button"
              onClick={() => handlers.onEditRow(row)}
              disabled={!editable}
              style={{
                display: 'flex', flexDirection: 'column', gap: 4, padding: 0,
                background: 'none', border: 'none', textAlign: 'left',
                cursor: editable ? 'pointer' : 'default', width: '100%',
              }}
              aria-label={editable ? `Edit ${row.name}` : row.name}
            >
              <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 'var(--space-2)', width: '100%',
              }}>
                <span style={{ font: 'var(--text-heading-3)' }}>{row.name}</span>
                <span style={{ font: 'var(--text-body-sm)', whiteSpace: 'nowrap' }}>
                  <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                    {formatINR(summary.totalPaid)}
                  </span>
                  <span style={{ color: 'var(--color-text-tertiary)' }}> / </span>
                  <span style={{ fontWeight: 600 }}>{formatINR(summary.totalPending)}</span>
                </span>
              </span>

              <span style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap',
              }}>
                <span style={{ font: 'var(--text-body-sm)', color: 'var(--color-text-secondary)' }}>
                  {row.className || 'No class'}
                  {row.sectionName ? ` · ${row.sectionName}` : ''}
                  {row.rollNo ? ` · #${row.rollNo}` : ''}
                </span>
                {row.isScholarship && <Badge variant="info">Scholarship</Badge>}
                {summary.totalDueNow > 0 && (
                  <Badge variant="error">{formatINR(summary.totalDueNow)} due now</Badge>
                )}
              </span>

              <span style={feeLineStyle}>
                {FIELD_LABELS.schoolFee} {formatINR(row.schoolFee)} ·{' '}
                {FIELD_LABELS.ecaAnnual} {formatINR(row.ecaAnnual)} ·{' '}
                {FIELD_LABELS.vanMonthly} {formatINR(row.vanMonthly)}
              </span>
            </button>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                type="button"
                style={actionStyle}
                aria-expanded={expanded}
                onClick={() => handlers.onToggleMonths(row.id)}
              >
                {expanded ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
                Months
              </button>
              <button
                type="button"
                style={{
                  ...actionStyle,
                  color: canRecord ? 'var(--color-primary-700)' : 'var(--color-text-tertiary)',
                  cursor: canRecord ? 'pointer' : 'not-allowed',
                }}
                disabled={!canRecord}
                onClick={() => handlers.onRecordPayment(row)}
              >
                Record payment
              </button>
              {removable && (
                <button
                  type="button"
                  style={{ ...actionStyle, flex: '0 0 auto', color: 'var(--color-error)' }}
                  onClick={() => handlers.onDeleteRow(row)}
                  aria-label={`Remove ${row.name}`}
                >
                  Remove
                </button>
              )}
            </div>

            {expanded && (
              <MonthDrawer
                eca={summary.eca}
                van={summary.van}
                isMobile
                canRecord={canRecord}
                onRecord={prefill => handlers.onRecordPayment(row, prefill)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
