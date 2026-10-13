'use client';

/* ============================================
   Subject & Teacher Assignment — page key 'subject-assignments'
   ============================================
   The academic step before a timetable exists: for one class-section, who
   teaches each subject. The timetable then resolves its teacher from this
   and never searches for "a Maths teacher" again.

   WHERE THE DATA LIVES
   --------------------
   No new collection. `teacherAssignments/{teacherId}_{year}` already holds
   entries carrying classId, sectionId, subjectId and their names — the exact
   record this page edits, only indexed by teacher. This screen re-indexes
   them by class-section and writes back through the same service, so the
   Teacher profile, this page and the timetable read ONE set of facts. Two
   stores of one relationship drift apart, and drift is the bug this whole
   area exists to end.

   Changing a subject's teacher touches two teachers' documents — the old
   one loses the cell, the new one gains it — so both writes are reported
   honestly if either fails.
*/

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSchool } from '@/context/SchoolContext';
import Button from '@/components/ui/Button';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/SharedUI';
import { useToast } from '@/components/ui/Toast';
import { PlusIcon } from '@/components/ui/Icons';
import { ClassesService, TeachersService } from '@/lib/firestore-service';
import {
  assignmentsForSection, buildAssignmentIndex, eligibleTeachersForSubject,
  findAssignment, planSectionCopy, sectionCoverage,
  withAssignment, withoutAssignment,
  type AssignmentDoc, type AssignmentEntry, type SubjectAssignment, type TeacherRecord,
} from '@/lib/subject-assignments';
import SubjectAssignmentImport from './SubjectAssignmentImport';
import { type MatchedRow } from '@/lib/assignment-import';
import type { Class, Subject } from '@/types/models';

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
};

const pickerStyle: React.CSSProperties = {
  padding: '8px 12px', minHeight: 40, fontSize: '0.9rem',
  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
  background: 'var(--color-surface)', color: 'var(--color-text-primary)',
};

export default function AdminSubjectAssignments() {
  const { school } = useSchool();
  const { showToast } = useToast();
  const year = school?.academicYear || '';

  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [docs, setDocs] = useState<AssignmentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');

  /** The add/edit dialog. `editing` carries the row being changed. */
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectAssignment | null>(null);
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formTeacherId, setFormTeacherId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<SubjectAssignment | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyToSectionId, setCopyToSectionId] = useState('');

  const load = useCallback(async () => {
    if (!year) return;
    setLoadError(null);
    try {
      const [c, t, a] = await Promise.all([
        ClassesService.getAll(year),
        TeachersService.getAll(),
        TeachersService.getAllAssignments(year),
      ]);
      setClasses(c as unknown as Class[]);
      setTeachers(t as unknown as TeacherRecord[]);
      setDocs(a as unknown as AssignmentDoc[]);
    } catch (error) {
      console.error('[subject-assignments] load failed', error);
      // Never render an empty table as though nothing is assigned.
      setLoadError('Could not load classes and teachers. Please retry.');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { void load(); }, [load]);

  const index = useMemo(() => buildAssignmentIndex(teachers, docs), [teachers, docs]);

  const selectedClass = classes.find(c => c.id === classId) ?? null;
  const sections = selectedClass?.sections ?? [];
  const selectedSection = sections.find(s => s.id === sectionId) ?? null;
  const classSubjects: Subject[] = selectedClass?.subjects ?? [];

  const rows = useMemo(
    () => (classId && sectionId ? assignmentsForSection(index, classId, sectionId) : []),
    [index, classId, sectionId],
  );

  const coverage = useMemo(
    () => sectionCoverage(index, classId, sectionId, classSubjects),
    [index, classId, sectionId, classSubjects],
  );

  /** Teachers offered for the chosen subject — qualification, not allocation. */
  const eligible = useMemo(() => {
    const subject = classSubjects.find(s => s.id === formSubjectId);
    return formSubjectId ? eligibleTeachersForSubject(teachers, formSubjectId, subject?.name) : [];
  }, [teachers, formSubjectId, classSubjects]);

  const readyToPick = Boolean(classId && sectionId);

  /* ── Writes ─────────────────────────────────────────────────────────── */

  /** A teacher's current entries, per-year document first. */
  const entriesOf = (teacherId: string): AssignmentEntry[] => {
    const doc = docs.find(d => d.teacherId === teacherId);
    if (doc) return doc.assignments ?? [];
    return teachers.find(t => t.id === teacherId)?.assignedClasses ?? [];
  };

  const saveAssignment = async () => {
    if (busy) return;
    const subject = classSubjects.find(s => s.id === formSubjectId);
    const teacher = teachers.find(t => t.id === formTeacherId);
    if (!subject || !teacher || !selectedClass || !selectedSection) {
      setFormError('Choose both a subject and a teacher.');
      return;
    }

    // Duplicate protection (§6) — one active teacher per class-section-subject.
    const existing = findAssignment(index, { classId, sectionId, subjectId: subject.id });
    if (existing && existing.teacherId !== teacher.id && !editing) {
      setFormError(
        `${subject.name} is already assigned to ${existing.teacherName} for `
        + `${selectedClass.name}-${selectedSection.name}. Use Edit on that row to change the teacher.`,
      );
      return;
    }

    const assignment: SubjectAssignment = {
      classId,
      className: selectedClass.name,
      sectionId,
      sectionName: selectedSection.name,
      subjectId: subject.id,
      subjectName: subject.name,
      teacherId: teacher.id,
      teacherName: teacher.name,
    };

    setBusy(true);
    try {
      // Moving a subject to another teacher: the previous holder loses the
      // cell first, so the pairing is never held by two people at once.
      const previous = editing ?? existing;
      if (previous && previous.teacherId !== teacher.id) {
        await TeachersService.updateAssignments(previous.teacherId, year,
          withoutAssignment(entriesOf(previous.teacherId),
            { classId, sectionId, subjectId: subject.id }) as never);
      }
      await TeachersService.updateAssignments(teacher.id, year,
        withAssignment(entriesOf(teacher.id), assignment) as never);

      await load();
      setFormOpen(false);
      setEditing(null);
      showToast(`${subject.name} → ${teacher.name} saved for ${selectedClass.name}-${selectedSection.name}`);
    } catch (error) {
      console.error('[subject-assignments] save failed', error);
      setFormError('The assignment was NOT saved. Please retry.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || busy) return;
    setBusy(true);
    try {
      await TeachersService.updateAssignments(deleteTarget.teacherId, year,
        withoutAssignment(entriesOf(deleteTarget.teacherId), {
          classId: deleteTarget.classId,
          sectionId: deleteTarget.sectionId,
          subjectId: deleteTarget.subjectId,
        }) as never);
      await load();
      setDeleteTarget(null);
      showToast(`${deleteTarget.subjectName} → ${deleteTarget.teacherName} removed`);
    } catch (error) {
      console.error('[subject-assignments] delete failed', error);
      showToast('The assignment was NOT removed. Please retry.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const copyPlan = useMemo(() => {
    const target = sections.find(s => s.id === copyToSectionId);
    if (!selectedClass || !target) return [];
    return planSectionCopy(index, { classId, sectionId }, {
      classId,
      sectionId: target.id,
      className: selectedClass.name,
      sectionName: target.name,
    });
  }, [index, classId, sectionId, copyToSectionId, sections, selectedClass]);

  const runCopy = async () => {
    if (busy || copyPlan.length === 0) return;
    setBusy(true);
    let saved = 0;
    try {
      // Grouped per teacher so each document is written once, not per subject.
      const byTeacher = new Map<string, SubjectAssignment[]>();
      for (const item of copyPlan) {
        byTeacher.set(item.teacherId, [...(byTeacher.get(item.teacherId) ?? []), item]);
      }
      for (const [teacherId, items] of byTeacher) {
        let entries = entriesOf(teacherId);
        for (const item of items) entries = withAssignment(entries, item);
        await TeachersService.updateAssignments(teacherId, year, entries as never);
        saved += items.length;
      }
      await load();
      setCopyOpen(false);
      showToast(`${saved} assignment${saved === 1 ? '' : 's'} copied — check the teachers and adjust.`);
    } catch (error) {
      console.error('[subject-assignments] copy failed', error);
      showToast(`Copied ${saved} of ${copyPlan.length}. The rest were NOT saved.`, 'error');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Writes the rows the Admin confirmed on the review screen. Grouped per
   * teacher so each document is written once, and a row that moves a subject
   * between teachers clears the previous holder first — the same two-sided
   * write the single-assignment form does.
   */
  const runImport = async (rows: MatchedRow[]) => {
    if (rows.length === 0) return;
    const entries = new Map<string, AssignmentEntry[]>();
    const editable = (teacherId: string): AssignmentEntry[] => {
      if (!entries.has(teacherId)) entries.set(teacherId, entriesOf(teacherId));
      return entries.get(teacherId)!;
    };

    for (const row of rows) {
      const key = { classId: row.classId!, sectionId: row.sectionId!, subjectId: row.subjectId! };
      // A conflict row hands the subject over, so strip it from whoever holds it.
      if (row.conflictWith) {
        entries.set(row.conflictWith.teacherId,
          withoutAssignment(editable(row.conflictWith.teacherId), key));
      }
      entries.set(row.teacherId!, withAssignment(editable(row.teacherId!), {
        ...key,
        className: row.className!,
        sectionName: row.sectionName!,
        subjectName: row.subjectName!,
        teacherId: row.teacherId!,
        teacherName: row.teacherName!,
      }));
    }

    let saved = 0;
    try {
      for (const [teacherId, list] of entries) {
        await TeachersService.updateAssignments(teacherId, year, list as never);
        saved += 1;
      }
      await load();
      setImportOpen(false);
      showToast(`${rows.length} assignment${rows.length === 1 ? '' : 's'} imported.`);
    } catch (error) {
      console.error('[subject-assignments] import failed', error);
      await load();
      showToast(
        `Imported ${saved} of ${entries.size} teachers. The rest were NOT saved — re-run the import.`,
        'error');
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="page-container">
        <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          Loading classes and teachers…
        </p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 className="text-h1">Subject &amp; Teacher Assignment</h2>
            {year && <Badge variant="primary">{year}</Badge>}
          </div>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            Assign subjects and their respective teachers for each class and section.
            The timetable takes its teachers from here.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            Bulk Import
          </Button>
          {readyToPick && (
            <>
            <Button variant="secondary" onClick={() => { setCopyToSectionId(''); setCopyOpen(true); }}>
              Copy Assignments
            </Button>
            <Button
              variant="primary"
              icon={<PlusIcon size={16} color="white" />}
              onClick={() => {
                setEditing(null);
                setFormSubjectId('');
                setFormTeacherId('');
                setFormError(null);
                setFormOpen(true);
              }}
            >
              Add Subject
            </Button>
            </>
          )}
        </div>
      </div>

      {loadError && (
        <div style={{ ...cardStyle, padding: 'var(--space-6)', textAlign: 'center', marginBottom: 'var(--space-4)' }}>
          <p className="text-body" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>{loadError}</p>
          <Button variant="primary" onClick={() => { setLoading(true); void load(); }}>Retry</Button>
        </div>
      )}

      {/* Class + section pickers */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 'var(--space-3)', marginBottom: 'var(--space-4)',
      }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="text-caption" style={{ color: 'var(--color-text-secondary)' }}>Class</span>
          <select
            style={pickerStyle}
            value={classId}
            onChange={e => { setClassId(e.target.value); setSectionId(''); }}
          >
            <option value="">Choose a class…</option>
            {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="text-caption" style={{ color: 'var(--color-text-secondary)' }}>Section</span>
          <select
            style={{ ...pickerStyle, opacity: sections.length ? 1 : 0.5 }}
            value={sectionId}
            disabled={sections.length === 0}
            onChange={e => setSectionId(e.target.value)}
          >
            <option value="">Choose a section…</option>
            {sections.map(sec => <option key={sec.id} value={sec.id}>Section {sec.name}</option>)}
          </select>
        </label>
      </div>

      {!readyToPick ? (
        <div style={{ ...cardStyle, padding: 'var(--space-8)', textAlign: 'center' }}>
          <p className="text-body" style={{ fontWeight: 600 }}>Choose a class and section</p>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            Their subjects and the teacher for each will be listed here.
          </p>
        </div>
      ) : (
        <>
          {/* Coverage summary (§14) */}
          <div style={{ ...cardStyle, padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 'var(--space-4)',
            }}>
              <Metric label="Class" value={`${selectedClass?.name ?? ''} — ${selectedSection?.name ?? ''}`} />
              <Metric label="Total subjects" value={String(coverage.total)} />
              <Metric label="Assigned" value={String(coverage.assigned)} color="var(--color-success)" />
              <Metric
                label="Unassigned"
                value={String(coverage.unassigned)}
                color={coverage.unassigned > 0 ? 'var(--color-error)' : 'var(--color-text-primary)'}
              />
            </div>
            {coverage.unassigned > 0 && (
              <p className="text-body-sm" style={{ color: 'var(--color-warning-text)', margin: 'var(--space-3) 0 0' }}>
                {coverage.unassigned} subject{coverage.unassigned === 1 ? '' : 's'} do
                {coverage.unassigned === 1 ? 'es' : ''} not have a teacher assigned
                {' — '}{coverage.unassignedSubjects.map(s => s.name).join(', ')}.
                Those subjects cannot be placed on the timetable until they do.
              </p>
            )}
          </div>

          {/* Assignment rows */}
          <div style={{ ...cardStyle, overflow: 'hidden' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 'var(--space-3)',
              padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-variant)',
              borderBottom: '1px solid var(--color-border)',
            }}>
              <span className="text-overline">Subject</span>
              <span className="text-overline">Assigned Teacher</span>
              <span className="text-overline">&nbsp;</span>
            </div>

            {rows.length === 0 ? (
              <p className="text-body-sm" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-tertiary)', margin: 0 }}>
                No subjects assigned for this section yet. Use <strong>Add Subject</strong> to start.
              </p>
            ) : rows.map(row => (
              <div
                key={`${row.subjectId}-${row.teacherId}`}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 'var(--space-3)',
                  padding: 'var(--space-3) var(--space-4)', alignItems: 'center',
                  borderTop: '1px solid var(--color-divider)',
                }}
              >
                <span style={{ fontWeight: 600 }}>{row.subjectName || '—'}</span>
                <span>{row.teacherName}</span>
                <span style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(row);
                      setFormSubjectId(row.subjectId);
                      setFormTeacherId(row.teacherId);
                      setFormError(null);
                      setFormOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(row)}>Delete</Button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add / edit */}
      {formOpen && (
        <Modal
          isOpen
          onClose={() => { if (!busy) { setFormOpen(false); setEditing(null); } }}
          title={editing ? 'Edit Assignment' : 'Add Assignment'}
          size="sm"
        >
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <Readback label="Class" value={selectedClass?.name ?? ''} />
            <Readback label="Section" value={selectedSection?.name ?? ''} />

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="text-caption" style={{ color: 'var(--color-text-secondary)' }}>Subject</span>
              <select
                style={pickerStyle}
                value={formSubjectId}
                /* Changing the subject invalidates the teacher: eligibility is
                   per subject, so a stale pick must not survive (§11). */
                onChange={e => { setFormSubjectId(e.target.value); setFormTeacherId(''); setFormError(null); }}
                disabled={Boolean(editing)}
              >
                <option value="">Choose a subject…</option>
                {classSubjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
              </select>
              {editing && (
                <span className="text-caption" style={{ color: 'var(--color-text-tertiary)' }}>
                  Delete the row and add it again to change the subject.
                </span>
              )}
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="text-caption" style={{ color: 'var(--color-text-secondary)' }}>Teacher</span>
              <select
                style={{ ...pickerStyle, opacity: formSubjectId ? 1 : 0.5 }}
                value={formTeacherId}
                disabled={!formSubjectId}
                onChange={e => { setFormTeacherId(e.target.value); setFormError(null); }}
              >
                <option value="">Choose a teacher…</option>
                {eligible.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {formSubjectId && eligible.length === 0 && (
                <span className="text-caption" style={{ color: 'var(--color-warning-text)' }}>
                  No teacher lists this subject on their profile. Add it under Teachers first.
                </span>
              )}
            </label>

            {formError && (
              <p className="text-body-sm" style={{ color: 'var(--color-error)', margin: 0 }}>{formError}</p>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button variant="secondary" onClick={() => { setFormOpen(false); setEditing(null); }} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => void saveAssignment()}
                loading={busy}
                disabled={busy || !formSubjectId || !formTeacherId}
              >
                {editing ? 'Save Assignment' : 'Add Assignment'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Copy (§9) */}
      {copyOpen && (
        <Modal
          isOpen
          onClose={() => { if (!busy) setCopyOpen(false); }}
          title="Copy Assignments"
          size="sm"
        >
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <Readback label="Copy from" value={`${selectedClass?.name ?? ''} — ${selectedSection?.name ?? ''}`} />
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="text-caption" style={{ color: 'var(--color-text-secondary)' }}>Copy to</span>
              <select
                style={pickerStyle}
                value={copyToSectionId}
                onChange={e => setCopyToSectionId(e.target.value)}
              >
                <option value="">Choose a section…</option>
                {sections.filter(s => s.id !== sectionId).map(sec => (
                  <option key={sec.id} value={sec.id}>Section {sec.name}</option>
                ))}
              </select>
            </label>

            {copyToSectionId && (
              copyPlan.length === 0 ? (
                <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', margin: 0 }}>
                  Nothing to copy — that section already has a teacher for every subject here.
                </p>
              ) : (
                <div style={{ ...cardStyle, padding: 'var(--space-3)' }}>
                  <p className="text-caption" style={{ color: 'var(--color-text-tertiary)', margin: '0 0 var(--space-2)' }}>
                    These {copyPlan.length} assignment{copyPlan.length === 1 ? '' : 's'} will be created.
                    The same teachers are carried over — change any that differ afterwards.
                  </p>
                  {copyPlan.map(item => (
                    <div key={item.subjectId} className="text-body-sm" style={{ padding: '2px 0' }}>
                      {item.subjectName} → {item.teacherName}
                    </div>
                  ))}
                </div>
              )
            )}

            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button variant="secondary" onClick={() => setCopyOpen(false)} disabled={busy}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => void runCopy()}
                loading={busy}
                disabled={busy || copyPlan.length === 0}
              >
                Copy {copyPlan.length || ''} assignment{copyPlan.length === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => { if (!busy) setDeleteTarget(null); }}
        onConfirm={() => void confirmDelete()}
        title="Remove this assignment?"
        message={deleteTarget
          ? `Remove ${deleteTarget.subjectName} → ${deleteTarget.teacherName} from `
            + `${deleteTarget.className}-${deleteTarget.sectionName}? `
            + 'The subject itself stays in the school list; only this teacher allocation is removed.'
          : ''}
        confirmLabel="Remove assignment"
      />

      <SubjectAssignmentImport
        open={importOpen}
        onClose={() => setImportOpen(false)}
        classes={classes}
        teachers={teachers}
        existing={index}
        onConfirm={runImport}
      />
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="text-overline" style={{ color: 'var(--color-text-tertiary)' }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: color ?? 'var(--color-text-primary)', wordBreak: 'break-word' }}>
        {value}
      </div>
    </div>
  );
}

function Readback({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)',
      padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)',
      background: 'var(--color-surface-variant)',
    }}>
      <span className="text-body-sm" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span className="text-body-sm" style={{ fontWeight: 700 }}>{value || '—'}</span>
    </div>
  );
}
