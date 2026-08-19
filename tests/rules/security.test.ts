/**
 * Firestore security-rules suite (R1 lockdown).
 *
 * Runs against the Firestore emulator via `npm run test:rules`
 * (firebase emulators:exec --only firestore "vitest run tests/rules").
 * The emulator needs Java; on machines without it this suite reports as
 * SKIPPED (with a loud banner) instead of failing the whole test run.
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

/* The emulator needs Java. When it is not listening the suite is SKIPPED with a
   loud banner rather than failing, so `vitest run tests/` still reports the
   unit-test result honestly. `npm run test:rules` boots it and runs for real. */
const EMULATOR_UP = await isEmulatorReachable();
if (!EMULATOR_UP) warnEmulatorMissing('security (R1 lockdown firestore.rules)');
const describeRules = EMULATOR_UP ? describe : describe.skip;

const PROJECT_ID = 'demo-mnps-rules';
const RULES_PATH = fileURLToPath(new URL('../../firestore.rules', import.meta.url));

const ADMIN_UID = 'admin-1';
const ADMIN_EMAIL = 'admin@school.test';
const CORRESPONDENT_UID = 'correspondent-1';
const CORRESPONDENT_EMAIL = 'correspondent@school.test';
const PRINCIPAL_UID = 'principal-1';
const PRINCIPAL_EMAIL = 'principal@school.test';
const TEACHER_UID = 'teacher-1';
const TEACHER_EMAIL = 'teacher@school.test';
const PARENT_UID = 'parent-1';

const NEW_STAFF_UID = 'new-staff-1';
const NEW_STAFF_EMAIL = 'new.teacher@school.test';
const PENDING_DOC_ID = 'pending-auto-id-1';

let testEnv: RulesTestEnvironment;

/** Seed one active user doc per role (bypassing rules). */
const seedBaseUsers = () =>
  testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`users/${ADMIN_UID}`).set({ role: 'admin', status: 'active', email: ADMIN_EMAIL });
    await db.doc(`users/${CORRESPONDENT_UID}`).set({ role: 'correspondent', status: 'active', email: CORRESPONDENT_EMAIL });
    await db.doc(`users/${PRINCIPAL_UID}`).set({ role: 'principal', status: 'active', email: PRINCIPAL_EMAIL });
    await db.doc(`users/${TEACHER_UID}`).set({ role: 'teacher', status: 'active', email: TEACHER_EMAIL });
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
const asCorrespondent = () =>
  testEnv.authenticatedContext(CORRESPONDENT_UID, { email: CORRESPONDENT_EMAIL, email_verified: true }).firestore();
const asPrincipal = () =>
  testEnv.authenticatedContext(PRINCIPAL_UID, { email: PRINCIPAL_EMAIL, email_verified: true }).firestore();
const asTeacher = () =>
  testEnv.authenticatedContext(TEACHER_UID, { email: TEACHER_EMAIL, email_verified: true }).firestore();
/** Anonymous parent session: authenticated, no email on the token. */
const asAnonParent = (uid = PARENT_UID) => testEnv.authenticatedContext(uid).firestore();

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

describeRules('users: self-create', () => {
  it('DENIES anonymous self-create with role principal', async () => {
    const db = asAnonParent('anon-attacker');
    await assertFails(db.doc('users/anon-attacker').set({ role: 'principal', status: 'active' }));
  });

  it('DENIES self-create targeting another uid', async () => {
    const db = asAnonParent('anon-genuine');
    await assertFails(db.doc('users/some-other-uid').set({ role: 'parent', studentId: 'stu-1' }));
  });

  it('ALLOWS self-create with role parent on own uid', async () => {
    const db = asAnonParent('anon-genuine');
    await assertSucceeds(db.doc('users/anon-genuine').set({ role: 'parent', status: 'active', studentId: 'stu-1' }));
  });
});

describeRules('users: self-update pinned fields', () => {
  it('DENIES self-update that changes role', async () => {
    const db = asAnonParent();
    await assertFails(db.doc(`users/${PARENT_UID}`).update({ role: 'admin' }));
  });

  it('DENIES self-update that changes studentId', async () => {
    const db = asAnonParent();
    await assertFails(db.doc(`users/${PARENT_UID}`).update({ studentId: 'stu-999' }));
  });

  it('ALLOWS self-update of non-pinned fields', async () => {
    const db = asAnonParent();
    await assertSucceeds(db.doc(`users/${PARENT_UID}`).update({ displayName: 'Parent Name' }));
  });
});

describeRules('users: staff first-login migration', () => {
  const migrationDoc = (overrides: Record<string, unknown> = {}) => ({
    role: 'teacher',
    status: 'active',
    email: NEW_STAFF_EMAIL,
    migratedFrom: PENDING_DOC_ID,
    ...overrides,
  });
  const asNewStaff = (tokenOverrides: Record<string, unknown> = {}) =>
    testEnv
      .authenticatedContext(NEW_STAFF_UID, {
        email: NEW_STAFF_EMAIL,
        email_verified: true,
        ...tokenOverrides,
      })
      .firestore();

  it('DENIES migration pointing at an ACTIVE (already-migrated) doc', async () => {
    await seedDocs({
      [`users/${PENDING_DOC_ID}`]: { role: 'teacher', status: 'active', email: NEW_STAFF_EMAIL },
    });
    await assertFails(asNewStaff().doc(`users/${NEW_STAFF_UID}`).set(migrationDoc()));
  });

  it('DENIES migration when the pending doc email does not match the token email', async () => {
    await seedDocs({
      [`users/${PENDING_DOC_ID}`]: { role: 'teacher', status: 'pending', email: 'someone.else@school.test' },
    });
    await assertFails(asNewStaff().doc(`users/${NEW_STAFF_UID}`).set(migrationDoc()));
  });

  it('DENIES migration via a non-pending doc', async () => {
    await seedDocs({
      [`users/${PENDING_DOC_ID}`]: { role: 'teacher', status: 'archived', email: NEW_STAFF_EMAIL },
    });
    await assertFails(asNewStaff().doc(`users/${NEW_STAFF_UID}`).set(migrationDoc()));
  });

  it('DENIES migration when the token email is unverified', async () => {
    await seedDocs({
      [`users/${PENDING_DOC_ID}`]: { role: 'teacher', status: 'pending', email: NEW_STAFF_EMAIL },
    });
    await assertFails(
      asNewStaff({ email_verified: false }).doc(`users/${NEW_STAFF_UID}`).set(migrationDoc())
    );
  });

  it('DENIES migration that upgrades the role in transit', async () => {
    await seedDocs({
      [`users/${PENDING_DOC_ID}`]: { role: 'teacher', status: 'pending', email: NEW_STAFF_EMAIL },
    });
    await assertFails(
      asNewStaff().doc(`users/${NEW_STAFF_UID}`).set(migrationDoc({ role: 'principal' }))
    );
  });

  it('ALLOWS the valid migration batch (create uid doc + delete pending doc)', async () => {
    await seedDocs({
      [`users/${PENDING_DOC_ID}`]: { role: 'teacher', status: 'pending', email: NEW_STAFF_EMAIL },
    });
    const db = asNewStaff();
    const batch = db.batch();
    batch.set(db.doc(`users/${NEW_STAFF_UID}`), migrationDoc());
    batch.delete(db.doc(`users/${PENDING_DOC_ID}`));
    await assertSucceeds(batch.commit());
  });

  it('DENIES pending-doc self-delete when the email does not match', async () => {
    await seedDocs({
      [`users/${PENDING_DOC_ID}`]: { role: 'teacher', status: 'pending', email: 'someone.else@school.test' },
    });
    await assertFails(asNewStaff().doc(`users/${PENDING_DOC_ID}`).delete());
  });
});

describeRules('users: management of other users', () => {
  it('ALLOWS admin to update another user doc', async () => {
    await assertSucceeds(asAdmin().doc(`users/${TEACHER_UID}`).update({ displayName: 'Renamed' }));
  });

  it('DENIES principal updating another user doc', async () => {
    await assertFails(asPrincipal().doc(`users/${TEACHER_UID}`).update({ displayName: 'Renamed' }));
  });
});

describeRules('feePayments', () => {
  const payment = {
    studentId: 'stu-1',
    amount: 1000,
    category: 'Term 1',
    paymentMode: 'cash',
    dateKey: '2026-08-10',
  };

  it('DENIES teacher creating a feePayment', async () => {
    await assertFails(asTeacher().doc('feePayments/pay-t1').set(payment));
  });

  it('DENIES parent creating a feePayment', async () => {
    await assertFails(asAnonParent().doc('feePayments/pay-p1').set(payment));
  });

  it('DENIES admin creating a feePayment', async () => {
    await assertFails(asAdmin().doc('feePayments/pay-a1').set(payment));
  });

  it('DENIES correspondent creating a feePayment', async () => {
    await assertFails(asCorrespondent().doc('feePayments/pay-c1').set(payment));
  });

  it('ALLOWS principal creating a feePayment', async () => {
    await assertSucceeds(asPrincipal().doc('feePayments/pay-1').set(payment));
  });

  it('ALLOWS principal updating a feePayment (incl. soft delete)', async () => {
    await seedDocs({ 'feePayments/pay-1': payment });
    await assertSucceeds(asPrincipal().doc('feePayments/pay-1').update({ deleted: true }));
  });

  it('ALLOWS teacher reading a feePayment (open reads, client-side scoping)', async () => {
    await seedDocs({ 'feePayments/pay-1': payment });
    await assertSucceeds(asTeacher().doc('feePayments/pay-1').get());
  });

  it('DENIES principal hard-deleting a feePayment', async () => {
    await seedDocs({ 'feePayments/pay-1': payment });
    await assertFails(asPrincipal().doc('feePayments/pay-1').delete());
  });

  it('DENIES admin hard-deleting a feePayment', async () => {
    await seedDocs({ 'feePayments/pay-1': payment });
    await assertFails(asAdmin().doc('feePayments/pay-1').delete());
  });
});

describeRules('feePayments history (write-once audit trail)', () => {
  const historyEntry = {
    action: 'edit',
    actor: PRINCIPAL_UID,
    before: { amount: 1000 },
    at: '2026-08-10T10:00:00+05:30',
  };

  it('ALLOWS principal creating a history entry', async () => {
    await assertSucceeds(asPrincipal().doc('feePayments/pay-1/history/h1').set(historyEntry));
  });

  it('DENIES principal updating a history entry', async () => {
    await seedDocs({ 'feePayments/pay-1/history/h1': historyEntry });
    await assertFails(asPrincipal().doc('feePayments/pay-1/history/h1').update({ action: 'tampered' }));
  });

  it('DENIES principal deleting a history entry', async () => {
    await seedDocs({ 'feePayments/pay-1/history/h1': historyEntry });
    await assertFails(asPrincipal().doc('feePayments/pay-1/history/h1').delete());
  });

  it('DENIES teacher reading a history entry', async () => {
    await seedDocs({ 'feePayments/pay-1/history/h1': historyEntry });
    await assertFails(asTeacher().doc('feePayments/pay-1/history/h1').get());
  });

  it('ALLOWS principal reading a history entry (guards the explicit read rule)', async () => {
    await seedDocs({ 'feePayments/pay-1/history/h1': historyEntry });
    await assertSucceeds(asPrincipal().doc('feePayments/pay-1/history/h1').get());
  });

  it('DENIES anonymous parent reading a history entry', async () => {
    await seedDocs({ 'feePayments/pay-1/history/h1': historyEntry });
    await assertFails(asAnonParent().doc('feePayments/pay-1/history/h1').get());
  });
});

describeRules('expenses', () => {
  const expense = {
    description: 'Chalk boxes',
    amount: 250,
    paymentMode: 'cash',
    dateKey: '2026-08-10',
  };

  it('DENIES teacher writing an expense', async () => {
    await assertFails(asTeacher().doc('expenses/exp-t1').set(expense));
  });

  it('ALLOWS principal writing an expense', async () => {
    await assertSucceeds(asPrincipal().doc('expenses/exp-1').set(expense));
  });

  it('DENIES principal hard-deleting an expense (soft delete only)', async () => {
    await seedDocs({ 'expenses/exp-1': expense });
    await assertFails(asPrincipal().doc('expenses/exp-1').delete());
  });

  it('DENIES teacher reading an expense', async () => {
    await seedDocs({ 'expenses/exp-1': expense });
    await assertFails(asTeacher().doc('expenses/exp-1').get());
  });

  it('ALLOWS principal creating an expense history entry, DENIES its update', async () => {
    await assertSucceeds(
      asPrincipal().doc('expenses/exp-1/history/h1').set({ action: 'edit', actor: PRINCIPAL_UID })
    );
    await assertFails(asPrincipal().doc('expenses/exp-1/history/h1').update({ action: 'tampered' }));
  });
});

describeRules('accounts', () => {
  const settings = { openingCash: 5000, openingBank: 20000, openingAsOf: '2026-06-01' };

  it('DENIES teacher reading accounts', async () => {
    await seedDocs({ 'accounts/settings': settings });
    await assertFails(asTeacher().doc('accounts/settings').get());
  });

  it('ALLOWS principal reading accounts', async () => {
    await seedDocs({ 'accounts/settings': settings });
    await assertSucceeds(asPrincipal().doc('accounts/settings').get());
  });

  it('ALLOWS principal writing accounts', async () => {
    await assertSucceeds(asPrincipal().doc('accounts/settings').set(settings));
  });

  it('DENIES admin writing accounts', async () => {
    await assertFails(asAdmin().doc('accounts/settings').set(settings));
  });
});
