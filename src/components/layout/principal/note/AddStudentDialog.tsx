'use client';

/* ============================================
   Fees Note — Add Student
   ============================================
   Students are seeded into the note once, then the row lives here for the
   year. The class list is READ from the existing classes collection — this
   module never writes to it.

   Month schedules are attached at creation: an ECA or van amount with no
   months attached would charge nothing at all (see monthsForAmount).
*/

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { ClassesService } from '@/lib/firestore-service';
import { ACADEMIC_MONTHS } from '@/lib/fee-utils';
import { PrincipalRegisterService } from '@/lib/principal-service';
import { principalWriteError, refreshFailedMessage } from '../principal-shared';
import ResponsiveSheet, { SheetActions } from './ResponsiveSheet';
import StudentFormFields, {
  emptyStudentForm, formAmount, validateStudentForm, type StudentFormValues,
} from './StudentFormFields';
import { monthsForAmount } from './note-helpers';
import { useTeacherOptions } from './use-teacher-options';
import type { NewRegisterRow, PrincipalActor, PrincipalSettings } from '@/types/principal';

interface ClassOption {
  name: string;
  sections: string[];
}

interface AddStudentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
  academicYear: string;
  actor: PrincipalActor;
  settings: PrincipalSettings | null;
  /** Classes already present in the register — the fallback when the read fails. */
  fallbackClassNames: string[];
  onSaved: () => Promise<void>;
}

const CANNOT_ADD = 'Only the Principal can add students to the fees note.';

function readClassOptions(docs: Record<string, unknown>[]): ClassOption[] {
  return docs
    .map(doc => {
      const sections = Array.isArray(doc.sections) ? doc.sections : [];
      return {
        name: String(doc.name ?? '').trim(),
        sections: sections
          .map(section => String((section as { name?: unknown })?.name ?? '').trim())
          .filter(Boolean),
      };
    })
    .filter(option => option.name.length > 0);
}

export default function AddStudentDialog({
  isOpen, onClose, isMobile, academicYear, actor, settings, fallbackClassNames, onSaved,
}: AddStudentDialogProps) {
  const { showToast } = useToast();
  const [form, setForm] = useState<StudentFormValues>(emptyStudentForm);
  const teachers = useTeacherOptions(isOpen);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [saving, setSaving] = useState(false);

  // Read through a ref so a background register refresh cannot re-run the
  // effect and wipe a half-typed form.
  const fallbackRef = useRef(fallbackClassNames);
  fallbackRef.current = fallbackClassNames;

  // Classes load when the dialog opens. A failure is never fatal: the form
  // falls back to the classes already in the register, then to free text.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setForm(emptyStudentForm());
    ClassesService.getAll(academicYear)
      .then(docs => {
        if (!cancelled) setClasses(readClassOptions(docs as Record<string, unknown>[]));
      })
      .catch(error => {
        console.error('[fees-note] class list load failed', error);
        if (!cancelled) {
          setClasses(fallbackRef.current.map(name => ({ name, sections: [] })));
        }
      });
    return () => { cancelled = true; };
  }, [isOpen, academicYear]);

  const classNames = classes.length > 0
    ? classes.map(option => option.name)
    : fallbackClassNames;
  const sectionNames = classes.find(option => option.name === form.className)?.sections ?? [];

  const update = useCallback((patch: Partial<StudentFormValues>) => {
    setForm(prev => ({ ...prev, ...patch }));
  }, []);

  const close = () => {
    if (saving) return;
    onClose();
  };

  const handleSave = async () => {
    if (saving) return;
    const problem = validateStudentForm(form);
    if (problem) { showToast(problem, 'error'); return; }
    if (!actor.uid) {
      showToast('Your session has no user id — sign in again before adding students.', 'error');
      return;
    }

    const ecaAnnual = formAmount(form.ecaAnnual);
    // Typed as the whole-year van cost; stored as the monthly rate the engine
    // charges — yearly ÷ the months the schedule covers.
    const vanYearly = formAmount(form.vanYearly);
    const vanMonthsList = monthsForAmount(vanYearly, [], settings?.defaultVanMonths) ?? [];
    const vanMonthly = vanMonthsList.length > 0 ? Math.round(vanYearly / vanMonthsList.length) : 0;
    const payload: NewRegisterRow = {
      academicYear,
      name: form.name.trim(),
      className: form.className.trim(),
      sectionName: form.sectionName.trim() || undefined,
      rollNo: form.rollNo.trim() || undefined,
      teacherUid: form.teacherUid || null,
      teacherName: teachers.find(t => t.uid === form.teacherUid)?.name ?? null,
      schoolFee: formAmount(form.schoolFee),
      ecaAnnual,
      ecaMonths: monthsForAmount(ecaAnnual, [], settings?.defaultEcaMonths)
        ?? [...ACADEMIC_MONTHS],
      vanMonthly,
      vanMonths: vanMonthsList,
      isScholarship: form.isScholarship,
      notes: form.notes.trim() || undefined,
    };

    setSaving(true);
    try {
      await PrincipalRegisterService.createRow(payload, actor);
      showToast(`${payload.name} added to the fees note`);
      onClose();
      try {
        await onSaved();
      } catch (refreshError) {
        // The row COMMITTED. A refetch failure must never read as "not saved"
        // or the principal adds the same student twice.
        console.error('[fees-note] refresh after add failed', refreshError);
        showToast(refreshFailedMessage('Student added'), 'warning');
      }
    } catch (error) {
      console.error('[fees-note] add student failed', { payload, error });
      showToast(principalWriteError(error, CANNOT_ADD), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveSheet isOpen={isOpen} onClose={close} title="Add Student" isMobile={isMobile}>
      <StudentFormFields
        values={form}
        onChange={update}
        classNames={classNames}
        sectionNames={sectionNames}
        teachers={teachers}
          identityEditable
        disabled={saving}
      />
      <SheetActions>
        <Button variant="secondary" onClick={close} disabled={saving}>Cancel</Button>
        <Button variant="primary" onClick={handleSave} loading={saving}>Add to note</Button>
      </SheetActions>
    </ResponsiveSheet>
  );
}
