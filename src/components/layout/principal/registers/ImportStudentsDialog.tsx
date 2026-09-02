'use client';

/* ============================================
   Teacher-wise Register — import from the student list
   ============================================
   The register used to be fillable only by typing each child into the Fees
   Note (or by the console seed script). This dialog is the in-app version of
   that bootstrap: it reads the school's REAL `students` collection, hides the
   ones already in the register, and lets the Principal pull the rest in —
   class by class, optionally assigning them to a teacher in the same step.

   Writes go through PrincipalRegisterService.createRow, so every imported row
   is principal-only, audited, and born with ALL FEES AT ZERO — the amounts
   get typed in the Fees Note afterwards, exactly like the seed script did it.
   Nothing here touches the `students` collection itself.

   De-duplication matches the seed script: a student whose normalised
   name + class already has a live register row is not offered again.
*/

import React, { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { SearchInput, Select } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { StudentsService } from '@/lib/firestore-service';
import { PrincipalRegisterService } from '@/lib/principal-service';
import type { PrincipalActor, RegisterRow } from '@/types/principal';
import { compareClassNames, describeError } from './register-shared';
import { EmptyBlock, NoticeBanner } from './register-ui';

/** Same normalisation the seed script uses, so the two never disagree. */
const tidy = (value: unknown): string => String(value ?? '').replace(/\s+/g, ' ').trim();
const rowKey = (name: string, className: string): string =>
  `${tidy(name).toLowerCase()}|${tidy(className).toLowerCase()}`;

interface Candidate {
  /** The students-collection doc id — used only as a stable React key. */
  id: string;
  name: string;
  className: string;
  sectionName: string;
  rollNo: string;
}

export interface ImportStudentsDialogProps {
  academicYear: string;
  /** Live register rows — anything already here is not offered again. */
  existingRows: RegisterRow[];
  /** Teachers that CAN be assigned (must carry an auth uid). */
  teachers: { uid: string; name: string }[];
  actor: PrincipalActor | null;
  onClose: () => void;
  /** Post-commit refetch (refreshQuietly): never throws, false = stale list. */
  onSaved: () => Promise<boolean>;
}

/* Mounted ONLY while open (the parent conditionally renders it), so every
   opening starts from fresh initial state — no in-effect resets needed. */
export default function ImportStudentsDialog({
  academicYear, existingRows, teachers, actor, onClose, onSaved,
}: ImportStudentsDialogProps) {
  const { showToast } = useToast();

  const [students, setStudents] = useState<Candidate[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [teacherUid, setTeacherUid] = useState('');
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  /* Load the real student list once per mount (= once per opening). */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const docs = await StudentsService.getAll();
        if (cancelled) return;
        setStudents(docs
          .filter(doc => doc.status !== 'archived')
          .map(doc => ({
            id: String(doc.id ?? ''),
            name: tidy(doc.name),
            className: tidy(doc.className),
            sectionName: tidy(doc.sectionName ?? doc.section),
            rollNo: tidy(doc.rollNo ?? doc.rollNumber),
          }))
          .filter(candidate => candidate.id && candidate.name));
      } catch (error) {
        if (cancelled) return;
        console.error('[principal-register] student list load failed', error);
        setLoadError(describeError(error, 'Could not load the student list. Please retry.'));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /** name|class keys already living in the register (live rows only). */
  const takenKeys = useMemo(() => new Set(
    existingRows
      .filter(row => row.deleted !== true)
      .map(row => rowKey(row.name, row.className)),
  ), [existingRows]);

  const candidates = useMemo(() => (students ?? [])
    .filter(candidate => !takenKeys.has(rowKey(candidate.name, candidate.className))),
  [students, takenKeys]);

  const classNames = useMemo(() => {
    const set = new Set<string>();
    for (const candidate of candidates) if (candidate.className) set.add(candidate.className);
    return Array.from(set).sort(compareClassNames);
  }, [candidates]);

  const term = search.trim().toLowerCase();
  const visible = useMemo(() => candidates
    .filter(candidate => !classFilter || candidate.className === classFilter)
    .filter(candidate => !term
      || `${candidate.name} ${candidate.className} ${candidate.rollNo}`.toLowerCase().includes(term))
    .sort((a, b) => compareClassNames(a.className, b.className)
      || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
  [candidates, classFilter, term]);

  const pickedIds = visible.filter(candidate => picked[candidate.id]).map(candidate => candidate.id);
  const selectedTeacher = teachers.find(teacher => teacher.uid === teacherUid) ?? null;

  const toggleAllVisible = () => setPicked(
    pickedIds.length === visible.length
      ? {}
      : Object.fromEntries(visible.map(candidate => [candidate.id, true])),
  );

  /** One audited createRow per student; partial failures reported honestly. */
  const importPicked = async () => {
    if (busy || pickedIds.length === 0) return;
    if (!actor) {
      showToast('Your session has no signed-in user. Refresh the app.', 'error');
      return;
    }
    setBusy(true);
    const chosen = visible.filter(candidate => picked[candidate.id]);
    let saved = 0;
    let lastError: unknown = null;
    for (const candidate of chosen) {
      try {
        await PrincipalRegisterService.createRow({
          academicYear,
          name: candidate.name,
          className: candidate.className,
          sectionName: candidate.sectionName || undefined,
          rollNo: candidate.rollNo || undefined,
          teacherUid: selectedTeacher?.uid ?? null,
          teacherName: selectedTeacher?.name ?? null,
          // Born with every fee at zero — amounts are typed in the Fees Note,
          // the same contract as the original seed script.
          schoolFee: 0,
          ecaAnnual: 0,
          ecaMonths: [],
          vanMonthly: 0,
          vanMonths: [],
          isScholarship: false,
        }, actor);
        saved += 1;
      } catch (error) {
        console.error('[principal-register] import failed', { student: candidate.name, error });
        lastError = error;
      }
    }

    const refreshed = await onSaved();
    setPicked({});
    setBusy(false);

    if (saved === chosen.length) {
      const assignedNote = selectedTeacher ? ` and assigned to ${selectedTeacher.name}` : '';
      showToast(
        refreshed
          ? `${saved} student${saved === 1 ? '' : 's'} added to the register${assignedNote}`
          : `${saved} student${saved === 1 ? '' : 's'} added${assignedNote} — reload to see the latest.`,
        refreshed ? 'success' : 'warning',
      );
      if (candidates.length - saved <= 0) onClose();
      return;
    }
    showToast(
      `${saved} of ${chosen.length} added. ${describeError(lastError, 'The rest were NOT saved — please retry.')}`,
      'error',
    );
  };

  return (
    <Modal isOpen onClose={busy ? () => {} : onClose} title="Add students from the school list" size="lg">
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        <p className="text-body-sm" style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
          These are the school&rsquo;s registered students who are not in the fees register yet.
          Pick a class, tick the students, and add them — fee amounts are typed in the Fees Note
          afterwards. Choosing a teacher assigns them in the same step.
        </p>

        {loadError && <NoticeBanner tone="error">{loadError}</NoticeBanner>}

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 'var(--space-2)',
        }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, class or roll" />
          <Select
            label=""
            aria-label="Filter by class"
            value={classFilter}
            options={[
              { value: '', label: 'All classes' },
              ...classNames.map(name => ({ value: name, label: name })),
            ]}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setClassFilter(e.target.value)}
          />
          <Select
            label=""
            aria-label="Assign to teacher"
            value={teacherUid}
            options={[
              { value: '', label: 'No teacher yet (assign later)' },
              ...teachers.map(teacher => ({ value: teacher.uid, label: `Assign to ${teacher.name}` })),
            ]}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTeacherUid(e.target.value)}
          />
        </div>

        <div style={{
          maxHeight: 360, overflowY: 'auto',
          border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
        }}>
          {students === null && !loadError ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.85rem' }}>
              Loading the student list…
            </div>
          ) : visible.length === 0 ? (
            <EmptyBlock
              title={candidates.length === 0
                ? 'Every registered student is already in the fees register'
                : 'No student matches these filters'}
              hint={candidates.length === 0 ? 'New admissions will appear here.' : undefined}
            />
          ) : visible.map(candidate => (
            <label
              key={candidate.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minHeight: 48,
                padding: 'var(--space-2) var(--space-4)', cursor: 'pointer',
                borderBottom: '1px solid var(--color-divider)',
                background: picked[candidate.id] ? 'var(--color-surface-variant)' : 'transparent',
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(picked[candidate.id])}
                onChange={() => setPicked(prev => ({ ...prev, [candidate.id]: !prev[candidate.id] }))}
                style={{ width: 18, height: 18, flexShrink: 0 }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600, display: 'block' }}>{candidate.name}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}>
                  {[candidate.className, candidate.sectionName, candidate.rollNo ? `Roll ${candidate.rollNo}` : '']
                    .filter(Boolean).join(' · ') || '—'}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="ghost" size="sm" onClick={toggleAllVisible} disabled={busy || visible.length === 0}>
            {pickedIds.length === visible.length && visible.length > 0 ? 'Clear selection' : 'Select all shown'}
          </Button>
          <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            {pickedIds.length} selected · {candidates.length} not in the register yet
          </span>
          <div style={{ flex: 1 }} />
          <Button variant="secondary" onClick={onClose} disabled={busy}>Close</Button>
          <Button
            variant="primary"
            onClick={() => void importPicked()}
            loading={busy}
            disabled={busy || pickedIds.length === 0}
          >
            {selectedTeacher
              ? `Add & assign to ${selectedTeacher.name}`
              : `Add ${pickedIds.length || ''} student${pickedIds.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
