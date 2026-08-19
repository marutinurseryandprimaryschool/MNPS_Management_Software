/**
 * Firestore security-rules suite for the standalone Principal Register.
 *
 * Covers the principalRegister / principalPayments / principalExpenses /
 * principalAudit / principalSettings collections. These share NO data with the
 * legacy feePayments / feeStructures / expenses collections — those are
 * exercised by tests/rules/security.test.ts and are untouched here.
 *
 * Runs against the Firestore emulator via `npm run test:rules`
 * (firebase emulators:exec --only firestore "vitest run tests/rules").
 * The emulator needs Java; on machines without it this suite reports as
 * SKIPPED (with a loud banner) instead of failing the whole test run.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

import { isEmulatorReachable, warnEmulatorMissing } from './emulator';

/* The emulator needs Java. When it is not listening the suite is SKIPPED with a
   loud banner rather than failing, so `vitest run tests/` still reports the
   unit-test result honestly. `npm run test:rules` boots it and runs for real. */
const EMULATOR_UP = await isEmulatorReachable();
if (!EMULATOR_UP) warnEmulatorMissing('principal-rules (Principal Register firestore.rules)');
const describeRules = EMULATOR_UP ? describe : describe.skip;

/**
 * The server clock. `createdAt` on a payment and `at` on an audit entry are
 * pinned to request.time by the rules, so every accepted write must use the
 * sentinel — a client-chosen timestamp is exactly the eviction attack the
 * audit log is hardened against.
 */
const serverNow = () => firebase.firestore.FieldValue.serverTimestamp();

const PROJECT_ID = 'demo-mnps-principal-rules';
const RULES_PATH = fileURLToPath(new URL('../../firestore.rules', import.meta.url));

const ADMIN_UID = 'admin-1';
const ADMIN_EMAIL = 'admin@school.test';
const PRINCIPAL_UID = 'principal-1';
const PRINCIPAL_EMAIL = 'principal@school.test';
/** Teacher assigned to OWN_ROW_ID. */
const TEACHER_UID = 'teacher-1';
const TEACHER_EMAIL = 'teacher@school.test';
/** Teacher assigned to nothing — the "not your student" case. */
const OTHER_TEACHER_UID = 'teacher-2';
const OTHER_TEACHER_EMAIL = 'teacher.two@school.test';
const PARENT_UID = 'parent-1';
/**
 * Signed in, but with NO users/{uid} doc — the session AuthContext.loginAsParent
 * holds before the login code is matched, and the one anybody can mint from the
 * public web config in the static bundle. It must reach nothing.
 */
const STRANGER_UID = 'stranger-1';

const YEAR = '2026-27';
/** Row whose teacherUid == TEACHER_UID. */
const OWN_ROW_ID = 'row-own-1';
/** Row assigned to OTHER_TEACHER_UID. */
const FOREIGN_ROW_ID = 'row-foreign-1';
/** Row with no teacher assigned at all (teacherUid: null). */
const UNASSIGNED_ROW_ID = 'row-unassigned-1';

const ECA_MONTHS = ['June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
const VAN_MONTHS = ['June', 'July', 'August'];

let testEnv: RulesTestEnvironment;

/** Seed one active user doc per role (bypassing rules). */
const seedBaseUsers = () =>
  testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`users/${ADMIN_UID}`).set({ role: 'admin', status: 'active', email: ADMIN_EMAIL });
    await db.doc(`users/${PRINCIPAL_UID}`).set({ role: 'principal', status: 'active', email: PRINCIPAL_EMAIL });
    await db.doc(`users/${TEACHER_UID}`).set({ role: 'teacher', status: 'active', email: TEACHER_EMAIL });
    await db.doc(`users/${OTHER_TEACHER_UID}`).set({ role: 'teacher', status: 'active', email: OTHER_TEACHER_EMAIL });
    await db.doc(`users/${PARENT_UID}`).set({ role: 'parent', status: 'active', studentId: 'stu-1' });
  });

const seedDocs = (docs: Record<string, Record<string, unknown>>) =>
  testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [path, data] of Object.entries(docs)) {
      await db.doc(path).set(data);
    }
  });

const asAdmin = () =>
  testEnv.authenticatedContext(ADMIN_UID, { email: ADMIN_EMAIL, email_verified: true }).firestore();
const asPrincipal = () =>
  testEnv.authenticatedContext(PRINCIPAL_UID, { email: PRINCIPAL_EMAIL, email_verified: true }).firestore();
const asTeacher = () =>
  testEnv.authenticatedContext(TEACHER_UID, { email: TEACHER_EMAIL, email_verified: true }).firestore();
const asOtherTeacher = () =>
  testEnv.authenticatedContext(OTHER_TEACHER_UID, { email: OTHER_TEACHER_EMAIL, email_verified: true }).firestore();
/** Anonymous parent session: authenticated, no email on the token. */
const asAnonParent = (uid = PARENT_UID) => testEnv.authenticatedContext(uid).firestore();
/** Authenticated with no users/{uid} doc at all — role resolves to ''. */
const asStranger = () => testEnv.authenticatedContext(STRANGER_UID).firestore();
/** Fully signed-out caller. */
const asSignedOut = () => testEnv.unauthenticatedContext().firestore();

const registerRow = (overrides: Record<string, unknown> = {}) => ({
  academicYear: YEAR,
  name: 'Aarav Kumar',
  className: 'Class 5',
  sectionName: 'A',
  rollNo: '12',
  teacherUid: TEACHER_UID,
  teacherName: 'Teacher One',
  schoolFee: 12000,
  ecaAnnual: 5000,
  ecaMonths: ECA_MONTHS,
  vanMonthly: 600,
  vanMonths: VAN_MONTHS,
  isScholarship: false,
  notes: '',
  deleted: false,
  createdAt: '2026-06-01T09:00:00+05:30',
  updatedAt: '2026-06-01T09:00:00+05:30',
  ...overrides,
});

const principalPayment = (overrides: Record<string, unknown> = {}) => ({
  academicYear: YEAR,
  rowId: OWN_ROW_ID,
  studentName: 'Aarav Kumar',
  className: 'Class 5',
  head: 'eca',
  month: 'June',
  amount: 500,
  dateKey: '2026-08-19',
  paidAt: '2026-08-19T10:00:00+05:30',
  mode: 'cash',
  enteredByUid: TEACHER_UID,
  enteredByName: 'Teacher One',
  enteredByRole: 'teacher',
  remarks: '',
  deleted: false,
  createdAt: serverNow(),
  ...overrides,
});

const principalExpense = (overrides: Record<string, unknown> = {}) => ({
  academicYear: YEAR,
  amount: 250,
  category: 'Stationery',
  description: 'Chalk boxes',
  dateKey: '2026-08-19',
  mode: 'cash',
  enteredByUid: PRINCIPAL_UID,
  enteredByName: 'Sharmi',
  deleted: false,
  createdAt: '2026-08-19T10:00:00+05:30',
  ...overrides,
});

const auditEntry = (overrides: Record<string, unknown> = {}) => ({
  at: serverNow(),
  actorUid: TEACHER_UID,
  actorName: 'Teacher One',
  actorRole: 'teacher',
  action: 'update',
  target: 'register',
  targetId: OWN_ROW_ID,
  studentName: 'Aarav Kumar',
  summary: 'School fee 12000 -> 15000',
  ...overrides,
});

const principalSettings = {
  academicYear: YEAR,
  openingCash: 5000,
  openingBank: 20000,
  openingAsOf: '2026-06-01',
  defaultEcaMonths: ECA_MONTHS,
  defaultVanMonths: ECA_MONTHS,
  expenseCategories: ['Stationery', 'Salary', 'Maintenance'],
};

/** Seed the three register rows every suite leans on. */
const seedRows = () =>
  seedDocs({
    [`principalRegister/${OWN_ROW_ID}`]: registerRow(),
    [`principalRegister/${FOREIGN_ROW_ID}`]: registerRow({
      name: 'Diya Sharma',
      teacherUid: OTHER_TEACHER_UID,
      teacherName: 'Teacher Two',
    }),
    [`principalRegister/${UNASSIGNED_ROW_ID}`]: registerRow({
      name: 'Kabir Rao',
      teacherUid: null,
      teacherName: null,
    }),
  });

beforeAll(async () => {
  if (!EMULATOR_UP) return;
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  // testEnv is undefined when the emulator was unreachable in beforeAll
  await testEnv?.cleanup();
});

beforeEach(async () => {
  if (!EMULATOR_UP) return;
  await testEnv.clearFirestore();
  await seedBaseUsers();
});

describeRules('principalRegister: principal writes', () => {
  it('ALLOWS principal creating a row', async () => {
    await assertSucceeds(asPrincipal().doc(`principalRegister/${OWN_ROW_ID}`).set(registerRow()));
  });

  it('ALLOWS principal updating a row (any field, incl. identity)', async () => {
    await seedRows();
    await assertSucceeds(
      asPrincipal().doc(`principalRegister/${OWN_ROW_ID}`).update({ name: 'Aarav K.', className: 'Class 6' })
    );
  });

  it('ALLOWS principal soft-deleting a row (deleted: true)', async () => {
    await seedRows();
    await assertSucceeds(asPrincipal().doc(`principalRegister/${OWN_ROW_ID}`).update({ deleted: true }));
  });

  it('ALLOWS principal reassigning the responsible teacher', async () => {
    await seedRows();
    await assertSucceeds(
      asPrincipal()
        .doc(`principalRegister/${OWN_ROW_ID}`)
        .update({ teacherUid: OTHER_TEACHER_UID, teacherName: 'Teacher Two' })
    );
  });

  it('DENIES admin creating a row (principal is the sole owner of this module)', async () => {
    await assertFails(asAdmin().doc('principalRegister/row-admin-1').set(registerRow()));
  });

  it('DENIES teacher creating a row', async () => {
    await assertFails(asTeacher().doc('principalRegister/row-teacher-1').set(registerRow()));
  });
});

describeRules('principalRegister: teacher updates on a row they own', () => {
  beforeEach(seedRows);

  it('ALLOWS the owning teacher to edit fee fields only', async () => {
    await assertSucceeds(
      asTeacher()
        .doc(`principalRegister/${OWN_ROW_ID}`)
        .update({
          schoolFee: 15000,
          ecaAnnual: 6000,
          ecaMonths: ECA_MONTHS,
          vanMonthly: 700,
          vanMonths: VAN_MONTHS,
          isScholarship: true,
          notes: 'Paid in two instalments',
          updatedAt: '2026-08-19T10:00:00+05:30',
        })
    );
  });

  it('DENIES the owning teacher changing name', async () => {
    await assertFails(
      asTeacher()
        .doc(`principalRegister/${OWN_ROW_ID}`)
        .update({ name: 'Someone Else', updatedAt: '2026-08-19T10:00:00+05:30' })
    );
  });

  it('DENIES the owning teacher changing className', async () => {
    await assertFails(
      asTeacher()
        .doc(`principalRegister/${OWN_ROW_ID}`)
        .update({ className: 'Class 9', updatedAt: '2026-08-19T10:00:00+05:30' })
    );
  });

  it('DENIES the owning teacher changing teacherUid (self-reassignment)', async () => {
    await assertFails(
      asTeacher()
        .doc(`principalRegister/${OWN_ROW_ID}`)
        .update({ teacherUid: OTHER_TEACHER_UID, updatedAt: '2026-08-19T10:00:00+05:30' })
    );
  });

  it('DENIES the owning teacher soft-deleting the row', async () => {
    await assertFails(asTeacher().doc(`principalRegister/${OWN_ROW_ID}`).update({ deleted: true }));
  });

  it('DENIES the owning teacher smuggling an identity change alongside a fee change', async () => {
    await assertFails(
      asTeacher()
        .doc(`principalRegister/${OWN_ROW_ID}`)
        .update({ schoolFee: 15000, className: 'Class 9', updatedAt: '2026-08-19T10:00:00+05:30' })
    );
  });
});

describeRules('principalRegister: updates by everyone else', () => {
  beforeEach(seedRows);

  it('DENIES a teacher updating fee fields on a row they do NOT own', async () => {
    await assertFails(
      asOtherTeacher()
        .doc(`principalRegister/${OWN_ROW_ID}`)
        .update({ schoolFee: 1, updatedAt: '2026-08-19T10:00:00+05:30' })
    );
  });

  it('DENIES a teacher updating an unassigned row (teacherUid: null)', async () => {
    await assertFails(
      asTeacher()
        .doc(`principalRegister/${UNASSIGNED_ROW_ID}`)
        .update({ schoolFee: 1, updatedAt: '2026-08-19T10:00:00+05:30' })
    );
  });

  it('DENIES a parent updating a row', async () => {
    await assertFails(
      asAnonParent()
        .doc(`principalRegister/${OWN_ROW_ID}`)
        .update({ schoolFee: 0, updatedAt: '2026-08-19T10:00:00+05:30' })
    );
  });

  it('DENIES a signed-out caller updating a row', async () => {
    await assertFails(
      asSignedOut()
        .doc(`principalRegister/${OWN_ROW_ID}`)
        .update({ schoolFee: 0, updatedAt: '2026-08-19T10:00:00+05:30' })
    );
  });

  it('DENIES a signed-out caller reading a row', async () => {
    await assertFails(asSignedOut().doc(`principalRegister/${OWN_ROW_ID}`).get());
  });
});

describeRules('principalRegister: reads are role-gated', () => {
  beforeEach(seedRows);

  it('ALLOWS the principal reading a row', async () => {
    await assertSucceeds(asPrincipal().doc(`principalRegister/${OWN_ROW_ID}`).get());
  });

  it('ALLOWS a teacher reading any row', async () => {
    await assertSucceeds(asTeacher().doc(`principalRegister/${FOREIGN_ROW_ID}`).get());
  });

  it('ALLOWS a parent reading a row (still scoped client-side — accepted residual risk)', async () => {
    await assertSucceeds(asAnonParent().doc(`principalRegister/${OWN_ROW_ID}`).get());
  });

  it('DENIES a signed-in caller with no users doc reading a row', async () => {
    await assertFails(asStranger().doc(`principalRegister/${OWN_ROW_ID}`).get());
  });

  it('DENIES a signed-in caller with no users doc enumerating the register', async () => {
    await assertFails(asStranger().collection('principalRegister').get());
  });

  it('DENIES admin reading a row (not their module)', async () => {
    await assertFails(asAdmin().doc(`principalRegister/${OWN_ROW_ID}`).get());
  });
});

describeRules('principalRegister: hard delete is impossible', () => {
  beforeEach(seedRows);

  it('DENIES principal hard-deleting a row (soft delete only)', async () => {
    await assertFails(asPrincipal().doc(`principalRegister/${OWN_ROW_ID}`).delete());
  });

  it('DENIES the owning teacher hard-deleting a row', async () => {
    await assertFails(asTeacher().doc(`principalRegister/${OWN_ROW_ID}`).delete());
  });

  it('DENIES admin hard-deleting a row', async () => {
    await assertFails(asAdmin().doc(`principalRegister/${OWN_ROW_ID}`).delete());
  });
});

describeRules('principalPayments: create', () => {
  beforeEach(seedRows);

  it('ALLOWS principal creating a payment', async () => {
    await assertSucceeds(
      asPrincipal()
        .doc('principalPayments/pay-principal-1')
        .set(principalPayment({ enteredByUid: PRINCIPAL_UID, enteredByRole: 'principal' }))
    );
  });

  it('ALLOWS principal creating a payment against an unassigned row', async () => {
    await assertSucceeds(
      asPrincipal()
        .doc('principalPayments/pay-principal-2')
        .set(principalPayment({ rowId: UNASSIGNED_ROW_ID, enteredByUid: PRINCIPAL_UID, enteredByRole: 'principal' }))
    );
  });

  it('ALLOWS the owning teacher creating a payment for their student', async () => {
    await assertSucceeds(asTeacher().doc('principalPayments/pay-teacher-1').set(principalPayment()));
  });

  it('DENIES a non-owning teacher creating a payment for that student', async () => {
    await assertFails(
      asOtherTeacher()
        .doc('principalPayments/pay-teacher-2')
        .set(principalPayment({ enteredByUid: OTHER_TEACHER_UID }))
    );
  });

  it('DENIES a teacher creating a payment against an unassigned row', async () => {
    await assertFails(
      asTeacher().doc('principalPayments/pay-teacher-3').set(principalPayment({ rowId: UNASSIGNED_ROW_ID }))
    );
  });

  it('DENIES a teacher creating a payment whose rowId does not exist', async () => {
    await assertFails(
      asTeacher().doc('principalPayments/pay-teacher-4').set(principalPayment({ rowId: 'row-does-not-exist' }))
    );
  });

  it('DENIES a teacher creating a payment with no rowId at all', async () => {
    const { rowId, ...withoutRowId } = principalPayment();
    void rowId;
    await assertFails(asTeacher().doc('principalPayments/pay-teacher-5').set(withoutRowId));
  });

  it('DENIES a parent creating a payment', async () => {
    await assertFails(asAnonParent().doc('principalPayments/pay-parent-1').set(principalPayment()));
  });

  it('DENIES admin creating a payment', async () => {
    await assertFails(asAdmin().doc('principalPayments/pay-admin-1').set(principalPayment()));
  });

  it('DENIES a signed-out caller creating a payment', async () => {
    await assertFails(asSignedOut().doc('principalPayments/pay-anon-1').set(principalPayment()));
  });

  /* ── Attribution and value pinning ── */

  it('DENIES the owning teacher recording money AS THE PRINCIPAL', async () => {
    await assertFails(
      asTeacher().doc('principalPayments/pay-forged-1').set(principalPayment({
        enteredByUid: PRINCIPAL_UID,
        enteredByName: 'Sharmi',
        enteredByRole: 'principal',
      }))
    );
  });

  it('DENIES the principal recording a payment attributed to a teacher', async () => {
    await assertFails(
      asPrincipal().doc('principalPayments/pay-forged-2').set(principalPayment({
        enteredByUid: TEACHER_UID,
      }))
    );
  });

  it('DENIES a negative amount', async () => {
    await assertFails(
      asTeacher().doc('principalPayments/pay-neg-1').set(principalPayment({ amount: -500 }))
    );
  });

  it('DENIES a zero amount', async () => {
    await assertFails(
      asTeacher().doc('principalPayments/pay-zero-1').set(principalPayment({ amount: 0 }))
    );
  });

  it('DENIES a non-numeric amount', async () => {
    await assertFails(
      asTeacher().doc('principalPayments/pay-str-1').set(principalPayment({ amount: '500' }))
    );
  });

  it('DENIES a payment born soft-deleted', async () => {
    await assertFails(
      asTeacher().doc('principalPayments/pay-del-1').set(principalPayment({ deleted: true }))
    );
  });

  it('DENIES an unknown fee head', async () => {
    await assertFails(
      asTeacher().doc('principalPayments/pay-head-1').set(principalPayment({ head: 'donation' }))
    );
  });

  it('DENIES an unknown payment mode', async () => {
    await assertFails(
      asTeacher().doc('principalPayments/pay-mode-1').set(principalPayment({ mode: 'upi-later' }))
    );
  });

  it('DENIES an academicYear that does not match the row', async () => {
    await assertFails(
      asTeacher().doc('principalPayments/pay-year-1').set(principalPayment({ academicYear: '2099-00' }))
    );
  });

  it('DENIES a client-chosen createdAt', async () => {
    await assertFails(
      asTeacher()
        .doc('principalPayments/pay-time-1')
        .set(principalPayment({ createdAt: '2026-08-19T10:00:00+05:30' }))
    );
  });
});

describeRules('principalPayments: update, read and delete', () => {
  beforeEach(async () => {
    await seedRows();
    await seedDocs({
      'principalPayments/pay-1': principalPayment(),
      'principalPayments/pay-foreign-1': principalPayment({
        rowId: FOREIGN_ROW_ID,
        studentName: 'Diya Sharma',
        enteredByUid: OTHER_TEACHER_UID,
      }),
    });
  });

  it('ALLOWS principal updating a payment', async () => {
    await assertSucceeds(asPrincipal().doc('principalPayments/pay-1').update({ amount: 750 }));
  });

  it('ALLOWS principal soft-deleting a payment', async () => {
    await assertSucceeds(asPrincipal().doc('principalPayments/pay-1').update({ deleted: true }));
  });

  /* ── Editing a recorded payment is PRINCIPAL-ONLY ──
     Teachers hold recordPrincipalPayments and nothing else (permissions.ts),
     and principal-service says so in its denial text. The rules now agree:
     a teacher may create a receipt, never rewrite or retire one. ── */

  it('DENIES the owning teacher changing the amount on a payment', async () => {
    await assertFails(asTeacher().doc('principalPayments/pay-1').update({ amount: 750 }));
  });

  it('DENIES the owning teacher soft-deleting a payment', async () => {
    await assertFails(asTeacher().doc('principalPayments/pay-1').update({ deleted: true }));
  });

  it('DENIES the owning teacher moving a payment between cash and bank', async () => {
    await assertFails(asTeacher().doc('principalPayments/pay-1').update({ mode: 'bank' }));
  });

  it('DENIES the owning teacher re-dating a payment', async () => {
    await assertFails(asTeacher().doc('principalPayments/pay-1').update({ dateKey: '2026-07-01' }));
  });

  it('DENIES the owning teacher parking a payment in another academic year', async () => {
    await assertFails(asTeacher().doc('principalPayments/pay-1').update({ academicYear: '2099-00' }));
  });

  it('DENIES a non-owning teacher updating that payment', async () => {
    await assertFails(asOtherTeacher().doc('principalPayments/pay-1').update({ amount: 0 }));
  });

  it('DENIES the owning teacher re-parenting a payment onto another teacher\'s row', async () => {
    await assertFails(asTeacher().doc('principalPayments/pay-1').update({ rowId: FOREIGN_ROW_ID }));
  });

  it('DENIES a parent updating a payment', async () => {
    await assertFails(asAnonParent().doc('principalPayments/pay-1').update({ amount: 0 }));
  });

  it('ALLOWS a teacher reading a payment (role-gated reads, client-side scoping)', async () => {
    await assertSucceeds(asTeacher().doc('principalPayments/pay-foreign-1').get());
  });

  it('DENIES a signed-in caller with no users doc reading a payment', async () => {
    await assertFails(asStranger().doc('principalPayments/pay-1').get());
  });

  it('DENIES a signed-in caller with no users doc enumerating payments', async () => {
    await assertFails(asStranger().collection('principalPayments').get());
  });

  it('DENIES admin reading a payment', async () => {
    await assertFails(asAdmin().doc('principalPayments/pay-1').get());
  });

  it('DENIES a signed-out caller reading a payment', async () => {
    await assertFails(asSignedOut().doc('principalPayments/pay-1').get());
  });

  it('DENIES principal hard-deleting a payment (soft delete only)', async () => {
    await assertFails(asPrincipal().doc('principalPayments/pay-1').delete());
  });

  it('DENIES the owning teacher hard-deleting a payment', async () => {
    await assertFails(asTeacher().doc('principalPayments/pay-1').delete());
  });
});

describeRules('principalExpenses', () => {
  it('ALLOWS principal creating an expense', async () => {
    await assertSucceeds(asPrincipal().doc('principalExpenses/exp-1').set(principalExpense()));
  });

  it('ALLOWS principal updating an expense (incl. soft delete)', async () => {
    await seedDocs({ 'principalExpenses/exp-1': principalExpense() });
    await assertSucceeds(asPrincipal().doc('principalExpenses/exp-1').update({ deleted: true }));
  });

  it('ALLOWS principal reading an expense', async () => {
    await seedDocs({ 'principalExpenses/exp-1': principalExpense() });
    await assertSucceeds(asPrincipal().doc('principalExpenses/exp-1').get());
  });

  it('DENIES a teacher creating an expense', async () => {
    await assertFails(asTeacher().doc('principalExpenses/exp-t1').set(principalExpense()));
  });

  it('DENIES a teacher reading an expense', async () => {
    await seedDocs({ 'principalExpenses/exp-1': principalExpense() });
    await assertFails(asTeacher().doc('principalExpenses/exp-1').get());
  });

  it('DENIES admin creating an expense', async () => {
    await assertFails(asAdmin().doc('principalExpenses/exp-a1').set(principalExpense()));
  });

  it('DENIES a parent reading an expense', async () => {
    await seedDocs({ 'principalExpenses/exp-1': principalExpense() });
    await assertFails(asAnonParent().doc('principalExpenses/exp-1').get());
  });

  it('DENIES principal hard-deleting an expense (soft delete only)', async () => {
    await seedDocs({ 'principalExpenses/exp-1': principalExpense() });
    await assertFails(asPrincipal().doc('principalExpenses/exp-1').delete());
  });
});

describeRules('principalAudit (write-once)', () => {
  it('ALLOWS a teacher creating an audit entry (their own edit must be loggable)', async () => {
    await assertSucceeds(asTeacher().doc('principalAudit/aud-t1').set(auditEntry()));
  });

  it('ALLOWS principal creating an audit entry', async () => {
    await assertSucceeds(
      asPrincipal()
        .doc('principalAudit/aud-p1')
        .set(auditEntry({ actorUid: PRINCIPAL_UID, actorName: 'Sharmi', actorRole: 'principal' }))
    );
  });

  it('ALLOWS a teacher writing a register update and its audit entry in one batch', async () => {
    await seedRows();
    const db = asTeacher();
    const batch = db.batch();
    batch.update(db.doc(`principalRegister/${OWN_ROW_ID}`), {
      schoolFee: 15000,
      updatedAt: '2026-08-19T10:00:00+05:30',
    });
    batch.set(db.doc('principalAudit/aud-batch-1'), auditEntry());
    await assertSucceeds(batch.commit());
  });

  it('DENIES a signed-out caller creating an audit entry', async () => {
    await assertFails(asSignedOut().doc('principalAudit/aud-anon-1').set(auditEntry()));
  });

  /* ── Forgery and eviction ──
     The log exists to answer "who moved this money". Anything it accepts on a
     caller's word is worthless, and nothing here can ever be deleted — so a
     forged or future-dated entry would be permanent. ── */

  it('DENIES a parent creating an audit entry', async () => {
    await assertFails(
      asAnonParent()
        .doc('principalAudit/aud-parent-1')
        .set(auditEntry({ actorUid: PARENT_UID, actorRole: 'parent' }))
    );
  });

  it('DENIES a caller with no users doc creating an audit entry', async () => {
    await assertFails(
      asStranger()
        .doc('principalAudit/aud-stranger-1')
        .set(auditEntry({ actorUid: STRANGER_UID, actorRole: 'principal' }))
    );
  });

  it('DENIES admin creating an audit entry', async () => {
    await assertFails(
      asAdmin().doc('principalAudit/aud-admin-1').set(auditEntry({ actorUid: ADMIN_UID, actorRole: 'admin' }))
    );
  });

  it('DENIES a teacher attributing an entry to someone else', async () => {
    await assertFails(
      asTeacher()
        .doc('principalAudit/aud-forge-1')
        .set(auditEntry({ actorUid: PRINCIPAL_UID, actorName: 'Sharmi', actorRole: 'principal' }))
    );
  });

  it('DENIES a teacher claiming a role they do not hold', async () => {
    await assertFails(
      asTeacher().doc('principalAudit/aud-forge-2').set(auditEntry({ actorRole: 'principal' }))
    );
  });

  it('DENIES a client-chosen `at` (the listRecent eviction attack)', async () => {
    await assertFails(
      asTeacher().doc('principalAudit/aud-evict-1').set(auditEntry({ at: '3000-01-01T00:00:00Z' }))
    );
  });

  it('DENIES an entry with an unknown action', async () => {
    await assertFails(
      asTeacher().doc('principalAudit/aud-bad-1').set(auditEntry({ action: 'obliterate' }))
    );
  });

  it('DENIES an entry with an unknown target', async () => {
    await assertFails(
      asTeacher().doc('principalAudit/aud-bad-2').set(auditEntry({ target: 'everything' }))
    );
  });

  it('DENIES an entry with no targetId', async () => {
    await assertFails(
      asTeacher().doc('principalAudit/aud-bad-3').set(auditEntry({ targetId: '' }))
    );
  });

  it('DENIES principal updating an audit entry', async () => {
    await seedDocs({ 'principalAudit/aud-1': auditEntry() });
    await assertFails(asPrincipal().doc('principalAudit/aud-1').update({ summary: 'tampered' }));
  });

  it('DENIES a teacher updating an audit entry', async () => {
    await seedDocs({ 'principalAudit/aud-1': auditEntry() });
    await assertFails(asTeacher().doc('principalAudit/aud-1').update({ summary: 'tampered' }));
  });

  it('DENIES principal deleting an audit entry', async () => {
    await seedDocs({ 'principalAudit/aud-1': auditEntry() });
    await assertFails(asPrincipal().doc('principalAudit/aud-1').delete());
  });

  it('DENIES a teacher deleting an audit entry', async () => {
    await seedDocs({ 'principalAudit/aud-1': auditEntry() });
    await assertFails(asTeacher().doc('principalAudit/aud-1').delete());
  });

  it('DENIES a teacher reading an audit entry', async () => {
    await seedDocs({ 'principalAudit/aud-1': auditEntry() });
    await assertFails(asTeacher().doc('principalAudit/aud-1').get());
  });

  it('DENIES a parent reading an audit entry', async () => {
    await seedDocs({ 'principalAudit/aud-1': auditEntry() });
    await assertFails(asAnonParent().doc('principalAudit/aud-1').get());
  });

  it('ALLOWS principal reading an audit entry', async () => {
    await seedDocs({ 'principalAudit/aud-1': auditEntry() });
    await assertSucceeds(asPrincipal().doc('principalAudit/aud-1').get());
  });
});

describeRules('principalSettings', () => {
  it('ALLOWS principal writing settings', async () => {
    await assertSucceeds(asPrincipal().doc('principalSettings/main').set(principalSettings));
  });

  it('ALLOWS principal updating settings', async () => {
    await seedDocs({ 'principalSettings/main': principalSettings });
    await assertSucceeds(asPrincipal().doc('principalSettings/main').update({ openingCash: 9000 }));
  });

  it('DENIES a teacher writing settings', async () => {
    await assertFails(asTeacher().doc('principalSettings/main').set(principalSettings));
  });

  it('DENIES admin writing settings', async () => {
    await assertFails(asAdmin().doc('principalSettings/main').set(principalSettings));
  });

  it('DENIES a parent writing settings', async () => {
    await assertFails(asAnonParent().doc('principalSettings/main').set(principalSettings));
  });

  it('ALLOWS a teacher reading settings (default month sets drive the register UI)', async () => {
    await seedDocs({ 'principalSettings/main': principalSettings });
    await assertSucceeds(asTeacher().doc('principalSettings/main').get());
  });

  it('ALLOWS a parent reading settings', async () => {
    await seedDocs({ 'principalSettings/main': principalSettings });
    await assertSucceeds(asAnonParent().doc('principalSettings/main').get());
  });

  it('DENIES a caller with no users doc reading settings', async () => {
    await seedDocs({ 'principalSettings/main': principalSettings });
    await assertFails(asStranger().doc('principalSettings/main').get());
  });

  it('DENIES a signed-out caller reading settings', async () => {
    await assertFails(asSignedOut().doc('principalSettings/main').get());
  });
});
