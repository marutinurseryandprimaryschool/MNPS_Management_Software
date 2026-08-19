'use client';
/* Student picker for the header's "Add New Payment" action.

   The month drawer already offers "record payment" per student, but that path
   starts from a student. This one starts from the money: a parent hands over
   cash, she clicks one button, finds the child, and records it. Search matches
   name, class or roll no so she can find a child the way she happens to
   remember them. */

import React, { useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { SearchIcon } from '@/components/ui/Icons';
import type { RegisterRow } from '@/types/principal';

interface PickStudentDialogProps {
  isOpen: boolean;
  rows: RegisterRow[];
  onClose: () => void;
  onPick: (row: RegisterRow) => void;
}

const norm = (v: string): string => v.toLowerCase().replace(/\s+/g, ' ').trim();

export default function PickStudentDialog({ isOpen, rows, onClose, onPick }: PickStudentDialogProps) {
  const [term, setTerm] = useState('');

  const matches = useMemo(() => {
    const live = rows.filter(r => !r.deleted);
    const q = norm(term);
    if (!q) return live.slice(0, 60);
    return live
      .filter(r => norm(`${r.name} ${r.className} ${r.rollNo || ''}`).includes(q))
      .slice(0, 60);
  }, [rows, term]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Payment" size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <p className="text-body-sm" style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
          Choose the student who paid.
        </p>

        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', display: 'flex' }}>
            <SearchIcon size={16} />
          </span>
          <input
            autoFocus
            value={term}
            onChange={e => setTerm(e.target.value)}
            placeholder="Search student, class or roll no"
            style={{
              width: '100%', padding: '10px 12px 10px 36px', fontSize: '0.9rem',
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface)', color: 'var(--color-text-primary)',
            }}
          />
        </div>

        <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          {matches.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.85rem' }}>
              {rows.length === 0
                ? 'No students in the fees note yet — add a student first.'
                : 'No student matches that search.'}
            </div>
          ) : matches.map(row => (
            <button
              key={row.id}
              onClick={() => onPick(row)}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                gap: 'var(--space-3)', padding: '10px 14px', minHeight: 44,
                background: 'none', border: 'none', borderBottom: '1px solid var(--color-border)',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{row.name}</span>
              <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
                {row.className}{row.rollNo ? ` • ${row.rollNo}` : ''}
              </span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}
