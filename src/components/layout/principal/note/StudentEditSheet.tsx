'use client';

/* ============================================
   Fees Note — edit a student
   ============================================
   The mobile path into the register (tap a card) and the desktop row-menu
   "Edit details". Only CHANGED fields are sent, so the audit entry reads as
   what the user actually did rather than a rewrite of the whole row.
*/

import React, { useCallback, useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { PrincipalRegisterService } from '@/lib/principal-service';
import { principalWriteError, refreshFailedMessage } from '../principal-shared';
import ResponsiveSheet, { SheetActions } from './ResponsiveSheet';
import StudentFormFields, {
  formAmount, studentFormFromRow, validateStudentForm, type StudentFormValues,
} from './StudentFormFields';
import { monthsForAmount } from './note-helpers';
import type {
  NewRegisterRow, PrincipalActor, PrincipalSettings, RegisterRow,
} from '@/types/principal';

interface StudentEditSheetProps {
  row: RegisterRow | null;
  onClose: () => void;
  isMobile: boolean;
  actor: PrincipalActor;
  settings: PrincipalSettings | null;
  /** Principal only. A teacher may move the fee fields, never the identity. */
  identityEditable: boolean;
  classNames: string[];
  onSaved: () => Promise<void>;
}

const CANNOT_EDIT = 'Only the Principal and the responsible teacher can edit this student.';

/** Only the fields that actually moved — an empty patch means "nothing to save". */
function buildPatch(
  row: RegisterRow,
  form: StudentFormValues,
  settings: PrincipalSettings | null,
): Partial<NewRegisterRow> {
  const patch: Partial<NewRegisterRow> = {};
  const name = form.name.trim();
  const className = form.className.trim();
  const sectionName = form.sectionName.trim();
  const rollNo = form.rollNo.trim();
  const notes = form.notes.trim();

  if (name !== (row.name || '')) patch.name = name;
  if (className !== (row.className || '')) patch.className = className;
  if (sectionName !== (row.sectionName || '')) patch.sectionName = sectionName;
  if (rollNo !== (row.rollNo || '')) patch.rollNo = rollNo;
  if (notes !== (row.notes || '')) patch.notes = notes;
  if (form.isScholarship !== Boolean(row.isScholarship)) patch.isScholarship = form.isScholarship;

  const schoolFee = formAmount(form.schoolFee);
  if (schoolFee !== (Number(row.schoolFee) || 0)) patch.schoolFee = schoolFee;

  const ecaAnnual = formAmount(form.ecaAnnual);
  if (ecaAnnual !== (Number(row.ecaAnnual) || 0)) {
    patch.ecaAnnual = ecaAnnual;
    const months = monthsForAmount(ecaAnnual, row.ecaMonths, settings?.defaultEcaMonths);
    if (months) patch.ecaMonths = months;
  }

  const vanMonthly = formAmount(form.vanMonthly);
  if (vanMonthly !== (Number(row.vanMonthly) || 0)) {
    patch.vanMonthly = vanMonthly;
    const months = monthsForAmount(vanMonthly, row.vanMonths, settings?.defaultVanMonths);
    if (months) patch.vanMonths = months;
  }

  return patch;
}

export default function StudentEditSheet({
  row, onClose, isMobile, actor, settings, identityEditable, classNames, onSaved,
}: StudentEditSheetProps) {
  const { showToast } = useToast();
  const [form, setForm] = useState<StudentFormValues | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(row ? studentFormFromRow(row) : null);
  }, [row]);

  const update = useCallback((patch: Partial<StudentFormValues>) => {
    setForm(prev => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const close = () => {
    if (saving) return;
    onClose();
  };

  const handleSave = async () => {
    if (saving || !row || !form) return;
    const problem = validateStudentForm(form);
    if (problem) { showToast(problem, 'error'); return; }
    if (!actor.uid) {
      showToast('Your session has no user id — sign in again before editing.', 'error');
      return;
    }

    const patch = buildPatch(row, form, settings);
    if (Object.keys(patch).length === 0) {
      showToast('Nothing changed', 'info');
      onClose();
      return;
    }

    setSaving(true);
    try {
      await PrincipalRegisterService.updateRow(row.id, patch, actor);
      showToast(`${form.name.trim() || 'Student'} updated`);
      onClose();
      try {
        await onSaved();
      } catch (refreshError) {
        console.error('[fees-note] refresh after edit failed', refreshError);
        showToast(refreshFailedMessage('Student updated'), 'warning');
      }
    } catch (error) {
      console.error('[fees-note] student edit failed', { rowId: row.id, patch, error });
      showToast(principalWriteError(error, CANNOT_EDIT), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveSheet
      isOpen={Boolean(row && form)}
      onClose={close}
      title={row ? row.name : 'Edit student'}
      isMobile={isMobile}
    >
      {form && (
        <>
          {!identityEditable && (
            <p className="text-body-sm" style={{
              color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-3)',
            }}>
              You can change the fee amounts for your students. Name and class are
              set by the Principal.
            </p>
          )}
          <StudentFormFields
            values={form}
            onChange={update}
            classNames={classNames}
            sectionNames={[]}
            identityEditable={identityEditable}
            disabled={saving}
          />
          <SheetActions>
            <Button variant="secondary" onClick={close} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>Save</Button>
          </SheetActions>
        </>
      )}
    </ResponsiveSheet>
  );
}
