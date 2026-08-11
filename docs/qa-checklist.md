# Manual QA Checklist — Principal Role, Fee Engine & Accounts

Per-role green-flag checklist for the Principal/fees/accounts release
(spec: `docs/designs/principal-role-fees-accounts.md`). Run the full pass
against the deployed app (or `next build` output served locally) with one
real login per role. Every box must be checked before the release is
declared green.

## Green-flag criteria (all required)

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run lint` — zero errors
- [ ] `npm run build` — static export completes
- [ ] `npm run test` — fee-utils unit suite green
- [ ] `npm run test:rules` — rules emulator suite green
      (requires a Java runtime; run wherever Java 11+ is available — see
      `docs/deploy.md` "Running the tests")
- [ ] Every checklist item below passed

---

## 1. Principal

Log in as the `principal` user. Nav must show: Fees, **Accounts**,
**Defaulter Report**. Nav must NOT show Users/Settings management beyond
what admin-like screens allow (Principal has no `manageUsers` /
`manageSettings`).

### Fee payment entry (AdminFees → Payments tab)
- [ ] "Record Payment" is visible and opens the payment modal
- [ ] Category dropdown is populated from the student's PENDING buckets in
      engine order: Previous Balance, terms, month-tagged ECA
      (`ECA - June` … `ECA - March`), additional fees, month-tagged bus
      (`Bus Fee - {month}`), plus "Other"
- [ ] Selecting an ECA month auto-fills the month slice amount (annual ECA
      divided across `ecaMonths`, rupee-rounded, remainder on first month)
- [ ] Collection-date picker defaults to today; **backdating works** (pick
      yesterday, save, payment lands under yesterday's `dateKey` in the
      daily balance sheet); future dates are rejected
- [ ] Duplicate guard: same student + same amount + same date shows a
      warning dialog before save
- [ ] Double-submit guard: save button disables with spinner while in flight
- [ ] Success toast on save; grid/list refreshes with the new payment
- [ ] Amount ≤ 0 rejected inline

### Edit / soft-delete / history
- [ ] Editing a payment (amount, category, date) saves and shows a success
      toast; edited values appear immediately
- [ ] Soft-delete: payment disappears from ALL totals (overview cards,
      class drill-down, balance sheet, defaulter report, parent view) but
      remains visible in the Principal's audit/deleted view
- [ ] Hard delete is impossible anywhere in the UI
- [ ] History modal on an edited/deleted payment shows one entry per
      mutation: before-snapshot, actor, timestamp, action
- [ ] Kill the network mid-save: error toast says NOT saved / retry — never
      a silent failure or success-looking failure

### Expenses (inside Accounts module only)
- [ ] Expense entry requires payment mode (`cash` | `bank`)
- [ ] New expense appears in the daily sheet under its mode
- [ ] Expense edit/soft-delete writes history (same pattern as payments);
      deleted expenses excluded from all sheets

### Opening balances
- [ ] `accounts/settings` opening cash/bank/as-of date editable from the
      Accounts screen
- [ ] Transactions dated ON or BEFORE `openingAsOf` do NOT move the
      running balances; transactions after it do

### Balance sheet math spot-check
- [ ] Daily view: pick a day with known entries. Verify by hand:
      Cash in Hand = openingCash + Σ cash payments − Σ cash expenses
      (after `openingAsOf`, deleted excluded); Bank = openingBank +
      Σ (upi/cheque/bank_transfer) payments − Σ bank expenses
- [ ] Monthly view: month totals equal the sum of that month's daily rows
- [ ] A backdated payment moves the correct day's totals, not today's
- [ ] Daily and monthly Excel + PDF exports download and match on-screen
      numbers

### Defaulter report
- [ ] Class-wise, month-wise, with School/ECA/Van split plus Previous
      Balance and Additional Fees buckets; Previous Balance listed first
- [ ] A scholarship student shows proportionally SCALED dues (never
      full-fee); scaled buckets sum exactly to the override
- [ ] A month that has not ended yet is NOT shown as due (client's
      August → June+July example)
- [ ] A term with no due date set is not yet due; UI nudges to set dates
- [ ] Unallocated ("Other") payments count toward total paid — the student
      is not a false defaulter for the amount paid
- [ ] Excel + PDF export match the on-screen report; printable layout OK

---

## 2. Admin and Correspondent (run once per role)

- [ ] Fees screen: **Structures tab works** — create/edit structure,
      including term `dueDate` fields and `ecaMonths`; scholarship
      configuration accessible
- [ ] **NO payment-entry UI anywhere**: no "Record Payment" button, no
      edit/soft-delete on payments (payments remain visible read-only)
- [ ] **NO Expenses page, NO Accounts, NO Defaulter Report** in nav or via
      direct URL (`/admin/accounts`, `/admin/defaulters` show
      denied/redirect, not the module)
- [ ] AdminSettings: System Migration Tool is GATED — shows the
      explanatory note, not the tool (Principal-only via
      `editFeePayments`)
- [ ] Master Reset text confirms feePayments are NOT wiped by the tool
      (console-only operation)
- [ ] Year-End Rollover (test on emulator/staging data, never production):
      carried `previousBalance` equals the engine's scholarship- and
      bus-aware pending, net of Previous-Balance payments (no double
      count) — cross-check one student by hand against their Fee Status
      panel
- [ ] User management (add/edit/delete users) still works for this role

## 3. Teacher

- [ ] Nav shows **"Fee Register"** (not "Collect Fees")
- [ ] Class teacher: register shows ONLY their own class's students;
      read-only month-wise balances per student; totals match what the
      Principal sees for that class
- [ ] **NO entry UI anywhere**: no collect/record/edit buttons on any
      screen, no Expenses page
- [ ] Teacher with no `isClassTeacher` assignment sees the explicit empty
      state "You are not assigned as a class teacher this year" — never a
      blank page
- [ ] Attempted direct write (if attempted via console/devtools) is denied
      by rules — covered by `npm run test:rules`

## 4. Parent

- [ ] Totals are **scholarship-adjusted** (the old inflated-total bug is
      gone); scholarship banner shown when an adjustment applies
- [ ] Month grids: ECA and Bus render as month cards with
      paid/partial/pending/upcoming states; current month shows as
      upcoming, not pending
- [ ] Term dues show with due-date awareness; Previous Balance bucket shown
      when present
- [ ] Legacy lump-sum "Extracurricular" payments appear allocated FIFO
      against oldest ECA months (history untouched)
- [ ] Unallocated payments visible as "Payments on account"
- [ ] Deleted payments never appear
- [ ] No regressions: anonymous parent login, marks, timetable, report
      card still work

## 5. Stale-client behavior (after rules deploy)

Open an OLD app bundle (pre-deploy tab kept open) after
`firebase deploy --only firestore:rules`:

- [ ] Admin/teacher payment write from the stale tab → permission-denied;
      after refresh the entry UI is gone (new bundle)
- [ ] New-bundle client shows the role-specific message + "refresh the
      app" hint on permission-denied, and "Connection lost — NOT saved,
      retry" when offline
- [ ] Staff FIRST login from a stale tab fails migration with a visible
      error (no silent fallback, no duplicate pending doc); reload and
      retry succeeds
- [ ] New parent self-signup still works during and after the window
