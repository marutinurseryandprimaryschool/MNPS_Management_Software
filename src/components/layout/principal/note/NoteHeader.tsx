'use client';

/* ============================================
   Fees Note — header
   ============================================
   Academic year, how many students the note holds, and the four numbers
   Sharmi asks for first: charged, collected, pending, and what she can chase
   TODAY. Then the search box, the class filter and [+ Add Student].

   "Due now" is the arrears figure — pending months that have already ENDED,
   never the whole year.
*/

import React from 'react';
import Button from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/Input';
import { Badge } from '@/components/ui/SharedUI';
import { PlusIcon } from '@/components/ui/Icons';
import { formatINR, pickerStyle } from '../principal-shared';
import type { NoteTotals } from './use-note-data';

interface NoteHeaderProps {
  academicYear: string;
  totals: NoteTotals;
  /** Students left after search + class filter (may differ from totals.students). */
  visibleCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  classFilter: string;
  classNames: string[];
  onClassFilterChange: (value: string) => void;
  canAddStudent: boolean;
  onAddStudent: () => void;
  /** Payments need at least one student, so this is gated separately. */
  canAddPayment: boolean;
  onAddPayment: () => void;
  /** Bulk-add from the school's registered students (Principal only). */
  canImport: boolean;
  onImport: () => void;
}

interface StatTile {
  label: string;
  value: string;
  color?: string;
  hint?: string;
}

const tileStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: 'var(--space-3)',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
};

export default function NoteHeader({
  academicYear, totals, visibleCount, search, onSearchChange,
  classFilter, classNames, onClassFilterChange, canAddStudent, onAddStudent,
  canAddPayment, onAddPayment, canImport, onImport,
}: NoteHeaderProps) {
  const tiles: StatTile[] = [
    { label: 'Charged', value: formatINR(totals.charged) },
    { label: 'Collected', value: formatINR(totals.paid), color: 'var(--color-success)' },
    { label: 'Pending (year)', value: formatINR(totals.pending) },
    {
      label: 'Due now',
      value: formatINR(totals.dueNow),
      color: totals.dueNow > 0 ? 'var(--color-error)' : 'var(--color-text-primary)',
      hint: 'Months that have already ended',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 className="text-h1">Fees Note</h2>
            {academicYear && <Badge variant="primary">{academicYear}</Badge>}
            <Badge variant="outline">
              {totals.students} {totals.students === 1 ? 'student' : 'students'}
            </Badge>
          </div>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            The master register. Every row here also appears in the class-wise and
            teacher-wise registers automatically.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {canAddPayment && (
            <Button variant="primary" icon={<PlusIcon size={16} />} onClick={onAddPayment}>
              Add New Payment
            </Button>
          )}
          {canImport && (
            <Button
              variant={canAddPayment ? 'secondary' : 'primary'}
              icon={<PlusIcon size={16} />}
              onClick={onImport}
            >
              Add from student list
            </Button>
          )}
          {canAddStudent && (
            <Button
              variant="secondary"
              icon={<PlusIcon size={16} />}
              onClick={onAddStudent}
            >
              Add Student
            </Button>
          )}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 'var(--space-3)',
      }}>
        {tiles.map(tile => (
          <div key={tile.label} style={tileStyle}>
            <span className="text-overline">{tile.label}</span>
            <span style={{
              font: 'var(--text-heading-2)',
              color: tile.color || 'var(--color-text-primary)',
            }}>
              {tile.value}
            </span>
            {tile.hint && (
              <span style={{ font: 'var(--text-caption)', color: 'var(--color-text-tertiary)' }}>
                {tile.hint}
              </span>
            )}
          </div>
        ))}
      </div>

      <div style={{
        display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center',
      }}>
        <div style={{ flex: '1 1 240px', minWidth: 200 }}>
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Search student, class or roll no"
          />
        </div>
        <select
          style={pickerStyle}
          value={classFilter}
          aria-label="Filter by class"
          onChange={event => onClassFilterChange(event.target.value)}
        >
          <option value="">All classes</option>
          {classNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        {(search || classFilter) && (
          <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            {visibleCount} of {totals.students} shown
          </span>
        )}
      </div>
    </div>
  );
}
