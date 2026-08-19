# Manual QA Checklist — Principal Register

Per-role green-flag checklist for the standalone Principal Register
(spec: `docs/designs/principal-register.md`). Run the full pass against the
deployed app, or a `next build` static export served locally, with one real
login per role. Every box must be checked before the release is declared green.

The register shares no data with the legacy fee module. Anything below that
mentions fees means `principalRegister` / `principalPayments` /
`principalExpenses` — never `feePayments` / `feeStructures` / `expenses`.

## Green-flag criteria (all required)

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run lint` — zero errors
- [ ] `npm run build` — static export completes
- [ ] `npm run test` — fee-utils suite green (shared month/date helpers)
- [ ] `npx vitest run tests/principal-fees.test.ts tests/principal-note-helpers.test.ts tests/principal-audit-format.test.ts`
      — engine + helper suites green
- [ ] `npm run test:rules` — rules emulator suite green, including
      `tests/rules/principal-rules.test.ts` (needs a Java runtime; see
      `docs/deploy.md` → "Running the tests")
- [ ] Every checklist item below passed

## Before you start

- [ ] `scripts/seed-principal-register.mjs` has been run (dry run reviewed,
      then `--commit`) — the note holds one row per live student, all amounts ₹0
- [ ] `principalSettings/main` has opening cash, opening bank and `openingAsOf`
      set from the Accounts screen — without them the balances start at zero
- [ ] At least one teacher has an app login AND has students assigned to them
- [ ] One parent login whose child has a register row, and one whose child does
      not (to test the unpublished state)
- [ ] Today's date noted — several checks below depend on which months have ended

---

## 1. Principal

Log in as the `principal` user. The sidebar must show a **PRINCIPAL REGISTER**
section: Fees Note, Class-wise, Teacher-wise, Income & Expense, Activity Log.
The legacy Fee Overview / Fee Structures / Payments / Defaulter Report entries
must be **gone**.

### 1.1 Fees Note (`principal-note`) — the paper note

- [ ] Header shows academic year, student count, and four tiles: Charged,
      Collected, Pending (year), **Due Now**
- [ ] **Add student**: name + class (+ optional section, roll no, notes) saves;
      the row appears in the grid immediately
- [ ] Blank name or a negative amount is rejected inline, not on save
- [ ] The class dropdown is populated from the existing classes collection; a
      class read failure falls back to the classes already in the register (and
      then to free text) rather than blocking the form
- [ ] **Type fees**: click a School / ECA / Van cell, type an amount, press
      **Enter** — it saves and focus moves to the next editable cell
- [ ] **Tab** commits and moves forward; **Shift+Tab** moves back; **Esc**
      cancels and reverts; clicking away (blur) commits
- [ ] Typing an ECA amount on a row with no ECA months attaches the ten default
      months automatically (the amount must never silently charge nothing)
- [ ] Same for a Van amount — typing ₹500 van charges 10 × ₹500, not ₹0
- [ ] Clearing a cell to blank sets it to ₹0 and removes the charge
- [ ] Search matches name, class, section, roll no and teacher name
- [ ] Class filter narrows the grid; the visible count in the header updates

### 1.2 Month drawer — the arrears rule

Use a student with ECA ₹5,000 across all ten months (₹500/month) and no payments.

- [ ] Expanding the row shows ECA and Van month by month
- [ ] Months that have **ended** read **DUE** (red); the **current** month and
      every later month read **Upcoming** — never due
- [ ] Standing in August: June and July are DUE, August → March are Upcoming.
      Row "Due Now" = **₹1,000**, row "Pending" = **₹5,000**
- [ ] The two numbers are labelled differently on screen (Due Now vs Pending) —
      a tester must not have to guess which is which
- [ ] A month with no charge reads "No charge", not ₹0 due
- [ ] Largest-remainder split: set ECA to ₹5 across 10 months → five months at
      ₹1 and five at ₹0; the months sum to exactly ₹5, never ₹6

### 1.3 Record a payment

- [ ] Tapping a month cell opens "Record payment" prefilled with that head,
      that month, and that month's **pending** amount
- [ ] Opening from the row menu defaults to the oldest month still owed
- [ ] Head options: School fee, ECA fee, Van fee, Other. Choosing ECA or Van
      shows the month picker; each option reads `June — ₹500 left (due)` /
      `— paid` / `— no charge`
- [ ] Choosing School or Other hides the month picker
- [ ] Recording against a head with no months yet is refused with a message
      telling her to set the amount on the row first
- [ ] Payment mode Cash / Bank is required
- [ ] **Backdating**: pick yesterday, save → the payment lands under
      yesterday's `dateKey` (verify on the Accounts daily sheet for yesterday)
- [ ] **Future dates are rejected** (the date input's max is today)
- [ ] Duplicate guard: same student + same amount + same date warns before save
- [ ] Double-submit guard: the save button disables while the write is in flight
- [ ] Success toast; the month cell turns PAID and the row totals update
- [ ] A partial payment leaves the month showing the remaining amount, still DUE
- [ ] An **overpayment** on one month, or a payment tagged to a month outside
      the schedule, still reduces that head's Due Now — the student must not
      read as a defaulter for money they actually paid
- [ ] An "Other" payment reduces Total Paid / Pending / Due Now and appears in
      no month cell

### 1.4 Edit and soft delete

- [ ] Row menu → **Edit details** changes name, class, section, roll no, notes
      and the three amounts; saves with a toast
- [ ] Row menu → **Remove student** asks for confirmation, then the row leaves
      every list and every total (note, class-wise, teacher-wise, parent view)
- [ ] The removed row is still recorded in the Activity Log with a before-snapshot
- [ ] **Hard delete is impossible anywhere in the UI**
- [ ] A payment can be edited and soft-deleted by the Principal; a deleted
      payment disappears from all totals and from the Accounts sheets
- [ ] Kill the network mid-save: the error says NOT saved / retry — never a
      silent failure and never a success-looking failure
- [ ] Kill the network *after* a save commits but before the refetch: the
      message says the save succeeded and the refresh did not — it must NOT
      read as "not saved"

### 1.5 Class-wise register (`principal-classes`)

- [ ] Every class Sharmi has students in appears, sorted numerically
      (Class 2 before Class 10); students with no class collect under
      **Unassigned**
- [ ] Per-class totals: students, charged, paid, pending, due now
- [ ] The sum of the class totals equals the note header's totals
- [ ] Expanding a class lists its students with their own balances
- [ ] The "dues only" filter shows only students with something owed today
- [ ] Recording a payment here updates the same row the note shows — reload the
      note and confirm the new number is there
- [ ] Fee **amounts** are not editable on this screen (one place to edit, so the
      registers can never disagree)

### 1.6 Teacher-wise register (`principal-teachers`) — assignment

- [ ] Left: the teacher list with how many students each carries
- [ ] A teacher with no linked app login is listed but **disabled**, with the
      reason shown (`teacherUid` must be an auth uid or the rows are invisible
      to them)
- [ ] The load badge flags a teacher far from the ~21-student target
- [ ] Multi-select students → assign in one action; the counts update
- [ ] Unassign returns a student to the unassigned pool
- [ ] A partial bulk failure reports how many did not land — the successful
      assignments stay saved
- [ ] Each assignment appears as its own entry in the Activity Log
- [ ] Filters: Unassigned / This teacher / Everyone all work

### 1.7 Income & Expense (`principal-accounts`)

- [ ] **Opening balances** card: cash, bank and "correct as of" date save with
      a toast
- [ ] A transaction dated **before** `openingAsOf` does NOT move the balances,
      and the screen shows the note explaining how many were excluded
- [ ] A transaction dated **on** `openingAsOf` DOES count
- [ ] **Daily view** for a day with known entries — verify by hand:
      `Cash in Hand = openingCash + Σ cash income − Σ cash expenses`
      and `Bank Balance = openingBank + Σ bank income − Σ bank expenses`
      (on/after `openingAsOf`, soft-deleted excluded)
- [ ] The tally line proves income − expense = net for the day
- [ ] Income and expense lists itemise the day's records with mode and actor
- [ ] **Add expense**: amount, date, category, paid-from (Cash/Bank),
      description — appears in the day's list and moves the right balance
- [ ] Expense edit / soft delete works; a deleted expense leaves every sheet but
      keeps its history (open the per-record trail modal)
- [ ] **Monthly view**: month totals equal the sum of that month's day rows; the
      day table carries running closing balances; a later month never leaks in
- [ ] A **backdated** payment moves the correct day's totals, not today's
- [ ] Daily and monthly **Excel and PDF exports** download and match the numbers
      on screen
- [ ] An export failure shows an error toast — never a truncated file

### 1.8 Activity Log (`principal-activity`)

- [ ] Newest first, showing actor, role, action, target, student and the
      before → after of the fields that moved
- [ ] Every action from §1.1–1.7 above is present, including the seed run
- [ ] Filter by actor works; the from/to date filter works
- [ ] "Show more" widens the window past the first 100 entries
- [ ] No entry can be edited or deleted from the UI

---

## 2. Teacher

Log in as a teacher who has students assigned. Nav shows **"My Students' Fees"**
under FEES, and nothing else money-related.

- [ ] The register lists **only** the students assigned to this teacher —
      count matches the number the Principal sees next to this teacher's name
- [ ] A teacher with no assignments sees an explicit empty state, never a blank
      page and never someone else's students
- [ ] A permanent notice is visible: *"Your changes are recorded in the school's
      activity log."*
- [ ] **Can edit fee amounts** on their own students: school fee, ECA (year),
      ECA months, van (per month), van months, notes — saves with a toast
- [ ] **Can record a payment** for their own students; the receipt is attributed
      to the teacher (not to the Principal) — check "entered by" on the record
- [ ] Both actions appear in the **Principal's** Activity Log with the teacher's
      name and role
- [ ] **Cannot** rename a student, change their class, or reassign the teacher —
      those fields are absent from the teacher's edit sheet
- [ ] **Cannot** remove a student (no delete action offered)
- [ ] **Cannot** edit or delete any payment, including one they just recorded
- [ ] **Cannot** see another teacher's students, the class-wise register, the
      Fees Note, Income & Expense or the Activity Log — not in nav, and not by
      typing the URL (`/teacher/principal-note`, `/admin/principal-accounts`)
- [ ] Attempted direct writes from devtools are denied by rules — covered by
      `tests/rules/principal-rules.test.ts`

---

## 3. Parent

Log in as a parent whose child has a register row.

- [ ] Fee Details shows the child's name and class, and four tiles: Total Fees,
      Total Paid, Balance, **Due Now**
- [ ] Fee Breakdown lists School Fee, ECA Fee, Van Fee with charged / paid /
      pending, plus "Other payments received" when any exist
- [ ] The ECA and Van month grids show the correct states: **Paid**, partial,
      **Due** for ended months, **Upcoming** for the current month and later —
      the same August verdict the Principal sees
- [ ] The caption is present: a month becomes due only after it has ended
- [ ] Payment history lists the receipts with head, month, date and mode
- [ ] Soft-deleted payments never appear
- [ ] The screen is **entirely read-only** — no record, edit or delete anywhere
- [ ] A parent whose child has **no** register row sees the **"Fees not
      published"** panel naming the child — not zeros, which would read as
      "you owe nothing"
- [ ] A parent account with no linked student sees "No student linked"
- [ ] No regressions: anonymous parent login, attendance, marks, timetable and
      report card still work

---

## 4. Admin and Correspondent (negative pass, run once per role)

- [ ] The **PRINCIPAL REGISTER** nav section is completely absent
- [ ] Direct URLs (`/admin/principal-note`, `/admin/principal-classes`,
      `/admin/principal-teachers`, `/admin/principal-accounts`,
      `/admin/principal-activity`) land on the dashboard, not on the module
- [ ] No register row, payment or expense can be read from devtools (rules deny
      admin reads on this module — it is not theirs)
- [ ] Their own screens (students, teachers, classes, timetable, exams, reports,
      settings, user management) still work

---

## 5. Mobile pass (Sharmi uses a phone too)

Run at **390 × 844** (phone) and confirm again at **768** (tablet) and
**1440** (desktop). The breakpoint is 900px.

- [ ] **No screen scrolls the page body horizontally.** Wide tables scroll
      inside their own container or are replaced by cards
- [ ] **Fees Note** < 900px: one **card per student** (name, class, balance
      summary) — no ten-column grid. Tapping a card opens an edit sheet with
      the same fields stacked
- [ ] The **month drawer** on a phone is a vertical month list, not a chip grid
      that scrolls sideways
- [ ] Record payment, Add student and Edit details open as sheets with full-width
      inputs; the keyboard does not cover the save button
- [ ] **Class-wise** and **Teacher-wise** < 900px: one card per student; the
      class headers stay tappable
- [ ] **Teacher assignment** on a phone: the teacher list and the student list
      stack; multi-select still works with a thumb
- [ ] **Income & Expense** < 900px: the daily and monthly record tables become
      one card per record; the balance cards stack; the month chart fits
- [ ] **Activity Log** < 900px: entries are readable cards; the before → after
      block wraps instead of overflowing
- [ ] **Parent Fee Details** on a phone: tiles stack, month grids wrap
- [ ] Desktop ≥ 900px: the Fees Note grid has a **frozen student-name column**
      that stays visible while scrolling the fee columns sideways
- [ ] Rotating a phone to landscape does not break any layout

---

## 6. Stale-client and rules behavior (after `firebase deploy --only firestore:rules`)

Keep a pre-deploy tab open, then deploy the rules.

- [ ] A write from the stale tab that the new rules forbid → permission-denied
      with the role-specific message **and** the "refresh the app" hint
- [ ] After refresh, the new bundle hides the UI for anything the role cannot do
- [ ] Offline write attempt → "Connection lost — NOT saved, retry", and the
      record really is not saved when connectivity returns
- [ ] A teacher cannot record a payment attributed to the Principal (rules pin
      `enteredByUid` to the signed-in uid)
- [ ] No audit entry can be created with someone else's `actorUid`, a client-set
      `at`, or an unknown action/target
- [ ] New parent self-signup still works during and after the deploy window
