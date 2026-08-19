---
status: ACTIVE
supersedes: the DATA MODEL in docs/designs/principal-role-fees-accounts.md
---
# Principal Register — Sharmi's fees note, the two automatic registers, and the money book

The Principal Register is a **standalone module**. It shares no collection, no
document and no capability with the legacy fee module. Everything it needs it
owns; everything the old module owns it ignores.

`docs/designs/principal-role-fees-accounts.md` remains the record of the
house style, the security decisions and the review history that got us here.
Its **data model is superseded by this document** — the plan there rebuilt the
`feePayments` / `feeStructures` / `expenses` module in place; this one replaces
it with five new collections and leaves the old ones frozen on disk.

---

## 1. Why it exists

Sharmi, the principal, runs the school's fees out of a paper notebook. From her
recorded call, the four requirements that shaped this module:

> *"…registered automatically in the extra two registers."*

She types a student's fees into ONE note. The same row must appear, without her
doing anything else, in a **class-wise register** and in the **responsible
teacher's register**. Not copied — the same row, seen three ways.

> ECA is written **"in 10 months."**

Three heads only: **School fees**, **ECA fees**, **Van fees**. The ECA amount is
an annual figure written across ten months, June → March.

> **In August only June and July count as due — never the whole year.**

This is her complaint about every system she has been shown. A month becomes
due only **after it has ended**. Standing in August, the arrears figure is
June + July. September, October and the rest are *upcoming*, not owed.

> Daily income versus expense, with **Cash in Hand** and **Bank Balance**,
> tallied — plus a monthly sheet.

Not a fee report: a cash book. What came in, what went out, what is in the box
and what is in the bank, for a day and for a month.

**Why standalone, and not a fix to the old module.** The legacy fee module
carries structures, scholarships, bus routes, previous balances, term due dates
and six divergent copies of the money math. Sharmi's note carries three numbers
per child. Bending one into the other would have left her fees entangled with
data she never enters and cannot check. Isolation is the feature: if the old
module is wrong, this register is still right.

---

## 2. The sections

| Page key | Title | Who | What it is |
|---|---|---|---|
| `principal-note` | Fees Note | Principal | The paper note. One row per student; the only screen that adds students and the primary place fee amounts are typed. |
| `principal-classes` | Class-wise Register | Principal | The same rows grouped by class, with per-class totals. Records payments; does not edit amounts. |
| `principal-teachers` | Teacher-wise Register | Principal / Teacher | Principal: hand students to teachers. Teacher: the rows assigned to me — editable fee amounts, recordable payments, nothing else. |
| `principal-accounts` | Income & Expense | Principal | Daily and monthly cash book. Opening balances, expenses, exports. |
| `principal-activity` | Activity Log | Principal | Every mutation in the module, newest first, with actor and before → after. |

Parents see the register read-only through their existing **Fee Details**
screen (`src/components/layout/parent/ParentFees.tsx`), rewired onto these
collections.

**The "automatic" part, mechanically.** There is no sync engine and no copy
step. `principalRegister` holds one row per student. The class-wise screen
groups those rows by `className`; the teacher-wise screen filters them by
`teacherUid`. Class-wise and teacher-wise are *queries*, not registers that
have to be kept in step — which is why they can never disagree with the note.

---

## 3. Data model

Five collections, all new, all isolated. Source of truth for the shapes:
`src/types/principal.ts`.

```
principalRegister/{rowId}      the fees note — one row per student
principalPayments/{paymentId}  money received against a row
principalExpenses/{expenseId}  money spent
principalAudit/{entryId}       write-once activity log
principalSettings/main         opening balances + per-year defaults
```

Nothing in this module reads or writes `feePayments`, `feeStructures` or
`expenses`.

### RegisterRow

```ts
{ id, academicYear, name, className, sectionName?, rollNo?,
  teacherUid?: string | null, teacherName?: string | null,
  schoolFee: number,                       // annual, due immediately
  ecaAnnual: number, ecaMonths: string[],  // annual sliced across these months
  vanMonthly: number, vanMonths: string[], // per-month charge on these months
  isScholarship?: boolean, notes?: string,
  deleted?: boolean, createdAt, updatedAt }
```

### PrincipalPayment

```ts
{ id, academicYear, rowId, studentName, className,      // name/class denormalized
  head: 'school' | 'eca' | 'van' | 'other',
  month?: string,                                        // required for eca/van
  amount: number,
  dateKey: string,        // 'yyyy-MM-dd' LOCAL — the one key every ledger buckets on
  paidAt: Date, mode: 'cash' | 'bank',
  enteredByUid, enteredByName, enteredByRole,
  remarks?, deleted?, createdAt }
```

### PrincipalExpense

```ts
{ id, academicYear, amount, category, description?,
  dateKey, mode: 'cash' | 'bank',
  enteredByUid, enteredByName, deleted?, createdAt }
```

### PrincipalAuditEntry (write-once)

```ts
{ id, at, actorUid, actorName, actorRole,
  action: 'create' | 'update' | 'delete',
  target: 'register' | 'payment' | 'expense' | 'settings',
  targetId, studentName?, summary: string,
  before?: Record<string, unknown>, after?: Record<string, unknown> }
```

### PrincipalSettings (`principalSettings/main`)

```ts
{ academicYear, openingCash, openingBank,
  openingAsOf: string,        // 'yyyy-MM-dd' — transactions ON/AFTER this move balances
  defaultEcaMonths: string[], defaultVanMonths: string[],
  expenseCategories: string[] }
```

**Months** are the capitalized ten, `'June' … 'March'`, from
`ACADEMIC_MONTHS` in `src/lib/fee-utils.ts`. Month ordering, month start dates,
academic-year start year, `toDateKey` and `coerceDate` are **imported** from
`fee-utils`; that math is never re-implemented in this module.

---

## 4. The engine — `src/lib/principal-fees.ts`

Pure functions. No Firestore imports, no mutation of inputs, no React. Screens
never compute money inline; every rupee on every screen comes from here.

### `computeRowSummary(row, payments, today)`

Returns `{ school, eca, van, other, totalCharged, totalPaid, totalPending, totalDueNow }`,
where `eca` and `van` each carry `months: MonthCell[]` plus `charged / paid /
pending / dueNow`, and a `MonthCell` is `{ month, amount, paid, pending, isDue }`.

**The arrears rule — Sharmi's August example.** A month falls due on the **1st
of the following month**:

```ts
isDue  ⇔  todayKey >= toDateKey(first day of the month AFTER this one)
```

Standing on **12 August**, for a student with ECA ₹5,000 across ten months
(₹500/month):

| Month | amount | isDue | counted in `dueNow`? |
|---|---|---|---|
| June | 500 | ✔ ended 30 Jun | **yes** |
| July | 500 | ✔ ended 31 Jul | **yes** |
| August | 500 | ✘ still running | no |
| September … March | 500 each | ✘ | no |

`eca.dueNow` = **₹1,000**, not ₹5,000. `eca.pending` is still ₹5,000 — the
*balance* for the year — and the two numbers are shown as different things:
**Balance** (what the year costs, unpaid) and **Due Now** (what she can chase
today). The school fee is due immediately, so its whole `pending` is arrears
from day one.

### Month amounts

- **ECA** — a **largest-remainder split** of `ecaAnnual` across `ecaMonths`:
  every month gets `floor(annual / count)`, and the first `remainder` months in
  academic order take one extra rupee. The slices sum **exactly** to the annual
  and can never overshoot it (₹5 across 10 months → five ₹1 months and five ₹0
  months, never ₹0.50 each).
- **Van** — `vanMonthly` on each month in `vanMonths`. No split; a van month
  costs what a van month costs.
- Month lists are de-duplicated and sorted into academic order before use — a
  repeated month would double-charge van and skew the ECA split.
- **Defaults differ on purpose.** ECA falls back to all ten months ("ECA is in
  10 months"). Van falls back to **no months**: only children who actually ride
  the van carry van months, so a default would invent a charge for everyone.
  The screens compensate — `monthsForAmount` attaches a schedule the moment a
  van amount is typed onto a row with no months, so "van ₹500" never silently
  charges nothing.

### Payment matching

- Payments match by `head`, and for `eca` / `van` also by `month`.
- Money a month cell cannot absorb — untagged, tagged to a month outside this
  row's schedule, or paid over a month's amount — is **surplus**. It fills no
  cell but still knocks down that head's `dueNow`, so a lump payment or an
  advance never reads as arrears.
- `head: 'other'` reduces `totalPaid`, `totalPending` and `totalDueNow` and
  belongs to no bucket. An unrecognised head is treated as `other`, so no money
  is ever lost from the totals.
- Soft-deleted payments are excluded everywhere.

### `computeClassSummary(rows, paymentsByRowId, today)`

Per-class `{ className, students, charged, paid, pending, dueNow }`, sorted
numeric-aware so *Class 2* precedes *Class 10*. Soft-deleted rows are dropped;
rows with no class collect under **Unassigned**.

### `computeDailyLedger` / `computeMonthlyLedger`

Both bucket every live transaction onto its local `dateKey` and split it by
channel — anything whose `mode` is not exactly `'bank'` is **cash**, which
matches the paper book.

- Daily → the day's `incomeCash/Bank`, `expenseCash/Bank`, `income`, `expense`,
  `net`, plus **Cash in Hand** and **Bank Balance** at the *close* of that day.
- Monthly → the same aggregates for a `'yyyy-MM'` month, the closing balances at
  month end, and one row per day that saw activity, each carrying its own
  running closing balance.
- **Balances count only transactions on or after `settings.openingAsOf`.**
  Anything dated earlier is already baked into the opening figures; counting it
  again would double-book. The Accounts screen shows an explicit note when
  transactions were excluded for this reason.

---

## 5. Service — `src/lib/principal-service.ts`

The **only** writer. Screens never call Firestore for these collections.

- **Every mutation writes its `principalAudit` entry in the same `writeBatch`
  as the change.** A change cannot exist without its trail; if the audit write
  would be denied, the whole mutation fails.
- **Deletes are soft** (`deleted: true`) for rows, payments and expenses. Hard
  deletes are denied by rules — the log is permanent.
- **Attribution comes from the session, not the caller.** `enteredByUid` and
  `actorUid` are read from `auth.currentUser`, and `at` is `serverTimestamp()`.
  Rules pin both to `request.auth.uid` / `request.time`, so a screen cannot
  stamp a teacher's receipt "entered by the Principal", and a forged future
  `at` cannot bury genuine entries below it in the log's window.
- **Error policy** (shared with the legacy module's
  `admin/fees/error-policy.ts`): `permission-denied` → a role-specific sentence
  plus a "refresh the app" hint; `unavailable` → *"Connection lost — NOT saved,
  retry"*, refused **before** the write so an offline batch cannot queue
  silently and read as saved. Nothing is caught silently. A refetch that fails
  *after* a committed write says the save succeeded and the refresh did not —
  never "not saved".
- Reads exclude soft-deleted docs and sort **in memory**, so no composite index
  is needed beyond the single-field ones Firestore creates itself.

Exports: `PrincipalRegisterService` (`listRows`, `createRow`, `updateRow`,
`softDeleteRow`, `assignTeacher`), `PrincipalPaymentsService` (`listByYear`,
`listByRow`, `create`, `update`, `softDelete`), `PrincipalExpensesService`,
`PrincipalSettingsService` (`get`, `save`), `PrincipalAuditService`
(`listRecent`, `listForTarget`). Every mutation takes
`actor = { uid, name, role }`.

---

## 6. Permissions

Capabilities live in `src/lib/permissions.ts` and gate the UI only. The
enforcement surface is `firestore.rules`.

| Capability | Principal | Teacher / Staff | Admin / Correspondent | Parent |
|---|:--:|:--:|:--:|:--:|
| `viewPrincipalRegister` | ✔ | ✔ | — | — |
| `editPrincipalRegister` | ✔ | — | — | — |
| `editOwnStudentFees` | — | ✔ | — | — |
| `recordPrincipalPayments` | ✔ | ✔ | — | — |
| `viewPrincipalAccounts` | ✔ | — | — | — |
| `manageTeacherAssignment` | ✔ | — | — | — |

Admin and correspondent hold **none** of these: the whole PRINCIPAL REGISTER
nav section disappears for them. Parents hold no capability at all — their
access is a read on their own child's row through `ParentFees`.

### What a teacher may actually do

A teacher's window is the rows where `teacherUid == their auth uid`. On those
rows they may:

- **edit fee amounts** — `schoolFee`, `ecaAnnual`, `ecaMonths`, `vanMonthly`,
  `vanMonths`, `isScholarship`, `notes` (Sharmi wanted the class teacher, who
  actually knows the child, able to correct a figure);
- **record a payment** — money they collected, attributed to themselves.

They may **not** rename a student, change a class, reassign themselves, delete
a row, edit or delete any payment (including their own), see another teacher's
students, or open Accounts or the Activity Log.

**Every teacher action is audited**, and `TeacherOwnRegister` says so on screen
as a permanent notice rather than a one-time toast: *"Your changes are recorded
in the school's activity log."* That notice is what makes the write access
safe — the Principal can see, on `principal-activity`, exactly who changed what
and from what to what.

---

## 7. Security rules summary

Full text: `firestore.rules`. Tests: `tests/rules/principal-rules.test.ts`.

`principalUserRole()` reads `users/{uid}.role` defensively and returns `''`
when the caller has no user doc — so **every rule tests a role, never mere
authentication**. That matters because the parent login signs in anonymously
before it matches a login code, and anyone holding the public web config can do
the same.

| Collection | read | create | update | delete |
|---|---|---|---|---|
| `principalRegister` | principal, teacher, staff, parent | principal | principal, **or** owning teacher limited to the fee fields | denied |
| `principalPayments` | principal, teacher, staff, parent | principal, **or** owning teacher — both subject to `pinnedNewPayment()` | principal | denied |
| `principalExpenses` | **principal only** | principal | principal | denied |
| `principalAudit` | **principal only** | principal or teacher, **as themselves** | denied | denied |
| `principalSettings` | principal, teacher, staff, parent | principal | principal | denied |

- `touchesOnlyTeacherFeeFields()` — a teacher's update may affect only
  `schoolFee`, `ecaAnnual`, `ecaMonths`, `vanMonthly`, `vanMonths`,
  `isScholarship`, `notes`, `updatedAt`. Identity, assignment, `academicYear`
  and `deleted` stay principal-only, so an identity change cannot be smuggled
  alongside a fee change.
- `pinnedNewPayment()` — `enteredByUid == request.auth.uid`,
  `deleted == false`, `amount is number && > 0`, `head` and `mode` in their
  closed vocabularies, `createdAt == request.time`, `rowId` must exist, and
  `academicYear` is forced to the referenced row's own year.
- Audit creates pin `actorUid` to the signed-in uid, `actorRole` to the role the
  user doc actually records, and `at` to `request.time`.
- **No hard deletes anywhere.** Soft delete is an update setting `deleted:true`,
  which keeps the audit trail and every payment that references a row intact.

**Accepted residual risk (documented, not hidden).** A signed-in parent can read
the whole `principalRegister` collection; their view of "my child's row" is
matched **client-side** by name + class in `ParentFees.findRowForChild`, with a
name-only fallback accepted only when it is unique. No `studentId` links a row
to a family. Closing this needs `studentId` on `RegisterRow` plus a
`studentId`-constrained parent query — a data migration, not a rule edit. It is
on the open-items list below.

---

## 8. Responsive contract

Sharmi uses both a phone and a PC. Breakpoint: **900px**
(`MOBILE_BREAKPOINT` in `principal/principal-shared.ts`).

**Desktop (≥ 900px)** — full data grid; the student-name column is frozen so a
row never loses its subject; the three fee columns edit in place; **Enter** and
**Tab** commit and move to the next editable cell, **Shift+Tab** moves back,
**Esc** cancels, blur commits.

**Mobile (< 900px)** — no spreadsheet. One card per student (name, class,
balance summary); tapping a card opens an edit sheet with the same fields
stacked; the month drawer becomes a vertical month list. Wide tables in
Accounts become a card per record.

Same rows, same service calls, two presentations. **A phone must never
horizontally scroll a ten-column table.**

---

## 9. Seeding

`scripts/seed-principal-register.mjs` — run **once**, by the Principal's login,
at cutover. It copies each live student for the year into `principalRegister`
with name, normalized class (the live data holds `'Class  2'` with a double
space and `'LKG '` with a trailing space), roll number if present, no teacher,
and **every fee amount at zero**.

It is a dry run by default and requires `--commit` to write. It is idempotent:
a student with a non-deleted row for the same name + class is skipped, so it
can be re-run after a partial failure or after new admissions. It writes
`principalRegister` and `principalAudit` (one create entry per row, in the same
batch) and touches nothing else.

---

## 10. Open items

1. **Sharmi must enter the fees.** Every seeded row is ₹0. The register shows
   nothing owed until she types School / ECA / Van amounts — by design, because
   inventing amounts would be worse than showing none. Until she does, parents
   see a published row with zero charges.
2. **Van routes are not modelled.** Van is a flat `vanMonthly` per student. No
   route table, no per-route rate, no rider list. If she wants routes, that is
   a `vanRouteId` on the row plus a route collection — deliberately deferred.
3. **Opening balances must be set before Accounts means anything.** Until
   `principalSettings/main` carries `openingCash`, `openingBank` and
   `openingAsOf`, Cash in Hand and Bank Balance start from zero and read as
   wrong. This is the first thing to do on the Accounts screen.
4. **Parent ↔ row link is by name + class.** See the residual risk in §7. Add
   `studentId` to `RegisterRow` and constrain the parent query.
5. **Teacher assignment needs a linked login.** `teacherUid` must be the
   teacher's **auth uid**, because rules compare it to `request.auth.uid`. A
   teacher record with no login cannot be assigned; the assign panel lists them
   disabled with the reason shown.
6. **Exports are Accounts-only.** Daily and monthly balance sheets export to
   Excel and PDF. The note and the class-wise / teacher-wise registers have no
   export yet.
7. **Duplicate name + class** in the same year cannot be distinguished by the
   register or by the parent matcher. The seed script reports them; they need a
   distinguishing detail (section or roll number) added by hand.

---

## File map

```
src/types/principal.ts                       doc shapes + engine I/O types
src/lib/principal-fees.ts                    the engine (pure)
src/lib/principal-service.ts                 the only writer
src/lib/permissions.ts                       capability map
firestore.rules                              enforcement
src/components/layout/principal/
  note/                                      Fees Note (grid, cards, month drawer,
                                             payment dialog, add/edit sheets)
  registers/                                 class-wise + teacher-wise
  accounts/                                  daily + monthly cash book
  activity/                                  audit log + per-record trail modal
  principal-shared.ts                        breakpoint, formatting, error text
src/components/layout/parent/ParentFees.tsx  read-only parent view
scripts/seed-principal-register.mjs          one-time seed
tests/principal-fees.test.ts                 engine
tests/principal-note-helpers.test.ts         note presentation helpers
tests/rules/principal-rules.test.ts          rules
docs/qa-checklist.md                         per-role manual QA
```
