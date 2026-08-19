/* ============================================
   CampusOS — one-time seed: students → principalRegister
   ============================================
   WHAT THIS DOES
   Copies the students already in `students` for the current academic year into
   `principalRegister`, one row per student, with every fee amount at ZERO.
   It gives Sharmi a fees note that already holds every child's name and class,
   so her first job is typing amounts instead of typing 200 names.

   WHEN IT RUNS
   ONCE, at cutover, before she opens the Fees Note for the first time. After
   that, students are added through the app's "Add student" dialog — the app is
   the normal path; this script is only the bootstrap.

   WHO RUNS IT
   The PRINCIPAL's own login. firestore.rules allows `principalRegister` and
   `principalAudit` writes only to a signed-in user whose `users/{uid}.role`
   is 'principal', so no other account can complete this run, and the audit
   entries are attributed to her — the same as if she had typed the rows.

   WHAT IT TOUCHES
   Reads : school/main (academic year), students, principalRegister (existing
           rows), users/{uid} (the actor's role + name)
   Writes: principalRegister — one row per new student
           principalAudit    — one 'create' entry per row, in the SAME batch
   Nothing else. It never reads or writes feePayments / feeStructures /
   expenses / principalPayments / principalExpenses / principalSettings.

   The audit entries are not optional noise: the module's rule is that no row
   may exist without a trail explaining where it came from. Expect the activity
   log's first page to be this seed — that is the correct record of what
   happened, and the log's date filter moves past it.

   USAGE
     # 1. dry run (the default — writes NOTHING, prints exactly what it would do)
     PRINCIPAL_EMAIL=principal@school PRINCIPAL_PASSWORD=... \
       node scripts/seed-principal-register.mjs

     # 2. read the summary, then commit
     PRINCIPAL_EMAIL=principal@school PRINCIPAL_PASSWORD=... \
       node scripts/seed-principal-register.mjs --commit

     # optional: seed a specific year instead of school/main's current one
     node scripts/seed-principal-register.mjs --year=2026-2027 --commit

   Keep the password out of your shell history: on bash, prefix the command
   with a space, or `read -s PRINCIPAL_PASSWORD && export PRINCIPAL_PASSWORD`.

   RE-RUNNING IS SAFE
   The script is idempotent. A student is skipped when a NON-DELETED register
   row already exists for the same name + class (both compared with whitespace
   collapsed and case ignored, because the live data holds 'Class  2' with a
   double space and 'LKG ' with a trailing space). So:
     - re-run after a partial failure → only the missing rows are created;
     - re-run after new admissions    → only the new children are created;
     - a row Sharmi soft-deleted      → treated as absent and re-created, which
       is the honest reading of "she removed it and the child is still enrolled";
       archive the student record instead if the child has actually left.

   Requires Node 20+ (the Firebase Web SDK's node build uses global fetch).
*/

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  collection, doc, getDoc, getDocs, getFirestore, query, serverTimestamp, where, writeBatch,
} from 'firebase/firestore';

/* ── Config (identical to src/lib/firebase.ts) ────────────────────────── */

const firebaseConfig = {
  apiKey: 'AIzaSyAL9J9BiJvPkM4zKB1yi-mIliZC0ngpfw0',
  authDomain: 'maruti-management.firebaseapp.com',
  projectId: 'maruti-management',
  storageBucket: 'maruti-management.firebasestorage.app',
  messagingSenderId: '975109116662',
  appId: '1:975109116662:web:6d70fadd33e767f10a92d7',
};

/* ── Constants ────────────────────────────────────────────────────────── */

/** June → March. The ten months the register runs on (src/lib/fee-utils.ts). */
const ACADEMIC_MONTHS = [
  'June', 'July', 'August', 'September', 'October',
  'November', 'December', 'January', 'February', 'March',
];

/** 200 rows x 2 writes (row + audit) = 400 ops, under Firestore's 500 cap. */
const ROWS_PER_BATCH = 200;

/** How many planned rows the dry run prints in full before it truncates. */
const SAMPLE_SIZE = 10;

/* ── CLI ──────────────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const flagValue = (name) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : '';
};

const COMMIT = hasFlag('commit');
const YEAR_OVERRIDE = flagValue('year').trim();

const log = (...parts) => console.log(...parts);
const warn = (...parts) => console.warn(...parts);

function die(message) {
  console.error(`\n[x] ${message}\n`);
  process.exit(1);
}

/* ── Normalization ────────────────────────────────────────────────────── */

/** Collapses runs of whitespace and trims. 'Class  2' → 'Class 2', 'LKG ' → 'LKG'. */
const tidy = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

/** The idempotency key. Case-insensitive, so 'Ravi K' never doubles as 'RAVI K'. */
const rowKey = (name, className) => `${tidy(name).toLowerCase()}|${tidy(className).toLowerCase()}`;

/** Roll number, if the student record carries one under either spelling. */
const rollOf = (student) => tidy(student.rollNo ?? student.rollNumber ?? '');

/* ── Firestore reads ──────────────────────────────────────────────────── */

async function readAcademicYear(db) {
  if (YEAR_OVERRIDE) return YEAR_OVERRIDE;
  const snap = await getDoc(doc(db, 'school', 'main'));
  if (!snap.exists()) die('school/main does not exist — pass --year=YYYY-YYYY explicitly.');
  const year = tidy(snap.data().academicYear);
  if (!year) die('school/main has no academicYear — pass --year=YYYY-YYYY explicitly.');
  return year;
}

async function readActor(db, uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) {
    die(`No users/${uid} document — this login carries no role, so every write would be denied.`);
  }
  const data = snap.data();
  const role = tidy(data.role);
  if (role !== 'principal') {
    die(`This login has role '${role || '(none)'}'. Only the principal may seed the register `
      + '(firestore.rules: principalRegister create is isPrincipal()).');
  }
  return { uid, role, name: tidy(data.name) || tidy(data.email) || 'Principal' };
}

async function readCollection(db, name, year) {
  const snap = await getDocs(query(collection(db, name), where('academicYear', '==', year)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ── Planning (pure) ──────────────────────────────────────────────────── */

/**
 * Decides, without writing anything, which students need a register row.
 * Returns the rows to create plus every reason a student was left out, so the
 * dry run reads as a decision rather than as a number.
 */
function planSeed(students, existingRows, year) {
  const taken = new Set(
    existingRows
      .filter((row) => row.deleted !== true)
      .map((row) => rowKey(row.name, row.className)),
  );

  const create = [];
  const skippedExisting = [];
  const skippedArchived = [];
  const skippedDuplicate = [];
  const missingClass = [];
  const unusable = [];

  for (const student of students) {
    const name = tidy(student.name);
    const className = tidy(student.className);

    if (!name) { unusable.push(student.id); continue; }
    if (tidy(student.status).toLowerCase() === 'archived') { skippedArchived.push(name); continue; }

    const key = rowKey(name, className);
    if (taken.has(key)) { skippedExisting.push(`${name} — ${className || 'no class'}`); continue; }

    // Two live students with the same name in the same class: the register
    // keys on name + class and the parent view matches on it, so a second row
    // would be unattributable. Seed one, report the other for a manual add.
    if (create.some((row) => rowKey(row.name, row.className) === key)) {
      skippedDuplicate.push(`${name} — ${className || 'no class'}`);
      continue;
    }

    if (!className) missingClass.push(name);

    const roll = rollOf(student);
    const section = tidy(student.sectionName);
    create.push({
      academicYear: year,
      name,
      className,
      ...(section ? { sectionName: section } : {}),
      ...(roll ? { rollNo: roll } : {}),
      teacherUid: null,
      teacherName: null,
      schoolFee: 0,
      ecaAnnual: 0,
      ecaMonths: [...ACADEMIC_MONTHS],
      vanMonthly: 0,
      vanMonths: [...ACADEMIC_MONTHS],
      deleted: false,
    });
  }

  create.sort((a, b) =>
    a.className.localeCompare(b.className, undefined, { numeric: true, sensitivity: 'base' })
    || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  return { create, skippedExisting, skippedArchived, skippedDuplicate, missingClass, unusable };
}

/* ── Reporting ────────────────────────────────────────────────────────── */

function countByClass(rows) {
  const counts = new Map();
  for (const row of rows) {
    const key = row.className || '(no class)';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }));
}

function printPlan(plan, context) {
  const { year, studentCount, existingCount } = context;
  const line = '-'.repeat(64);

  log('');
  log(line);
  log(`  Academic year          ${year}`);
  log(`  Students read          ${studentCount}`);
  log(`  Register rows now      ${existingCount}`);
  log(line);
  log(`  TO CREATE              ${plan.create.length}`);
  log(`  Already in register    ${plan.skippedExisting.length}`);
  log(`  Archived students      ${plan.skippedArchived.length}`);
  log(`  Duplicate name+class   ${plan.skippedDuplicate.length}`);
  log(`  Unusable (no name)     ${plan.unusable.length}`);
  log(line);

  if (plan.create.length > 0) {
    log('\n  New rows by class:');
    for (const [className, count] of countByClass(plan.create)) {
      log(`    ${className.padEnd(24)} ${String(count).padStart(4)}`);
    }
    log(`\n  First ${Math.min(SAMPLE_SIZE, plan.create.length)} rows:`);
    for (const row of plan.create.slice(0, SAMPLE_SIZE)) {
      const roll = row.rollNo ? ` · roll ${row.rollNo}` : '';
      log(`    ${row.name} — ${row.className || '(no class)'}${roll} · all fees 0`);
    }
    if (plan.create.length > SAMPLE_SIZE) {
      log(`    … and ${plan.create.length - SAMPLE_SIZE} more`);
    }
  }

  if (plan.missingClass.length > 0) {
    warn(`\n  ! ${plan.missingClass.length} student(s) have NO class on their student record.`);
    warn('    Their rows land under "Unassigned" in the class-wise register until the');
    warn(`    Principal sets a class: ${plan.missingClass.slice(0, 8).join(', ')}`
      + (plan.missingClass.length > 8 ? ', …' : ''));
  }
  if (plan.skippedDuplicate.length > 0) {
    warn(`\n  ! ${plan.skippedDuplicate.length} duplicate name+class skipped — add them by hand`);
    warn(`    with a distinguishing detail: ${plan.skippedDuplicate.join(', ')}`);
  }
  if (plan.unusable.length > 0) {
    warn(`\n  ! ${plan.unusable.length} student doc(s) have no name and were skipped: `
      + plan.unusable.slice(0, 8).join(', '));
  }
  log('');
}

/* ── Writing ──────────────────────────────────────────────────────────── */

const auditSummary = (row) =>
  `Seeded ${row.name} (${row.className || 'no class'}) into the fees note from the student register`;

/**
 * Commits the plan in chunks. Each row and its audit entry go in the SAME
 * batch, so a row can never land without its trail. A chunk that fails stops
 * the run and reports how many rows are already saved — re-running picks up
 * exactly where it stopped, because the skip test is against what is in the
 * register, not against a checkpoint file.
 */
async function commitPlan(db, rows, actor) {
  let written = 0;

  for (let start = 0; start < rows.length; start += ROWS_PER_BATCH) {
    const chunk = rows.slice(start, start + ROWS_PER_BATCH);
    const batch = writeBatch(db);

    for (const row of chunk) {
      const rowRef = doc(collection(db, 'principalRegister'));
      batch.set(rowRef, { ...row, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

      // firestore.rules pins actorUid to the signed-in uid, actorRole to the
      // role users/{uid} records, and `at` to the SERVER's clock.
      batch.set(doc(collection(db, 'principalAudit')), {
        at: serverTimestamp(),
        actorUid: actor.uid,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'create',
        target: 'register',
        targetId: rowRef.id,
        studentName: row.name,
        summary: auditSummary(row),
        before: null,
        after: { ...row },
      });
    }

    try {
      await batch.commit();
    } catch (error) {
      console.error(error);
      die(`Batch failed after ${written} row(s) were saved. Those rows are committed and will `
        + 'be skipped on the next run — fix the error above and run --commit again.');
    }

    written += chunk.length;
    log(`  committed ${written}/${rows.length}`);
  }

  return written;
}

/* ── Main ─────────────────────────────────────────────────────────────── */

async function main() {
  const email = process.env.PRINCIPAL_EMAIL || '';
  const password = process.env.PRINCIPAL_PASSWORD || '';
  if (!email || !password) {
    die('Set PRINCIPAL_EMAIL and PRINCIPAL_PASSWORD (the Principal\'s app login) and re-run.\n'
      + '  See the usage block at the top of this file.');
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  log(`\nSigning in as ${email} …`);
  let credential;
  try {
    credential = await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    die(`Sign-in failed (${error?.code || 'unknown'}). Check the email and password.`);
  }

  const actor = await readActor(db, credential.user.uid);
  log(`Signed in as ${actor.name} (${actor.role}).`);

  const year = await readAcademicYear(db);
  const [students, existingRows] = await Promise.all([
    readCollection(db, 'students', year),
    readCollection(db, 'principalRegister', year),
  ]);

  const plan = planSeed(students, existingRows, year);
  printPlan(plan, { year, studentCount: students.length, existingCount: existingRows.length });

  if (plan.create.length === 0) {
    log('Nothing to create — the register already covers every live student.\n');
  } else if (!COMMIT) {
    log('DRY RUN — nothing was written.');
    log('Re-run with --commit once the numbers above look right.\n');
  } else {
    log(`Writing ${plan.create.length} row(s) + ${plan.create.length} audit entr(ies) …`);
    const written = await commitPlan(db, plan.create, actor);
    log(`\n[ok] Seeded ${written} row(s) into principalRegister for ${year}.`);
    log('     Open Fees Note as the Principal and start typing amounts.\n');
  }

  await signOut(auth).catch(() => {});
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  die('Seed aborted — see the error above. Re-running is safe: committed rows are skipped.');
});
