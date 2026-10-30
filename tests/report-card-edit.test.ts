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
