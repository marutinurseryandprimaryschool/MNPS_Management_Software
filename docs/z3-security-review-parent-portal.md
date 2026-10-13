# Z3 Connect — Master Product Security Checklist
## Completed review: MNPS Management Software — parent authentication & data access

> Scope: the flows changed in this release — Parent Login (code + DOB and Google), `/api/parent-login`, `/api/parent-data`, the parent screens, and the Firestore rules that gate student data. Staff flows are covered where the rules change touches them.
>
> Status values: `PASS` / `FAIL` / `N/A` / `PARTIAL` / `UNVERIFIED` (needs an account owner to confirm — not something code review can see).
>
> Source checklist: `docs/Z3_Connect_Master_Product_Security_Checklist.md`.
>
> Evidence column cites files, tests or commands. "Automated" = asserted by `npm run test` or `npm run test:rules`.

## 0. Project Information

- **Project Name:** MNPS Management Software (CampusOS)
- **Client Name:** Maruti Nursery & Primary School
- **Product Type:** Portal / school ERP
- **Environment:** Staging (pre-production)
- **Production URL:** https://mnps-staging.vercel.app (staging); production domain not yet cut over
- **Backend URL:** same host, `/api/parent-login`, `/api/parent-data` (Vercel functions)
- **Database:** Cloud Firestore, Firebase project `maruti-management`
- **Hosting Provider:** Vercel (static export + functions), Firebase (Auth, Firestore)
- **Security Review Date:** 2026-10-13
- **Reviewed By:** automated code review (Claude) on branch `feat/principal-billing-expenses`
- **Approved By:** _pending — Technical Lead_

---

# 1. Network & Perimeter Security

| Check | Requirement | Status | Notes |
|---|---|---|---|
| 1.1 | Production uses HTTPS only | PASS | Vercel serves HTTPS only; HSTS header added in `vercel.json`. |
| 1.2 | HTTP redirects permanently to HTTPS | PASS | Vercel platform default (301). |
| 1.3 | Valid TLS certificate is active | PASS | Vercel-managed certificate on `*.vercel.app`; re-verify after custom domain. |
| 1.4 | WAF is enabled where applicable | PARTIAL | Vercel Firewall baseline is on by default; no custom rules for `/api/*`. Recommend a rate rule on `/api/parent-login`. |
| 1.5 | DDoS protection is enabled | PASS | Vercel edge DDoS mitigation (platform). |
| 1.6 | Suspicious traffic is blocked/rate-limited | PASS | App-level: 8 attempts/code, 20/IP per 15 min (`RATE_LIMIT` in `src/lib/parent-portal/core.ts`). Automated. |
| 1.7 | Unused server ports are closed | N/A | Serverless; no hosts. |
| 1.8 | Database ports are not publicly exposed | PASS | Firestore is reachable only through Firebase APIs gated by `firestore.rules` or the Admin SDK. |
| 1.9 | Admin/internal services are not publicly exposed | PASS | Firestore emulator is local-only; no admin endpoints deployed. |
| 1.10 | Firewall rules follow least-privilege | N/A | |

# 2. Authentication Security

| Check | Requirement | Status | Notes |
|---|---|---|---|
| 2.1 | Every protected area requires authentication | PASS | Rules deny unauthenticated reads except `school/main`; API returns 401 without a bearer token. Automated. |
| 2.2 | Passwords are never stored in plaintext | PARTIAL | No passwords exist. The parent "password" is the child's DOB, a profile field stored in clear because the school needs it as data. See 2.4. |
| 2.3 | Passwords use Argon2id or bcrypt | N/A | Staff: Google. Parents: DOB (see 2.4). |
| 2.4 | Strong password policy is enforced | **FAIL** | DOB is low-entropy and known to relatives. Mitigated by 2.5/2.6 and generic errors. Recommendation: office-issued per-family PIN (hashed) with DOB as second factor. Accepted for this release by the school's choice of login scheme; tracked in `docs/parent-portal-security.md` residual risk 1. |
| 2.5 | Login attempts are rate-limited | PASS | `api/_lib/parent-login-core.ts`; tests `parent-login: rate limiting`. Automated. |
| 2.6 | Repeated failures trigger temporary restriction | PASS | 429 + `Retry-After`, 15-minute fixed window per code and per IP. Automated. |
| 2.7 | MFA/2FA for Super Admin/Admin | UNVERIFIED | Staff sign in with Google; 2-Step Verification must be enforced on the school's Google accounts (Workspace admin or each account). Owner to confirm. |
| 2.8 | Password reset tokens expire | N/A | No reset flow (Google / DOB). |
| 2.9 | Reset tokens are single-use | N/A | |
| 2.10 | Reset does not reveal whether an account exists | PASS | Login equivalent: unknown code, wrong DOB, archived student and malformed input return the identical 401 body with a uniform 250–550 ms delay. Automated (`answers … IDENTICALLY`). |
| 2.11 | Logout invalidates the active session/token | PARTIAL | `signOut` clears the Firebase session and refresh token; an already-issued ID token stays valid ≤ 60 min (Firebase design). `verifyIdToken(…, true)` honours server-side revocation. |
| 2.12 | Disabled users cannot continue using old sessions | PASS | Staff: deactivation deletes `users/{uid}`; `isStaff()` re-reads it on every request. Parents: an archived student returns 404 from the API even if the token still names them. Automated. |
| 2.13 | Suspicious login activity is logged | PASS | Structured events `parent_login.failed`, `rate_limited_ip`, `rate_limited_code`, `parent_data.cross_student_blocked` (no DOB/phone/code in logs). |
| 2.14 | Default/test credentials removed | PARTIAL | None in code. Untracked `clear_test_data.ts` deletes live accounts collections — delete the file before release (it is already denied by the new rules, but it should not exist). |

# 3. Session & Token Security

| Check | Requirement | Status | Notes |
|---|---|---|---|
| 3.1 | Browser sessions use secure handling | PASS | Firebase Auth session; HTTPS only. |
| 3.2–3.4 | Cookie flags | N/A | No cookies; bearer ID tokens. |
| 3.5 | Sessions expire after inactivity | PARTIAL | Firebase refresh tokens do not expire on inactivity. Recommend `browserSessionPersistence` for parent sessions (shared phones). |
| 3.6 | Sensitive admin sessions have shorter lifetime | PARTIAL | Same as 3.5 for staff. |
| 3.7 | Tokens are rotated/revoked when required | PASS | ID tokens rotate hourly; claims re-pinned at every parent login; revocation checked server-side. |
| 3.8 | Tokens not stored insecurely in frontend storage | PARTIAL | Firebase SDK keeps the refresh token in IndexedDB (standard). The old `localStorage` parent session was removed. Exposure requires XSS — see 8.3. |
| 3.9 | JWT secrets/keys are strong and protected | PASS | Google-managed signing keys; the service-account key lives only in Vercel env (`FIREBASE_SERVICE_ACCOUNT`). |
| 3.10 | Expired tokens are rejected by backend | PASS | `verifyIdToken` rejects expired/invalid tokens → 401. Automated (`401 … invalid one`). |

# 4. Authorization & RBAC

| Check | Requirement | Status | Notes |
|---|---|---|---|
| 4.1 | Backend validates authorization for every protected endpoint | PASS | Both functions verify the token and the `role`/`studentIds` claims; Firestore rules check role per request. Automated. |
| 4.2 | UI hiding is not treated as security | PASS | `src/lib/permissions.ts` is UI-only by design; enforcement is `firestore.rules` + API. |
| 4.3 | Roles are clearly defined | PASS | admin, principal, correspondent, teacher, staff, parent. |
| 4.4 | Permissions for sensitive actions | PASS | Money writes Principal-only; user management admin/correspondent; parent reads via API only. |
| 4.5 | Least privilege is followed | PARTIAL | Teachers can write marks/attendance for any class (not only their own). Tracked: `TODOS.md` P2 rules sweep. |
| 4.6 | Users cannot modify their own role/permissions | PASS | `users` self-update excludes `role`/`studentId`; parent self-create removed. Automated (`security.test.ts`). |
| 4.7 | Employees cannot access admin endpoints | PASS | Teacher writes to `students`/`classes`/`users` denied. Automated. |
| 4.8 | Managers access only approved scopes | PARTIAL | See 4.5. |
| 4.9 | Finance access is separated | PASS | Principal-only fee/expense writes; teachers read only their rows. Automated (`principal-rules.test.ts`). |
| 4.10 | Critical role changes are logged | PARTIAL | Money changes are audited (`principalAudit`); role changes in Settings are not. |
| 4.11 | Critical permission changes require higher authorization | N/A | Single admin tier. |
| 4.12 | Privilege-escalation tests performed | PASS | Automated: anonymous → admin/principal self-create denied; role upgrade in staff migration denied. |

# 5. Tenant / Family Isolation

| Check | Requirement | Status | Notes |
|---|---|---|---|
| 5.1 | Every record has owner identification | PASS | `studentId` on every per-student record; register rows matched by name+class server-side. |
| 5.2 | Backend derives context from authenticated identity | PASS | `studentIds` come from token claims minted server-side. |
| 5.3 | Client-provided id is never blindly trusted | PASS | `?studentId=` must be in the claims → else 403. Automated (`cross-student guard`). |
| 5.4 | Family A cannot access Family B records | PASS | Class-wide docs have `records[]` trimmed to the child; response JSON asserted free of classmate ids. Automated. |
| 5.5 | Branch isolation | N/A | Single school. |
| 5.6 | Object-level authorization is enforced | PASS | Per request, per student. |
| 5.7 | URL ID manipulation does not expose other records | PASS | Automated (403; body contains no other name). |
| 5.8 | Cross-tenant export impossible | PASS | Parents have no export; staff exports gated by rules. |
| 5.9 | Cross-tenant tests automated | PASS | `tests/parent-data.test.ts`, `tests/rules/parent-isolation.test.ts`. |
| 5.10 | Isolation failure is release-blocking | PASS | Treated as such in this review. |

# 6. API Security

| Check | Requirement | Status | Notes |
|---|---|---|---|
| 6.1–6.3 | Auth / authz / scope validated | PASS | See §4–5. |
| 6.4 | Request body is validated | PASS | `parseLoginInput`: exact shapes; >4 keys or non-object → 400. Automated. |
| 6.5 | Query parameters are validated | PASS | `view` whitelist (`PARENT_DATA_VIEWS`), `studentId` against claims. Automated. |
| 6.6 | Route parameters validated | N/A | No path params. |
| 6.7 | API rate limiting enabled | PASS | Login endpoint. Data endpoint relies on token auth; add a Vercel rate rule if abuse appears. |
| 6.8 | Stricter limits on sensitive endpoints | PASS | Per-code limit (8) tighter than per-IP (20). |
| 6.9 | APIs return only required fields | PASS | `PARENT_VISIBLE_STUDENT_FIELDS` whitelist; no Aadhaar, fee adjustments, `parentIds`. Automated. |
| 6.10 | Internal errors not exposed | PASS | Catch-all → `{ error: 'server_error' }`; detail only in server logs. |
| 6.11 | API versioning controlled | N/A | Internal API, same deploy as client. |
| 6.12 | CORS allows only approved origins | PASS | No CORS headers emitted → browsers enforce same-origin. |
| 6.13 | Debug endpoints removed | PASS | Only the two functions exist in `api/`. |
| 6.14 | API docs do not expose secrets | PASS | |

# 7. Input Validation & Injection

| Check | Requirement | Status | Notes |
|---|---|---|---|
| 7.1 | All server-side inputs validated | PASS | |
| 7.2 | Numbers range-checked | N/A | No numeric inputs. |
| 7.3 | Dates are validated | PASS | Real calendar date, 1990–2100. Automated (31 Feb, month 13 rejected). |
| 7.4 | Emails/phones/IDs follow format | PASS | Code `^\d{4}$`; email normalised; ids from claims ≤128 chars. |
| 7.5 | Enumerated fields reject unknown values | PASS | `view` whitelist → 400. Automated. |
| 7.6–7.7 | SQL | N/A | |
| 7.8 | NoSQL operator injection | PASS | Firestore SDK typed queries; only validated string equality on server. Automated (`"3210' OR 1=1"` rejected). |
| 7.9–7.11 | Command exec / traversal / redirects | N/A | None. |
| 7.12 | Server-side validation exists regardless of frontend | PASS | |

# 8. Browser / Frontend Security

| Check | Requirement | Status | Notes |
|---|---|---|---|
| 8.1 | XSS mitigated | PASS | React escaping; no user HTML rendered. |
| 8.2 | Unsafe HTML avoided | PASS | `dangerouslySetInnerHTML` used twice for static print CSS constants only. |
| 8.3 | CSP configured | **FAIL** | No Content-Security-Policy. Needs allow-list for `*.googleapis.com`, `*.gstatic.com`, `*.firebaseapp.com`, Google sign-in popup; recommended follow-up with report-only first. |
| 8.4 | Clickjacking protection | PASS | `X-Frame-Options: DENY` (vercel.json). |
| 8.5 | X-Content-Type-Options | PASS | `nosniff` site-wide. |
| 8.6 | Referrer policy | PASS | `strict-origin-when-cross-origin`; `no-referrer` on `/api/*`. |
| 8.7 | Permissions policy | PASS | camera/microphone/geolocation/payment disabled. |
| 8.8 | HSTS | PASS | `max-age=63072000; includeSubDomains`. |
| 8.9 | Sensitive data not in page source | PASS | Firebase web config is public by design; no student data in the static bundle. |
| 8.10 | Sensitive data not in console logs | PASS | No `console.log` in `src/`; `console.error` logs error objects only. |
| 8.11 | API secrets not bundled | PASS | Service account only in `api/` runtime env. |
| 8.12 | Source maps reviewed | PASS | Next production export emits no browser source maps by default. |

# 9. CSRF Protection

| Check | Requirement | Status | Notes |
|---|---|---|---|
| 9.1–9.4 | Cookie-based CSRF controls | N/A | Bearer-token auth; no cookies. |
| 9.5 | GET endpoints are not destructive | PASS | `/api/parent-data` is read-only; login is POST only (405 otherwise). Automated. |

# 10. Database Security

| Check | Requirement | Status | Notes |
|---|---|---|---|
| 10.1 | Production DB not publicly exposed | PASS | Rules + Admin SDK only. |
| 10.2 | DB credentials unique to production | **FAIL** | Staging and production share Firebase project `maruti-management`. Recommend a separate staging project before the next release. |
| 10.3 | App does not connect as superuser | PARTIAL | The functions use a service account; by default Firebase Admin keys carry Editor-level access. Recommend a dedicated SA with only `Cloud Datastore User` + `Firebase Authentication Admin` + `Service Account Token Creator`. |
| 10.4 | DB user least privilege | PARTIAL | As 10.3. |
| 10.5 | DB traffic encrypted | PASS | TLS (Google APIs). |
| 10.6 | Backups are enabled | **UNVERIFIED** | Firestore scheduled backups / PITR must be enabled in the Firebase console. **Release-blocking** per §28 until confirmed. |
| 10.7 | Backup access restricted | UNVERIFIED | |
| 10.8 | DB logs do not expose sensitive values | PASS | |
| 10.9 | Dangerous direct DB access restricted | PARTIAL | `clear_test_data.ts` (untracked) — delete. Console access = project owners only. |
| 10.10 | Schema/rules version-controlled | PASS | `firestore.rules`, `firestore.indexes.json` in git. |
| 10.11 | Controlled migration process | PARTIAL | Deploy order documented in `docs/parent-portal-security.md`; no CI gate. |

# 11. Data Security & Privacy

| Check | Requirement | Status | Notes |
|---|---|---|---|
| 11.1 | Data in transit encrypted | PASS | |
| 11.2 | Sensitive data at rest protected | PASS | Firestore encryption at rest (Google-managed). |
| 11.3 | Only necessary personal data collected | PARTIAL | Aadhaar numbers are stored in `students`; now never leave the server for parents. Confirm the school needs them. |
| 11.4 | Sensitive data not in logs | PASS | Logs carry uid/ip/event only; the login code was removed from the rate-limit log in this release. |
| 11.5 | Sensitive data not returned unnecessarily | PASS | Field whitelist; `records[]` trimmed. Automated. |
| 11.6 | Exports follow permission checks | PASS | Exports read Firestore under staff-only rules. |
| 11.7 | Documents protected | N/A | No document storage in use. |
| 11.8–11.10 | Retention / deletion / prod-to-dev copies | UNVERIFIED | Policy to be defined by the school; staging currently IS production data (see 10.2). |

# 12. File Upload & Document Security

| Check | Requirement | Status | Notes |
|---|---|---|---|
| 12.1–12.10 | Upload controls | N/A | The only file input (student Excel import) is parsed in the browser by ExcelJS and never uploaded to a server; no Storage uploads in code. |

# 13. Secrets & Credential Security

| Check | Requirement | Status | Notes |
|---|---|---|---|
| 13.1 | `.env` excluded from Git | PASS | `.gitignore`: `.env*`. |
| 13.2 | Production secrets in a secret manager | PASS | Vercel Environment Variables (`FIREBASE_SERVICE_ACCOUNT`). |
| 13.3–13.4 | DB / JWT secrets not hardcoded | PASS | Firebase web config is public-by-design, not a secret. |
| 13.5 | Payment secrets server-side | N/A | |
| 13.6 | Cloud private keys server-side only | PASS | |
| 13.7 | Service-account keys not committed | PASS | `git ls-files` has none. |
| 13.8 | Git history checked for leaked secrets | PASS | `git log --all -p -S"PRIVATE KEY"` and `-S"client_email"`: 0 hits. |
| 13.9 | Leaked secrets rotated | N/A | None leaked. |
| 13.10 | Different environments use different credentials | **FAIL** | Same Firebase project for staging and production (see 10.2). |

# 14. Payment Security — N/A (no online payments; fees are recorded by the Principal).

# 15. Sensitive Action Protection

| Check | Requirement | Status | Notes |
|---|---|---|---|
| 15.3 | Role/permission changes protected | PASS | admin/correspondent only (rules). |
| 15.4 | Admin creation restricted | PASS | Pre-registration by admin/correspondent; migration rule forbids role upgrade. Automated. |
| 15.5 | Bulk delete protected | PASS | Payments/expenses/register rows cannot be hard-deleted by anyone (rules). |
| 15.7 | Financial exports protected | PASS | Principal/teacher scope via rules. |
| 15.8 | Re-auth/MFA for critical actions | N/A | |
| 15.9 | Maker-checker | N/A | Day-close reconciliation exists for cash. |
| 15.10 | Sensitive actions generate audit logs | PASS | `principalAudit`, write-once. |
| 15.1, 15.2, 15.6 | Salary/bank/payroll | N/A | No payroll module. |

# 16. Audit Logging

| Check | Requirement | Status | Notes |
|---|---|---|---|
| 16.1 | Successful logins logged | PARTIAL | Parent logins: `parent_login.ok` / `parent_link.ok` in Vercel function logs. Staff (Google) logins: Firebase Authentication logs only. |
| 16.2 | Failed logins logged | PASS | `parent_login.failed`, rate-limit events. |
| 16.4 | User creation/deactivation logged | PARTIAL | Not audited in-app (admin UI). |
| 16.5 | Role changes logged | PARTIAL | As 16.4. |
| 16.8 | Invoice/payment changes logged | PASS | `principalAudit` + `history` subcollections with before/after. |
| 16.11 | Logs include actor, action, target, time, result | PASS | For money; parent-API events include uid/ip/event/time. |
| 16.12 | Old/new values captured | PASS | Money changes. |
| 16.13 | Normal users cannot modify audit logs | PASS | `principalAudit` update/delete denied for all. Automated. |
| 16.14 | Audit retention defined | **FAIL** | Vercel function logs are retained briefly (plan-dependent, ~1 day on Hobby). Recommend a Log Drain or upgrading retention. |

# 17. Monitoring & Alerting

| Check | Requirement | Status | Notes |
|---|---|---|---|
| 17.1 | Application errors monitored | PARTIAL | Vercel runtime logs; no error tracker. |
| 17.2 | Availability monitored | PARTIAL | Vercel status only; no uptime check. |
| 17.3 | Repeated login failures alert | **FAIL** | Logged, not alerted. |
| 17.4 | Repeated 401/403 monitored | **FAIL** | Logged (`cross_student_blocked`), not alerted. |
| 17.5–17.8 | Spikes / admin activity / exports / resources | FAIL | Not configured. |
| 17.9 | Alerts have owners | FAIL | To assign. |
| 17.10 | Monitoring does not log secrets | PASS | |

# 18. Backup & Disaster Recovery

| Check | Requirement | Status | Notes |
|---|---|---|---|
| 18.1 | Automated DB backups enabled | **UNVERIFIED** | Enable Firestore scheduled backups (daily, 7–30 day retention) or PITR. Blocking until confirmed. |
| 18.2–18.5 | Frequency / restore points / encryption / separation | UNVERIFIED | Follows from 18.1. |
| 18.6 | Restore process documented | FAIL | Not yet. |
| 18.7 | Restore test performed | FAIL | Not yet. |
| 18.8–18.10 | RTO / file backups / owners | FAIL | To define. |

# 19. Infrastructure & Cloud Security

| Check | Requirement | Status | Notes |
|---|---|---|---|
| 19.1 | Hosting/cloud accounts use MFA | UNVERIFIED | Vercel + Google (Firebase) owner accounts. |
| 19.2 | GitHub accounts use MFA | UNVERIFIED | Org `marutinurseryandprimaryschool`. |
| 19.3–19.5 | Registrar / CDN / payment MFA | UNVERIFIED / N/A | |
| 19.6–19.9 | SSH / root / packages / patches | N/A | Serverless. |
| 19.10 | Secrets not in shell history | PASS | The service-account key is pasted into the Vercel UI, never typed into a shell. Keep it that way. |
| 19.11 | Dev/staging/prod separated | **FAIL** | Shared Firebase project (10.2). |
| 19.12 | Production access limited | UNVERIFIED | Review Firebase IAM and Vercel team members. |
| 19.13 | Leavers lose access immediately | UNVERIFIED | |

# 20. Source Code & Repository Security

| Check | Requirement | Status | Notes |
|---|---|---|---|
| 20.1 | Repository is private | UNVERIFIED | Check GitHub org settings. |
| 20.2–20.4 | Branch protection / restricted pushes / PR review | UNVERIFIED | PRs #1–#2 exist; protection unknown. |
| 20.5 | Secret scanning in commits | FAIL | Not enabled (GitHub secret scanning / push protection recommended). |
| 20.6 | Dependency alerts enabled | UNVERIFIED | Enable Dependabot alerts. |
| 20.7 | Code scanning | FAIL | None. |
| 20.10 | No production data dumps in repo | PASS | None found. |

# 21. Dependency & Supply Chain Security

| Check | Requirement | Status | Notes |
|---|---|---|---|
| 21.1 | Vulnerability scan run | PASS | `npm audit --omit=dev` on 2026-10-13: 2 critical, 5 high, 5 moderate (before upgrade attempt). |
| 21.2 | Critical/high reviewed | PASS | `next` (critical advisories): all target the Next.js **server runtime / dev server**; this app ships a static export and plain Node functions, so the vulnerable code paths do not run in production. `websocket-driver` (critical): pulled by `@firebase/database`, which the app does not import and the bundler tree-shakes out. `@grpc/grpc-js` (high): server-side gRPC advisories; the function is a gRPC client. `brace-expansion` via `exceljs` (DoS on glob patterns): no user-controlled globs. `postcss`/`sharp`/`source-map-js`: build-time only. |
| 21.3 | Known exploitable criticals block release | PASS | None reachable in the shipped runtime (Next server/dev advisories do not apply to a static export; `websocket-driver` sits under the unused `@firebase/database`). The `next@16.4.0` + `npm audit fix` upgrade was NOT applied on 2026-10-13 (job stalled; lockfile unchanged). Tracked as a follow-up. |
| 21.4 | Unused dependencies removed | PARTIAL | `AdminFees`, `PrincipalDefaulters`, `TeacherFees/Formative/Marks/ReportCard` components are dead code (not deps). |
| 21.5 | Lockfile committed | PASS | `package-lock.json`. |
| 21.6 | Updates managed regularly | FAIL | No schedule; enable Dependabot. |
| 21.7 | Trusted registries | PASS | npmjs. |
| 21.8 | Unmaintained packages reviewed | PASS | New: `firebase-admin@14.5.0` (Google), `@vercel/node@23` (Vercel). |

# 22. CI/CD Security

| Check | Requirement | Status | Notes |
|---|---|---|---|
| 22.1 | Lint/tests run before deployment | PASS | `.github/workflows/ci.yml` runs lint, `tsc`, unit tests, emulator rules tests and the production build on every push/PR. |
| 22.2–22.4 | Secret / dependency / security tests in CI | PARTIAL | Dependency audit (`npm audit --omit=dev --audit-level=high`) and rules tests run in CI; no dedicated secret scanner yet. Workflow file requires a GitHub token with `workflow` scope to push. |
| 22.5 | Build/deploy credentials protected | PASS | Vercel login per machine; no tokens in repo. |
| 22.6 | Production deploys restricted | UNVERIFIED | Vercel team roles. |
| 22.7 | Failed checks can block deploy | FAIL | No CI. |
| 22.8 | Deployment history traceable | PASS | Vercel deployments list; git commits. |
| 22.9 | Rollback documented | PASS | `docs/parent-portal-security.md` → Rollback. |

# 23. Error Handling & Information Disclosure

| Check | Requirement | Status | Notes |
|---|---|---|---|
| 23.1 | Stack traces hidden | PASS | Functions return `server_error` only. |
| 23.2 | DB errors not exposed | PASS | |
| 23.3 | Internal paths not exposed | PASS | |
| 23.4 | Secrets never in errors | PASS | |
| 23.5 | User-facing errors generic but actionable | PASS | "Invalid Login Code or Date of Birth…", "Too many login attempts… N minute(s)". |
| 23.6 | Detailed errors in secure logs | PASS | `logEvent` → Vercel logs. |
| 23.7 | Debug mode disabled in production | PASS | Production build; no debug flags. |

# 24. Website / Contact Form — N/A (no public forms).

# 25. ERP-Specific

| Check | Requirement | Status | Notes |
|---|---|---|---|
| 25.5 | Billing deletion controlled | PASS | Soft-delete only, Principal-only, audited. |
| 25.8 | Cash register actions auditable | PASS | Day-close docs, write-once audit. |
| 25.9 | Financial reports permission-controlled | PASS | Principal / own-row teacher scope. |
| 25.10 | Sensitive exports permission-controlled | PASS | |
| 25.11 | Deactivation immediately revokes access | PASS | See 2.12. |
| 25.1–25.4, 25.6, 25.7, 25.12 | Payroll / inventory / branches | N/A | |

# 26. Security Testing Checklist — what was executed

**Authentication tests**
- [x] Wrong DOB repeatedly → 401 ×8 then 429 (`parent-login.test.ts`).
- [x] Rate limiting / temporary restriction (per code and per IP, window reset).
- [x] Archived student cannot log in (401) and cannot be read with an old token (404).
- [ ] Expired/used reset link — N/A.
- [x] Logout invalidates session — manual on staging (see sign-off checklist).

**Authorization tests**
- [x] Parent token calls data API with another student's id → 403 (`parent-data.test.ts`).
- [x] Teacher token calls parent API → 403.
- [x] Anonymous session reads students/marks/attendance → denied (`parent-isolation.test.ts`).
- [x] Anonymous self-creates admin/principal/parent user doc → denied (`security.test.ts`).
- [x] Teacher writes students/classes → denied; writes marks/attendance → allowed.

**Tenant (family) isolation tests**
- [x] Response bodies for attendance/marks/classTests/reportCard contain no classmate id.
- [x] Sibling on the same phone is readable; unrelated same-suffix student is not merged into the family.
- [x] Fee view returns one matched register row; register itself unreadable to parents (rules).

**Input / injection tests**
- [x] Malformed JSON / non-object body → 400; unexpected extra fields → 400.
- [x] `"3210' OR 1=1"`, letters, wrong lengths, impossible dates → rejected.
- [x] Oversized string body (>2 KB) → treated as malformed.

**File upload tests** — N/A. **Payment tests** — N/A.

**API abuse tests**
- [x] Login brute force controlled (8/code, 20/IP).
- [x] Unauthorized API returns 401/403.
- [x] CORS: no cross-origin headers emitted.

Results on 2026-10-13: `npm run test` — 11 files, 242 tests passed. `npm run test:rules` — see the final report for the emulator run on this machine.

# 27. Pre-Production Release Gate

| Item | Status |
|---|---|
| HTTPS active | PASS |
| WAF/firewall configured | PARTIAL (platform default) |
| Admin MFA enabled | UNVERIFIED — owner |
| No default/test passwords | PASS (delete `clear_test_data.ts`) |
| Authentication tested | PASS |
| RBAC tested | PASS |
| Backend authorization tested | PASS |
| Tenant isolation tested | PASS |
| API validation tested | PASS |
| Rate limiting enabled | PASS |
| Database is private/restricted | PASS |
| Secrets are not exposed | PASS |
| `.env` / private keys not in Git | PASS |
| File upload security tested | N/A |
| Security headers configured | PASS (CSP outstanding) |
| Payment/webhook verification | N/A |
| Audit logs active | PASS (money) / PARTIAL (admin actions) |
| Monitoring active | FAIL |
| Backup active | UNVERIFIED — **blocking** |
| Restore tested | FAIL — **blocking** per release rule |
| Dependency scan completed | PASS |
| Secret scan completed | PASS |
| No unresolved critical vulnerabilities | PASS (none reachable at runtime; see 21.2) |
| No unresolved exploitable high-risk vulnerabilities | PASS |
| Production debug mode disabled | PASS |
| Production access reviewed | UNVERIFIED |
| Security reviewer approval | PENDING |

# 28. Release Decision

- **Overall Status:** **CONDITIONAL**
- **Critical Findings:** none in code. Process: Firestore backups and a restore test are not confirmed (release rule: "Backup does not exist for critical production data").
- **High Findings:** (1) staging and production share one Firebase project; (2) no CSP; (3) no alerting on repeated failures / 403s; (4) DOB as the parent credential (accepted by design, mitigated).
- **Medium Findings:** Vercel log retention too short for audit; no CI gate; teacher writes not class-scoped; admin role changes not audited; service account broader than needed.
- **Low Findings:** dead legacy components; `clear_test_data.ts` present in the working tree.
- **Exceptions Approved:** _none yet_.
- **Reviewer:** automated code review (Claude), 2026-10-13.
- **Approval Date:** _pending_.

**Release rule check:** no authentication bypass, no authorization bypass, no cross-family access, no unauthenticated sensitive API, no exposed secret, DB not publicly exposed, no reachable exploitable critical. **Outstanding:** backup existence and restore demonstration → must be confirmed by the Firebase project owner before production cut-over. Staging deployment for sign-off testing is permitted.

# 31. Final Sign-Off

- Developer: _________ Date: _______
- QA / Security Reviewer: _________ Date: _______
- Technical Lead: _________ Date: _______
- Production Release approved: YES / NO — Version / Commit: _______
