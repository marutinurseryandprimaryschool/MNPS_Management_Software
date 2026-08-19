import { describe, expect, it } from 'vitest';
import { computeRowSummary } from '@/lib/principal-fees';
import {
  filterRows, fieldPatch, monthState, monthsForAmount, parseAmountInput,
} from '@/components/layout/principal/note/note-helpers';
import type { RegisterRow } from '@/types/principal';

const row: RegisterRow = {
  id: 'r1', academicYear: '2026-27', name: 'Sharmi Test', className: 'UKG',
  schoolFee: 6000, ecaAnnual: 5000,
  ecaMonths: ['June','July','August','September','October','November','December','January','February','March'],
  vanMonthly: 300, vanMonths: ['June','July','August'],
  createdAt: new Date(), updatedAt: new Date(),
};

describe('principal fees note — presentation helpers', () => {
  it('renders Sharmi\u2019s August rule: only June+July read DUE', () => {
    const summary = computeRowSummary(row, [], new Date(2026, 7, 15)); // 15 Aug 2026
    const states = summary.eca.months.map(c => `${c.month}:${monthState(c)}`);
    expect(states.slice(0, 4)).toEqual([
      'June:due', 'July:due', 'August:upcoming', 'September:upcoming',
    ]);
    expect(summary.eca.months.reduce((s, c) => s + c.amount, 0)).toBe(5000);
  });

  it('marks a fully paid month PAID and a van month with no charge free', () => {
    const summary = computeRowSummary(row, [
      { head: 'eca', month: 'June', amount: 500, dateKey: '2026-06-10', mode: 'cash' },
    ], new Date(2026, 7, 15));
    expect(monthState(summary.eca.months[0])).toBe('paid');
    expect(summary.van.months.map(c => c.month)).toEqual(['June', 'July', 'August']);
  });

  it('parses cell input', () => {
    expect(parseAmountInput('  1,200 ')).toBe(1200);
    expect(parseAmountInput('\u20B9500')).toBe(500);
    expect(parseAmountInput('')).toBe(0);
    expect(parseAmountInput('abc')).toBeNull();
    expect(parseAmountInput('-5')).toBeNull();
  });

  it('schedules months only when an amount needs them', () => {
    expect(monthsForAmount(0, [], [])).toBeNull();
    expect(monthsForAmount(500, ['June'], [])).toBeNull();
    expect(monthsForAmount(500, [], ['June', 'July'])).toEqual(['June', 'July']);
    expect(monthsForAmount(500, [], undefined)).toHaveLength(10);
  });

  it('builds typed one-field patches', () => {
    expect(fieldPatch('vanMonthly', 300)).toEqual({ vanMonthly: 300 });
    expect(fieldPatch('ecaAnnual', 0)).toEqual({ ecaAnnual: 0 });
  });

  it('filters by search and class', () => {
    const rows = [row, { ...row, id: 'r2', name: 'Other Kid', className: 'LKG' }];
    expect(filterRows(rows, 'sharmi', '').map(r => r.id)).toEqual(['r1']);
    expect(filterRows(rows, '', 'LKG').map(r => r.id)).toEqual(['r2']);
    expect(filterRows(rows, 'zzz', '')).toHaveLength(0);
  });
});
