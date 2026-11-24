import { describe, expect, it } from 'vitest';
import { classTeacherSlots, planClassTeacherAssignment } from '@/lib/class-teacher-plan';

const uidOf = (t: Record<string, unknown>) => String(t.userId ?? '');

describe('classTeacherSlots', () => {
  it('reads class-teacher entries, year doc first, skipping unlinked teachers', () => {
    const teachers = [
      { id: 't1', userId: 'u1', name: 'Anita',
        assignedClasses: [{ className: 'UKG', sectionName: 'C', isClassTeacher: true }] },
      { id: 't2', userId: 'u2', name: 'Bala',
        assignedClasses: [{ className: 'LKG', sectionName: 'A', isClassTeacher: true }] },
      { id: 't3', userId: '', name: 'No login',
        assignedClasses: [{ className: 'LKG', sectionName: 'B', isClassTeacher: true }] },
    ];
    const year = [{ teacherId: 't1', assignments: [
      { className: 'UKG', sectionName: 'A', isClassTeacher: true, subjectId: '' },
      { className: 'UKG', sectionName: 'A', isClassTeacher: true, subjectId: 'math' },
      { className: 'UKG', sectionName: 'B', isClassTeacher: false, subjectId: 'tamil' },
    ] }];
    expect(classTeacherSlots(teachers, year, uidOf)).toEqual([
      { uid: 'u1', name: 'Anita', className: 'UKG', sectionName: 'A' },
      { uid: 'u2', name: 'Bala', className: 'LKG', sectionName: 'A' },
    ]);
  });
});

describe('planClassTeacherAssignment', () => {
  const slots = [
    { uid: 'u1', name: 'Anita', className: 'UKG', sectionName: 'A' },
    { uid: 'u2', name: 'Bala', className: 'UKG', sectionName: 'B' },
    { uid: 'u3', name: 'Chitra', className: 'LKG', sectionName: 'A' },
    { uid: 'u4', name: 'Devi', className: 'LKG', sectionName: 'A' },
  ];

  it('splits a class imported under one teacher back into its sections', () => {
    const rows = [
      { id: 'r1', className: 'UKG', sectionName: 'A', teacherUid: 'u1' },
      { id: 'r2', className: 'U.K.G', sectionName: 'B', teacherUid: 'u1' },
      { id: 'r3', className: 'UKG', sectionName: 'b', teacherUid: null },
      { id: 'r4', className: 'UKG', sectionName: 'C', teacherUid: 'u1' },
      { id: 'r5', className: 'LKG', sectionName: 'A', teacherUid: 'u9' },
    ];
    const plan = planClassTeacherAssignment(rows, slots);
    expect(plan.moves).toEqual([
      { rowId: 'r2', teacher: { uid: 'u2', name: 'Bala' } },
      { rowId: 'r3', teacher: { uid: 'u2', name: 'Bala' } },
    ]);
    expect(plan.alreadyCorrect).toBe(1);
    // No class teacher for UKG C and two for LKG A: those rows are untouched.
    expect(plan.sectionsWithoutTeacher).toEqual(['UKG · C']);
    expect(plan.sectionsWithClash).toEqual(['LKG · A']);
    expect(plan.leftAlone).toBe(2);
  });

  it('uses a whole-class class teacher only when no section-specific one exists', () => {
    const plan = planClassTeacherAssignment(
      [{ id: 'r1', className: 'Class 1', sectionName: 'A' }],
      [{ uid: 'u5', name: 'Esther', className: 'Class 1', sectionName: '' }],
    );
    expect(plan.moves).toEqual([{ rowId: 'r1', teacher: { uid: 'u5', name: 'Esther' } }]);
  });
});
