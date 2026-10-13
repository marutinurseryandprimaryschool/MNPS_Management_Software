/**
 * Pure logic shared by the parent portal API and the browser:
 * input validation, phone-suffix + DOB matching, sibling grouping, the
 * rate-limit policy, the per-student record filter, field whitelisting and
 * the fee-row matcher.
 */
import { describe, it, expect } from 'vitest';
import {
  parseLoginInput, dobKey, matchStudents, siblingsOf, studentsByEmail,
  applyRateLimit, RATE_LIMIT, restrictRecordsToStudent, sanitizeStudentForParent,
  findRowForChild, isParentClaims, isParentDataView,
} from '@/lib/parent-portal/core';

const students = [
  { id: 'stu-a', name: 'Arun', phone: '98765 43210', email: 'Ravi.K@Gmail.com ', dob: new Date(2018, 5, 15), status: 'active' },
  { id: 'stu-b', name: 'Bala', phone: '+91 9876543210', email: '', dob: '2020-01-02', status: 'active' },      // sibling of a
  { id: 'stu-c', name: 'Charu', phone: '9000003210', email: 'other@x.com', dob: new Date(2018, 5, 15), status: 'active' }, // same last4+dob as a? last4 3210, dob same → twin-like clash
  { id: 'stu-d', name: 'Dev', phone: '9111111111', email: 'ravi.k@gmail.com', dob: new Date(2019, 0, 1), status: 'archived' },
  { id: 'stu-e', name: 'Esha', phone: '', dob: new Date(2019, 0, 1) },
];

describe('parseLoginInput', () => {
  it('accepts exactly 4 digits + a real DDMMYYYY date', () => {
    expect(parseLoginInput({ code: '3210', dob: '15062018' })).toEqual({ code: '3210', dob: '15062018' });
  });
  it.each([
    [{ code: '321', dob: '15062018' }],
    [{ code: '32100', dob: '15062018' }],
    [{ code: 'abcd', dob: '15062018' }],
    [{ code: '3210', dob: '1506201' }],
    [{ code: '3210', dob: '32062018' }],   // day 32
    [{ code: '3210', dob: '31022018' }],   // 31 Feb
    [{ code: '3210', dob: '15132018' }],   // month 13
    [{ code: '3210', dob: '15061980' }],   // year out of range
    [{ code: 3210, dob: '15062018' }],
    [{ code: '3210' }],
    ['3210'],
    [null],
    [{ code: "3210' OR 1=1", dob: '15062018' }],
  ])('rejects %j', (raw) => {
    expect(parseLoginInput(raw)).toBeNull();
  });
});

describe('dobKey', () => {
  it('reads Date, Timestamp-like, ISO and digit strings', () => {
    expect(dobKey(new Date(2018, 5, 15))).toBe('15062018');
    expect(dobKey({ toDate: () => new Date(2018, 5, 15) })).toBe('15062018');
    expect(dobKey('2018-06-15')).toBe('15062018');
    expect(dobKey('15/06/2018')).toBe('15062018');
    expect(dobKey('')).toBe('');
    expect(dobKey(null)).toBe('');
    expect(dobKey('garbage')).toBe('');
  });
});

describe('matchStudents', () => {
  it('matches last-4 phone digits + DOB and returns the whole family on that phone', () => {
    const { matched, family } = matchStudents(students, { code: '3210', dob: '02012020' });
    expect(matched?.id).toBe('stu-b');
    expect(family.map(s => s.id)).toEqual(['stu-b', 'stu-a']);
  });
  it('returns nothing for a right code with the wrong DOB', () => {
    expect(matchStudents(students, { code: '3210', dob: '01012000' })).toEqual({ matched: null, family: [] });
  });
  it('returns nothing for an unknown code', () => {
    expect(matchStudents(students, { code: '0000', dob: '15062018' })).toEqual({ matched: null, family: [] });
  });
  it('never matches an archived student', () => {
    expect(matchStudents(students, { code: '1111', dob: '01012019' }).matched).toBeNull();
  });
  it('never matches a student with no phone, even on a DOB hit', () => {
    expect(matchStudents(students, { code: '', dob: '01012019' } as never).matched).toBeNull();
  });
  it('is deterministic when two unrelated students share last-4 + DOB, and does not merge their families', () => {
    const { matched, family } = matchStudents(students, { code: '3210', dob: '15062018' });
    expect(matched?.id).toBe('stu-a'); // lowest id
    expect(family.map(s => s.id)).toEqual(['stu-a', 'stu-b']); // only the full-phone family
    expect(family.find(s => s.id === 'stu-c')).toBeUndefined();
  });
});

describe('siblingsOf / studentsByEmail', () => {
  it('groups by the FULL phone number only', () => {
    expect(siblingsOf(students, students[2]).map(s => s.id)).toEqual(['stu-c']);
  });
  it('matches email case- and space-insensitively, active only', () => {
    expect(studentsByEmail(students, 'ravi.k@gmail.com').map(s => s.id)).toEqual(['stu-a']);
    expect(studentsByEmail(students, '')).toEqual([]);
  });
});

describe('applyRateLimit', () => {
  const now = 1_000_000;
  it('starts a window at 1', () => {
    expect(applyRateLimit(null, 8, now)).toEqual({ allowed: true, retryAfterSec: 0, next: { count: 1, windowStart: now } });
  });
  it('counts up to the limit, then blocks with a Retry-After', () => {
    let w = applyRateLimit(null, 3, now).next;
    w = applyRateLimit(w, 3, now + 1).next;
    w = applyRateLimit(w, 3, now + 2).next;
    expect(w.count).toBe(3);
    const blocked = applyRateLimit(w, 3, now + 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(Math.ceil((RATE_LIMIT.windowMs - 3) / 1000));
    expect(blocked.next).toEqual(w); // nothing advances while blocked
  });
  it('resets after the window', () => {
    const w = { count: 99, windowStart: now };
    expect(applyRateLimit(w, 3, now + RATE_LIMIT.windowMs)).toMatchObject({ allowed: true, next: { count: 1 } });
  });
});

describe('restrictRecordsToStudent', () => {
  const docs = [
    { id: 'att-1', date: '2026-10-01', records: [{ studentId: 'stu-a', status: 'present' }, { studentId: 'stu-z', status: 'absent' }] },
    { id: 'att-2', date: '2026-10-02', records: [{ studentId: 'stu-z', status: 'present' }] },
    { id: 'att-3', date: '2026-10-03', records: null },
  ];
  it('keeps only the child entry and drops docs without one', () => {
    const out = restrictRecordsToStudent(docs, 'stu-a');
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('att-1');
    expect(out[0].records).toEqual([{ studentId: 'stu-a', status: 'present' }]);
  });
  it('leaks nothing when the child is absent from every doc', () => {
    expect(restrictRecordsToStudent(docs, 'nobody')).toEqual([]);
    expect(JSON.stringify(restrictRecordsToStudent(docs, 'stu-a'))).not.toContain('stu-z');
  });
});

describe('sanitizeStudentForParent', () => {
  it('whitelists: identity, class, contact — not Aadhaar, fee adjustments or parentIds', () => {
    const out = sanitizeStudentForParent({
      id: 's', name: 'Arun', aadhaarNumber: '1234 5678 9012', feeAdjustment: { amount: 1 },
      scholarshipId: 'rte', parentIds: ['x'], previousBalance: 500, className: 'LKG', phone: '9',
    });
    expect(out).toEqual({ id: 's', name: 'Arun', className: 'LKG', phone: '9' });
  });
});

describe('findRowForChild', () => {
  const rows = [
    { id: 'r1', name: 'Arun Kumar', className: 'Class 1' },
    { id: 'r2', name: 'Arun Kumar', className: 'Class 2' },
    { id: 'r3', name: 'Bala', className: 'UKG' },
    { id: 'r4', name: 'Charu', className: 'LKG', deleted: true },
  ];
  it('matches name + alias-aware class', () => {
    expect(findRowForChild(rows, { name: 'arun  kumar', className: 'First' })?.id).toBe('r1');
  });
  it('accepts a unique name-only match', () => {
    expect(findRowForChild(rows, { name: 'Bala', className: 'Class 3' })?.id).toBe('r3');
  });
  it('refuses an ambiguous name when the class does not disambiguate', () => {
    expect(findRowForChild(rows, { name: 'Arun Kumar', className: 'Class 5' })).toBeNull();
  });
  it('ignores soft-deleted rows and empty names', () => {
    expect(findRowForChild(rows, { name: 'Charu', className: 'LKG' })).toBeNull();
    expect(findRowForChild(rows, { name: '  ', className: 'LKG' })).toBeNull();
    expect(findRowForChild(rows, null)).toBeNull();
  });
});

describe('claims + views', () => {
  it('accepts only role=parent with a non-empty studentIds list', () => {
    expect(isParentClaims({ role: 'parent', studentIds: ['a'] })).toBe(true);
    expect(isParentClaims({ role: 'parent', studentIds: [] })).toBe(false);
    expect(isParentClaims({ role: 'admin', studentIds: ['a'] })).toBe(false);
    expect(isParentClaims({ role: 'parent' })).toBe(false);
    expect(isParentClaims({ role: 'parent', studentIds: [1] })).toBe(false);
    expect(isParentClaims(null)).toBe(false);
  });
  it('whitelists the data views', () => {
    expect(isParentDataView('attendance')).toBe(true);
    expect(isParentDataView('users')).toBe(false);
    expect(isParentDataView(undefined)).toBe(false);
  });
});
