/* ============================================
   "Assign by class teacher" — who should own each fee row
   ============================================
   A register row's `teacherUid` decides whose fee list a student is in
   (Teacher-wise, Accounts, the teacher's own My Students). It is set by
   hand or by "Add from student list", which gives ONE chosen teacher every
   student in the import — so importing a whole class put 52-53 students,
   every section, under a single teacher.

   The school's rule is simpler: a student belongs to the CLASS TEACHER of
   their class and section. This module works out, from the teacher
   assignments the office already keeps, which rows need to move. It never
   guesses: a section with no class teacher, or with two, is left alone and
   reported, so the Principal can fix the assignment rather than have the
   app pick someone.
*/

import { sameClass } from './parent-portal/core';

export interface ClassTeacherSlot {
  uid: string;
  name: string;
  className: string;
  /** Empty = the teacher is class teacher of the whole class. */
  sectionName: string;
}

export interface PlanRow {
  id: string;
  name?: string;
  className: string;
  sectionName?: string | null;
  teacherUid?: string | null;
}

export interface ClassTeacherMove {
  rowId: string;
  teacher: { uid: string; name: string };
}

export interface ClassTeacherPlan {
  /** Rows whose teacher changes. */
  moves: ClassTeacherMove[];
  /** Rows already with their class teacher. */
  alreadyCorrect: number;
  /** "UKG · B" style labels of sections nobody is class teacher of. */
  sectionsWithoutTeacher: string[];
  /** Sections two or more teachers claim — left unchanged. */
  sectionsWithClash: string[];
  /** Rows left untouched because of the two lists above. */
  leftAlone: number;
}

const sectionKey = (value?: string | null): string =>
  String(value ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase();

const label = (className: string, sectionName?: string | null): string =>
  [className, sectionName].filter(Boolean).join(' · ') || '—';

/**
 * Class-teacher slots from the teacher records. The academic year's
 * assignment doc wins; the legacy `assignedClasses` on the teacher doc is
 * used only for a teacher with no year doc at all. Teachers without a
 * linked login (no uid) are skipped — a row assigned to them would be
 * invisible to everybody.
 */
export function classTeacherSlots(
  teachers: Array<Record<string, unknown>>,
  yearAssignments: Array<Record<string, unknown>>,
  uidOf: (teacher: Record<string, unknown>) => string,
): ClassTeacherSlot[] {
  const slots: ClassTeacherSlot[] = [];
  for (const teacher of teachers) {
    const uid = uidOf(teacher);
    if (!uid) continue;
    const yearDoc = yearAssignments.find(doc => doc.teacherId === teacher.id);
    const entries = (yearDoc
      ? yearDoc.assignments
      : teacher.assignedClasses) as Array<Record<string, unknown>> | undefined;
    const seen = new Set<string>();
    for (const entry of entries ?? []) {
      if (entry.isClassTeacher !== true) continue;
      const className = String(entry.className ?? '').trim();
      if (!className) continue;
      const sectionName = String(entry.sectionName ?? '').trim();
      const key = `${className.toLowerCase()}|${sectionKey(sectionName)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      slots.push({ uid, name: String(teacher.name ?? 'Teacher'), className, sectionName });
    }
  }
  return slots;
}

/** Which rows move to which class teacher. Pure; writes nothing. */
export function planClassTeacherAssignment(
  rows: PlanRow[],
  slots: ClassTeacherSlot[],
): ClassTeacherPlan {
  const moves: ClassTeacherMove[] = [];
  const without = new Set<string>();
  const clash = new Set<string>();
  let alreadyCorrect = 0;
  let leftAlone = 0;

  for (const row of rows) {
    const inClass = slots.filter(slot => sameClass(slot.className, row.className));
    // A section-specific class teacher beats a whole-class one.
    const exact = inClass.filter(slot =>
      slot.sectionName !== '' && sectionKey(slot.sectionName) === sectionKey(row.sectionName));
    const candidates = exact.length > 0 ? exact : inClass.filter(slot => slot.sectionName === '');
    const owners = Array.from(new Map(candidates.map(slot => [slot.uid, slot])).values());

    if (owners.length !== 1) {
      (owners.length === 0 ? without : clash).add(label(row.className, row.sectionName));
      leftAlone += 1;
      continue;
    }
    const owner = owners[0];
    if (row.teacherUid === owner.uid) {
      alreadyCorrect += 1;
      continue;
    }
    moves.push({ rowId: row.id, teacher: { uid: owner.uid, name: owner.name } });
  }

  return {
    moves,
    alreadyCorrect,
    sectionsWithoutTeacher: Array.from(without).sort(),
    sectionsWithClash: Array.from(clash).sort(),
    leftAlone,
  };
}
