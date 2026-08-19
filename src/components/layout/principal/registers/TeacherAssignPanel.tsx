'use client';

/* ============================================
   Teacher-wise Register — PRINCIPAL mode
   ============================================
   Sharmi decides who is responsible for whom. Left: her teachers with the
   number of students each carries. Right: students she can multi-select and
   hand over in one action, plus the ability to take them back.

   Two things this screen is deliberately strict about:
   - `teacherUid` MUST be the teacher's AUTH uid, because firestore.rules
     compares it to `request.auth.uid`. A teacher record with no linked login
     cannot be assigned — the rows would be invisible to them and editable by
     nobody. Those teachers are listed but disabled, with the reason shown.
   - Each assignment is its own audited write. A bulk action is a loop of them,
     so a partial failure leaves the successful ones saved and says how many
     did not land, instead of pretending the whole batch failed.
*/

import React, { useEffect, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { TeachersService } from '@/lib/firestore-service';
import { PrincipalRegisterService } from '@/lib/principal-service';
import type { PrincipalActor, RegisterRow } from '@/types/principal';
import {
  compareClassNames, compareStudents, describeError, inr,
  teacherAuthUid, teacherLoadStatus, TARGET_STUDENTS_PER_TEACHER,
} from './register-shared';
import {
  Chip, EmptyBlock, NoticeBanner, StatGrid, surfaceCard, useIsNarrow,
} from './register-ui';
import type { RegisterData } from './useRegisterData';

interface TeacherOption {
  id: string;
  uid: string;
  name: string;
}

type StudentFilter = 'unassigned' | 'mine' | 'all';

const FILTER_LABELS: Record<StudentFilter, string> = {
  unassigned: 'Unassigned',
  mine: 'This teacher',
  all: 'Everyone',
};

export interface TeacherAssignPanelProps {
  data: RegisterData;
  actor: PrincipalActor | null;
}

export default function TeacherAssignPanel({ data, actor }: TeacherAssignPanelProps) {
  const { showToast } = useToast();
  const narrow = useIsNarrow();

  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [teacherError, setTeacherError] = useState<string | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [filter, setFilter] = useState<StudentFilter>('unassigned');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  /**
   * The teacher list is the one thing this panel loads for itself (the rows
   * come from the shared register hook). `cancelled` keeps a slow response
   * from writing into an unmounted panel.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const docs = await TeachersService.getAll();
        if (cancelled) return;
        setTeachers(docs
          .map(doc => ({
            id: String(doc.id ?? ''),
            uid: teacherAuthUid(doc as { userId?: string; uid?: string; id?: string }),
            name: String(doc.name ?? 'Unnamed teacher'),
          }))
          .filter(teacher => teacher.id)
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })));
        setTeacherError(null);
      } catch (e) {
        if (cancelled) return;
        console.error('[principal-register] could not load teachers', e);
        setTeacherError(describeError(e, 'Could not load the teacher list. Please retry.'));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const countsByUid = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of data.rows) {
      if (!row.teacherUid) continue;
      counts.set(row.teacherUid, (counts.get(row.teacherUid) ?? 0) + 1);
    }
    return counts;
  }, [data.rows]);

  const selectedTeacher = teachers.find(teacher => teacher.id === selectedTeacherId) ?? null;
  const unassignedCount = data.rows.filter(row => !row.teacherUid).length;

  /** Rows assigned to a uid nobody in the teacher list owns any more. */
  const orphanedRows = useMemo(() => {
    const known = new Set(teachers.map(teacher => teacher.uid).filter(Boolean));
    return data.rows.filter(row => row.teacherUid && !known.has(row.teacherUid));
  }, [data.rows, teachers]);

  const term = search.trim().toLowerCase();
  const visibleRows = useMemo(() => data.rows
    .filter(row => {
      if (filter === 'unassigned') return !row.teacherUid;
      if (filter === 'mine') return Boolean(selectedTeacher) && row.teacherUid === selectedTeacher?.uid;
      return true;
    })
    .filter(row => !term || `${row.name} ${row.className} ${row.sectionName ?? ''}`.toLowerCase().includes(term))
    .sort((a, b) => compareClassNames(a.className, b.className) || compareStudents(a, b)),
  [data.rows, filter, selectedTeacher, term]);

  const pickedIds = useMemo(
    () => visibleRows.filter(row => picked[row.id]).map(row => row.id),
    [visibleRows, picked],
  );

  const togglePick = (rowId: string) =>
    setPicked(prev => ({ ...prev, [rowId]: !prev[rowId] }));

  const pickAllVisible = () => setPicked(
    pickedIds.length === visibleRows.length
      ? {}
      : Object.fromEntries(visibleRows.map(row => [row.id, true])),
  );

  /**
   * One audited write per row. Partial failures are reported honestly: the
   * rows that saved stay saved.
   */
  const applyAssignment = async (
    rowIds: string[],
    teacher: { uid: string; name: string } | null,
    verb: string,
  ) => {
    if (busy || rowIds.length === 0 || !actor) {
      if (!actor) showToast('Your session has no signed-in user. Refresh the app.', 'error');
      return;
    }
    setBusy(true);
    let saved = 0;
    let lastError: unknown = null;
    for (const rowId of rowIds) {
      try {
        await PrincipalRegisterService.assignTeacher(rowId, teacher, actor);
        saved += 1;
      } catch (e) {
        console.error('[principal-register] assignment failed', { rowId, error: e });
        lastError = e;
      }
    }
    const refreshed = await data.refreshQuietly();
    setPicked({});
    setBusy(false);

    if (saved === rowIds.length) {
      showToast(
        refreshed
          ? `${saved} student${saved === 1 ? '' : 's'} ${verb}`
          : `${saved} student${saved === 1 ? '' : 's'} ${verb} — reload to see the latest.`,
        refreshed ? 'success' : 'warning',
      );
      return;
    }
    showToast(
      `${saved} of ${rowIds.length} saved. ${describeError(lastError, 'The rest were NOT saved — please retry.')}`,
      'error',
    );
  };

  const assignPicked = () => {
    if (!selectedTeacher) {
      showToast('Pick a teacher first.', 'error');
      return;
    }
    if (!selectedTeacher.uid) {
      showToast(`${selectedTeacher.name} has no login linked yet, so students cannot be assigned to them.`, 'error');
      return;
    }
    void applyAssignment(pickedIds, { uid: selectedTeacher.uid, name: selectedTeacher.name },
      `assigned to ${selectedTeacher.name}`);
  };

  const unassignPicked = () => { void applyAssignment(pickedIds, null, 'unassigned'); };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="text-h1">Teacher-wise Register</h2>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            Assign each student to the teacher responsible for collecting their fees.
          </p>
        </div>
      </div>

      {teacherError && <NoticeBanner tone="error">{teacherError}</NoticeBanner>}

      {orphanedRows.length > 0 && (
        <NoticeBanner tone="warning">
          {orphanedRows.length} student{orphanedRows.length === 1 ? ' is' : 's are'} assigned to a
          teacher who is no longer in the teacher list. Reassign them so the fees stay chased.
        </NoticeBanner>
      )}

      <div style={{ ...surfaceCard, padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <StatGrid
          stats={[
            { label: 'Students', value: String(data.rows.length) },
            { label: 'Teachers', value: String(teachers.length) },
            { label: 'Unassigned', value: String(unassignedCount), tone: unassignedCount > 0 ? 'pending' : 'paid' },
            { label: 'Target / teacher', value: String(TARGET_STUDENTS_PER_TEACHER) },
          ]}
        />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: narrow ? '1fr' : 'minmax(240px, 320px) 1fr',
        gap: 'var(--space-4)', alignItems: 'start',
      }}>
        <TeacherColumn
          teachers={teachers}
          countsByUid={countsByUid}
          selectedId={selectedTeacherId}
          onSelect={id => { setSelectedTeacherId(id); setFilter(id ? 'unassigned' : 'all'); }}
        />

        <div style={{ ...surfaceCard, overflow: 'hidden' }}>
          <div style={{
            padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface-variant)', display: 'grid', gap: 'var(--space-2)',
          }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {(Object.keys(FILTER_LABELS) as StudentFilter[]).map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  disabled={key === 'mine' && !selectedTeacher}
                  style={{
                    padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.78rem',
                    fontWeight: 600, minHeight: 34,
                    cursor: key === 'mine' && !selectedTeacher ? 'not-allowed' : 'pointer',
                    border: `1px solid ${filter === key ? 'var(--color-text-primary)' : 'var(--color-border)'}`,
                    background: filter === key ? 'var(--color-text-primary)' : 'var(--color-surface)',
                    color: filter === key ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                    opacity: key === 'mine' && !selectedTeacher ? 0.5 : 1,
                  }}
                >
                  {key === 'mine' && selectedTeacher ? selectedTeacher.name : FILTER_LABELS[key]}
                </button>
              ))}
            </div>
            <SearchInput value={search} onChange={setSearch} placeholder="Search students" />
          </div>

          {visibleRows.length === 0 ? (
            <EmptyBlock
              title={data.rows.length === 0 ? 'No students in the fees note yet' : 'No students here'}
              hint={data.rows.length === 0
                // An empty register is the common first-run state; saying
                // "everyone already has a teacher" here reads as a bug.
                ? 'Open the Fees Note and import your students first — then assign them here.'
                : filter === 'unassigned'
                  ? 'Every student already has a responsible teacher.'
                  : 'Nothing matches the current filter.'}
            />
          ) : (
            <>
              <StudentPickList
                rows={visibleRows}
                picked={picked}
                onToggle={togglePick}
                summaryFor={data.summaryFor}
              />
              <div style={{
                position: 'sticky', bottom: 0, padding: 'var(--space-3) var(--space-4)',
                borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)',
                display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center',
              }}>
                <Button variant="ghost" size="sm" onClick={pickAllVisible} disabled={busy}>
                  {pickedIds.length === visibleRows.length ? 'Clear selection' : 'Select all shown'}
                </Button>
                <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                  {pickedIds.length} selected
                </span>
                <div style={{ flex: 1 }} />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={unassignPicked}
                  disabled={busy || pickedIds.length === 0}
                >
                  Remove teacher
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={assignPicked}
                  loading={busy}
                  disabled={busy || pickedIds.length === 0 || !selectedTeacher}
                >
                  {selectedTeacher ? `Assign to ${selectedTeacher.name}` : 'Pick a teacher'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Teacher column ───────────────────────────────────────────────────── */

function TeacherColumn({ teachers, countsByUid, selectedId, onSelect }: {
  teachers: TeacherOption[];
  countsByUid: Map<string, number>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (teachers.length === 0) {
    return <EmptyBlock title="No teachers yet" hint="Add teachers first, then assign students to them." />;
  }
  return (
    <div style={{ ...surfaceCard, overflow: 'hidden' }}>
      <div style={{
        padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface-variant)',
      }}>
        <span className="text-overline">Teachers</span>
      </div>
      <div style={{ display: 'grid' }}>
        {teachers.map(teacher => {
          const count = teacher.uid ? countsByUid.get(teacher.uid) ?? 0 : 0;
          const load = teacherLoadStatus(count);
          const selected = teacher.id === selectedId;
          return (
            <button
              key={teacher.id}
              type="button"
              onClick={() => onSelect(selected ? '' : teacher.id)}
              style={{
                textAlign: 'left', cursor: 'pointer', font: 'inherit', minHeight: 56,
                padding: 'var(--space-3) var(--space-4)', border: 'none',
                borderTop: '1px solid var(--color-divider)',
                background: selected ? 'var(--color-surface-variant)' : 'transparent',
                borderLeft: `3px solid ${selected ? 'var(--color-primary-500)' : 'transparent'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <span>
                <span style={{ fontWeight: 600 }}>{teacher.name}</span>
                {!teacher.uid && (
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-warning-text)' }}>
                    No login linked — cannot be assigned
                  </span>
                )}
              </span>
              <Chip
                label={`${count}`}
                tone={load === 'ok' ? 'paid' : load === 'heavy' ? 'due' : 'pending'}
                title={load === 'ok'
                  ? `${count} students — close to the ${TARGET_STUDENTS_PER_TEACHER} target`
                  : `${count} students — far from the ${TARGET_STUDENTS_PER_TEACHER} target`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Student pick list ────────────────────────────────────────────────── */

function StudentPickList({ rows, picked, onToggle, summaryFor }: {
  rows: RegisterRow[];
  picked: Record<string, boolean>;
  onToggle: (rowId: string) => void;
  summaryFor: RegisterData['summaryFor'];
}) {
  return (
    <div style={{ display: 'grid', maxHeight: 520, overflowY: 'auto' }}>
      {rows.map(row => {
        const summary = summaryFor(row.id);
        return (
          <label
            key={row.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minHeight: 56,
              padding: 'var(--space-2) var(--space-4)', cursor: 'pointer',
              borderTop: '1px solid var(--color-divider)',
              background: picked[row.id] ? 'var(--color-surface-variant)' : 'transparent',
            }}
          >
            <input
              type="checkbox"
              checked={Boolean(picked[row.id])}
              onChange={() => onToggle(row.id)}
              style={{ width: 18, height: 18, flexShrink: 0 }}
            />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 600, display: 'block' }}>{row.name}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}>
                {[row.className, row.sectionName].filter(Boolean).join(' · ') || '—'}
                {row.teacherName ? ` · ${row.teacherName}` : ' · unassigned'}
              </span>
            </span>
            {summary.totalDueNow > 0 && <Chip label={`Due ${inr(summary.totalDueNow)}`} tone="due" />}
          </label>
        );
      })}
    </div>
  );
}
