/**
 * /api/parent-data authorization and data scoping, with the store faked:
 * missing/invalid tokens, non-parent roles, a studentId outside the token's
 * claims, and — the point of the endpoint — that no classmate's record ever
 * appears in a response.
 */
import { describe, it, expect } from 'vitest';
import { createParentDataHandler, type ParentDataStore, type Doc } from '../api/_lib/parent-data-core';

const MINE = 'stu-a';
const SIBLING = 'stu-b';
const CLASSMATE = 'stu-z';
const LEFT = 'stu-left'; // archived after the token was issued

const store: ParentDataStore = {
  academicYear: async () => '2026-27',
  studentsByIds: async ids => ids.flatMap(id => id === MINE
    ? [{ id, name: 'Arun', classId: 'c1', sectionId: 's1', className: 'Class 1', aadhaarNumber: 'SECRET', phone: '9', parentIds: ['p'] }]
    : id === SIBLING ? [{ id, name: 'Bala', classId: 'c2', sectionId: 's1', className: 'Class 2' }]
    : id === CLASSMATE ? [{ id, name: 'Zed', classId: 'c1', sectionId: 's1' }]
    : id === LEFT ? [{ id, name: 'Left', classId: 'c1', sectionId: 's1', status: 'archived' }]
    : []),
  classById: async classId => ({ id: classId, name: classId === 'c1' ? 'Class 1' : 'Class 2', subjects: [] }),
  attendanceForClass: async () => [
    { id: 'att-1', date: '2026-10-01', records: [{ studentId: MINE, status: 'present' }, { studentId: CLASSMATE, status: 'absent' }] },
    { id: 'att-2', date: '2026-10-02', records: [{ studentId: CLASSMATE, status: 'late' }] },
  ],
  marksForClass: async () => [
    { id: 'm-1', examType: 'major_exam', records: [{ studentId: CLASSMATE, marksObtained: 99 }, { studentId: MINE, marksObtained: 71 }] },
  ],
  classTestsForClass: async () => [
    { id: 'ct-1', records: [{ studentId: CLASSMATE, marksObtained: 10 }] },
  ],
  coScholasticForClass: async () => [
    { id: 'co-1', records: [{ studentId: MINE, grade: 'A' }, { studentId: CLASSMATE, grade: 'B' }] },
  ],
  weeklyTestsForStudent: async studentId => [
    { id: 'w-1', studentId, weeks: { W1: 7 } },
    { id: 'w-leak', studentId: CLASSMATE, weeks: { W1: 10 } },
  ],
  assignmentsForClass: async () => [{ id: 'as-1', title: 'HW' }],
  timetableForClass: async () => ({ id: 'tt-1', slots: [] }),
  registerRows: async () => [
    { id: 'row-a', name: 'Arun', className: 'First' },
    { id: 'row-z', name: 'Zed', className: 'Class 1' },
  ] as Doc[],
  paymentsForRow: async rowId => [
    { id: `${rowId}-p1`, rowId, amount: 100, deleted: false },
    { id: `${rowId}-p2`, rowId, amount: 50, deleted: true },
  ],
};

const claimsFor = (token: string): Record<string, unknown> => {
  if (token === 'parent') return { role: 'parent', studentIds: [MINE, SIBLING] };
  if (token === 'parent-of-left') return { role: 'parent', studentIds: [LEFT, MINE] };
  if (token === 'teacher') return { role: 'teacher' };
  if (token === 'noclaims') return {};
  throw new Error('invalid');
};

const handle = createParentDataHandler({
  verifyIdToken: async token => ({ uid: `uid-${token}`, claims: claimsFor(token) }),
  store,
  log: () => {},
});

const get = (view?: string, token = 'parent', studentId?: string) => handle({
  method: 'GET',
  authorization: token ? `Bearer ${token}` : undefined,
  query: { ...(view ? { view } : {}), ...(studentId ? { studentId } : {}) },
});

describe('parent-data: authorization', () => {
  it('401 without a bearer token or with an invalid one', async () => {
    expect((await get('attendance', '')).status).toBe(401);
    expect((await get('attendance', 'garbage')).status).toBe(401);
  });
  it('403 for a token without parent claims (staff, or a bare anonymous session)', async () => {
    expect((await get('attendance', 'teacher')).status).toBe(403);
    expect((await get('attendance', 'noclaims')).status).toBe(403);
  });
  it('403 for a studentId the token does not name — the cross-student guard', async () => {
    const res = await get('attendance', 'parent', CLASSMATE);
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain('Zed');
  });
  it('400 for an unknown or missing view; 405 for non-GET', async () => {
    expect((await get('users')).status).toBe(400);
    expect((await get(undefined)).status).toBe(400);
    expect((await handle({ method: 'POST', authorization: 'Bearer parent', query: { view: 'me' } })).status).toBe(405);
  });
  it('404 for an archived student even when the (older) token still names them; me omits them', async () => {
    expect((await get('attendance', 'parent-of-left', LEFT)).status).toBe(404);
    const me = (await get('me', 'parent-of-left')).body.data as { children: Doc[] };
    expect(me.children.map(c => c.id)).toEqual([MINE]);
  });
  it('allows a sibling named in the claims', async () => {
    const res = await get('class', 'parent', SIBLING);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ class: { id: 'c2', name: 'Class 2', subjects: [] } });
  });
});

describe('parent-data: scoping', () => {
  it('me: returns only whitelisted fields of the claimed children', async () => {
    const res = await get('me');
    const data = res.body.data as { children: Record<string, unknown>[]; academicYear: string };
    expect(data.academicYear).toBe('2026-27');
    expect(data.children.map(c => c.id)).toEqual([MINE, SIBLING]);
    expect(data.children[0]).not.toHaveProperty('aadhaarNumber');
    expect(data.children[0]).not.toHaveProperty('parentIds');
    expect(data.children[0]).toHaveProperty('phone');
  });

  it('attendance/marks/classTests/coScholastic/reportCard: only the child\'s own record survives', async () => {
    for (const view of ['attendance', 'marks', 'classTests', 'reportCard'] as const) {
      const res = await get(view);
      expect(res.status).toBe(200);
      expect(res.headers?.['Cache-Control']).toContain('no-store');
      expect(JSON.stringify(res.body)).not.toContain(CLASSMATE);
    }
    const att = (await get('attendance')).body.data as { attendance: Doc[] };
    expect(att.attendance.map(a => a.id)).toEqual(['att-1']); // att-2 had no entry for the child
    expect(att.attendance[0].records).toEqual([{ studentId: MINE, status: 'present' }]);
    const ct = (await get('classTests')).body.data as { classTests: Doc[] };
    expect(ct.classTests).toEqual([]);
    const rc = (await get('reportCard')).body.data as { marks: Doc[]; coScholastic: Doc[]; class: Doc };
    expect(rc.marks[0].records).toEqual([{ studentId: MINE, marksObtained: 71 }]);
    expect(rc.coScholastic[0].records).toEqual([{ studentId: MINE, grade: 'A' }]);
    expect(rc.class.id).toBe('c1');
  });

  it('weekly: drops any doc not belonging to the child even if the store returns it', async () => {
    const data = (await get('weekly')).body.data as { weekly: Doc[] };
    expect(data.weekly.map(w => w.id)).toEqual(['w-1']);
  });

  it('fees: returns the child\'s matched row and its live payments, never the register', async () => {
    const data = (await get('fees')).body.data as { row: Doc | null; payments: Doc[] };
    expect(data.row?.id).toBe('row-a'); // alias "First" == "Class 1"
    expect(data.payments.map(p => p.id)).toEqual(['row-a-p1']);
    expect(JSON.stringify(data)).not.toContain('row-z');
  });

  it('fees: a child with no register row gets row null and no payments', async () => {
    const data = (await get('fees', 'parent', SIBLING)).body.data as { row: Doc | null; payments: Doc[] };
    expect(data).toEqual({ row: null, payments: [] });
  });

  it('assignments and timetable are class-level and pass through', async () => {
    expect(((await get('assignments')).body.data as { assignments: Doc[] }).assignments).toHaveLength(1);
    expect(((await get('timetable')).body.data as { timetable: Doc }).timetable.id).toBe('tt-1');
  });
});
