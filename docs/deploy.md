# Deploy Runbook — Principal Role, Fee Arrears & Accounts Update

Branch: `plan/principal-fees-accounts`. Spec: [designs/principal-role-fees-accounts.md](designs/principal-role-fees-accounts.md).
QA gate: [qa-checklist.md](qa-checklist.md).

## What this release changes in production behavior

- **Firestore rules** (the only enforcement surface — this app is a static export
  with no backend): fee payments and expenses become Principal-only writes;
  payments can never be hard-deleted; the users-collection privilege-escalation
  hole (any signed-in user could self-assign any role) is closed; staff
  first-login migration now requires the `migratedFrom` pointer written by the
  updated AuthContext.
- **App**: shared fee engine (month-wise ECA/term/bus arrears), Principal
  payment entry with backdating + audit history, read-only teacher Fee
  Register, Principal Accounts module (balance sheet, defaulter report,
  exports), parent fee view corrections.

**App and rules must ship together, app first** (see order below). The app
deploy is harmless under old rules; old app + new rules breaks staff first-login
and admin fee entry, so never deploy rules first.

## Pre-deploy checklist

1. `npm run test` — fee engine unit suite must be green.
2. `npm run test:rules` — 41-assertion rules suite via the Firestore emulator.
   Requires a Java runtime (not installed on the current dev machine — install
   a JRE, e.g. `winget install EclipseAdoptium.Temurin.21.JRE`, or run in CI).
   **Do not deploy rules that haven't passed this suite somewhere.**
3. `npm run build` — static export must succeed.
4. **Users-collection audit** (protects staff logins from the new migration
   rule). Result from 2026-08-10, production:
   ```json
   {"totalDocs":38,"byRole":{"admin":12,"parent":6,"teacher":18,"principal":2},
    "pendingDocs":4,"uidKeyedDocs":34,
    "LEGACY_RISK_docs_failing_new_migration_rule":[]}
   ```
   `LEGACY_RISK` is empty → every not-yet-migrated staff doc is `status:
   'pending'` → the migration rule strands nobody. Re-run this audit if staff
   docs were touched since (query: users docs where doc.id ≠ uid field and
   status ≠ 'pending' and role ≠ 'parent').
   ⚠️ Side finding: **12 admin accounts** exist. Under the documented trust
   boundary, every admin can self-promote to principal. Prune unused admin
   accounts with the school.

## Deploy order

```bash
# 1. App (Netlify) — merge the branch, or deploy the branch build
npm run build          # output in dist/
# push/merge → Netlify deploys, or drag-drop dist/ for a manual deploy

# 2. Rules — immediately after the app is live
firebase deploy --only firestore:rules
```

Notes on the in-between window (minutes):
- Old cached clients keep the old looser write behavior until rules land.
- After rules land, stale tabs (old bundle) fail staff FIRST logins and any
  teacher/admin fee-entry attempt with a permission error that includes a
  "refresh the app" hint. Self-heals on reload. Tell the school: refresh after
  the deploy.

## Post-deploy verification (first 15 minutes)

Run the per-role passes in [qa-checklist.md](qa-checklist.md). Minimum smoke:
1. Principal login → record a ₹1 test payment (backdated to today), see it in
   Accounts daily view, edit it, check history entry, soft-delete it.
2. Teacher login → Fee Register is read-only, scoped to their class.
3. Admin login → no payment entry UI, no Accounts/Expenses; structures editable.
4. Parent login → fees load, month grid correct.
5. Firebase console → confirm the test payment doc has `deleted: true`, not gone.

## Console-only operations (by design)

- **Fresh install / first admin**: the in-app bootstrap is inert under the new
  rules. Seed the first admin doc via Firebase console (`users/{uid}`,
  `role: 'admin'`, `status: 'active'`, matching email).
- **Wiping feePayments** (year reset): Master Reset intentionally no longer
  touches `feePayments` (`delete: false` in rules). Delete the collection from
  the Firebase console if ever genuinely required.

## Rollback

- **App-only problem**: `git revert` the feature commits on the branch/main and
  redeploy Netlify. New rules tolerate the old app EXCEPT staff first-login
  (old app lacks `migratedFrom`) — if rolling back the app, roll back rules too.
- **Rules problem**: `git checkout <pre-deploy-commit> -- firestore.rules &&
  firebase deploy --only firestore:rules`. This reopens the security holes —
  treat as temporary, fix forward fast.
- Data needs no rollback: schema additions are optional fields; old docs are
  read compatibly.

## Staging deployment (Vercel) — 2026-08-17

The reviewed build is live for sign-off testing at **https://mnps-staging.vercel.app**
(Vercel project `mnps-staging`, school account `marutinurseryandprimaryschool`).
The school's existing site is untouched; production Firestore rules are still the
TRANSITION set (new collections principal-gated, old access preserved), so the
old app and the staging app both work.

Redeploy staging after changes:
```bash
npm run build
npx vercel deploy --prod --yes dist    # from the repo root
```

Firebase Auth authorized domains now include `mnps-staging.vercel.app` and
`mnps-management-software.vercel.app` (required for Google sign-in to work off
localhost).

**Cutover checklist (when the school signs off):**
1. Point the school at the chosen Vercel URL (or promote/alias a custom domain).
2. Deploy the strict rules from the repo: `npx firebase deploy --only firestore:rules`
   (the repo's `firestore.rules` is the FULL lockdown version, not the transition set).
3. Tell staff to refresh; stale tabs get permission errors with a refresh hint until reloaded.
