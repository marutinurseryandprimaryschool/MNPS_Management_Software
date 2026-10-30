import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReportCardSheet from '@/components/layout/shared/ReportCardSheet';

const subjectsOf = (names: string[]) => names.map((name, i) => ({ id: `s${i}`, name }));
const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
const base = { editing: false, drafts: {}, coDrafts: {}, onMark: () => {}, onCo: () => {} };

describe('ReportCardSheet', () => {
  it('KG card: one mark per exam, Total and Grade as on the LKG paper card', () => {
    const subjects = subjectsOf(['English', 'Tamil', 'Maths', 'Science', 'Story Telling', 'G.K.', 'Rhymes', 'Hindi', 'Drawing']);
    const iMid = ['68', '80', '94', '78', '90', '88', '72', '-', 'C'];
    const quarterly = ['73', '91', 'ab', '82', '92', '90', 'ab', null, 'ab'];
    const matrix: Record<string, Record<string, unknown>> = {};
    subjects.forEach((s, i) => {
      matrix[s.id] = {
        i_mid_term: { kgMark: iMid[i] },
        quarterly: quarterly[i] === null ? null : { kgMark: quarterly[i] },
      };
    });
    const coData = { i_mid_term: { neatness: 'Good', workingDays: '44/48', remarks: 'Good' } };
    const out = text(renderToStaticMarkup(createElement(ReportCardSheet, { ...base, isKG: true, subjects, matrix, coData })));
    expect(out).toContain('|I Term|II Term|III Term|');
    expect(out).toContain('|Total|570|428|');
    expect(out).toContain('|Grade|A|—|');
    expect(out).toContain('|No. of Working days|44/48|');
    expect(out).toContain('Grade Assessment is made only for those who have passed in all Subjects.');
    expect(out).not.toContain('FA');
  });

  it('STD card: FA/SA/Total/Grade, total-only subjects, Average and Grade', () => {
    const subjects = subjectsOf(['English', 'Tamil', 'Mathematics', '(EVS) Science', 'Social', 'G.K.', 'Computer', 'Hindi']);
    const rows: Array<[number | null, number | null, number]> = [
      [32, 18, 50], [40, 16, 56], [22, 21, 43], [27, 40, 67], [34, 40, 74], [null, null, 38], [null, null, 50], [null, null, 52],
    ];
    const matrix: Record<string, Record<string, unknown>> = {};
    subjects.forEach((s, i) => {
      matrix[s.id] = { i_mid_term: { faTotal: rows[i][0], saScore: rows[i][1], totalMarks: rows[i][2] } };
    });
    const out = text(renderToStaticMarkup(createElement(ReportCardSheet, { ...base, isKG: false, subjects, matrix, coData: {} })));
    expect(out).toContain('|English|32|18|50|C2|');
    expect(out).toContain('|G.K.|38|D|');
    expect(out).toContain('|TOTAL|430|');
    expect(out).toContain('|AVERAGE|54%|');
    expect(out).toContain('|GRADE|C1|');
    expect(out).toContain('|CO-CURRICULAR ACTIVITIES|');
  });
});
