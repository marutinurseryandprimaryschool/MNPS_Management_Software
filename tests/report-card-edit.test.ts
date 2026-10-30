import { describe, it, expect } from 'vitest';
import { parseMark, upsertStudentMarks, REPORT_FA_MAX, REPORT_SA_MAX } from '@/lib/report-card-utils';

describe('parseMark', () => {
  it('accepts whole numbers and one decimal within range', () => {
    expect(parseMark('38', REPORT_FA_MAX)).toBe(38);
    expect(parseMark(' 4.5 ', REPORT_FA_MAX)).toBe(4.5);
    expect(parseMark('0', REPORT_SA_MAX)).toBe(0);
  });
  it('blank is null; out of range or junk is invalid', () => {
    expect(parseMark('', REPORT_FA_MAX)).toBeNull();
    expect(parseMark('41', REPORT_FA_MAX)).toBe('invalid');
    expect(parseMark('61', REPORT_SA_MAX)).toBe('invalid');
    expect(parseMark('-1', REPORT_FA_MAX)).toBe('invalid');
    expect(parseMark('ab', REPORT_FA_MAX)).toBe('invalid');
  });
});

describe('upsertStudentMarks', () => {
  const other = { studentId: 'b', faTotal: 30, saScore: 50, totalMarks: 80 };
  it('adds a student record without touching classmates', () => {
    const out = upsertStudentMarks([other], 'a', 'Adrien', 35, 52);
    expect(out).toContainEqual(other);
    const a = out.find(r => r.studentId === 'a')!;
    expect(a).toMatchObject({ studentName: 'Adrien', faTotal: 35, saScore: 52, totalMarks: 87, faClassExamScore: 35 });
  });
  it('keeps the FA breakdown consistent with an edited FA total', () => {
    const start = [{ studentId: 'a', faClassExamScore: 20, faProjectScore: 10, faReadingScore: 5, faTotal: 35, saScore: 50, totalMarks: 85 }];
    const a = upsertStudentMarks(start, 'a', 'A', 38, 50)[0];
    expect((a.faClassExamScore as number) + (a.faProjectScore as number) + (a.faReadingScore as number)).toBe(38);
    expect(a.totalMarks).toBe(88);
  });
  it('clearing both marks removes the student entry', () => {
    const start = [other, { studentId: 'a', faTotal: 10, saScore: 10, totalMarks: 20 }];
    expect(upsertStudentMarks(start, 'a', 'A', null, null)).toEqual([other]);
  });
  it('one blank half still saves the other', () => {
    const a = upsertStudentMarks([], 'a', 'A', null, 45)[0];
    expect(a).toMatchObject({ faTotal: null, saScore: 45, totalMarks: 45 });
  });
});

import {
  isKgClass, parseKgMark, kgColumnSummary, kgGrade, stdColumnSummary, upsertCoRecord,
} from '@/lib/report-card-utils';

describe('isKgClass', () => {
  it('Pre-KG, LKG, UKG are KG; Class 1-5 are not', () => {
    for (const c of ['Pre-KG', 'LKG', 'L.K.G', 'UKG', 'U.K.G', 'Nursery']) expect(isKgClass(c)).toBe(true);
    for (const c of ['Class 1', 'Std 3', 'Class 5', 'First']) expect(isKgClass(c)).toBe(false);
  });
});

describe('KG card', () => {
  it('parses numbers, ab, dash and grade letters', () => {
    expect(parseKgMark('68')).toEqual({ value: '68', numeric: 68 });
    expect(parseKgMark('AB')).toEqual({ value: 'ab', numeric: null });
    expect(parseKgMark('-')).toEqual({ value: '-', numeric: null });
    expect(parseKgMark('c')).toEqual({ value: 'C', numeric: null });
    expect(parseKgMark('101')).toBe('invalid');
    expect(parseKgMark('xyz')).toBe('invalid');
  });
  it('matches the LKG A paper card: I MID 570 → A; Quarterly 428 with absences → no grade', () => {
    const iMid = ['68', '80', '94', '78', '90', '88', '72', '-', 'C'];
    expect(kgColumnSummary(iMid)).toEqual({ total: 570, grade: 'A' });
    const quarterly = ['73', '91', 'ab', '82', '92', '90', 'ab', null, 'ab'];
    expect(kgColumnSummary(quarterly)).toEqual({ total: 428, grade: null });
  });
  it('a mark below 35 means no grade; the scale bands', () => {
    expect(kgColumnSummary(['90', '30']).grade).toBeNull();
    expect([kgGrade(95), kgGrade(85), kgGrade(72), kgGrade(61), kgGrade(55), kgGrade(40), kgGrade(20)])
      .toEqual(['A+', 'A', 'B', 'C', 'D', 'E', 'F']);
  });
  it('stores a KG mark on the student record', () => {
    const [r] = upsertStudentMarks([], 's', 'S', null, null, { kgMark: 'ab' });
    expect(r).toMatchObject({ kgMark: 'ab', totalMarks: null });
    const [n] = upsertStudentMarks([], 's', 'S', null, null, { kgMark: '88' });
    expect(n).toMatchObject({ kgMark: '88', totalMarks: 88 });
  });
});

describe('STD card', () => {
  it('matches the Class card: I MID total 430, average 54%, grade C1', () => {
    expect(stdColumnSummary([50, 56, 43, 67, 74, 38, 50, 52])).toEqual({ total: 430, average: 54, grade: 'C1' });
  });
  it('a total-only subject (GK, Computer, Hindi) saves without FA/SA', () => {
    const [r] = upsertStudentMarks([], 's', 'S', null, null, { total: 38 });
    expect(r).toMatchObject({ faTotal: null, saScore: null, totalMarks: 38 });
  });
});

describe('upsertCoRecord', () => {
  it('replaces one student and keeps presentDays in step', () => {
    const other = { studentId: 'b', remarks: 'Good' };
    const out = upsertCoRecord([other], 'a', 'A', { workingDays: '45/48', remarks: 'Study well' });
    expect(out).toContainEqual(other);
    expect(out.find(r => r.studentId === 'a')).toMatchObject({ workingDays: '45/48', presentDays: '45', remarks: 'Study well' });
  });
});
