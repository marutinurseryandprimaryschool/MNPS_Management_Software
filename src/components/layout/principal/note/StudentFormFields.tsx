'use client';

/* ============================================
   Fees Note — student form fields
   ============================================
   The one field set behind BOTH "Add Student" and "Edit details", so the two
   can never disagree about what a register row holds. Fields stack in a single
   column on a phone and pair up on a PC.

   `identityEditable` is false for a teacher: firestore.rules lets a responsible
   teacher move only the fee fields on their own students, so the name, class,
   section and roll no render disabled rather than failing on save.
*/

import React from 'react';
import Input, { Select, Textarea } from '@/components/ui/Input';
import type { RegisterRow } from '@/types/principal';

export interface TeacherOption {
  uid: string;
  name: string;
}

export interface StudentFormValues {
  name: string;
  className: string;
  /** Responsible teacher's uid ('' = unassigned). Principal-only field. */
  teacherUid: string;
  sectionName: string;
  rollNo: string;
  schoolFee: string;
  ecaAnnual: string;
  vanMonthly: string;
  isScholarship: boolean;
  notes: string;
}

export const emptyStudentForm = (): StudentFormValues => ({
  name: '',
  className: '',
  teacherUid: '',
  sectionName: '',
  rollNo: '',
  schoolFee: '',
  ecaAnnual: '',
  vanMonthly: '',
  isScholarship: false,
  notes: '',
});

export const studentFormFromRow = (row: RegisterRow): StudentFormValues => ({
  name: row.name || '',
  className: row.className || '',
  teacherUid: row.teacherUid || '',
  sectionName: row.sectionName || '',
  rollNo: row.rollNo || '',
  schoolFee: String(Math.round(Number(row.schoolFee) || 0)),
  ecaAnnual: String(Math.round(Number(row.ecaAnnual) || 0)),
  vanMonthly: String(Math.round(Number(row.vanMonthly) || 0)),
  isScholarship: Boolean(row.isScholarship),
  notes: row.notes || '',
});

/** Blank means zero — an untouched fee column is simply "nothing charged". */
export const formAmount = (text: string): number => {
  const value = Number((text || '').replace(/[₹,\s]/g, ''));
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
};

/** Returns the first problem with the form, or null when it is safe to save. */
export function validateStudentForm(values: StudentFormValues): string | null {
  if (!values.name.trim()) return 'Enter the student’s name';
  if (!values.className.trim()) return 'Choose a class';
  for (const [label, text] of [
    ['school fee', values.schoolFee],
    ['ECA amount', values.ecaAnnual],
    ['van fee', values.vanMonthly],
  ] as const) {
    const cleaned = (text || '').replace(/[₹,\s]/g, '');
    if (cleaned === '') continue;
    const value = Number(cleaned);
    if (!Number.isFinite(value) || value < 0) return `Enter a valid ${label}`;
  }
  return null;
}

interface StudentFormFieldsProps {
  values: StudentFormValues;
  onChange: (patch: Partial<StudentFormValues>) => void;
  /** Class dropdown options; falls back to a free-text field when empty. */
  classNames: string[];
  sectionNames: string[];
  /** Teachers with a linked login; omitted for the teacher's own edit sheet. */
  teachers?: TeacherOption[];
  identityEditable: boolean;
  disabled: boolean;
}

/* Fields pair up when there is room and stack on a phone — no media query
   needed, auto-fit collapses to one column below the minimum track width. */
const fieldRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 'var(--space-3)',
};

export default function StudentFormFields({
  values, onChange, classNames, sectionNames, teachers, identityEditable, disabled,
}: StudentFormFieldsProps) {
  const lockIdentity = disabled || !identityEditable;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <Input
        label="Student name"
        value={values.name}
        disabled={lockIdentity}
        placeholder="As written in the note"
        onChange={event => onChange({ name: event.target.value })}
      />

      <div style={fieldRowStyle}>
        {classNames.length > 0 ? (
          <Select
            label="Class"
            value={values.className}
            disabled={lockIdentity}
            placeholder="Choose a class"
            options={classNames.map(name => ({ value: name, label: name }))}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
              onChange({ className: event.target.value, sectionName: '' })}
          />
        ) : (
          <Input
            label="Class"
            value={values.className}
            disabled={lockIdentity}
            placeholder="e.g. Class 2"
            hint="No classes found — type the class name"
            onChange={event => onChange({ className: event.target.value })}
          />
        )}
        {identityEditable && teachers && teachers.length > 0 && (
          <Select
            label="Responsible teacher (optional)"
            value={values.teacherUid}
            disabled={lockIdentity}
            placeholder="Not assigned yet"
            options={teachers.map(t => ({ value: t.uid, label: t.name }))}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
              onChange({ teacherUid: event.target.value })}
          />
        )}

        {sectionNames.length > 0 && (
          <Select
            label="Section (optional)"
            value={values.sectionName}
            disabled={lockIdentity}
            placeholder="No section"
            options={sectionNames.map(name => ({ value: name, label: name }))}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
              onChange({ sectionName: event.target.value })}
          />
        )}
        <Input
          label="Roll no (optional)"
          value={values.rollNo}
          disabled={lockIdentity}
          onChange={event => onChange({ rollNo: event.target.value })}
        />
      </div>

      <div style={fieldRowStyle}>
        <Input
          label="School fee (₹ / year)"
          type="number"
          min={0}
          value={values.schoolFee}
          disabled={disabled}
          onChange={event => onChange({ schoolFee: event.target.value })}
        />
        <Input
          label="ECA (₹ / year)"
          type="number"
          min={0}
          value={values.ecaAnnual}
          disabled={disabled}
          hint="Split across 10 months"
          onChange={event => onChange({ ecaAnnual: event.target.value })}
        />
        <Input
          label="Van (₹ / month)"
          type="number"
          min={0}
          value={values.vanMonthly}
          disabled={disabled}
          onChange={event => onChange({ vanMonthly: event.target.value })}
        />
      </div>

      <label style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        font: 'var(--text-body-sm)', color: 'var(--color-text-secondary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}>
        <input
          type="checkbox"
          checked={values.isScholarship}
          disabled={disabled}
          onChange={event => onChange({ isScholarship: event.target.checked })}
        />
        Scholarship student
      </label>

      <Textarea
        label="Notes (optional)"
        rows={2}
        value={values.notes}
        disabled={disabled}
        placeholder="Anything you would have written in the margin"
        onChange={event => onChange({ notes: event.target.value })}
      />
    </div>
  );
}
