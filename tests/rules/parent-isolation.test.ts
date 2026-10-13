/**
 * firestore.rules: parent isolation.
 *
 * After the parent portal moved behind /api/parent-data, NO parent session —
 * whether it carries server-issued parent claims, a legacy users doc with
 * role 'parent', or nothing at all (anonymous) — may read student data from
 * Firestore directly. Staff reads and writes must keep working.
 *
 * Runs against the Firestore emulator via `npm run test:rules`; skipped with
 * a loud banner when the emulator is not listening.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

import { isEmulatorReachable, warnEmulatorMissing } from './emulator';

const EMULATOR_UP = await isEmulatorReachable();
if (!EMULATOR_UP) warnEmulatorMissing('parent-isolation (firestore.rules)');
const describeRules = EMULATOR_UP ? describe : describe.skip;

const PROJECT_ID = 'demo-mnps-parent-isolation';
const RULES_PATH = fileURLToPath(new URL('../../firestore.rules', import.meta.url));

const ADMIN_UID = 'admin-1';
const TEACHER_UID = 'teacher-1';
const PRINCIPAL_UID = 'principal-1';
const CLAIMS_PARENT_UID = 'parent_claims';      // server-issued custom token, no users doc
const LEGACY_PARENT_UID = 'parent-legacy';      // users doc role 'parent', no claims
const ANON_UID = 'anon-1';

let testEnv: RulesTestEnvironment;

const seed = () =>
  testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`users/${ADMIN_UID}`).set({ role: 'admin', status: 'active', email: 'admin@school.test', phone: '1' });
    await db.doc(`users/${TEACHER_UID}`).set({ role: 'teacher', status: 'active', email: 'teacher@school.test', phone: '2' });
    await db.doc(`users/${PRINCIPAL_UID}`).set({ role: 'principal', status: 'active', email: 'principal@school.test' });
    await db.doc(`users/${LEGACY_PARENT_UID}`).set({ role: 'parent', status: 'active', studentId: 'stu-1' });
    await db.doc('school/main').set({ academicYear: '2026-27' });
    await db.doc('students/stu-1').set({ name: 'Arun', phone: '9876543210', dob: '2018-06-15', classId: 'c1', sectionId: 's1', academicYear: '2026-27' });
    await db.doc('students/stu-2').set({ name: 'Zed', phone: '9000000000', dob: '2018-01-01', classId: 'c1', sectionId: 's1', academicYear: '2026-27' });
    await db.doc('attendance/att-1').set({ classId: 'c1', sectionId: 's1', academicYear: '2026-27', date: '2026-10-01', records: [{ studentId: 'stu-1', status: 'present' }, { studentId: 'stu-2', status: 'absent' }] });
    await db.doc('marks/m-1').set({ classId: 'c1', sectionId: 's1', academicYear: '2026-27', records: [{ studentId: 'stu-1', marksObtained: 70 }] });
    await db.doc('classTests/ct-1').set({ classId: 'c1', sectionId: 's1', academicYear: '2026-27', records: [] });
    await db.doc('weeklyTests/w-1').set({ studentId: 'stu-1', academicYear: '2026-27', weeks: {} });
    await db.doc('reportCards/rc-1').set({ studentId: 'stu-1', academicYear: '2026-27' });
    await db.doc('coScholasticRecords/co-1').set({ classId: 'c1', sectionId: 's1', academicYear: '2026-27', records: [] });
    await db.doc('assignments/as-1').set({ classId: 'c1', title: 'HW' });
    await db.doc('timetables/tt-1').set({ classId: 'c1', sectionId: 's1', academicYear: '2026-27', slots: [] });
    await db.doc('classes/c1').set({ name: 'Class 1', academicYear: '2026-27' });
    await db.doc('feePayments/fp-1').set({ studentId: 'stu-1', amount: 100 });
    await db.doc('principalRegister/row-1').set({ academicYear: '2026-27', name: 'Arun', className: 'Class 1', schoolFee: 1000, ecaAnnual: 0, ecaMonths: [], vanMonthly: 0, vanMonths: [] });
    await db.doc('principalPayments/pp-1').set({ rowId: 'row-1', amount: 100, academicYear: '2026-27' });
    await db.doc('parentLoginAttempts/ip_abc').set({ count: 1, windowStart: 1 });
  });

const asAdmin = () => testEnv.authenticatedContext(ADMIN_UID, { email: 'admin@school.test', email_verified: true }).firestore();
const asTeacher = () => testEnv.authenticatedContext(TEACHER_UID, { email: 'teacher@school.test', email_verified: true }).firestore();
const asPrincipal = () => testEnv.authenticatedContext(PRINCIPAL_UID, { email: 'principal@school.test', email_verified: true }).firestore();
/** What signInWithCustomToken(parent-login token) looks like to the rules. */
const asClaimsParent = () => testEnv.authenticatedContext(CLAIMS_PARENT_UID, { role: 'parent', studentIds: ['stu-1'] }).firestore();
const asLegacyParent = () => testEnv.authenticatedContext(LEGACY_PARENT_UID).firestore();
const asAnon = () => testEnv.authenticatedContext(ANON_UID).firestore();
const asNobody = () => testEnv.unauthenticatedContext().firestore();

beforeAll(async () => {
  if (!EMULATOR_UP) return;
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(RULES_PATH, 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  if (!EMULATOR_UP) return;
  await testEnv.clearFirestore();
  await seed();
});

const STUDENT_DATA_DOCS = [
  'students/stu-1', 'students/stu-2', 'attendance/att-1', 'marks/m-1', 'classTests/ct-1',
  'weeklyTests/w-1', 'reportCards/rc-1', 'coScholasticRecords/co-1', 'assignments/as-1',
  'timetables/tt-1', 'classes/c1', 'feePayments/fp-1', 'principalRegister/row-1', 'principalPayments/pp-1',
];

describeRules('parent sessions read NO student data directly', () => {
  for (const [label, ctx] of [
    ['claims parent (custom token)', asClaimsParent],
    ['legacy parent (users doc)', asLegacyParent],
    ['anonymous session', asAnon],
    ['unauthenticated', asNobody],
  ] as const) {
    it(`${label}: every student-data doc is DENIED, including the family's own child`, async () => {
      const db = ctx();
      for (const path of STUDENT_DATA_DOCS) {
        await assertFails(db.doc(path).get());
      }
      await assertFails(db.collection('students').get());
      await assertFails(db.collection('attendance').where('classId', '==', 'c1').get());
      await assertFails(db.collection('principalRegister').where('academicYear', '==', '2026-27').get());
    });

    it(`${label}: cannot read staff user docs or the rate-limit counters`, async () => {
      const db = ctx();
      await assertFails(db.doc(`users/${TEACHER_UID}`).get());
      await assertFails(db.collection('users').get());
      await assertFails(db.doc('parentLoginAttempts/ip_abc').get());
    });

    it(`${label}: cannot write marks, attendance or a users doc for itself`, async () => {
      const db = ctx();
      await assertFails(db.doc('marks/m-1').update({ records: [] }));
      await assertFails(db.doc('attendance/att-2').set({ classId: 'c1', records: [] }));
      await assertFails(db.doc('marks/m-new').set({ classId: 'c1', records: [] }));
      await assertFails(db.doc(`users/${ANON_UID}`).set({ role: 'parent', studentId: 'stu-2' }));
      await assertFails(db.doc(`users/${ANON_UID}`).set({ role: 'admin' }));
    });
  }

  it('a legacy parent may still read ITS OWN users doc (and nothing else there)', async () => {
    await assertSucceeds(asLegacyParent().doc(`users/${LEGACY_PARENT_UID}`).get());
    await assertFails(asLegacyParent().doc(`users/${ADMIN_UID}`).get());
  });

  it('the public school profile stays readable (needed before sign-in)', async () => {
    await assertSucceeds(asNobody().doc('school/main').get());
    await assertSucceeds(asClaimsParent().doc('school/main').get());
  });
});

describeRules('staff access keeps working', () => {
  it('teacher reads students, attendance, marks, timetables, classes', async () => {
    const db = asTeacher();
    for (const path of ['students/stu-1', 'attendance/att-1', 'marks/m-1', 'timetables/tt-1', 'classes/c1', 'assignments/as-1', 'weeklyTests/w-1']) {
      await assertSucceeds(db.doc(path).get());
    }
    await assertSucceeds(db.collection('students').where('classId', '==', 'c1').get());
  });

  it('teacher writes attendance, marks, class tests, assignments', async () => {
    const db = asTeacher();
    await assertSucceeds(db.doc('attendance/att-2').set({ classId: 'c1', sectionId: 's1', records: [] }));
    await assertSucceeds(db.doc('marks/m-1').update({ records: [{ studentId: 'stu-1', marksObtained: 80 }] }));
    await assertSucceeds(db.doc('classTests/ct-2').set({ classId: 'c1', records: [] }));
    await assertSucceeds(db.doc('assignments/as-2').set({ classId: 'c1', title: 'HW 2' }));
  });

  it('teacher cannot write students or classes (admin-like only)', async () => {
    await assertFails(asTeacher().doc('students/stu-1').update({ name: 'X' }));
    await assertFails(asTeacher().doc('classes/c1').update({ name: 'X' }));
  });

  it('admin manages students and reads the users directory', async () => {
    await assertSucceeds(asAdmin().doc('students/stu-1').update({ email: 'parent@x.com' }));
    await assertSucceeds(asAdmin().collection('users').get());
  });

  it('principal reads the register and payments; teacher reads the register', async () => {
    await assertSucceeds(asPrincipal().doc('principalRegister/row-1').get());
    await assertSucceeds(asPrincipal().doc('principalPayments/pp-1').get());
    await assertSucceeds(asTeacher().doc('principalRegister/row-1').get());
  });

  it('nobody, not even admin, touches the rate-limit counters from a client', async () => {
    await assertFails(asAdmin().doc('parentLoginAttempts/ip_abc').get());
    await assertFails(asAdmin().doc('parentLoginAttempts/ip_abc').delete());
    await assertFails(asPrincipal().doc('parentLoginAttempts/x').set({ count: 0, windowStart: 0 }));
  });
});
