'use client';
/* One-time bootstrap: copy the school's student records into the fees note.

   The register is standalone, so it starts empty — this dialog is the bridge
   that saves Sharmi typing ~228 names. It copies IDENTITY only (name, class,
   section, roll no); every fee stays 0 because the amounts are hers to type.

   It runs in the app, as her own signed-in login, because the school signs in
   with Google and has no password a CLI script could use. Each row is created
   through PrincipalRegisterService, so every import is audited exactly like a
   hand-typed row.

   Idempotent: a student is skipped when a live row already holds the same
   name + class (whitespace collapsed, case ignored — the live data contains
   'Class  2' with a double space and 'LKG ' with a trailing space). Re-running
   after new admissions therefore adds only the new children. */

import React, { useCallback, useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { StudentsService } from '@/lib/firestore-service';
import { PrincipalRegisterService } from '@/lib/principal-service';
import { ACADEMIC_MONTHS } from '@/lib/fee-utils';
import type { PrincipalActor, RegisterRow } from '@/types/principal';

/** 'Class  2' and 'LKG ' both exist in the live data — compare them fairly. */
const norm = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();
const tidy = (value: string): string => value.replace(/\s+/g, ' ').trim();

interface Candidate {
  name: string;
  className: string;
  sectionName?: string;
  rollNo?: string;
}

interface ImportStudentsDialogProps {
  isOpen: boolean;
  academicYear: string;
  existingRows: RegisterRow[];
  actor: PrincipalActor;
  onClose: () => void;
  onImported: () => Promise<void> | void;
}

export default function ImportStudentsDialog({
  isOpen, academicYear, existingRows, actor, onClose, onImported,
}: ImportStudentsDialogProps) {
  const { showToast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [skipped, setSkipped] = useState(0);

  const scan = useCallback(async () => {
    setScanning(true);
    setScanError(null);
    try {
      const students = await StudentsService.getAll(academicYear) as unknown as Array<Record<string, unknown>>;
      // Live (non-deleted) rows only: a row she deleted should come back if the
      // child is still enrolled.
      const taken = new Set(
        existingRows.filter(r => !r.deleted).map(r => `${norm(r.name)}|${norm(r.className)}`),
      );
      const fresh: Candidate[] = [];
      let already = 0;
      for (const s of students) {
        const name = tidy(String(s.name || ''));
        const className = tidy(String(s.className || ''));
        if (!name) continue;
        if (taken.has(`${norm(name)}|${norm(className)}`)) { already += 1; continue; }
        taken.add(`${norm(name)}|${norm(className)}`);
        fresh.push({
          name,
          className,
          sectionName: s.sectionName ? tidy(String(s.sectionName)) : undefined,
          rollNo: s.rollNumber ? String(s.rollNumber) : undefined,
        });
      }
      setCandidates(fresh);
      setSkipped(already);
    } catch (e) {
      console.error('[import-students] scan failed', e);
      setScanError('Could not read the school records. Check your connection and try again.');
    } finally {
      setScanning(false);
    }
  }, [academicYear, existingRows]);

  useEffect(() => { if (isOpen) void scan(); }, [isOpen, scan]);

  const runImport = async () => {
    if (importing || candidates.length === 0) return;
    setImporting(true);
    setProgress(0);
    let done = 0;
    let failed = 0;
    for (const c of candidates) {
      try {
        await PrincipalRegisterService.createRow({
          academicYear,
          name: c.name,
          className: c.className,
          sectionName: c.sectionName,
          rollNo: c.rollNo,
          teacherUid: null,
          teacherName: null,
          schoolFee: 0,
          ecaAnnual: 0,
          ecaMonths: [...ACADEMIC_MONTHS],
          vanMonthly: 0,
          vanMonths: [...ACADEMIC_MONTHS],
        }, actor);
        done += 1;
      } catch (e) {
        failed += 1;
        console.error('[import-students] row failed', { name: c.name, error: e });
      }
      setProgress(done + failed);
    }
    setImporting(false);
    await onImported();
    if (failed === 0) {
      showToast(`${done} students added to the fees note`, 'success');
      onClose();
    } else {
      // Partial import is safe to retry — the scan skips what already landed.
      showToast(`${done} added, ${failed} failed. Run the import again to retry the rest.`, 'warning');
    }
  };

  if (!isOpen) return null;

  const nothingToDo = !scanning && !scanError && candidates.length === 0;

  return (
    <Modal isOpen={isOpen} onClose={importing ? () => {} : onClose} title="Import students from school records" size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <p className="text-body-sm" style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
          Copies each child&apos;s <strong>name and class</strong> into your fees note so you don&apos;t have to type them.
          All fee amounts start at ₹0 — you type those yourself. Nothing else is copied, and the school records are not changed.
        </p>

        {scanning && (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
            Checking school records…
          </div>
        )}

        {scanError && (
          <div style={{ padding: 'var(--space-3) var(--space-4)', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-md)', color: '#B91C1C', fontSize: '0.85rem' }}>
            {scanError}
          </div>
        )}

        {!scanning && !scanError && (
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <Stat label="Will be added" value={candidates.length} tone={candidates.length > 0 ? 'good' : 'muted'} />
            <Stat label="Already in the note" value={skipped} tone="muted" />
          </div>
        )}

        {nothingToDo && (
          <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-variant)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            {skipped > 0
              ? 'Every student from the school records is already in your fees note.'
              : 'No student records were found for this academic year. Add students with the “Add Student” button instead.'}
          </div>
        )}

        {candidates.length > 0 && !importing && (
          <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
            {candidates.slice(0, 50).map((c, i) => (
              <div key={`${c.name}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid var(--color-border)', fontSize: '0.82rem' }}>
                <span>{c.name}</span>
                <span style={{ color: 'var(--color-text-tertiary)' }}>{c.className}</span>
              </div>
            ))}
            {candidates.length > 50 && (
              <div style={{ padding: '6px 12px', fontSize: '0.78rem', color: 'var(--color-text-tertiary)' }}>
                …and {candidates.length - 50} more
              </div>
            )}
          </div>
        )}

        {importing && (
          <div style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Adding {progress} of {candidates.length}…</div>
            <div style={{ height: 6, background: 'var(--color-surface-variant)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.round((progress / Math.max(1, candidates.length)) * 100)}%`, background: 'var(--color-primary-500)', transition: 'width 0.2s' }} />
            </div>
            <div className="text-caption" style={{ color: 'var(--color-text-tertiary)', marginTop: 6 }}>
              Keep this window open until it finishes.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose} disabled={importing}>
            {nothingToDo ? 'Close' : 'Cancel'}
          </Button>
          {candidates.length > 0 && (
            <Button variant="primary" onClick={runImport} loading={importing}>
              Add {candidates.length} students
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'good' | 'muted' }) {
  return (
    <div style={{ flex: 1, minWidth: 130, padding: 'var(--space-3)', background: 'var(--color-surface-variant)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
      <div className="text-caption" style={{ color: 'var(--color-text-tertiary)', fontWeight: 600 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: tone === 'good' ? '#059669' : 'var(--color-text-primary)' }}>{value}</div>
    </div>
  );
}
