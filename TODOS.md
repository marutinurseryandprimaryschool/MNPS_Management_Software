# TODOS

Deferred work with context. Format: What / Why / Context / Effort / Priority / Depends on.
Generated from /plan-ceo-review 2026-08-10 (Principal role, fee arrears engine & accounts module).

## P2 — Security follow-up: rules sweep on non-money collections
- **What:** Tighten remaining any-authenticated-user Firestore rules: WRITES on marks, attendance, assignments, weeklyTests, classTests, reportCards, coScholasticRecords, chats; READS on `users` (staff emails/phones currently visible to anonymous parent sessions).
- **Why:** Same hole class as the fee-payment one closed by the 2026-08 update; a parent session can alter marks today.
- **Context:** The users-rules redesign, `isPrincipal()`-style helpers, and the rules emulator test harness from the Principal update make this mostly mechanical. Touches many teacher write paths — needs its own regression pass.
- **Effort:** M (human) → S with CC. **Priority:** P2. **Depends on:** Principal update R1 (rules redesign + emulator harness) landed.

## P2 — PDF payment receipts
- **What:** Printable/downloadable receipt after saving a payment (school header, student, category/months, receipt number). jspdf already installed; `receiptNumber` field exists on payments.
- **Why:** School likely hand-writes receipts; parents get a proper artifact.
- **Context:** Deferred from the Principal update (D14) as an independent follow-up PR. Hook into the payment-save success path in AdminFees.
- **Effort:** S-M (human) → S with CC. **Priority:** P2. **Depends on:** Principal update R2 (payment entry final form).

## P3 — Day-close cash reconciliation
- **What:** "Close day" flow: Principal confirms counted cash vs computed Cash in Hand; variance note; day locks.
- **Why:** Gives the daily balance sheet a trustworthy anchor; surfaces variances same-day.
- **Context:** Deferred from the Principal update (D16) until balance-sheet numbers prove stable in real use. Locking semantics need care (what edits are allowed on a closed day → audit trail covers).
- **Effort:** M (human) → S with CC. **Priority:** P3. **Depends on:** Accounts module (R2) in production a few weeks.

## P3 — Temporary fee-entry delegation
- **What:** Principal-grantable temporary delegation of fee/expense entry (e.g. to correspondent) for absences.
- **Why:** Principal-only entry is an operational single point of failure; current stance (accepted): paper slips + backdated entry on return.
- **Context:** Decision 12A of the CEO review. Needs a rules-visible delegation flag (e.g. `accounts/delegation` doc with expiry) — design carefully so it doesn't reopen the exclusivity the client asked for. Raise with the client before building.
- **Effort:** M (human) → S with CC. **Priority:** P3. **Depends on:** client sign-off.

## P3 — WhatsApp fee-due reminders (client proposal)
- **What:** Monthly automated "pending dues" messages to parents (e.g. "June + July ECA pending").
- **Why:** Turns the defaulter report into automatic follow-up; agency already runs a WhatsApp automation stack (cross-sell).
- **Context:** Deferred from the Principal update (D18). Needs external infra, per-message cost, opt-in handling, and its own pricing conversation with the school — propose after the Principal update lands.
- **Effort:** L (human) → M with CC + infra. **Priority:** P3. **Depends on:** defaulter report (R2) live; client agreement.
