/* ============================================
   Subject & Teacher Assignment — who teaches what, where
   ============================================
   The academic layer between "this teacher COULD teach Maths" and the
   timetable: for one class-section, which teacher actually takes each
   subject. The timetable reads it and never guesses (see timetable-teachers).

   WHERE IT LIVES — and why there is no new collection
   ---------------------------------------------------
   `teacherAssignments/{teacherId}_{year}` already holds an `assignments[]`
   array whose entries carry classId, sectionId, subjectId and their
   denormalised names — precisely the record this feature needs, only
   indexed by TEACHER. The Admin wants the same facts indexed by
   CLASS-SECTION, so this module re-indexes them rather than copying them
   into a parallel store.

   That matters: two stores of one relationship drift, and drift is exactly
   the bug this whole area is recovering from. One store, two views.

   Everything here is pure. Writes are planned as "here is teacher X's new
   assignments array", and the caller persists them through the existing
   TeachersService.updateAssignments.
*/

/** One assignment entry as stored on a teacher's assignments array. */
export interface AssignmentEntry {
  classId?: string;
  sectionId?: string;
  subjectId?: string;
  className?: string;
  sectionName?: string;
  subjectName?: string;
  isClassTeacher?: boolean;
}

/** The same fact, indexed the way the Admin page reads it. */
export interface SubjectAssignment {
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
}

export interface TeacherRecord {
  id: string;
  name: string;
  status?: string;
  /** Subjects the teacher is QUALIFIED for — eligibility, not allocation. */
  subjects?: string[];
  subjectNames?: string[];
  assignedClasses?: AssignmentEntry[];
}

/** A `teacherAssignments` document. */
export interface AssignmentDoc {
  teacherId?: string;
  assignments?: AssignmentEntry[];
}

const norm = (value: unknown): string => String(value ?? '').trim().toLowerCase();

const isActive = (teacher: TeacherRecord): boolean => {
  const status = norm(teacher.status);
  return status === '' || status === 'active';
};

/** Identifies one class-section-subject cell. */
export interface AssignmentKey {
  classId: string;
  sectionId: string;
  subjectId: string;
}

const sameKey = (entry: AssignmentEntry, key: AssignmentKey): boolean =>
  norm(entry.classId) === norm(key.classId)
  && norm(entry.sectionId) === norm(key.sectionId)
  && norm(entry.subjectId) === norm(key.subjectId);

/**
 * Every subject allocation in the school, flattened from the per-teacher
 * documents. Entries naming no subject are skipped: those are class-teacher
 * designations, which say who leads a section, not who teaches a subject.
 *
 * `docs` (the per-year assignment collection) takes precedence; a teacher's
 * own `assignedClasses` is read as a fallback for records written before
 * assignments moved into their own collection.
 */
export function buildAssignmentIndex(
  teachers: TeacherRecord[],
  docs: AssignmentDoc[] = [],
): SubjectAssignment[] {
  const byTeacher = new Map<string, AssignmentEntry[]>();
  for (const doc of docs) {
    if (doc.teacherId) byTeacher.set(doc.teacherId, doc.assignments ?? []);
  }

  const out: SubjectAssignment[] = [];
  for (const teacher of teachers) {
    const entries = byTeacher.get(teacher.id) ?? teacher.assignedClasses ?? [];
    for (const entry of entries) {
      if (!entry.classId || !entry.subjectId) continue;
      out.push({
        classId: String(entry.classId),
        className: String(entry.className ?? ''),
        sectionId: String(entry.sectionId ?? ''),
        sectionName: String(entry.sectionName ?? ''),
        subjectId: String(entry.subjectId),
        subjectName: String(entry.subjectName ?? ''),
        teacherId: teacher.id,
        teacherName: teacher.name,
      });
    }
  }
  return out;
}

/** Allocations for one class-section, subject name order. */
export function assignmentsForSection(
  index: SubjectAssignment[],
  classId: string,
  sectionId: string,
): SubjectAssignment[] {
  return index
    .filter(a => norm(a.classId) === norm(classId) && norm(a.sectionId) === norm(sectionId))
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName, undefined, { sensitivity: 'base' }));
}

/** The allocation for one cell, or null when nobody is allocated. */
export function findAssignment(
  index: SubjectAssignment[],
  key: AssignmentKey,
): SubjectAssignment | null {
  return index.find(a =>
    norm(a.classId) === norm(key.classId)
    && norm(a.sectionId) === norm(key.sectionId)
    && norm(a.subjectId) === norm(key.subjectId)) ?? null;
}

/**
 * Teachers the Admin may pick from for a subject: active, and qualified for
 * it on their profile. Eligibility only — the Admin still chooses, and the
 * choice is what the timetable obeys (spec §4).
 */
export function eligibleTeachersForSubject<T extends TeacherRecord>(
  teachers: T[],
  subjectId: string,
  subjectName?: string,
): T[] {
  return teachers.filter(teacher => {
    if (!isActive(teacher)) return false;
    if ((teacher.subjects ?? []).some(id => norm(id) === norm(subjectId))) return true;
    if (!subjectName) return false;
    return (teacher.subjectNames ?? []).some(name => norm(name) === norm(subjectName));
  });
}

/* ── Planning writes ──────────────────────────────────────────────────── */

/**
 * One teacher's assignments array with this cell added, replacing any entry
 * that teacher already had for the same cell. Class-teacher designations for
 * the section are preserved — they are a different fact about the same row.
 */
export function withAssignment(
  entries: AssignmentEntry[],
  assignment: SubjectAssignment,
): AssignmentEntry[] {
  const key: AssignmentKey = assignment;
  const kept = entries.filter(entry => !sameKey(entry, key));
  return [...kept, {
    classId: assignment.classId,
    sectionId: assignment.sectionId,
    subjectId: assignment.subjectId,
    className: assignment.className,
    sectionName: assignment.sectionName,
    subjectName: assignment.subjectName,
    // A section-wide class-teacher flag must survive a subject edit.
    isClassTeacher: entries.some(entry =>
      norm(entry.classId) === norm(assignment.classId)
      && norm(entry.sectionId) === norm(assignment.sectionId)
      && entry.isClassTeacher === true),
  }];
}

/**
 * One teacher's assignments array with this cell removed. A class-teacher
 * designation for that section is KEPT, stripped of its subject — deleting
 * "who teaches Maths" must not also un-appoint the class teacher.
 */
export function withoutAssignment(
  entries: AssignmentEntry[],
  key: AssignmentKey,
): AssignmentEntry[] {
  const out: AssignmentEntry[] = [];
  for (const entry of entries) {
    if (!sameKey(entry, key)) {
      out.push(entry);
      continue;
    }
    if (entry.isClassTeacher) {
      out.push({ ...entry, subjectId: '', subjectName: '' });
    }
  }
  return out;
}

/**
 * What "copy UKG-A's structure to UKG-B" produces: the same subjects with
 * the same teachers, minus any cell UKG-B has already filled — an existing
 * allocation is never overwritten by a copy (spec §9). The Admin edits
 * teachers afterwards; nothing here assumes the same people teach both.
 */
export function planSectionCopy(
  index: SubjectAssignment[],
  from: { classId: string; sectionId: string },
  to: { classId: string; sectionId: string; className: string; sectionName: string },
): SubjectAssignment[] {
  const target = assignmentsForSection(index, to.classId, to.sectionId);
  const taken = new Set(target.map(a => norm(a.subjectId)));
  return assignmentsForSection(index, from.classId, from.sectionId)
    .filter(a => !taken.has(norm(a.subjectId)))
    .map(a => ({
      ...a,
      classId: to.classId,
      className: to.className,
      sectionId: to.sectionId,
      sectionName: to.sectionName,
    }));
}

/* ── Coverage ─────────────────────────────────────────────────────────── */

export interface SectionCoverage {
  total: number;
  assigned: number;
  unassigned: number;
  unassignedSubjects: { id: string; name: string }[];
}

/** How much of a class's subject list has a teacher (spec §14). */
export function sectionCoverage(
  index: SubjectAssignment[],
  classId: string,
  sectionId: string,
  classSubjects: { id: string; name: string }[],
): SectionCoverage {
  const assigned = new Set(
    assignmentsForSection(index, classId, sectionId).map(a => norm(a.subjectId)),
  );
  const unassignedSubjects = classSubjects.filter(subject => !assigned.has(norm(subject.id)));
  return {
    total: classSubjects.length,
    assigned: classSubjects.length - unassignedSubjects.length,
    unassigned: unassignedSubjects.length,
    unassignedSubjects,
  };
}
