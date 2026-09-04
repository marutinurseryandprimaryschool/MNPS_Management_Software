/* ============================================
   Timetable teacher resolution
   ============================================
   The reported bug: two teachers both list Maths among the subjects they are
   qualified for, so "UKG-A + Maths" could resolve to whichever came first —
   even the one actually allocated to UKG-A for Tamil.

   These cases are the spec's §21 list, written against the resolver every
   timetable path now shares.
*/

import { describe, it, expect } from 'vitest';
import {
  findTeacherConflict,
  isTeacherValidForSlot,
  resolveAssignedTeacher,
  resolveEligibleTeachers,
  type TeacherLike,
} from '@/lib/timetable-teachers';

/* ── Fixtures ─────────────────────────────────────────────────────────── */

const UKG = 'cls-ukg';
const CLASS1 = 'cls-1';
const SEC_A = 'sec-a';
const SEC_B = 'sec-b';
const MATHS = 'sub-maths';
const TAMIL = 'sub-tamil';
const ENGLISH = 'sub-english';

/** Both teachers are QUALIFIED in Maths — that is the whole point. */
const teacherA: TeacherLike = {
  id: 't-a',
  name: 'Teacher A',
  subjects: [MATHS, ENGLISH],
  assignedClasses: [
    { classId: UKG, sectionId: SEC_A, subjectId: MATHS },
  ],
};

const teacherB: TeacherLike = {
  id: 't-b',
  name: 'Teacher B',
  subjects: [MATHS, TAMIL],
  assignedClasses: [
    { classId: UKG, sectionId: SEC_A, subjectId: TAMIL },
  ],
};

const ukgAMaths = { classId: UKG, sectionId: SEC_A, subjectId: MATHS };
const ukgATamil = { classId: UKG, sectionId: SEC_A, subjectId: TAMIL };

/* ── Test 1: allocation decides, not qualification ────────────────────── */

describe('Test 1 — the reported bug', () => {
  const teachers = [teacherA, teacherB];

  it('UKG-A + Maths resolves to the teacher ALLOCATED to it', () => {
    expect(resolveAssignedTeacher(teachers, ukgAMaths)?.id).toBe('t-a');
  });

  it('UKG-A + Tamil resolves to the other teacher', () => {
    expect(resolveAssignedTeacher(teachers, ukgATamil)?.id).toBe('t-b');
  });

  it('the Maths-qualified teacher allocated to Tamil is NOT eligible for Maths', () => {
    const eligible = resolveEligibleTeachers(teachers, ukgAMaths).map(t => t.id);
    expect(eligible).toEqual(['t-a']);
    expect(eligible).not.toContain('t-b');
  });
});

/* ── Test 2: same subject, different classes ──────────────────────────── */

describe('Test 2 — same subject in two classes', () => {
  const teachers: TeacherLike[] = [
    { ...teacherA, assignedClasses: [{ classId: UKG, sectionId: SEC_A, subjectId: MATHS }] },
    { ...teacherB, assignedClasses: [{ classId: CLASS1, sectionId: SEC_A, subjectId: MATHS }] },
  ];

  it('each class resolves to its own teacher', () => {
    expect(resolveAssignedTeacher(teachers, ukgAMaths)?.id).toBe('t-a');
    expect(resolveAssignedTeacher(teachers,
      { classId: CLASS1, sectionId: SEC_A, subjectId: MATHS })?.id).toBe('t-b');
  });
});

/* ── Test 3: same subject, different sections ─────────────────────────── */

describe('Test 3 — sections do not leak', () => {
  const teachers: TeacherLike[] = [
    { ...teacherA, assignedClasses: [{ classId: UKG, sectionId: SEC_A, subjectId: MATHS }] },
    { ...teacherB, assignedClasses: [{ classId: UKG, sectionId: SEC_B, subjectId: MATHS }] },
  ];

  it('UKG-A and UKG-B resolve to their own teachers', () => {
    expect(resolveAssignedTeacher(teachers, ukgAMaths)?.id).toBe('t-a');
    expect(resolveAssignedTeacher(teachers,
      { classId: UKG, sectionId: SEC_B, subjectId: MATHS })?.id).toBe('t-b');
  });

  it("section A's teacher is not eligible in section B", () => {
    const inB = resolveEligibleTeachers(teachers,
      { classId: UKG, sectionId: SEC_B, subjectId: MATHS }).map(t => t.id);
    expect(inB).toEqual(['t-b']);
  });
});

/* ── Test 4: nobody allocated ─────────────────────────────────────────── */

describe('Test 4 — no allocation means no teacher', () => {
  it('returns none rather than substituting a qualified teacher', () => {
    const teachers = [teacherA, teacherB];
    const key = { classId: UKG, sectionId: SEC_A, subjectId: ENGLISH };
    expect(resolveEligibleTeachers(teachers, key)).toEqual([]);
    expect(resolveAssignedTeacher(teachers, key)).toBeNull();
  });

  it('an assignment naming no subject cannot decide a subject teacher', () => {
    // This is every existing production assignment: class + section, no subject.
    const sectionOnly: TeacherLike = {
      id: 't-c',
      name: 'Teacher C',
      subjects: [MATHS],
      assignedClasses: [{ classId: UKG, sectionId: SEC_A, subjectId: '' }],
    };
    expect(resolveEligibleTeachers([sectionOnly], ukgAMaths)).toEqual([]);
  });
});

/* ── Test 5: qualification without allocation ─────────────────────────── */

describe('Test 5 — qualified but not allocated here', () => {
  it('a teacher with the subject but no assignment to the class is excluded', () => {
    const qualifiedElsewhere: TeacherLike = {
      id: 't-d',
      name: 'Teacher D',
      subjects: [MATHS],
      subjectNames: ['Maths'],
      assignedClasses: [{ classId: CLASS1, sectionId: SEC_A, subjectId: MATHS }],
    };
    expect(resolveEligibleTeachers([qualifiedElsewhere], ukgAMaths)).toEqual([]);
  });

  it('an inactive teacher is never eligible', () => {
    const resigned: TeacherLike = {
      ...teacherA, id: 't-x', status: 'inactive',
    };
    expect(resolveEligibleTeachers([resigned], ukgAMaths)).toEqual([]);
  });
});

/* ── Test 6: double-booking ───────────────────────────────────────────── */

describe('Test 6 — a teacher cannot be in two rooms at once', () => {
  const booked = [{
    day: 'MONDAY', period: 1, teacherId: 't-a', classId: UKG, sectionId: SEC_A,
    className: 'UKG', sectionName: 'A',
  }];

  it('flags the same teacher at the same day and period in another class', () => {
    const clash = findTeacherConflict(booked, {
      teacherId: 't-a', day: 'MONDAY', period: 1, classId: CLASS1, sectionId: SEC_A,
    });
    expect(clash?.className).toBe('UKG');
  });

  it('does not flag a different period', () => {
    expect(findTeacherConflict(booked, {
      teacherId: 't-a', day: 'MONDAY', period: 2, classId: CLASS1, sectionId: SEC_A,
    })).toBeNull();
  });

  it('does not flag a different day', () => {
    expect(findTeacherConflict(booked, {
      teacherId: 't-a', day: 'TUESDAY', period: 1, classId: CLASS1, sectionId: SEC_A,
    })).toBeNull();
  });

  it('does not flag a cell against its own timetable', () => {
    expect(findTeacherConflict(booked, {
      teacherId: 't-a', day: 'MONDAY', period: 1, classId: UKG, sectionId: SEC_A,
    })).toBeNull();
  });

  it('does not flag a different teacher in that period', () => {
    expect(findTeacherConflict(booked, {
      teacherId: 't-b', day: 'MONDAY', period: 1, classId: CLASS1, sectionId: SEC_A,
    })).toBeNull();
  });
});

/* ── Save validation (§18) ────────────────────────────────────────────── */

describe('save validation rejects a pairing the UI should never have sent', () => {
  const teachers = [teacherA, teacherB];

  it('accepts the allocated teacher', () => {
    expect(isTeacherValidForSlot(teachers, ukgAMaths, 't-a')).toBe(true);
  });

  it('rejects a merely-qualified teacher', () => {
    expect(isTeacherValidForSlot(teachers, ukgAMaths, 't-b')).toBe(false);
  });

  it('allows an unfilled cell', () => {
    expect(isTeacherValidForSlot(teachers, ukgAMaths, '')).toBe(true);
  });
});

/* ── Shape tolerance ──────────────────────────────────────────────────── */

describe('older records still resolve', () => {
  it('matches on subject NAME when the entry stored no id', () => {
    const byName: TeacherLike = {
      id: 't-n',
      name: 'Teacher N',
      assignedClasses: [{ classId: UKG, sectionId: SEC_A, subjectName: 'Maths' }],
    };
    expect(resolveAssignedTeacher([byName],
      { ...ukgAMaths, subjectName: 'Maths' })?.id).toBe('t-n');
  });

  it('treats a section-less assignment as covering the whole class', () => {
    const wholeClass: TeacherLike = {
      id: 't-w',
      name: 'Teacher W',
      assignedClasses: [{ classId: UKG, sectionId: '', subjectId: MATHS }],
    };
    expect(resolveAssignedTeacher([wholeClass], ukgAMaths)?.id).toBe('t-w');
    expect(resolveAssignedTeacher([wholeClass],
      { classId: UKG, sectionId: SEC_B, subjectId: MATHS })?.id).toBe('t-w');
  });

  it('several legitimate teachers are all returned, and none auto-picked', () => {
    const shared = [
      { ...teacherA, id: 't-1' },
      { ...teacherB, id: 't-2', assignedClasses: [{ classId: UKG, sectionId: SEC_A, subjectId: MATHS }] },
    ];
    expect(resolveEligibleTeachers(shared, ukgAMaths)).toHaveLength(2);
    expect(resolveAssignedTeacher(shared, ukgAMaths)).toBeNull();
  });
});
