'use client';

/* ============================================
   Fees Note — inline amount cell (desktop grid)
   ============================================
   Click a fee cell and it becomes an input. Enter or Tab commits and moves to
   the next editable cell, Shift+Tab moves back, Esc cancels, blur commits.
   Unusable text never reaches the register — it reverts and warns instead.
*/

import React, { useEffect, useRef } from 'react';
import { formatINR } from '../principal-shared';
import { amountToInput, parseAmountInput } from './note-helpers';

export type CellMove = 'next' | 'prev' | 'none';

interface AmountCellProps {
  value: number;
  editable: boolean;
  editing: boolean;
  /** Screen-reader label, e.g. "School fee for Anitha". */
  label: string;
  onStartEdit: () => void;
  onCancel: () => void;
  onCommit: (value: number, move: CellMove) => void;
  /** Typed text that is not an amount — the caller warns and keeps the old value. */
  onInvalid: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 72,
  padding: '6px 8px',
  textAlign: 'right',
  font: 'var(--text-body)',
  color: 'var(--color-text-primary)',
  background: 'var(--color-surface)',
  border: '2px solid var(--color-primary-500)',
  borderRadius: 'var(--radius-sm)',
  outline: 'none',
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  textAlign: 'right',
  font: 'var(--text-body)',
  color: 'var(--color-text-primary)',
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 'var(--radius-sm)',
  cursor: 'text',
};

const readOnlyStyle: React.CSSProperties = {
  display: 'block',
  padding: '6px 8px',
  textAlign: 'right',
  font: 'var(--text-body)',
  color: 'var(--color-text-secondary)',
};

/**
 * Mounts fresh each time editing starts, so the draft is always seeded from
 * the value on screen and focus/select runs exactly once.
 */
function AmountEditor({
  initial, label, onCommit, onCancel, onInvalid,
}: Pick<AmountCellProps, 'label' | 'onCommit' | 'onCancel' | 'onInvalid'> & { initial: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Enter/Tab/Esc settle the cell; the blur that follows must not settle again.
  const settledRef = useRef(false);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, []);

  const commit = (move: CellMove) => {
    if (settledRef.current) return;
    settledRef.current = true;
    const parsed = parseAmountInput(inputRef.current?.value ?? '');
    if (parsed === null) {
      onInvalid();
      onCancel();
      return;
    }
    onCommit(parsed, move);
  };

  const cancel = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    onCancel();
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      aria-label={label}
      defaultValue={amountToInput(initial)}
      style={inputStyle}
      onBlur={() => commit('none')}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit('next');
        } else if (event.key === 'Tab') {
          event.preventDefault();
          commit(event.shiftKey ? 'prev' : 'next');
        } else if (event.key === 'Escape') {
          event.preventDefault();
          cancel();
        }
      }}
    />
  );
}

export default function AmountCell({
  value, editable, editing, label, onStartEdit, onCancel, onCommit, onInvalid,
}: AmountCellProps) {
  if (!editable) {
    return <span style={readOnlyStyle}>{formatINR(value)}</span>;
  }

  if (editing) {
    return (
      <AmountEditor
        initial={value}
        label={label}
        onCommit={onCommit}
        onCancel={onCancel}
        onInvalid={onInvalid}
      />
    );
  }

  return (
    <button
      type="button"
      style={buttonStyle}
      aria-label={`${label} — ${formatINR(value)}. Press Enter to edit.`}
      onClick={onStartEdit}
      onFocus={onStartEdit}
    >
      {formatINR(value)}
    </button>
  );
}
