'use client';

/* ============================================
   Principal Fees Note — page key 'principal-note'
   ============================================
   Sharmi's paper "fees note", typed once. Every row written here shows up in
   the class-wise and teacher-wise registers automatically — they are views of
   these same documents, never copies.

   Two presentations over ONE data source: a frozen-first-column grid with
   inline cell editing on a PC, a card per student with a bottom-sheet editor
   on a phone. Both call the same handlers against the same rows.

   Money math is the engine's (src/lib/principal-fees.ts) and writes are the
   service's (src/lib/principal-service.ts). This screen owns neither.
*/

import React, { useCallback, useMemo, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/SharedUI';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { PlusIcon } from '@/components/ui/Icons';
import { hasCapability } from '@/lib/permissions';
import { PrincipalRegisterService } from '@/lib/principal-service';
import {
  principalWriteError, refreshFailedMessage, useIsMobile, usePrincipalActor,
} from '../principal-shared';
import NoteCards from './NoteCards';
import NoteGrid from './NoteGrid';
import NoteHeader from './NoteHeader';
import AddStudentDialog from './AddStudentDialog';
import ImportStudentsDialog from './ImportStudentsDialog';
import RecordPaymentDialog, { type PaymentTarget } from './RecordPaymentDialog';
import StudentEditSheet from './StudentEditSheet';
import { useCellAutosave, type RowPatch } from './use-cell-autosave';
import { useNoteData } from './use-note-data';
import {
  classOptions, fieldPatch, filterRows, monthsForAmount,
  type CellRef, type EditableField, type NoteRowHandlers, type PaymentPrefill,
} from './note-helpers';
import type { RegisterRow } from '@/types/principal';

const CANNOT_EDIT = 'Only the Principal and the responsible teacher can edit the fees note.';
const CANNOT_REMOVE = 'Only the Principal can remove a student from the fees note.';

const panelStyle: React.CSSProperties = {
  padding: 'var(--space-8)',
  textAlign: 'center',
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border)',
};

export default function PrincipalFeesNote() {
  const { role } = useAuth();
  const { school } = useSchool();
  const { showToast } = useToast();
  const actor = usePrincipalActor();
  const isMobile = useIsMobile();

  const academicYear = school?.academicYear || '';
  const {
    rows, paymentsFor, summaryFor, settings, totals,
    loading, error, reload, retry, patchRow,
  } = useNoteData(academicYear);

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<CellRef | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RegisterRow | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RegisterRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  // State updates are async: two taps inside one frame would both pass a
  // `deleting` check. The ref closes that window.
  const deletingRef = useRef(false);

  /* ── Capabilities (UI gating; firestore.rules is the real boundary) ── */

  const canView = hasCapability(role, 'viewPrincipalRegister');
  const isRegisterOwner = hasCapability(role, 'editPrincipalRegister');
  const canEditOwnRows = hasCapability(role, 'editOwnStudentFees');
  const canRecordPayments = hasCapability(role, 'recordPrincipalPayments');

  const ownsRow = useCallback(
    (row: RegisterRow): boolean => Boolean(actor.uid) && row.teacherUid === actor.uid,
    [actor.uid],
  );
  const canEditRow = useCallback(
    (row: RegisterRow): boolean => isRegisterOwner || (canEditOwnRows && ownsRow(row)),
    [isRegisterOwner, canEditOwnRows, ownsRow],
  );
  const canRecordFor = useCallback(
    (row: RegisterRow): boolean =>
      canRecordPayments && (isRegisterOwner || ownsRow(row)),
    [canRecordPayments, isRegisterOwner, ownsRow],
  );
  // Soft-delete writes `deleted`, a field firestore.rules keeps out of a
  // teacher's allowed set — so only the register owner is ever offered it.
  const canDeleteRow = useCallback((): boolean => isRegisterOwner, [isRegisterOwner]);

  /* ── Inline editing: optimistic UI + debounced write ── */

  const autosave = useCellAutosave({
    save: (rowId, patch) => PrincipalRegisterService.updateRow(rowId, patch, actor),
    onFailure: (rowId, revert, saveError) => {
      patchRow(rowId, revert as Partial<RegisterRow>);
      showToast(principalWriteError(saveError, CANNOT_EDIT), 'error');
    },
  });

  const commitCell = useCallback((row: RegisterRow, field: EditableField, value: number) => {
    const current = Number(row[field]) || 0;
    if (value === current) return;

    const patch: RowPatch = fieldPatch(field, value);
    const revert: RowPatch = fieldPatch(field, current);

    // An amount with no months attached charges nothing. Typing "van 500" into
    // a cell has to schedule the months too, or the register silently stays 0.
    if (field === 'ecaAnnual') {
      const months = monthsForAmount(value, row.ecaMonths, settings?.defaultEcaMonths);
      if (months) {
        patch.ecaMonths = months;
        revert.ecaMonths = [...(row.ecaMonths ?? [])];
      }
    }
    if (field === 'vanMonthly') {
      const months = monthsForAmount(value, row.vanMonths, settings?.defaultVanMonths);
      if (months) {
        patch.vanMonths = months;
        revert.vanMonths = [...(row.vanMonths ?? [])];
      }
    }

    patchRow(row.id, patch as Partial<RegisterRow>);
    autosave.queue(row.id, patch, revert);
  }, [autosave, patchRow, settings?.defaultEcaMonths, settings?.defaultVanMonths]);

  /* ── Row actions ── */

  const openPayment = useCallback((row: RegisterRow, prefill?: PaymentPrefill) => {
    if (!canRecordFor(row)) {
      showToast('You can only record payments for your own students.', 'error');
      return;
    }
    setPaymentTarget({ row, summary: summaryFor(row.id), prefill });
  }, [canRecordFor, summaryFor, showToast]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget || deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    try {
      await PrincipalRegisterService.softDeleteRow(deleteTarget.id, actor);
      showToast(`${deleteTarget.name} removed (kept in the activity log)`);
      setDeleteTarget(null);
      try {
        await reload();
      } catch (refreshError) {
        console.error('[fees-note] refresh after remove failed', refreshError);
        showToast(refreshFailedMessage('Student removed'), 'warning');
      }
    } catch (deleteError) {
      console.error('[fees-note] remove student failed', { id: deleteTarget.id, error: deleteError });
      showToast(principalWriteError(deleteError, CANNOT_REMOVE), 'error');
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  }, [deleteTarget, actor, reload, showToast]);

  const handlers = useMemo<NoteRowHandlers>(() => ({
    summaryFor,
    canEditRow,
    canDeleteRow,
    canRecordFor,
    onToggleMonths: rowId => setExpandedRowId(prev => (prev === rowId ? null : rowId)),
    onRecordPayment: openPayment,
    onEditRow: row => setEditTarget(row),
    onDeleteRow: row => setDeleteTarget(row),
  }), [summaryFor, canEditRow, canDeleteRow, canRecordFor, openPayment]);

  /* ── Derived lists ── */

  const classNames = useMemo(() => classOptions(rows), [rows]);
  const visibleRows = useMemo(
    () => filterRows(rows, search, classFilter),
    [rows, search, classFilter],
  );

  /* ── Render ── */

  if (!canView) {
    return (
      <div className="page-container">
        <div style={panelStyle}>
          <p className="text-body" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
            The fees note is not available for your role
          </p>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            Ask the Principal for access. If your role changed recently, refresh the app.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container">
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300,
        }}>
          <span className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            Loading the fees note...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div style={panelStyle}>
          <p className="text-body" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
            Could not load the fees note
          </p>
          <p className="text-body-sm" style={{
            color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)',
          }}>
            {error}
          </p>
          <Button variant="primary" onClick={() => { void retry(); }}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <NoteHeader
        academicYear={academicYear}
        totals={totals}
        visibleCount={visibleRows.length}
        search={search}
        onSearchChange={setSearch}
        classFilter={classFilter}
        classNames={classNames}
        onClassFilterChange={setClassFilter}
        canAddStudent={isRegisterOwner}
        onAddStudent={() => setAddOpen(true)}
      />

      <div style={{ marginTop: 'var(--space-4)' }}>
        {rows.length === 0 ? (
          <EmptyState
            title="The fees note is empty"
            description={
              isRegisterOwner
                ? 'Students are added to this note once, then their row stays for the whole year. Add the first one to start.'
                : 'The Principal has not added any students to the note yet.'
            }
            action={isRegisterOwner ? (
              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button variant="primary" onClick={() => setImportOpen(true)}>
                  Import students from school records
                </Button>
                <Button variant="secondary" icon={<PlusIcon size={16} />} onClick={() => setAddOpen(true)}>
                  Add Student
                </Button>
              </div>
            ) : undefined}
          />
        ) : visibleRows.length === 0 ? (
          <EmptyState
            title="No student matches"
            description="Try a different name, or clear the class filter."
            action={(
              <Button
                variant="secondary"
                onClick={() => { setSearch(''); setClassFilter(''); }}
              >
                Clear filters
              </Button>
            )}
          />
        ) : isMobile ? (
          <NoteCards
            rows={visibleRows}
            expandedRowId={expandedRowId}
            handlers={handlers}
          />
        ) : (
          <NoteGrid
            rows={visibleRows}
            expandedRowId={expandedRowId}
            editingCell={editingCell}
            handlers={handlers}
            onStartEdit={setEditingCell}
            onCommitCell={commitCell}
            onInvalidCell={() =>
              showToast('That is not an amount — the cell was left unchanged.', 'error')}
          />
        )}
      </div>

      <ImportStudentsDialog
        isOpen={importOpen}
        academicYear={academicYear}
        existingRows={rows}
        actor={actor}
        onClose={() => setImportOpen(false)}
        onImported={reload}
      />

      <AddStudentDialog
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        isMobile={isMobile}
        academicYear={academicYear}
        actor={actor}
        settings={settings}
        fallbackClassNames={classNames}
        onSaved={reload}
      />

      <StudentEditSheet
        row={editTarget}
        onClose={() => setEditTarget(null)}
        isMobile={isMobile}
        actor={actor}
        settings={settings}
        identityEditable={isRegisterOwner}
        classNames={classNames}
        onSaved={reload}
      />

      <RecordPaymentDialog
        target={paymentTarget}
        onClose={() => setPaymentTarget(null)}
        isMobile={isMobile}
        academicYear={academicYear}
        actor={actor}
        existingPayments={paymentTarget ? paymentsFor(paymentTarget.row.id) : []}
        onSaved={reload}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => { if (!deleting) setDeleteTarget(null); }}
        onConfirm={() => { void handleDelete(); }}
        title="Remove from the fees note?"
        message={
          deleteTarget
            ? `${deleteTarget.name} will disappear from every register. Payments already recorded stay in the activity log.`
            : ''
        }
        confirmLabel={deleting ? 'Removing...' : 'Remove'}
        cancelLabel="Keep"
        variant="danger"
      />
    </div>
  );
}
