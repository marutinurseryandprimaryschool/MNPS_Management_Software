/* GET /api/parent-data?view=<view>&studentId=<id>
   Authorization: Bearer <Firebase ID token carrying parent claims>
   Returns only the named child's slice of each collection.
   See _lib/parent-data-core.ts and tests/parent-data.test.ts. */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminAuth, adminDb } from './_lib/admin';
import { logEvent, plain, send } from './_lib/http';
import { createParentDataHandler, type Doc, type ParentDataStore } from './_lib/parent-data-core';

const docs = (snap: FirebaseFirestore.QuerySnapshot): Doc[] =>
  snap.docs.map(d => ({ ...(d.data() as Record<string, unknown>), id: d.id }));

const inYear = (year: string) => (d: Doc) => !d.academicYear || d.academicYear === year;
const inSection = (sectionId: string) => (d: Doc) => !sectionId || d.sectionId === sectionId;

const db = () => adminDb();

// Single-equality queries (no composite indexes to deploy); the remaining
// predicates are applied in memory on a class-sized result set.
const store: ParentDataStore = {
  academicYear: async () => ((await db().doc('school/main').get()).data()?.academicYear as string) || '',
  studentsByIds: async ids => {
    const snaps = await Promise.all(ids.map(id => db().doc(`students/${id}`).get()));
    return snaps.filter(s => s.exists).map(s => ({ ...(s.data() as Record<string, unknown>), id: s.id }));
  },
  classById: async classId => {
    if (!classId) return null;
    const s = await db().doc(`classes/${classId}`).get();
    return s.exists ? { ...(s.data() as Record<string, unknown>), id: s.id } : null;
  },
  attendanceForClass: async (classId, sectionId, year) =>
    docs(await db().collection('attendance').where('classId', '==', classId).get())
      .filter(inSection(sectionId)).filter(inYear(year)),
  marksForClass: async (classId, sectionId, year) =>
    docs(await db().collection('marks').where('classId', '==', classId).get())
      .filter(inSection(sectionId)).filter(inYear(year)),
  classTestsForClass: async (classId, sectionId, year) =>
    docs(await db().collection('classTests').where('classId', '==', classId).get())
      .filter(inSection(sectionId)).filter(inYear(year)),
  coScholasticForClass: async (classId, sectionId, year) =>
    docs(await db().collection('coScholasticRecords').where('classId', '==', classId).get())
      .filter(inSection(sectionId)).filter(inYear(year)),
  weeklyTestsForStudent: async (studentId, year) =>
    docs(await db().collection('weeklyTests').where('studentId', '==', studentId).get()).filter(inYear(year)),
  assignmentsForClass: async classId =>
    docs(await db().collection('assignments').where('classId', '==', classId).get()),
  timetableForClass: async (classId, sectionId, year) => {
    const all = docs(await db().collection('timetables').where('classId', '==', classId).get())
      .filter(inSection(sectionId)).filter(inYear(year))
      .filter(t => t.status !== 'archived');
    // Prefer the published one, then the highest version.
    all.sort((a, b) => Number(b.status === 'published') - Number(a.status === 'published')
      || Number(b.version || 0) - Number(a.version || 0));
    return all[0] || null;
  },
  registerRows: async year =>
    docs(await db().collection('principalRegister').where('academicYear', '==', year).get()),
  paymentsForRow: async rowId =>
    docs(await db().collection('principalPayments').where('rowId', '==', rowId).get()),
};

const handler = createParentDataHandler({
  verifyIdToken: async idToken => {
    const t = await adminAuth().verifyIdToken(idToken, true);
    return { uid: t.uid, claims: t as unknown as Record<string, unknown> };
  },
  store,
  log: logEvent,
});

export default async function parentData(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const auth = req.headers.authorization;
    const out = await handler({
      method: req.method || 'GET',
      authorization: Array.isArray(auth) ? auth[0] : auth,
      query: req.query as Record<string, string | string[] | undefined>,
    });
    send(res, out.status, plain(out.body), out.headers);
  } catch (err) {
    logEvent('parent_data.error', { message: (err as Error)?.message });
    send(res, 500, { error: 'server_error' });
  }
}
