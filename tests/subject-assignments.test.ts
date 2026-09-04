/* ============================================
   Subject & Teacher Assignment
   ============================================
   The spec's §17 matrix is the heart of it: ONE subject, seven class-sections,
   seven different teachers, and every lookup must return its own.
*/

import { describe, it, expect } from 'vitest';
import {
  assignmentsForSection,
  buildAssignmentIndex,
  eligibleTeachersForSubject,
  findAssignment,
  planSectionCopy,
  sectionCoverage,
  withAssignment,
  withoutAssignment,
  type AssignmentEntry,
  type TeacherRecord,
} from '@/lib/subject-assignments';
import { resolveAssignedTeacher, type TeacherLike } from '@/lib/timetable-teachers';

const MATHS = 'sub-maths';
const ENGLISH = 'sub-english';
const SEC_A = 'sec-a';
const SEC_B = 'sec-b';

/** Every one of these teachers is qualified in Maths — that is the point. */
const entry = (
  classId: string, sectionId: string, className: string, sectionName: string,
): AssignmentEntry => ({
  classId, sectionId, className, sectionName, subjectId: MATHS, subjectName: 'Maths',
});

const teachers: TeacherRecord[] = [
  { id: 't-meena', name: 'Meena', subjects: [MATHS], assignedClasses: [entry('ukg', SEC_A, 'UKG', 'A')] },
  { id: 't-swarna', name: 'Swarnalatha', subjects: [MATHS], assignedClasses: [entry('c1', SEC_A, 'I', 'A')] },
  {
    id: 't-prabha',
    name: 'Prabha',
    subjects: [MATHS],
    assignedClasses: [entry('c1', SEC_B, 'I', 'B'), entry('c2', SEC_A, 'II', 'A')],
  },
  {
    id: 't-kohila',
    name: 'Kohila',
    subjects: [MATHS],
    assignedClasses: [entry('c2', SEC_B, 'II', 'B'), entry('c5', SEC_A, 'V', 'A')],
  },
  { id: 't-anusha', name: 'Anusha', subjects: [MATHS, ENGLISH], assignedClasses: [entry('c4', SEC_A, 'IV', 'A')] },
];

const index = buildAssignmentIndex(teachers);

/* ── §17: the required matrix ─────────────────────────────────────────── */

describe('§17 — one subject, many classes, the right teacher every time', () => {
  const cases: [string, string, string, string][] = [
    ['UKG-A', 'ukg', SEC_A, 'Meena'],
    ['I-A', 'c1', SEC_A, 'Swarnalatha'],
    ['I-B', 'c1', SEC_B, 'Prabha'],
    ['II-A', 'c2', SEC_A, 'Prabha'],
    ['II-B', 'c2', SEC_B, 'Kohila'],
    ['IV-A', 'c4', SEC_A, 'Anusha'],
    ['V-A', 'c5', SEC_A, 'Kohila'],
  ];

  it.each(cases)('%s + Maths resolves to %s', (_label, classId, sectionId, expected) => {
    expect(findAssignment(index, { classId, sectionId, subjectId: MATHS })?.teacherName)
      .toBe(expected);
  });

  it('the timetable resolver agrees with the assignment page, everywhere', () => {
    // One relationship, two readers — they must never disagree.
    for (const [, classId, sectionId, expected] of cases) {
      expect(resolveAssignedTeacher(teachers as unknown as TeacherLike[],
        { classId, sectionId, subjectId: MATHS })?.name).toBe(expected);
    }
  });

  it('one teacher can hold the same subject in two sections', () => {
    expect(findAssignment(index, { classId: 'c1', sectionId: SEC_B, subjectId: MATHS })?.teacherName)
      .toBe('Prabha');
    expect(findAssignment(index, { classId: 'c2', sectionId: SEC_A, subjectId: MATHS })?.teacherName)
      .toBe('Prabha');
  });

  it('an unallocated cell returns nothing rather than a qualified stranger', () => {
    expect(findAssignment(index, { classId: 'ukg', sectionId: SEC_B, subjectId: MATHS })).toBeNull();
  });
});

/* ── Eligibility vs allocation (§4, §13) ──────────────────────────────── */

describe('eligibility offers a choice; it does not make one', () => {
  it('lists every qualified teacher for the dropdown', () => {
    expect(eligibleTeachersForSubject(teachers, MATHS).map(t => t.name)).toHaveLength(5);
  });

  it('matches on subject name when the profile stored names', () => {
    const byName: TeacherRecord[] = [{ id: 't-n', name: 'N', subjectNames: ['Maths'] }];
    expect(eligibleTeachersForSubject(byName, MATHS, 'Maths')).toHaveLength(1);
  });

  it('excludes inactive teachers', () => {
    const resigned: TeacherRecord[] = [{ id: 't-x', name: 'X', status: 'inactive', subjects: [MATHS] }];
    expect(eligibleTeachersForSubject(resigned, MATHS)).toEqual([]);
  });

  it('being eligible for Maths everywhere allocates it nowhere', () => {
    const eligible = eligibleTeachersForSubject(teachers, MATHS).map(t => t.id);
    expect(eligible).toContain('t-kohila');
    // Kohila is qualified, but UKG-A is Meena's.
    expect(findAssignment(index, { classId: 'ukg', sectionId: SEC_A, subjectId: MATHS })?.teacherId)
      .toBe('t-meena');
  });
});

/* ── Index building ───────────────────────────────────────────────────── */

describe('building the class-section index', () => {
  it('prefers the per-year assignment documents over the teacher record', () => {
    const docs = [{ teacherId: 't-meena', assignments: [entry('c3', SEC_A, 'III', 'A')] }];
    const built = buildAssignmentIndex(teachers, docs);
    const meena = built.filter(a => a.teacherId === 't-meena');
    expect(meena).toHaveLength(1);
    expect(meena[0].className).toBe('III');
  });

  it('skips class-teacher rows that name no subject', () => {
    const classTeacherOnly: TeacherRecord[] = [{
      id: 't-ct',
      name: 'CT',
      assignedClasses: [{ classId: 'ukg', sectionId: SEC_A, subjectId: '', isClassTeacher: true }],
    }];
    expect(buildAssignmentIndex(classTeacherOnly)).toEqual([]);
  });

  it('lists a section’s subjects in name order', () => {
    const withEnglish = buildAssignmentIndex([
      ...teachers,
      {
        id: 't-eng',
        name: 'Eng',
        assignedClasses: [{
          classId: 'ukg', sectionId: SEC_A, subjectId: ENGLISH,
          className: 'UKG', sectionName: 'A', subjectName: 'English',
        }],
      },
    ]);
    expect(assignmentsForSection(withEnglish, 'ukg', SEC_A).map(a => a.subjectName))
      .toEqual(['English', 'Maths']);
  });
});

/* ── Editing ──────────────────────────────────────────────────────────── */

describe('adding, replacing and removing an allocation', () => {
  const target = {
    classId: 'ukg', className: 'UKG', sectionId: SEC_A, sectionName: 'A',
    subjectId: MATHS, subjectName: 'Maths', teacherId: 't-kohila', teacherName: 'Kohila',
  };

  it('adds the cell to a teacher who did not have it', () => {
    const next = withAssignment([], target);
    expect(next).toHaveLength(1);
    expect(next[0].subjectId).toBe(MATHS);
  });

  it('replaces rather than duplicates the same cell', () => {
    const existing = [entry('ukg', SEC_A, 'UKG', 'A')];
    expect(withAssignment(existing, target)).toHaveLength(1);
  });

  it('keeps a class-teacher designation through a subject edit', () => {
    const existing: AssignmentEntry[] = [{
      classId: 'ukg', sectionId: SEC_A, subjectId: MATHS, isClassTeacher: true,
    }];
    expect(withAssignment(existing, target)[0].isClassTeacher).toBe(true);
  });

  it('removes only the named cell', () => {
    const existing = [entry('ukg', SEC_A, 'UKG', 'A'), entry('c1', SEC_A, 'I', 'A')];
    const next = withoutAssignment(existing, { classId: 'ukg', sectionId: SEC_A, subjectId: MATHS });
    expect(next).toHaveLength(1);
    expect(next[0].classId).toBe('c1');
  });

  it('un-teaching a subject does not un-appoint the class teacher', () => {
    const existing: AssignmentEntry[] = [{
      classId: 'ukg', sectionId: SEC_A, subjectId: MATHS, isClassTeacher: true,
    }];
    const next = withoutAssignment(existing, { classId: 'ukg', sectionId: SEC_A, subjectId: MATHS });
    expect(next).toHaveLength(1);
    expect(next[0].isClassTeacher).toBe(true);
    expect(next[0].subjectId).toBe('');
  });
});

/* ── Copy (§9) ────────────────────────────────────────────────────────── */

describe('copying a section’s structure', () => {
  const to = { classId: 'ukg', sectionId: SEC_B, className: 'UKG', sectionName: 'B' };

  it('carries the subjects across', () => {
    const planned = planSectionCopy(index, { classId: 'ukg', sectionId: SEC_A }, to);
    expect(planned).toHaveLength(1);
    expect(planned[0].sectionName).toBe('B');
    expect(planned[0].subjectId).toBe(MATHS);
  });

  it('never overwrites a cell the target already filled', () => {
    const withTarget = buildAssignmentIndex([
      ...teachers,
      { id: 't-other', name: 'Other', assignedClasses: [entry('ukg', SEC_B, 'UKG', 'B')] },
    ]);
    expect(planSectionCopy(withTarget, { classId: 'ukg', sectionId: SEC_A }, to)).toEqual([]);
  });
});

/* ── Coverage (§14) ───────────────────────────────────────────────────── */

describe('coverage tells the Admin what is still missing', () => {
  const subjects = [{ id: MATHS, name: 'Maths' }, { id: ENGLISH, name: 'English' }];

  it('counts assigned and unassigned subjects', () => {
    const coverage = sectionCoverage(index, 'ukg', SEC_A, subjects);
    expect(coverage).toMatchObject({ total: 2, assigned: 1, unassigned: 1 });
    expect(coverage.unassignedSubjects[0].name).toBe('English');
  });

  it('reports a fully unassigned section honestly', () => {
    expect(sectionCoverage(index, 'ukg', SEC_B, subjects))
      .toMatchObject({ total: 2, assigned: 0, unassigned: 2 });
  });
});
