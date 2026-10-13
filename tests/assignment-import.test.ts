/* ============================================
   Bulk import — parse, match, and the §17 resolution cases
   ============================================
   The end-to-end claim: parse the school's own allocation text, match it to
   real records, and the resolver then answers class + section + subject with
   the teacher the sheet named — not whoever else happens to teach Maths.
*/

import { describe, it, expect } from 'vitest';
import {
  applyTeacherChoice, isImportable, matchAllocations, parseAllocationText, summarise,
  type ClassRecord, type NamedRecord,
} from '@/lib/assignment-import';
import { ALLOCATION_SHEET } from '@/lib/allocation-sheet';
import { buildAssignmentIndex, findAssignment, type TeacherRecord } from '@/lib/subject-assignments';
import { resolveAssignedTeacher, type TeacherLike } from '@/lib/timetable-teachers';

/* ── Fixtures shaped like the real records ────────────────────────────── */

const subject = (name: string): NamedRecord => ({ id: `sub-${name.toLowerCase().replace(/\s+/g, '')}`, name });

const PRIMARY_SUBJECTS = [
  subject('English'), subject('Tamil'), subject('Maths'), subject('EVS'),
  subject('Computer'), subject('GK'), subject('Hindi'),
];
const UPPER_SUBJECTS = [
  subject('English'), subject('Tamil'), subject('Maths'), subject('Science'),
  subject('Social'), subject('Hindi'), subject('Computer'), subject('GK'),
];
const KG_SUBJECTS = [
  subject('English'), subject('Tamil'), subject('Maths'), subject('EVS'),
  subject('Rhymes'), subject('Story'), subject('GK'), subject('Physical Education'),
];

const sectionA: NamedRecord = { id: 'sec-a', name: 'A' };
const sectionB: NamedRecord = { id: 'sec-b', name: 'B' };

const classes: ClassRecord[] = [
  { id: 'cls-lkg', name: 'LKG', sections: [sectionA, sectionB], subjects: KG_SUBJECTS },
  { id: 'cls-ukg', name: 'UKG', sections: [sectionA], subjects: KG_SUBJECTS },
  { id: 'cls-1', name: 'Class 1', sections: [sectionA, sectionB], subjects: PRIMARY_SUBJECTS },
  { id: 'cls-2', name: 'Class 2', sections: [sectionA, sectionB], subjects: PRIMARY_SUBJECTS },
  { id: 'cls-4', name: 'Class 4', sections: [sectionA], subjects: UPPER_SUBJECTS },
  { id: 'cls-5', name: 'Class 5', sections: [sectionA], subjects: UPPER_SUBJECTS },
];

/** Names exactly as the sheet writes them, so every row matches cleanly. */
const teacherNames = [
  'Uma', 'Revathy', 'Swarnalatha', 'Kohila', 'Murugabekhi', 'Abisha',
  'Prabha', 'Kaleeswari', 'Anusha', 'Meena', 'Athilakshmi',
];
const teachers: NamedRecord[] = teacherNames.map(name => ({ id: `t-${name.toLowerCase()}`, name }));

/* ── Parsing ──────────────────────────────────────────────────────────── */

describe('parsing the allocation sheet', () => {
  const rows = parseAllocationText(ALLOCATION_SHEET);

  it('reads every subject line under its class heading', () => {
    expect(rows.length).toBe(65);
  });

  it('splits class and section from the heading', () => {
    const first = rows[0];
    expect(first).toMatchObject({
      className: 'I', sectionName: 'A', subjectName: 'English', teacherName: 'Uma',
    });
  });

  it('keeps a hyphenated class name whole', () => {
    const parsed = parseAllocationText('PRE-KG\nEnglish -> Uma');
    expect(parsed[0]).toMatchObject({ className: 'PRE-KG', sectionName: '' });
  });

  it('accepts the arrow, colon and equals separators', () => {
    const parsed = parseAllocationText('UKG-A\nMaths → Meena\nTamil: Revathy\nGK = Uma');
    expect(parsed.map(r => r.teacherName)).toEqual(['Meena', 'Revathy', 'Uma']);
  });
});

/* ── Matching ─────────────────────────────────────────────────────────── */

describe('matching against real records', () => {
  const rows = parseAllocationText(ALLOCATION_SHEET);
  const matched = matchAllocations({ rows, classes, teachers, existing: [] });

  it('matches every row when the names line up', () => {
    const summary = summarise(matched);
    expect(summary.review).toBe(0);
    expect(summary.matched).toBe(rows.length);
  });

  it('understands "I-A" as Class 1 section A', () => {
    const first = matched[0];
    expect(first.classId).toBe('cls-1');
    expect(first.sectionId).toBe('sec-a');
  });

  it('resolves shortened subject names to the real subject', () => {
    const phy = matched.find(m => m.row.subjectName === 'Physical Education');
    expect(phy?.subjectName).toBe('Physical Education');
    const science = matched.find(m => m.row.subjectName === 'Science');
    expect(science?.subjectName).toBe('Science');
  });

  it('never guesses a teacher whose spelling differs', () => {
    // The database spells her differently from the sheet.
    const dbTeachers = teachers.map(t =>
      t.name === 'Swarnalatha' ? { id: t.id, name: 'Sornalatha B' } : t);
    const result = matchAllocations({
      rows: [{ className: 'I', sectionName: 'A', subjectName: 'Maths', teacherName: 'Swarnalatha' }],
      classes, teachers: dbTeachers, existing: [],
    });
    expect(result[0].status).toBe('review');
    expect(result[0].teacherId).toBeUndefined();
    // …but offers her as the leading suggestion rather than a dead end.
    expect(result[0].teacherSuggestions?.[0].name).toBe('Sornalatha B');
    expect(isImportable(result[0])).toBe(false);
  });

  it('reports an unknown teacher instead of inventing one', () => {
    const result = matchAllocations({
      rows: [{ className: 'I', sectionName: 'A', subjectName: 'Maths', teacherName: 'Nobody At All' }],
      classes, teachers, existing: [],
    });
    expect(result[0].status).toBe('review');
    expect(result[0].problems[0]).toMatch(/No teacher/);
  });

  it('reports a subject the class does not carry', () => {
    const result = matchAllocations({
      rows: [{ className: 'UKG', sectionName: 'A', subjectName: 'Hindi', teacherName: 'Meena' }],
      classes, teachers, existing: [],
    });
    expect(result[0].status).toBe('review');
    expect(result[0].problems[0]).toMatch(/not a subject/);
  });

  it('flags a cell another teacher already holds', () => {
    const result = matchAllocations({
      rows: [{ className: 'UKG', sectionName: 'A', subjectName: 'Maths', teacherName: 'Meena' }],
      classes,
      teachers,
      existing: [{
        classId: 'cls-ukg', sectionId: 'sec-a', subjectId: 'sub-maths',
        teacherId: 't-kohila', teacherName: 'Kohila',
      }],
    });
    expect(result[0].status).toBe('conflict');
    expect(result[0].conflictWith?.teacherName).toBe('Kohila');
    // A conflict is still importable — importing it replaces the holder.
    expect(isImportable(result[0])).toBe(true);
  });

  it('does not flag a conflict when the sheet agrees with what exists', () => {
    const result = matchAllocations({
      rows: [{ className: 'UKG', sectionName: 'A', subjectName: 'Maths', teacherName: 'Meena' }],
      classes,
      teachers,
      existing: [{
        classId: 'cls-ukg', sectionId: 'sec-a', subjectId: 'sub-maths',
        teacherId: 't-meena', teacherName: 'Meena',
      }],
    });
    expect(result[0].status).toBe('matched');
  });
});

/* ── §17: the resolution cases, end to end ────────────────────────────── */

describe('§17 — after import, the timetable resolves the sheet’s teacher', () => {
  /* Import the sheet, turn the result into teacher records, and ask the
     resolver the questions the spec lists. */
  const matched = matchAllocations({
    rows: parseAllocationText(ALLOCATION_SHEET), classes, teachers, existing: [],
  }).filter(isImportable);

  const imported: TeacherRecord[] = teachers.map(teacher => ({
    id: teacher.id,
    name: teacher.name,
    assignedClasses: matched
      .filter(m => m.teacherId === teacher.id)
      .map(m => ({
        classId: m.classId, sectionId: m.sectionId, subjectId: m.subjectId,
        className: m.className, sectionName: m.sectionName, subjectName: m.subjectName,
      })),
  }));

  const index = buildAssignmentIndex(imported);
  const maths = 'sub-maths';

  const ask = (classId: string, sectionId: string, subjectId: string) =>
    findAssignment(index, { classId, sectionId, subjectId })?.teacherName;

  it('TEST 1 — UKG-A + Maths → Meena', () => {
    expect(ask('cls-ukg', 'sec-a', maths)).toBe('Meena');
  });

  it('TEST 2 — UKG-A + Tamil → Revathy', () => {
    expect(ask('cls-ukg', 'sec-a', 'sub-tamil')).toBe('Revathy');
  });

  it('TEST 3 — UKG-A + English → Anusha', () => {
    expect(ask('cls-ukg', 'sec-a', 'sub-english')).toBe('Anusha');
  });

  it('TEST 4 — II-B + Maths → Kohila', () => {
    expect(ask('cls-2', 'sec-b', maths)).toBe('Kohila');
  });

  it('TEST 5 — V-A + Maths → Kohila', () => {
    expect(ask('cls-5', 'sec-a', maths)).toBe('Kohila');
  });

  it('TEST 6 — I-A + Maths → Swarnalatha', () => {
    expect(ask('cls-1', 'sec-a', maths)).toBe('Swarnalatha');
  });

  it('TEST 7 — I-B + Maths → Prabha', () => {
    expect(ask('cls-1', 'sec-b', maths)).toBe('Prabha');
  });

  it('six teachers hold Maths, and each class still gets its own', () => {
    const mathsHolders = new Set(index.filter(a => a.subjectId === maths).map(a => a.teacherName));
    expect(mathsHolders.size).toBeGreaterThan(1);
    // The timetable resolver — a different reader — agrees on every one.
    const viaTimetable = (classId: string, sectionId: string) =>
      resolveAssignedTeacher(imported as unknown as TeacherLike[],
        { classId, sectionId, subjectId: maths })?.name;
    expect(viaTimetable('cls-ukg', 'sec-a')).toBe('Meena');
    expect(viaTimetable('cls-1', 'sec-a')).toBe('Swarnalatha');
    expect(viaTimetable('cls-1', 'sec-b')).toBe('Prabha');
    expect(viaTimetable('cls-2', 'sec-a')).toBe('Prabha');
    expect(viaTimetable('cls-2', 'sec-b')).toBe('Kohila');
    expect(viaTimetable('cls-4', 'sec-a')).toBe('Anusha');
    expect(viaTimetable('cls-5', 'sec-a')).toBe('Kohila');
  });

  it('LKG-A and LKG-B take different teachers for the same subjects', () => {
    expect(ask('cls-lkg', 'sec-a', maths)).toBe('Athilakshmi');
    expect(ask('cls-lkg', 'sec-b', maths)).toBe('Uma');
    expect(ask('cls-lkg', 'sec-a', 'sub-english')).toBe('Abisha');
    expect(ask('cls-lkg', 'sec-b', 'sub-english')).toBe('Meena');
  });
});

/* ── Correcting a row on the review screen ────────────────────────────── */

describe('accepting a suggested teacher', () => {
  const dbTeachers = teachers.map(t =>
    t.name === 'Swarnalatha' ? { id: t.id, name: 'Sornalatha B' } : t);
  const unresolved = matchAllocations({
    rows: [{ className: 'I', sectionName: 'A', subjectName: 'Maths', teacherName: 'Swarnalatha' }],
    classes, teachers: dbTeachers, existing: [],
  })[0];

  it('turns a reviewed row into an importable one', () => {
    const fixed = applyTeacherChoice(unresolved, { id: 't-swarnalatha', name: 'Sornalatha B' }, []);
    expect(fixed.status).toBe('matched');
    expect(fixed.teacherName).toBe('Sornalatha B');
    expect(fixed.problems).toEqual([]);
    expect(isImportable(fixed)).toBe(true);
  });

  it('still reports a conflict the choice runs into', () => {
    const fixed = applyTeacherChoice(unresolved, { id: 't-swarnalatha', name: 'Sornalatha B' }, [{
      classId: 'cls-1', sectionId: 'sec-a', subjectId: 'sub-maths',
      teacherId: 't-kohila', teacherName: 'Kohila',
    }]);
    expect(fixed.status).toBe('conflict');
    expect(fixed.conflictWith?.teacherName).toBe('Kohila');
  });

  it('does not clear a problem the choice cannot answer', () => {
    // The subject does not belong to this class — naming a teacher cannot fix that.
    const bad = matchAllocations({
      rows: [{ className: 'UKG', sectionName: 'A', subjectName: 'Hindi', teacherName: 'Nobody' }],
      classes, teachers, existing: [],
    })[0];
    const fixed = applyTeacherChoice(bad, { id: 't-meena', name: 'Meena' }, []);
    expect(fixed.status).toBe('review');
    expect(fixed.problems.some(p => /not a subject/.test(p))).toBe(true);
    expect(isImportable(fixed)).toBe(false);
  });
});
