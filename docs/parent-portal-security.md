# Parent Portal — Security Architecture & Deploy Runbook

Branch: `feat/principal-billing-expenses`. Supersedes the browser-side parent
login described in older notes. Read this before deploying anything that
touches parent access.

## What changed and why

Before: the Parent Login tab signed the browser in anonymously, **downloaded
every student record** (names, phones, dates of birth, Aadhaar numbers) and
matched the login code locally. Any visitor to the login page could pull that
list, and a signed-in parent could read every class's marks, attendance and
the whole fee register because Firestore rules only checked "is authenticated".

After:

| Concern | Now |
| --- | --- |
| Credential check | `POST /api/parent-login` (Vercel function, Firebase Admin SDK) verifies the 4-digit phone suffix + DOB **server-side** and mints a Firebase custom token whose claims are `{ role: 'parent', studentIds: [...] }` — only that household's children. |
| Google-signed-in parents | Same endpoint with `{ idToken }`: verifies the token, matches the **verified** email to a student record, pins the same claims on that account. |
| Data access | `GET /api/parent-data?view=…&studentId=…` verifies the ID token, rejects any `studentId` not in the claims (403), and returns the child's slice only: class-wide docs (`attendance`, `marks`, `classTests`, `coScholasticRecords`) have `records[]` trimmed to the child; the fee view returns one matched register row and its payments. |
| Firestore rules | Every student-data collection is **staff-only** (`isStaff()` = role in `users/{uid}` ∈ admin/principal/correspondent/teacher/staff). Parents, anonymous sessions and tokens with no users doc read nothing directly. `users` reads are staff-or-own-doc only. Parent self-signup rule removed. `parentLoginAttempts` is denied to all clients. |
| Brute force | Fixed windows in Firestore via the Admin SDK: 8 attempts per login code / 15 min, 20 per IP / 15 min, `429` + `Retry-After`. |
| Enumeration | Unknown code, wrong DOB, archived student and malformed input all return the identical `401` body; every path takes a uniform 250–550 ms settle delay. |
| Input validation | Code must be exactly 4 digits; DOB exactly 8 digits and a real calendar date (1990–2100). Bodies > 4 keys or non-JSON → `400`. |
| Field exposure | `me` returns a whitelist (`PARENT_VISIBLE_STUDENT_FIELDS`): no Aadhaar, no fee adjustments, no `parentIds`, no `previousBalance`. |
| Session | Firebase Auth session (custom token → ID token, 1 h, auto-refreshed). No `localStorage` parent session. Claims travel with the token; `verifyIdToken(…, true)` checks revocation. |

Code map:

- `src/lib/parent-portal/core.ts` — pure logic shared by browser and API (validation, matching, rate-limit policy, record filter, field whitelist, fee-row matcher).
- `api/_lib/parent-login-core.ts`, `api/parent-login.ts` — login handler (logic / wiring).
- `api/_lib/parent-data-core.ts`, `api/parent-data.ts` — data handler (logic / wiring).
- `api/_lib/admin.ts`, `api/_lib/http.ts` — Admin SDK bootstrap, HTTP helpers.
- `src/lib/parent-api.ts` — browser client. `src/context/AuthContext.tsx` — session handling.
- `firestore.rules` — enforcement. Tests: `tests/parent-*.test.ts`, `tests/rules/parent-isolation.test.ts`.

## Deploy order (do not reorder)

The app and the rules depend on each other: the new rules break the OLD
parent screens (they read Firestore directly), and the old rules leave the
NEW app secure but the leak open. Ship app first, rules immediately after.

### 0. One-time: service-account key → Vercel

The functions need `FIREBASE_SERVICE_ACCOUNT`. Only a Firebase project
**Owner** can create it.

1. Firebase Console → project `maruti-management` → ⚙ Project settings → **Service accounts**.
2. **Generate new private key** → a JSON file downloads. Treat it like a root password.
3. Vercel → project (`mnps-staging`, later production) → Settings → **Environment Variables**.
4. Name `FIREBASE_SERVICE_ACCOUNT`, value = the **entire JSON file contents** pasted as one value (or base64 of it). Environments: Production + Preview.
5. Save. Delete the downloaded JSON from the laptop (Recycle Bin too).
6. Never commit it; `.gitignore` already excludes `.env*`.

Rotation: Service accounts → ⋮ on the key → delete, generate a new one, update Vercel, redeploy.

### 1. Pre-deploy gates

```bash
npm run test          # unit suites incl. parent-portal-core / parent-login / parent-data
npm run test:rules    # Firestore emulator (needs Java) — parent-isolation + security + principal-rules
npm run build         # static export
```

Do not deploy rules that have not passed `test:rules` somewhere.

### 2. Deploy the app (functions ship with it)

```bash
npx vercel login                       # once per machine
npx vercel link                        # pick mnps-staging
npx vercel deploy --prod --yes         # from the repo root; builds dist/ + api/
```

Smoke-check before touching rules:

```bash
curl -s -X POST https://mnps-staging.vercel.app/api/parent-login \
  -H 'content-type: application/json' -d '{"code":"0000","dob":"01011999"}'
# → HTTP 401 {"error":"invalid_credentials", …}   (500 = env var missing)
```

### 3. Deploy the rules

```bash
npx firebase deploy --only firestore:rules --project maruti-management
```

Tell staff to refresh open tabs.

### 4. Verify with real accounts (staging sign-off checklist)

Parent (Parent Login tab, code + DOB):
- [ ] Logs in; dashboard shows the right child (and siblings on the same phone).
- [ ] Attendance, Timetable, Major Exams, Weekly Tests, Class Tests, Report Card, Assignments, Fees all load.
- [ ] Wrong DOB → "Invalid Login Code or Date of Birth"; 9th wrong attempt on the same code → "Too many login attempts".
- [ ] DevTools → Network: no request to `firestore.googleapis.com` returns other students; `/api/parent-data` responses contain only the child's `records`.
- [ ] Sign out, sign back in: still works (claims persist).

Parent (Google, email saved on the child's record):
- [ ] Staff tab → Sign in with Google → lands on the parent dashboard.
- [ ] Unknown Gmail → switched to Parent Login tab with the hint.

Staff:
- [ ] Teacher: timetable, attendance marking, marks entry, class fee register.
- [ ] Admin: students list/edit, Excel import, settings/user management.
- [ ] Principal: Fees Note, registers, daily/monthly accounts, activity log.
- [ ] New staff first login (pending invite) still migrates.

## Rollback

- App problem: `git revert`, redeploy Vercel. Old app + new rules = parent screens show nothing (safe, not leaking) and staff unaffected.
- Rules problem: `git checkout <pre-deploy> -- firestore.rules && npx firebase deploy --only firestore:rules`. This REOPENS the student-data leak — treat as minutes, not days.

## Residual risks (known, not closed by this change)

1. **DOB as the password.** Guessable by people who know the family; the only mitigations are the per-code lock (8 tries / 15 min) and the generic error. Recommended next step: an office-issued PIN per family, stored hashed, with DOB as the second factor.
2. **Firestore-backed rate limiting** is best-effort against a distributed attacker (many IPs × many codes). Add Firebase App Check and/or Vercel WAF rate rules for the `/api/*` path if abuse is observed.
3. **Fee-row match is by name + class**, not a student id, because the Principal Register is standalone. Two children with the same name in the same class resolve to "not published" rather than the wrong family's fees — safe, but a data-model follow-up.
4. **Staff writes** on academic collections are now staff-only, but not per-class: any teacher can still edit any class's marks. Narrowing that is the `TODOS.md` P2 rules sweep.
5. **`users` directory** is readable by all staff roles (teachers can see colleagues' emails/phones). Acceptable for a school office; tighten to admin-like if asked.
6. **Legacy parent `users` docs** written by the old flow remain; they grant nothing (rules check `isStaff`), and the login endpoint refreshes them on next sign-in. Clean-up is optional.
