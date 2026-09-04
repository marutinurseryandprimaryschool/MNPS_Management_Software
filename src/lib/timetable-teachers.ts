/* ============================================
   Timetable — who teaches this subject, in THIS class-section
   ============================================
   The one place the timetable is allowed to answer that question. The editor,
   the subject palette, Auto Generate, the saved-slot display and the save
   validation all call in here, so a manually built timetable and a generated
   one can never disagree (spec §16, §17).

   THE BUG THIS REPLACES
   ---------------------
   Every call site used to test two things INDEPENDENTLY:

       teacher's profile lists the subject      (a global "can teach" list)
       AND teacher is assigned to this section  (ignoring which subject)

   So a teacher assigned to UKG-A for Tamil, who also happens to list Maths
   among the subjects they are qualified for, matched "UKG-A + Maths". With
   several teachers qualified in Maths, the timetable picked whichever came
   first. Qualification is not allocation — the two must be read together,
   from the SAME assignment entry.

   ELIGIBILITY, EXACTLY
   --------------------
   A teacher is eligible for (class, section, subject) when ONE assignment
   entry on their record names all three. Nothing about their global subject
   list can make them eligible on its own.

   Matching is by ID. Names are a fallback only where an ID is absent
   (older records denormalised names before ids), and never a substitute for
   the class/section test.
*/

/** The shape this module needs from a teacher; `Teacher` satisfies it. */
export interface TeacherLike {
  id: string;
  name: string;
  status?: string;
  /** Subjects the teacher is QUALIFIED for. Never proof of allocation. */
  subjects?: string[];
  subjectNames?: string[];
  assignedClasses?: {
    classId?: string;
    sectionId?: string;
    subjectId?: string;
    className?: string;
    sectionName?: string;
    subjectName?: string;
    isClassTeacher?: boolean;
  }[];
}

/** What the timetable is resolving a teacher for. */
export interface TeachingSlotKey {
  classId: string;
  sectionId: string;
  subjectId: string;
  /** Used only when an assignment stored a name but no id. */
  subjectName?: string;
}

const norm = (value: unknown): string => String(value ?? '').trim().toLowerCase();

/** An active teacher. Absent status means active — most records omit it. */
function isActive(teacher: TeacherLike): boolean {
  const status = norm(teacher.status);
  return status === '' || status === 'active';
}

/**
 * True when ONE assignment entry ties this teacher to all three of
 * class, section and subject. The subject test reads the entry's own
 * subjectId/subjectName — never the teacher's global subject list.
 *
 * A section-less entry ('' sectionId) covers every section of that class,
 * which is how whole-class allocations have always been recorded.
 */
function entryCovers(
  entry: NonNullable<TeacherLike['assignedClasses']>[number],
  key: TeachingSlotKey,
): boolean {
  if (norm(entry.classId) !== norm(key.classId)) return false;
  if (entry.sectionId && norm(entry.sectionId) !== norm(key.sectionId)) return false;

  const entrySubjectId = norm(entry.subjectId);
  const entrySubjectName = norm(entry.subjectName);
  // An entry naming no subject allocates the section, not a subject, so it
  // cannot decide who teaches Maths there.
  if (!entrySubjectId && !entrySubjectName) return false;

  if (entrySubjectId) return entrySubjectId === norm(key.subjectId);
  return entrySubjectName === norm(key.subjectName);
}

/**
 * Every teacher actually allocated to teach this subject in this section.
 * Usually one; more than one is legitimate (a shared or split subject) and
 * the caller should let the Admin choose rather than picking for them.
 * Empty means nobody is allocated — say so, never substitute someone.
 */
export function resolveEligibleTeachers<T extends TeacherLike>(
  teachers: T[],
  key: TeachingSlotKey,
): T[] {
  if (!key.classId || !key.subjectId) return [];
  return teachers.filter(teacher =>
    isActive(teacher)
    && (teacher.assignedClasses ?? []).some(entry => entryCovers(entry, key)));
}

/**
 * The single teacher to fill a cell with, or null when the choice is not the
 * system's to make: nobody allocated, or several and the Admin must pick.
 * Auto Generate and the subject palette both go through this, so neither can
 * invent an allocation the Admin never made.
 */
export function resolveAssignedTeacher<T extends TeacherLike>(
  teachers: T[],
  key: TeachingSlotKey,
): T | null {
  const eligible = resolveEligibleTeachers(teachers, key);
  return eligible.length === 1 ? eligible[0] : null;
}

/**
 * Guards the save (spec §18): UI filtering is not protection, so the write
 * path re-checks the pairing itself. An empty teacherId is allowed through —
 * an unfilled cell is a legitimate state; a WRONG one is not.
 */
export function isTeacherValidForSlot<T extends TeacherLike>(
  teachers: T[],
  key: TeachingSlotKey,
  teacherId: string,
): boolean {
  if (!teacherId) return true;
  return resolveEligibleTeachers(teachers, key).some(teacher => teacher.id === teacherId);
}

/* ── Double-booking ───────────────────────────────────────────────────── */

/** One booked cell, from any class-section's timetable. */
export interface BookedSlot {
  day: string;
  period: number;
  teacherId: string;
  classId?: string;
  sectionId?: string;
  className?: string;
  sectionName?: string;
}

/**
 * The other class this teacher is already standing in at this day+period, or
 * null. Keyed on teacher + day + period — the same teacher taking different
 * periods, or a different teacher in the same period, is perfectly normal
 * (spec §14). Slots from the timetable being edited are excluded by
 * class+section so a cell never conflicts with itself.
 */
export function findTeacherConflict(
  booked: BookedSlot[],
  candidate: { teacherId: string; day: string; period: number; classId: string; sectionId: string },
): BookedSlot | null {
  if (!candidate.teacherId) return null;
  return booked.find(slot =>
    slot.teacherId === candidate.teacherId
    && norm(slot.day) === norm(candidate.day)
    && slot.period === candidate.period
    && !(norm(slot.classId) === norm(candidate.classId)
      && norm(slot.sectionId) === norm(candidate.sectionId))) ?? null;
}
