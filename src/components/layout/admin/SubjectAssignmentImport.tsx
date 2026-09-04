/* ============================================
   Bulk import — paste, review, confirm
   ============================================
   Three steps, and the middle one is the point: the Admin sees exactly what
   will be written before anything is. Nothing here touches the database —
   the parent does the writing, and only when `onConfirm` is called.
*/

'use client';

import React, { useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/SharedUI';
import {
  applyTeacherChoice, isImportable, matchAllocations, parseAllocationText, summarise,
  type ExistingAssignment, type MatchedRow, type NamedRecord,
} from '@/lib/assignment-import';
import { ALLOCATION_SHEET } from '@/lib/allocation-sheet';
import type { SubjectAssignment, TeacherRecord } from '@/lib/subject-assignments';
import type { Class } from '@/types/models';

interface Props {
  open: boolean;
  onClose: () => void;
  classes: Class[];
  teachers: TeacherRecord[];
  /** Assignments that already exist, so collisions are shown, not made. */
  existing: SubjectAssignment[];
  /** Writes the rows. Called only from Confirm & Import. */
  onConfirm: (rows: MatchedRow[]) => Promise<void>;
}

const cellStyle: React.CSSProperties = {
  padding: '8px 10px', fontSize: '0.85rem', borderBottom: '1px solid var(--color-border)',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontFamily: 'var(--font-mono, monospace)',
  fontSize: '0.8rem', lineHeight: 1.6, minHeight: 260,
  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
  background: 'var(--color-surface)', color: 'var(--color-text-primary)',
};

export default function SubjectAssignmentImport({
  open, onClose, classes, teachers, existing, onConfirm,
}: Props) {
  const [text, setText] = useState('');
  /** null until the Admin has asked for a match — that is the review step. */
  const [rows, setRows] = useState<MatchedRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  const existingKeys = useMemo<ExistingAssignment[]>(() => existing.map(a => ({
    classId: a.classId, sectionId: a.sectionId, subjectId: a.subjectId,
    teacherId: a.teacherId, teacherName: a.teacherName,
  })), [existing]);

  const teacherOptions = useMemo<NamedRecord[]>(
    () => teachers.map(t => ({ id: t.id, name: t.name })), [teachers]);

  const reset = () => { setText(''); setRows(null); setBusy(false); };
  const close = () => { reset(); onClose(); };

  const runMatch = () => {
    const parsed = parseAllocationText(text);
    setRows(matchAllocations({
      rows: parsed,
      classes: classes.map(c => ({
        id: c.id, name: c.name,
        sections: (c.sections ?? []).map(s => ({ id: s.id, name: s.name })),
        subjects: (c.subjects ?? []).map(s => ({ id: s.id, name: s.name })),
      })),
      teachers: teacherOptions,
      existing: existingKeys,
    }));
  };

  const chooseTeacher = (at: number, teacherId: string) => {
    const teacher = teacherOptions.find(t => t.id === teacherId);
    if (!teacher || !rows) return;
    setRows(rows.map((row, i) => i === at ? applyTeacherChoice(row, teacher, existingKeys) : row));
  };

  const confirm = async () => {
    if (!rows || busy) return;
    setBusy(true);
    try {
      await onConfirm(rows.filter(isImportable));
      reset();
    } finally {
      setBusy(false);
    }
  };

  const summary = rows ? summarise(rows) : null;

  /* ── Step 1: paste ──────────────────────────────────────────────────── */

  if (!rows) {
    return (
      <Modal isOpen={open} onClose={close} title="Import assignments" size="lg">
        <div style={{ display: 'grid', gap: 12 }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            Paste the allocation as it is written on the sheets — a class heading,
            then one <code>Subject → Teacher</code> line per subject. Nothing is
            saved until you have reviewed the matches.
          </p>
          <textarea
            style={inputStyle}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={'CLASS I-A\nEnglish → Uma\nMaths → Swarnalatha'}
            aria-label="Allocation list"
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => setText(ALLOCATION_SHEET)}>
              Load the school&apos;s sheet
            </Button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" onClick={close}>Cancel</Button>
              <Button onClick={runMatch} disabled={!text.trim()}>Match</Button>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  /* ── Step 2: review ─────────────────────────────────────────────────── */

  const group = (status: MatchedRow['status']) => rows.filter(r => r.status === status);

  const renderGroup = (
    title: string, status: MatchedRow['status'], tone: 'success' | 'warning' | 'error', note: string,
  ) => {
    const items = group(status);
    if (items.length === 0) return null;
    return (
      <section style={{ display: 'grid', gap: 6 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Badge variant={tone}>{items.length}</Badge>
          <strong style={{ fontSize: '0.9rem' }}>{title}</strong>
          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>{note}</span>
        </header>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
            <tbody>
              {items.map(row => {
                const at = rows.indexOf(row);
                return (
                  <tr key={at}>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                      {row.className ?? row.row.className}
                      {row.sectionName ? `-${row.sectionName}` : ''}
                    </td>
                    <td style={cellStyle}>{row.subjectName ?? row.row.subjectName}</td>
                    <td style={cellStyle}>
                      {row.teacherName ?? <em>{row.row.teacherName}</em>}
                      {row.conflictWith && (
                        <span style={{ color: 'var(--color-warning)', marginLeft: 6 }}>
                          replaces {row.conflictWith.teacherName}
                        </span>
                      )}
                    </td>
                    <td style={cellStyle}>
                      {row.problems.length > 0 && (
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.78rem' }}>
                          {row.problems.join(' ')}
                        </span>
                      )}
                      {/* Only a teacher can be corrected here — a missing subject
                          or section is a records problem, not a naming one. */}
                      {!row.teacherId && row.subjectId && row.sectionId && (
                        <select
                          value=""
                          onChange={e => chooseTeacher(at, e.target.value)}
                          style={{ marginTop: 4, width: '100%', padding: '6px 8px', fontSize: '0.8rem' }}
                          aria-label={`Teacher for ${row.row.subjectName}`}
                        >
                          <option value="">Choose the right teacher…</option>
                          {(row.teacherSuggestions ?? []).map(t => (
                            <option key={t.id} value={t.id}>{t.name} — closest match</option>
                          ))}
                          {teacherOptions
                            .filter(t => !(row.teacherSuggestions ?? []).some(s => s.id === t.id))
                            .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  return (
    <Modal isOpen={open} onClose={close} title="Review before importing" size="lg">
      <div style={{ display: 'grid', gap: 16 }}>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
          {summary!.importable} of {rows.length} rows are ready to save.
          {summary!.review > 0 && ` ${summary!.review} need a decision and will be skipped.`}
          {' '}Nothing has been saved yet.
        </p>

        {renderGroup('Matched', 'matched', 'success', 'will be saved as shown')}
        {renderGroup('Conflict', 'conflict', 'warning', 'will replace the current teacher')}
        {renderGroup('Needs review', 'review', 'error', 'skipped unless you resolve them')}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => setRows(null)} disabled={busy}>Back</Button>
          <Button variant="secondary" onClick={close} disabled={busy}>Cancel</Button>
          <Button onClick={confirm} disabled={busy || summary!.importable === 0}>
            {busy ? 'Saving…' : `Confirm & import ${summary!.importable}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
