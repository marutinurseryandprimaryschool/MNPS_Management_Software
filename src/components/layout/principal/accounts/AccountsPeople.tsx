'use client';

/* ============================================
   Principal Accounts — students & teachers (Phase 2 §7, §8, §20, §21)
   ============================================
   The Principal's actual route to a student's money:

     search a name  ──────────────────────────────┐
                                                  ▼
     teacher list ──▶ that teacher's students ──▶ student profile ──▶ payment

   Search short-circuits the whole walk (§21): typing three letters of a name
   lists matching students from every teacher at once.

   This screen renders EXISTING pieces — StudentRegisterList for the list,
   StudentDetailSheet for the profile, RecordPaymentModal for the entry form.
   It adds navigation and filtering, not a second copy of any of them, and it
   computes no money: `summaryFor` comes from the caller, already memoized.
*/

import React, { useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import { SearchInput, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/SharedUI';
import { ChevronLeftIcon } from '@/components/ui/Icons';
import { computeTeacherSummaries, UNASSIGNED_TEACHER } from '@/lib/principal-fees';
import { formatINR, panelHeaderStyle, panelStyle } from '../principal-shared';
import { compareStudents } from '../registers/register-shared';
import StudentRegisterList from '../registers/StudentRegisterList';
import type { RegisterRow, RowSummary, FeeStatus } from '@/types/principal';

/** Which students the list shows, independent of teacher/search (§20). */
type StatusFilter = 'all' | 'outstanding' | FeeStatus;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All students' },
  { value: 'outstanding', label: 'Has a balance' },
  { value: 'pending', label: 'Pending — nothing paid' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Fully paid' },
];

export interface AccountsPeopleProps {
  rows: RegisterRow[];
  summaryFor: (rowId: string) => RowSummary;
  loading: boolean;
  /** Set when the register could not be read — an empty list would otherwise
      read as "the school has no students" (§18). */
  error?: string | null;
  onRetry?: () => void;
  onOpenStudent: (row: RegisterRow) => void;
  onRecordPayment: (row: RegisterRow) => void;
}

export default function AccountsPeople({
  rows, summaryFor, loading, error, onRetry, onOpenStudent, onRecordPayment,
}: AccountsPeopleProps) {
  /** null = the teacher list; otherwise the selected teacher's uid ('' = unassigned). */
  const [teacherUid, setTeacherUid] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [className, setClassName] = useState('');
  /** §21: narrow by teacher WHILE searching, when the drill-down is bypassed.
      '' = every teacher; 'none' = students with nobody responsible. */
  const [teacherFilter, setTeacherFilter] = useState('');

  const teachers = useMemo(
    () => computeTeacherSummaries(rows, summaryFor),
    [rows, summaryFor],
  );

  const classNames = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) if (row.className) set.add(row.className);
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [rows]);

  const term = search.trim().toLowerCase();
  const searching = term.length > 0;

  /** Rows the list should render, after search / teacher / class / status. */
  const visibleRows = useMemo(() => {
    const matchesSearch = (row: RegisterRow) => !searching
      || (row.name || '').toLowerCase().includes(term)
      || (row.rollNo || '').toLowerCase().includes(term)
      || (row.className || '').toLowerCase().includes(term);

    const matchesStatus = (row: RegisterRow) => {
      if (status === 'all') return true;
      const summary = summaryFor(row.id);
      if (status === 'outstanding') return summary.totalPending > 0;
      return summary.status === status;
    };

    const matchesTeacher = (row: RegisterRow) => {
      // Searching bypasses the drill-down, so the dropdown is the only
      // teacher constraint there; otherwise the selected teacher governs.
      if (searching) {
        if (!teacherFilter) return true;
        return teacherFilter === 'none'
          ? !row.teacherUid
          : (row.teacherUid || '') === teacherFilter;
      }
      return teacherUid === null || (row.teacherUid || '') === teacherUid;
    };

    return rows
      .filter(row => row.deleted !== true)
      .filter(matchesTeacher)
      .filter(row => !className || row.className === className)
      .filter(matchesSearch)
      .filter(matchesStatus)
      .sort(compareStudents);
  }, [rows, searching, term, teacherUid, teacherFilter, className, status, summaryFor]);

  const selectedTeacher = teacherUid === null
    ? null
    : teachers.find(teacher => teacher.teacherUid === teacherUid) ?? null;

  /** The teacher list is only the landing view: not searching, none picked. */
  const showTeacherList = !searching && teacherUid === null;

  const filterBar = (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 'var(--space-3)', marginBottom: 'var(--space-4)',
    }}>
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search student by name, roll or class…"
      />
      <Select
        label=""
        aria-label="Filter by status"
        value={status}
        options={STATUS_OPTIONS}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
          setStatus(e.target.value as StatusFilter)}
      />
      <Select
        label=""
        aria-label="Filter by class"
        value={className}
        options={[
          { value: '', label: 'All classes' },
          ...classNames.map(name => ({ value: name, label: name })),
        ]}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setClassName(e.target.value)}
      />
      {/* Only meaningful while searching — otherwise the teacher is already
          chosen by the drill-down, and a second control would contradict it. */}
      {searching && (
        <Select
          label=""
          aria-label="Filter by teacher"
          value={teacherFilter}
          options={[
            { value: '', label: 'All teachers' },
            ...teachers.map(teacher => ({
              value: teacher.teacherUid || 'none',
              label: teacher.teacherName,
            })),
          ]}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTeacherFilter(e.target.value)}
        />
      )}
    </div>
  );

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          Loading the register…
        </span>
      </div>
    );
  }

  /* A read failure must say so. Showing an empty student list here would tell
     the Principal her 200-odd students had vanished (§18). */
  if (error && rows.length === 0) {
    return (
      <div style={{ ...panelStyle, padding: 'var(--space-8)', textAlign: 'center' }}>
        <p className="text-body" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
          Could not load the student register
        </p>
        <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>
          {error} Your students are safe — this screen simply could not read them.
        </p>
        {onRetry && <Button variant="primary" onClick={onRetry}>Retry</Button>}
      </div>
    );
  }

  return (
    <div>
      {filterBar}

      {showTeacherList ? (
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span className="text-overline">Teachers</span>
            <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
              {teachers.length} {teachers.length === 1 ? 'group' : 'groups'} · biggest balance first
            </span>
          </div>
          {teachers.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
              <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                No students in the register yet.
              </span>
            </div>
          ) : (
            <div>
              {teachers.map(teacher => (
                <button
                  key={teacher.teacherUid || 'unassigned'}
                  type="button"
                  onClick={() => setTeacherUid(teacher.teacherUid)}
                  style={{
                    display: 'flex', width: '100%', alignItems: 'center', gap: 'var(--space-3)',
                    justifyContent: 'space-between', flexWrap: 'wrap',
                    padding: 'var(--space-4)', background: 'none', cursor: 'pointer',
                    border: 'none', borderTop: '1px solid var(--color-divider)',
                    textAlign: 'left', font: 'inherit',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="text-body" style={{ fontWeight: 700 }}>
                      {teacher.teacherName}
                      {teacher.teacherUid === '' && (
                        <span style={{ marginLeft: 8 }}>
                          <Badge variant="warning">no teacher</Badge>
                        </span>
                      )}
                    </div>
                    <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
                      {teacher.students} {teacher.students === 1 ? 'student' : 'students'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
                    <Figure label="Collected" value={formatINR(teacher.collected)} tone="var(--color-success)" />
                    <Figure label="Outstanding" value={formatINR(teacher.outstanding)} tone="var(--color-error)" />
                    <Figure label="Due now" value={formatINR(teacher.dueNow)} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              {!searching && (
                <button
                  type="button"
                  onClick={() => setTeacherUid(null)}
                  aria-label="Back to the teacher list"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 6px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-primary-600)', font: 'var(--text-caption)', fontWeight: 700,
                  }}
                >
                  <ChevronLeftIcon size={14} /> Teachers
                </button>
              )}
              <span className="text-overline">
                {searching
                  ? `Search results for “${search.trim()}”`
                  : selectedTeacher?.teacherName || UNASSIGNED_TEACHER}
              </span>
            </span>
            <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
              {visibleRows.length} {visibleRows.length === 1 ? 'student' : 'students'}
            </span>
          </div>

          <StudentRegisterList
            rows={visibleRows}
            summaryFor={summaryFor}
            onOpen={onOpenStudent}
            onRecordPayment={onRecordPayment}
            showClass
            showStatus
            emptyLabel={
              searching
                ? 'No student matches that search.'
                : 'No students match these filters.'
            }
          />
        </div>
      )}
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>{label}</div>
      <div className="text-body-sm" style={{ fontWeight: 700, color: tone ?? 'var(--color-text-primary)' }}>
        {value}
      </div>
    </div>
  );
}
