import { describe, it, expect } from 'vitest';
import { toInputDate } from '@/lib/utils';

// Run with TZ=Asia/Kolkata (school browsers): a DOB stored at midnight IST
// must show and round-trip as that same day.
describe('toInputDate', () => {
  it('shows the local calendar day, not the UTC one', () => {
    const d = new Date(2021, 4, 3); // 3 May 2021, local midnight
    expect(toInputDate(d)).toBe('2021-05-03');
    expect(toInputDate({ toDate: () => d })).toBe('2021-05-03');
  });
  it('round-trips through the form unchanged', () => {
    const d = new Date(2021, 4, 3);
    const saved = new Date(toInputDate(d)); // what the form saves
    expect(toInputDate(saved)).toBe('2021-05-03');
  });
  it('empty and invalid values give an empty field', () => {
    expect(toInputDate(null)).toBe('');
    expect(toInputDate('not a date')).toBe('');
  });
});
