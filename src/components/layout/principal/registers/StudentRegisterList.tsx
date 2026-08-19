'use client';

/* ============================================
   Principal Register — student list, two presentations
   ============================================
   ONE dataset, two layouts (the responsive contract for this module):
     - >= 900px : a data grid whose first column (student name) is frozen, so
                  the numbers scroll under the name instead of away from it.
     - <  900px : one card per student. No 10-column table on a phone, ever —
                  the card carries the same numbers stacked, and every action
                  is a full-width tap target.

   The list is READ-ONLY presentation of rows the fees note owns. The only
   mutation it offers is "Record payment"; editing fee amounts is a separate,
   capability-gated affordance passed in by the teacher-wise register.
*/

import React from 'react';
import Button from '@/components/ui/Button';
import type { RegisterRow, RowSummary } from '@/types/principal';
import { inr } from './register-shared';
import {
  Chip, Money, StatGrid, surfaceCard, table, tableScroll,
  td, tdRight, tdSticky, th, thRight, thSticky, useIsNarrow,
} from './register-ui';

export interface StudentRegisterListProps {
  rows: RegisterRow[];
  summaryFor: (rowId: string) => RowSummary;
  onOpen: (row: RegisterRow) => void;
  onRecordPayment?: (row: RegisterRow) => void;
  onEditFees?: (row: RegisterRow) => void;
  /** Show the class column/line — on by default off a class group. */
  showClass?: boolean;
  emptyLabel?: string;
}

export default function StudentRegisterList(props: StudentRegisterListProps) {
  const narrow = useIsNarrow();
  const { rows, emptyLabel = 'No students here yet.' } = props;

  if (rows.length === 0) {
    return (
      <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', padding: 'var(--space-4)', margin: 0 }}>
        {emptyLabel}
      </p>
    );
  }

  return narrow ? <CardList {...props} /> : <Grid {...props} />;
}

/* ── Desktop: frozen-first-column grid ────────────────────────────────── */

function Grid({
  rows, summaryFor, onOpen, onRecordPayment, onEditFees, showClass = false,
}: StudentRegisterListProps) {
  const hasActions = Boolean(onRecordPayment || onEditFees);
  return (
    <div style={tableScroll}>
      <table style={table}>
        <thead>
          <tr>
            <th style={thSticky}>Student</th>
            {showClass && <th style={th}>Class</th>}
            <th style={th}>Sec / Roll</th>
            <th style={thRight} title="School fee still unpaid — due from day one">School due</th>
            <th style={thRight} title="ECA months that have ENDED and are still unpaid">ECA due</th>
            <th style={thRight} title="Van months that have ENDED and are still unpaid">Van due</th>
            <th style={thRight}>Collected</th>
            <th style={thRight}>Pending</th>
            <th style={thRight}>Due now</th>
            {hasActions && <th style={thRight}>&nbsp;</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const summary = summaryFor(row.id);
            return (
              <tr key={row.id}>
                <td style={tdSticky}>
                  <button
                    type="button"
                    onClick={() => onOpen(row)}
                    style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      font: 'inherit', color: 'var(--color-text-primary)', fontWeight: 600,
                      textAlign: 'left', textDecoration: 'underline dotted',
                    }}
                    title="Open the month-by-month breakdown"
                  >
                    {row.name}
                  </button>
                  {row.isScholarship && <span style={{ marginLeft: 6 }}><Chip label="Scholarship" /></span>}
                </td>
                {showClass && <td style={td}>{row.className || '—'}</td>}
                <td style={td}>
                  {[row.sectionName, row.rollNo].filter(Boolean).join(' · ') || '—'}
                </td>
                <td style={tdRight}><Money amount={summary.school.pending} tone="due" /></td>
                <td style={tdRight}><Money amount={summary.eca.dueNow} tone="due" /></td>
                <td style={tdRight}><Money amount={summary.van.dueNow} tone="due" /></td>
                <td style={tdRight}><Money amount={summary.totalPaid} tone="paid" /></td>
                <td style={tdRight}><Money amount={summary.totalPending} tone="pending" /></td>
                <td style={tdRight}><Money amount={summary.totalDueNow} tone="due" bold /></td>
                {hasActions && (
                  <td style={{ ...tdRight, whiteSpace: 'nowrap' }}>
                    {onEditFees && (
                      <Button variant="ghost" size="sm" onClick={() => onEditFees(row)}>Edit</Button>
                    )}
                    {onRecordPayment && (
                      <Button variant="secondary" size="sm" onClick={() => onRecordPayment(row)}>
                        Record payment
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Mobile: one card per student ─────────────────────────────────────── */

function CardList({
  rows, summaryFor, onOpen, onRecordPayment, onEditFees, showClass = false,
}: StudentRegisterListProps) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-2)', padding: 'var(--space-3)' }}>
      {rows.map(row => {
        const summary = summaryFor(row.id);
        return (
          <div
            key={row.id}
            style={{ ...surfaceCard, borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}
          >
            <button
              type="button"
              onClick={() => onOpen(row)}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                font: 'inherit', color: 'var(--color-text-primary)', textAlign: 'left', width: '100%',
              }}
            >
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                gap: 'var(--space-2)', marginBottom: 'var(--space-2)',
              }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{row.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}>
                    {[showClass ? row.className : '', row.sectionName, row.rollNo ? `Roll ${row.rollNo}` : '']
                      .filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <Chip
                  label={summary.totalDueNow > 0 ? `Due ${inr(summary.totalDueNow)}` : 'Up to date'}
                  tone={summary.totalDueNow > 0 ? 'due' : 'paid'}
                />
              </div>
              <StatGrid
                compact
                stats={[
                  { label: 'Collected', value: inr(summary.totalPaid), tone: 'paid' },
                  { label: 'Pending', value: inr(summary.totalPending), tone: 'pending' },
                  { label: 'Due now', value: inr(summary.totalDueNow), tone: 'due' },
                ]}
              />
            </button>

            {(onRecordPayment || onEditFees) && (
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                {onEditFees && (
                  <Button variant="secondary" size="sm" fullWidth onClick={() => onEditFees(row)}>
                    Edit fees
                  </Button>
                )}
                {onRecordPayment && (
                  <Button variant="primary" size="sm" fullWidth onClick={() => onRecordPayment(row)}>
                    Record payment
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
