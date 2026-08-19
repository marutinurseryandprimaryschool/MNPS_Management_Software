'use client';

/* ============================================
   Fees Note — desktop grid (>= 900px)
   ============================================
   The paper note, on a PC. Student name is frozen to the left so a wide row
   never loses its subject; the three fee columns edit in place; Enter and Tab
   walk to the next editable cell in reading order.

   The mobile presentation (NoteCards) renders the SAME rows and calls the SAME
   handlers — only the layout differs.
*/

import React from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@/components/ui/Icons';
import { Badge } from '@/components/ui/SharedUI';
import { formatINR, thStyle } from '../principal-shared';
import AmountCell, { type CellMove } from './AmountCell';
import MonthDrawer from './MonthDrawer';
import RowMenu, { type RowMenuItem } from './RowMenu';
import {
  EDITABLE_FIELDS, FIELD_LABELS, sameCell,
  type CellRef, type EditableField, type NoteRowHandlers,
} from './note-helpers';
import type { RegisterRow } from '@/types/principal';

interface NoteGridProps {
  rows: RegisterRow[];
  expandedRowId: string | null;
  editingCell: CellRef | null;
  handlers: NoteRowHandlers;
  onStartEdit: (cell: CellRef | null) => void;
  onCommitCell: (row: RegisterRow, field: EditableField, value: number) => void;
  onInvalidCell: () => void;
}

const COLUMN_COUNT = 8;

const nameCellStyle: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  zIndex: 1,
  background: 'var(--color-surface)',
  padding: '8px 16px',
  borderRight: '1px solid var(--color-border)',
  minWidth: 220,
};

const nameHeadStyle: React.CSSProperties = {
  ...thStyle,
  position: 'sticky',
  left: 0,
  zIndex: 3,
  background: 'var(--color-surface-variant)',
  borderRight: '1px solid var(--color-border)',
};

/* The header sits inside the horizontal scroll box, so it travels with the
   columns and stays put over the frozen name column. */
const headRowStyle: React.CSSProperties = {
  background: 'var(--color-surface-variant)',
};

const bodyCellStyle: React.CSSProperties = { padding: '8px 16px' };

const numericCellStyle: React.CSSProperties = {
  ...bodyCellStyle,
  padding: '4px 8px',
  textAlign: 'right',
};

const expandButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 2,
  marginRight: 6,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--color-text-tertiary)',
  verticalAlign: 'middle',
};

/**
 * The next (or previous) editable cell in reading order: across the fee
 * columns of this row, then on to the next row the user is allowed to edit.
 * Returns null at either end so focus simply stops instead of wrapping.
 */
function stepCell(
  rows: RegisterRow[],
  canEditRow: (row: RegisterRow) => boolean,
  from: CellRef,
  move: Exclude<CellMove, 'none'>,
): CellRef | null {
  const rowIndex = rows.findIndex(row => row.id === from.rowId);
  if (rowIndex === -1) return null;
  const step = move === 'next' ? 1 : -1;
  const fieldIndex = EDITABLE_FIELDS.indexOf(from.field) + step;

  if (fieldIndex >= 0 && fieldIndex < EDITABLE_FIELDS.length) {
    return { rowId: from.rowId, field: EDITABLE_FIELDS[fieldIndex] };
  }

  for (let index = rowIndex + step; index >= 0 && index < rows.length; index += step) {
    const candidate = rows[index];
    if (!canEditRow(candidate)) continue;
    return {
      rowId: candidate.id,
      field: move === 'next' ? EDITABLE_FIELDS[0] : EDITABLE_FIELDS[EDITABLE_FIELDS.length - 1],
    };
  }
  return null;
}

export default function NoteGrid({
  rows, expandedRowId, editingCell, handlers, onStartEdit, onCommitCell, onInvalidCell,
}: NoteGridProps) {
  const commit = (row: RegisterRow, field: EditableField, value: number, move: CellMove) => {
    onCommitCell(row, field, value);
    if (move === 'none') {
      onStartEdit(null);
      return;
    }
    onStartEdit(stepCell(rows, handlers.canEditRow, { rowId: row.id, field }, move));
  };

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%', minWidth: 900, borderCollapse: 'separate', borderSpacing: 0,
        }}>
          <thead>
            <tr style={headRowStyle}>
              <th style={nameHeadStyle}>Student</th>
              <th style={thStyle}>Class</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>{FIELD_LABELS.schoolFee}</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>{FIELD_LABELS.ecaAnnual}</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>{FIELD_LABELS.vanMonthly}</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Paid</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Balance</th>
              <th style={{ ...thStyle, textAlign: 'right' }} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const summary = handlers.summaryFor(row.id);
              const editable = handlers.canEditRow(row);
              const canRecord = handlers.canRecordFor(row);
              const expanded = expandedRowId === row.id;
              const menuItems: RowMenuItem[] = [
                {
                  label: expanded ? 'Hide months' : 'Show months',
                  onSelect: () => handlers.onToggleMonths(row.id),
                },
                {
                  label: 'Record payment',
                  onSelect: () => handlers.onRecordPayment(row),
                  disabled: !canRecord,
                },
                {
                  label: 'Edit details',
                  onSelect: () => handlers.onEditRow(row),
                  disabled: !editable,
                },
                {
                  label: 'Remove student',
                  danger: true,
                  onSelect: () => handlers.onDeleteRow(row),
                  disabled: !handlers.canDeleteRow(row),
                },
              ];

              return (
                <React.Fragment key={row.id}>
                  <tr style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td style={nameCellStyle}>
                      <button
                        type="button"
                        style={expandButtonStyle}
                        aria-label={expanded ? `Hide months for ${row.name}` : `Show months for ${row.name}`}
                        aria-expanded={expanded}
                        onClick={() => handlers.onToggleMonths(row.id)}
                      >
                        {expanded ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
                      </button>
                      <span style={{ font: 'var(--text-body)', fontWeight: 600 }}>{row.name}</span>
                      {row.isScholarship && (
                        <span style={{ marginLeft: 8 }}><Badge variant="info">Scholarship</Badge></span>
                      )}
                      {row.rollNo && (
                        <span style={{
                          marginLeft: 8, font: 'var(--text-caption)', color: 'var(--color-text-tertiary)',
                        }}>
                          #{row.rollNo}
                        </span>
                      )}
                    </td>
                    <td style={{ ...bodyCellStyle, whiteSpace: 'nowrap' }}>
                      <span style={{ font: 'var(--text-body-sm)' }}>{row.className || '—'}</span>
                      {row.sectionName && (
                        <span style={{ color: 'var(--color-text-tertiary)' }}> · {row.sectionName}</span>
                      )}
                    </td>
                    {EDITABLE_FIELDS.map(field => (
                      <td key={field} style={numericCellStyle}>
                        <AmountCell
                          value={Number(row[field]) || 0}
                          editable={editable}
                          editing={sameCell(editingCell, { rowId: row.id, field })}
                          label={`${FIELD_LABELS[field]} for ${row.name}`}
                          onStartEdit={() => onStartEdit({ rowId: row.id, field })}
                          onCancel={() => onStartEdit(null)}
                          onInvalid={onInvalidCell}
                          onCommit={(value, move) => commit(row, field, value, move)}
                        />
                      </td>
                    ))}
                    <td style={{ ...bodyCellStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                        {formatINR(summary.totalPaid)}
                      </span>
                    </td>
                    <td style={{ ...bodyCellStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600 }}>{formatINR(summary.totalPending)}</span>
                      {summary.totalDueNow > 0 && (
                        <div style={{ marginTop: 2, display: 'flex', justifyContent: 'flex-end' }}>
                          <Badge variant="error">{formatINR(summary.totalDueNow)} due now</Badge>
                        </div>
                      )}
                    </td>
                    <td style={{ ...bodyCellStyle, textAlign: 'right' }}>
                      <RowMenu items={menuItems} label={row.name} />
                    </td>
                  </tr>
                  {expanded && (
                    <tr>
                      <td colSpan={COLUMN_COUNT} style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <MonthDrawer
                          eca={summary.eca}
                          van={summary.van}
                          isMobile={false}
                          canRecord={canRecord}
                          onRecord={prefill => handlers.onRecordPayment(row, prefill)}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
