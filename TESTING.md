# DocPulse — Testing Strategy

This document describes the test suites **as they are currently implemented** in this repository: the libraries each layer depends on, what every test file actually verifies, and why that verification exists. It is derived directly from the test source files themselves (`frontend/src/**/*.test.tsx`, `backend/test/**/*.test.ts`, `e2e/tests/*.spec.ts`) and their configuration (`frontend/vite.config.ts`, `backend/jest.config.js`, `e2e/playwright.config.ts`), not from intent or design docs.

Companion reading: [`TECHNICAL_DOCUMENTATION.md`](./TECHNICAL_DOCUMENTATION.md) (system architecture) and [`docs/architecture/`](./docs/architecture/README.md) (request-lifecycle diagrams).

---

## 1. Three layers, three different guarantees

The project runs three independent test suites, each trading off realism against speed differently. No single layer is "better", they check different things and are meant to be read together.

| Layer | Runner | Real browser? | Real backend process? | Real database? | Network mocking | Speed |
|---|---|---|---|---|---|---|
| **Frontend** (`frontend/`) | Vitest + jsdom | No (simulated DOM) | No | No | **MSW** intercepts every `fetch` at the network layer | Fastest (whole suite in seconds) |
| **Backend** (`backend/`) | Jest + `ts-jest` | No | Yes, in-process (unit tests) or the real Express app object (integration tests) | Yes — dedicated local `TEST_DATABASE_URL` Postgres DB | None — real HTTP-shaped requests via `supertest` | Fast (~1-2 min for 176 tests) |
| **End-to-End** (`e2e/`) | Playwright (Chromium) | **Yes**, real headless browser | Yes, a real spawned `node dist/server.js` process | Yes — same local test Postgres DB as the backend suite | None — real SMTP, real HTTP over the wire | Slowest (~1-8 min depending on retries/timeouts) |

Consequence: only the **frontend** suite can run with zero external setup (no DB, no server). The **backend** and **e2e** suites both require a local Postgres database reachable via `TEST_DATABASE_URL` (set in `backend/.env`) before they can run at all, both `backend/test/util/testEnv.ts` and `e2e/env.ts` throw immediately if it's missing. The **e2e** suite additionally requires a real SMTP account configured in `backend/.env` (`SMTP_*`), since it has no mocked or catcher-based email path, e2e test runs send real emails.

---

## 2. Frontend Tests (`frontend/src/**/*.test.tsx`, `*.test.ts`)

### 2.1 Libraries

| Library | Version | Role |
|---|---|---|
| `vitest` | ^4.1.11 | Test runner, assertions (`describe`/`it`/`expect`), configured in `vite.config.ts`'s `test` block |
| `jsdom` | ^30.0.1 | Simulated DOM/`window`/`document` environment — no real rendering, no CSS layout, no real network |
| `@testing-library/react` | ^16.3.3 | Mounts React components into jsdom; query API (`getByRole`, `getByPlaceholderText`, `getByTestId`, ...) |
| `@testing-library/jest-dom` | ^7.0.1 | DOM-specific matchers (`toBeInTheDocument`, `toHaveTextContent`, ...) |
| `@testing-library/user-event` | ^14.6.7 | Simulates realistic user interaction (typing, clicking) by dispatching real DOM events |
| `msw` (Mock Service Worker) | ^2.15.0 | Intercepts `fetch` calls at the network layer and returns fixture JSON — no real backend is ever reached |
| `@vitejs/plugin-react` | ^6.0.4 | Reuses the app's own Vite/React transform pipeline for test compilation |

### 2.2 How the mocking boundary works

`frontend/src/test/setupTests.ts` starts an MSW server (`server.listen({ onUnhandledRequest: "error" })`) before any test runs; `frontend/src/test/msw/handlers.ts` defines a fixture response for every endpoint the app calls (keyed to `http://localhost:3000`, matching the dev proxy target). Individual tests override a specific handler via `server.use(...)` for error/edge cases. `onUnhandledRequest: "error"` means any call the fixtures don't cover fails the test loudly rather than silently trying to reach a real network. **This means frontend tests validate UI logic against a hand-maintained contract, not the real backend** — if the real API's response shape drifts from these fixtures, these tests keep passing while the real app breaks.

### 2.3 What's covered, and why

**Shared infra** — `frontend/src/test/`: `render.tsx` (a `renderWithProviders` helper that wraps a component in `RouterProvider` + `AuthProvider` and pre-seeds `window.history`), `setupTests.ts`, `msw/` (server + handlers).

| File | Covers | Why it's covered |
|---|---|---|
| `App.test.tsx` | Non-admin redirected away from `/admin*` to `/dashboard` with a toast, no React 19 render-phase side-effect warning; doctors aren't redirected from `/dashboard`; redirect doesn't re-fire on re-render | Route guarding is the only thing standing between a non-admin and the admin panel; React 19 is strict about side effects fired during render |
| `context/AuthContext.test.tsx` | Unauthenticated by default; hydrates from `localStorage`; tolerates corrupt JSON; login success/failure; logout clears state; reacts to a `SESSION_EXPIRED_EVENT`; notification auto-dismiss (fake timers) | This context is the single source of truth for auth state app-wide — a bug here breaks every protected page at once |
| `context/RouterContext.test.tsx` | Reads initial path/search/query param; `navigate()` push vs `replace`; calls `window.scrollTo`; responds to `popstate` (browser back button) | This is a **hand-rolled router** (no `react-router`), so its correctness isn't backed by a maintained library's own test suite — it needs its own |
| `utils/passwordPolicy.test.ts` | Each password rule (length≥12, upper/lower/number/special) individually and combined; overall validity | Password policy is duplicated between here and the backend's own signup validation — must stay correct independently on both sides |
| `utils/cn.test.ts` | Class-name joining, falsy-value dropping, Tailwind conflict resolution (last wins), conditional object syntax | Used by nearly every styled component; a regression here has UI-wide blast radius |
| `utils/istDateTime.test.ts` | IST date/time rollover at the UTC 18:30 boundary; past/future/boundary comparisons | The backend anchors "is this appointment in the past" to IST regardless of server timezone — the frontend must agree exactly, including at the day-rollover instant |
| `components/Navbar.test.tsx` | Auth-state-dependent nav rendering; Admin-only shortcuts; brand-click destination varies by role | Nav is the only element present on almost every authenticated page |
| `api/*.test.ts` (`profileApi`, `adminApi`, `doctorApi`, `appointmentApi`, `authApi`) | Each API wrapper function returns the right shape on success; correctly parses/normalizes the backend's error envelope (including the Joi-array `data` shape) into a consistent `{success, error}` result; network-error fallback | These wrappers are the **only** place that translates the backend's inconsistent response envelopes (see [doc 08](./docs/architecture/08-error-decision-flows.md)) into one shape the UI can rely on — a parsing bug here surfaces as a wrong or missing error message everywhere |
| `api/apiClient.test.ts` | Passes through on success; `skipAuthRefresh` bypass; refreshes once on 401 and retries exactly once (no infinite loop); single-flights concurrent refresh calls; ends session cleanly when refresh itself fails | This is the token-refresh interceptor sitting under every authenticated call — a bug here means either silent auth failures or a refresh request storm |
| `pages/DashboardPage.test.tsx` | Correct default tab and greeting per role (Patient/Doctor/Admin) | Sole entry point after login; wrong default tab is the first thing every user would notice |
| `pages/AcceptInvitationPage.test.tsx` | Invalid/expired/garbage token states; role-specific fields (patient vs doctor); live password checklist; password-mismatch error; successful submit redirects to `/login`; server-rejection banner | This is the only account-creation path in the app (no self-serve signup for doctors/admins) |
| `pages/LoginPage.test.tsx` | Field presence; required/format validation; successful login toast; server-rejected credentials error; in-flight loading state; navigation to `/register` | The single authentication gate for the whole app |
| `pages/PatientSelfRegisterPage.test.tsx` | Validation; identical "Check Your Inbox" confirmation regardless of whether the email already exists | Mirrors a real backend guarantee: this endpoint must never let the UI leak whether an email is already registered (user/account enumeration) |
| `pages/ProfilePage.test.tsx` | Loading state; role-specific form (patient height/weight vs doctor experience); Admin sees a static message and **skips the fetch entirely**; range validation; server-error handling | Admins have no profile row in the DB — the UI must know not to even ask for one |
| `pages/admin/AdminInvitationsPage.test.tsx` | Table rendering with role/status badges; debounced (300ms) search; status/role filters; invite/revoke flows; role selector **excludes Patient** while the filter still offers it historically; no Revoke action for USED/REVOKED rows | Encodes a real business rule change (admins can no longer invite patients — see [doc 04](./docs/architecture/04-admin-flows.md)) directly into what the UI does and doesn't allow |
| `components/ui/{Button,FormField,Modal}.test.tsx` | Loading/disabled states; label/hint/error rendering; open/close semantics (Escape, backdrop click, `closeOnEscape`/`disableClose`) | Base primitives reused across virtually every form/dialog in the app |
| `components/auth/PasswordRequirementChecklist.test.tsx` | All 5 rules shown unmet for empty input; individual pass/fail styling | The only real-time feedback a user gets while choosing a password |
| `components/doctor/DoctorAvailabilitySection.test.tsx` | Grouped-by-date rendering; client-side rejection of `start ≥ end` and past dates; exact request payload shape; server `AVAILABILITY_OVERLAP` error surfaced | Availability publishing is the doctor-side precondition for every booking that follows |
| `components/doctor/DoctorAppointmentsSection.test.tsx` | Confirm/Decline/Complete button enabled state is **time-dependent** (disabled once the scheduled time has passed/not yet arrived); status filter re-fetches | Encodes the same time-gating rules the backend enforces (see [doc 05](./docs/architecture/05-appointment-lifecycle.md)) so the UI doesn't offer an action the API will reject |
| `components/admin/BulkInviteModal.test.tsx` | Client-side CSV/size rejection; full-success, partial-failure (with filter-to-failed view), and all-PATIENT-FAILED result summaries; `onSuccess` fires only when ≥1 invite actually succeeded | Bulk invite is the only batch operation in the app — its partial-failure UX needs explicit coverage |
| `components/admin/AdminLayout.test.tsx` | Sidebar/header navigation; outside-click closes profile dropdown; Sign Out fires logout | Shared shell for every admin page |
| `components/patient/PatientAppointmentsList.test.tsx` | Cancel action visible only for future PENDING appointments; cancel flow via confirmation modal | Mirrors the backend's own cancel-eligibility rule |
| `components/patient/PatientDoctorDiscovery.test.tsx` | Search/specialization filters re-fetch; booking modal opens after fetching doctor availability; error alert on availability-fetch failure | The entry point to the entire booking journey |
| `components/patient/AppointmentBookingModal.test.tsx` | Past-dated windows filtered from the date picker; 30-minute slots correctly generated around a bisected availability window; same-day already-passed slot rejected client-side; exact `POST` payload; server `DOCTOR_NOT_AVAILABLE` shown without closing | Slot-generation logic is entirely client-side (the backend just validates the chosen range), so its correctness has no server-side backstop |

---

## 3. Backend Tests (`backend/test/**/*.test.ts`)

### 3.1 Libraries

| Library | Version | Role |
|---|---|---|
| `jest` | ^29.7.0 | Test runner (`jest.config.js`: `ts-jest` transform, path-alias mapping matching `tsconfig.json`, `testMatch: **/test/**/*.test.(ts\|js)`) |
| `ts-jest` | ^29.4.12 | Compiles TypeScript test/source files on the fly |
| `supertest` | ^6.3.4 | Fires real HTTP-shaped requests at the app's Express instance in-process (no real socket/port) |
| `typeorm` | ^0.2.29 | Real ORM/query access to the test database from both app code and test fixtures |
| `bcrypt` | ^5.1.0 | Hashes fixture passwords exactly as the app does, so `loginAgent()` can log in as a fixture user for real |
| `jsonwebtoken` | ^9.0.0 | Used directly in fixtures to hand-craft tokens (e.g. `signExpiredRefreshToken`) for negative-path tests |
| `express-rate-limit` | ^8.6.2 | The library under direct test in `rateLimiter.test.ts` |
| `pg` | ^8.10.0 | Postgres driver underlying TypeORM's connection to the test DB |

### 3.2 Unit vs. Integration

- **Unit** (`backend/test/unit/`, 2 files): a single module in isolation. `rateLimiter.test.ts` mounts the middleware on a throwaway, single-route Express app built inline in the test, no DB, no app bootstrap. `email-templates.test.ts` calls plain template-builder functions directly, no HTTP, no DB at all.
- **Integration** (`backend/test/integration/`, 12 files): the **real** `src/app.ts` Express app, via `test/util/testApp.ts`'s `setupIntegrationTest()`, which awaits the app's own DB-ready promise, runs real TypeORM migrations once, and — before **every individual test** — truncates all business tables and reseeds two known specializations (`test/util/testDb.ts`). Every `EmailService` method is mocked by default (`mockAllEmailDelivery()`) so no integration test can trigger a real SMTP send; tests that care about a specific email re-spy on it. Fixture helpers in `test/util/factories.ts` insert real rows via raw SQL and drive real endpoints via `supertest` + `loginAgent()`.

Both categories run together under one `npm run test` (`jest --detectOpenHandles --forceExit --verbose --runInBand --coverage`, from `backend/package.json`) — `--runInBand` is required because every integration file shares one physical test database and resets it around itself.

### 3.3 What's covered, and why

**Unit**

| File | Covers | Why |
|---|---|---|
| `rateLimiter.test.ts` | The patient self-registration limiter returns 429 with its configured message once the per-IP ceiling is exceeded (with `NODE_ENV` flipped away from `test`); confirms the limiter is fully bypassed under `NODE_ENV=test` | This is the platform's first fully public, unauthenticated write endpoint — worth verifying directly rather than trusting config alone; every other test in the suite relies on the test-env bypass working |
| `email-templates.test.ts` | Every lifecycle email builder (invitation, appointment requested/confirmed/declined/cancelled/completed) has correct subject/content, and doesn't leak content it shouldn't (e.g. completed email doesn't leak medical details, declined email doesn't fabricate a reason) | Emails are the only channel some users see appointment-state changes through (no in-app notification center) |

**Integration**

| File | Covers | Why |
|---|---|---|
| `admin-bulk-invite.test.ts` | CSV bulk-invite happy path; PATIENT rows always FAILED; file-type/size/row-count rejection; per-row FAILED handling without failing the whole batch; in-file duplicate and cross-file existing-user detection; role/auth gating | The only batch-write endpoint in the API — partial failure handling is easy to get subtly wrong |
| `admin-invitations.test.ts` | Admin can no longer invite PATIENT; listing's search/role/status filters, including a regression check that JS-computed status matches the SQL-side filter; revoke's success/404/409/403 paths | Encodes a real, deliberate business-rule change (patients self-register now, admins can't invite them) directly as an enforced contract |
| `appointment-listing.test.ts` | Pagination/filter/sort on both patient and doctor listing endpoints; doctor listing scoped to only the caller's own appointments; invalid filter combos 400; **listing itself auto-expires stale (>48h) PENDING appointments to REJECTED** as a side effect | The stale-expiry side effect is easy to regress silently since it's not the endpoint's primary purpose |
| `appointment.test.ts` | Past-date/elapsed-cancel rejection; availability-window clamping around "now"; **double-booking and status-update races proven safe via real concurrent HTTP requests**; role-gated status transitions; booking-abuse caps (per-doctor and global) enforced and race-tested; email-per-transition correctness, including that a race sends exactly one confirmation email and an email failure doesn't fail the appointment update | Concurrent booking is the single highest-consequence correctness property in the app (a race here means two patients booked into the same slot) — proven with real concurrent requests against the real DB exclusion constraint, not mocked |
| `auth.test.ts` | Refresh-cookie flow incl. distinct expired-vs-invalid messages and cookie flags; generic 401 for both wrong-password and non-existent-email (no user enumeration); **IDOR checks** — a patient/doctor can't view or act on another patient's/doctor's appointment (404, not 403) | Login/session and cross-tenant data isolation are the two things a security review would check first |
| `doctor-availability-query.test.ts` | Own-availability endpoint returns raw windows; **public availability endpoint correctly bisects a window around a busy appointment, excludes fully-booked windows, re-includes a cancelled appointment's freed slot, and splits a window into three around two busy ranges** | This busy-slot-subtraction logic is the entire booking system's source of truth for "what's actually free" — the highest-complexity pure logic in the backend |
| `doctor-availability.test.ts` | Happy path; past-date/past-time/inverted-range rejection; real DB exclusion-constraint-backed 409 on overlap | The overlap guarantee here is enforced at the database level (GIST exclusion constraint), not just app logic — worth testing against the real DB |
| `doctor.test.ts` | Inactive specializations excluded from signup and rejected if used; profile GET/PATCH role-gating; experienceYears bounds (0–80); specializationId immutable post-signup (rejected via unknown-key validation, not silently dropped) | Confirms an immutability rule is actively enforced, not just absent from the update DTO by omission |
| `invitation.test.ts` | Doctor/patient invite→accept persists role-specific fields; client-supplied role override never honored; a failed signup step **rolls back the whole transaction** (invitation stays usable, retry succeeds); concurrent accept calls on one token yield exactly one success; expired/used/revoked/garbage tokens all rejected; per-field validation | The accept-invitation transaction's rollback-on-failure and single-use-under-concurrency properties are exactly the kind of thing that looks correct in code review but fails under real concurrent load |
| `patient-self-register.test.ts` | New email creates invitation + sends email; existing patient/doctor/admin/already-invited emails all return the **identical generic response** (no enumeration) without creating a row or sending mail; extensive malicious-input validation (SQLi-shaped, HTML-shaped, non-string, array, unknown field); soft-deleted users treated as available; **2-way/10-way/multi-email concurrent requests never create duplicate invitations**; full self-register→accept flow; admin can still revoke/list self-registration-sourced invitations | This is the platform's first fully public, unauthenticated write endpoint — both the injection-hardening and the no-enumeration guarantee need direct proof, not just code inspection |
| `patient.test.ts` | Profile GET/PATCH role-gating; partial update doesn't null out the other field; height/weight bounds (30–300cm, 2–500kg); bloodGroup/dob immutable post-signup | Same immutability + partial-update-safety pattern as `doctor.test.ts` |
| `security.test.ts` | Standard Helmet security headers (nosniff, X-Frame-Options, HSTS, no `X-Powered-By`) present on both a generic and an auth response | Baseline security-header hygiene, checked directly rather than assumed from Helmet being configured |

---

## 4. End-to-End Tests (`e2e/tests/*.spec.ts`, Playwright)

### 4.1 Libraries

| Library | Version | Role |
|---|---|---|
| `@playwright/test` | ^1.62.1 | Test runner + real Chromium browser automation (`e2e/playwright.config.ts`) |
| `pg` | ^8.10.0 | Direct Postgres access for seeding fixtures the UI can't reasonably reach in a test's timeframe (`e2e/utils/db.ts`, `e2e/utils/fixtures.ts`) |
| `bcrypt` | ^6.0.0 | Hashes directly-seeded fixture passwords identically to the backend, so a seeded account can log in through the real UI |
| `dotenv` | ^16.4.5 | Loads `backend/.env` so the e2e harness shares the same `TEST_DATABASE_URL` as the Jest suite, no separate credential copy |

### 4.2 How it boots

`e2e/playwright.config.ts`'s `webServer` array spawns **two real processes** before any test runs: the backend via `npm run serve` (env `DATABASE_URL` explicitly overridden to `TEST_DATABASE_URL`, so it's the same local Postgres DB the Jest suite uses) and the frontend via `npm run dev`. `globalSetup` (`e2e/global-setup.ts`) compiles the backend fresh, runs real TypeORM migrations, and wipes the test DB before the run starts, independent of whether the Jest suite has ever run on this machine. Each spec file additionally resets the DB and seeds its own exact fixtures in its own `beforeAll` (`fullyParallel: false, workers: 1`, since every spec shares that one DB).

Two things that make this suite meaningfully different from the other two:
- **No email mock exists at this layer.** `backend/.env`'s real SMTP credentials are used, so booking/inviting flows send genuine emails. Fixtures that need a raw invitation token bypass the UI's invite-sending step by seeding a `user_invitations` row directly with a token generated the exact same way the backend does (`generateInvitationToken()` in `e2e/utils/fixtures.ts`), since the real token only ever exists in the outgoing email body or the inviting admin's own response, never in the DB (which stores only its hash).
- **This is the only layer with a real rendered UI.** The frontend recently added a public marketing landing page at `/` for unauthenticated visitors (`frontend/src/App.tsx`); the actual login form now lives at `/login`. Every spec that needs to authenticate navigates to `/login` explicitly rather than `/`.

### 4.3 What's covered, and why

| File | Journeys | Why an e2e test (not just integration/unit) |
|---|---|---|
| `smoke.spec.ts` | Login page loads against the real backend + test DB | Cheapest possible "is anything fundamentally broken" signal |
| `auth-failure-paths.spec.ts` | Invalid-credentials error toast; expired/garbage invitation links; forced logout when the session becomes invalid (cookies dropped mid-session) | The forced-logout case specifically exercises the *client's* reaction to a 401 (via `apiClient`'s failed-refresh path) in a real browser — something a jsdom test can assert on directly, but only e2e proves the whole real request/response/redirect chain actually happens |
| `patient-self-register.spec.ts` | Login↔self-register navigation; client-side email-format rejection; identical confirmation for a new vs. already-registered email | Re-verifies the no-enumeration guarantee (also unit-tested in the backend) end-to-end through the real UI and real backend together |
| `doctor-onboarding.spec.ts` | Doctor accepts invitation, logs in, publishes an availability slot | The full account-activation journey, real UI form validation included |
| `patient-booking.spec.ts` | Patient accepts invitation → logs in → discovers a doctor → books a slot, appointment appears as Pending Approval | The canonical end-to-end happy path tying together onboarding, discovery, and booking through the real UI, real backend, real (bisected) availability, and real outbound emails |
| `patient-booking-conflict.spec.ts` | A real 409 conflict surfaces correctly when a viewed slot is taken before the patient confirms | A genuine race condition between "viewing" and "confirming" a slot — needs a real browser session to reproduce the timing gap realistically |
| `doctor-confirms-appointment.spec.ts` / `doctor-rejects-appointment.spec.ts` | Doctor confirms/declines a pending request in one browser context; the patient (separate browser context) sees the status update | Uses **two independent browser contexts** in the same test to prove the state change is visible cross-session, not just to the actor who made it |
| `patient-cancels-appointment.spec.ts` | Patient cancels a confirmed appointment; doctor (separate context) sees it cancelled | Same cross-session pattern as above, for the cancellation path |
| `doctor-completes-past-appointment.spec.ts` | Doctor marks a past confirmed appointment as completed | The precondition (a confirmed appointment whose time has already passed) has **no real-UI path to create it** — the "Confirm" button is disabled once time passes — so it's seeded directly, then the completion action itself is driven for real |
| `profile-updates.spec.ts` | Doctor updates years of experience; doctor's out-of-range experience rejected client-side without a server round-trip; patient updates height/weight | Confirms client-side validation actually prevents a network call, not just that it *would* be rejected server-side |
| `admin-bulk-invite.spec.ts` | Admin sends a single invitation; bulk-invites via CSV with a partial failure | The only two admin-side flows that both display results (single toast vs. a full per-row results table) — worth proving the real UI renders each correctly |

---

## 5. Running the suites

| Command | Runs |
|---|---|
| `npm run test:frontend` (from repo root) or `cd frontend && npm test` | Vitest, all `*.test.ts(x)` under `frontend/src` |
| `npm run test:backend` or `cd backend && npm test` | Jest, all unit + integration tests, against the local `TEST_DATABASE_URL` Postgres DB |
| `npm run test:e2e` | Playwright, all specs under `e2e/tests`, against real spawned backend + frontend dev servers and the same local test DB |
| `npm run test:e2e:ui` | Same, in Playwright's interactive UI mode |
| `npm run test:all` | All three, sequentially |

---

## 6. Known limitations (verified, not assumed)

- **No visual regression testing exists at any layer.** jsdom (frontend) doesn't compute CSS layout or paint pixels at all; Playwright captures screenshots only on failure, for debugging, there's no baseline image-diffing. A component can be visually broken (invisible text, overlapping elements, broken layout) while every test still passes.
- **Frontend tests validate against hand-maintained MSW fixtures, not a live contract.** If the real backend's response shape drifts from `frontend/src/test/msw/handlers.ts`, frontend tests keep passing while the real integration breaks; only the e2e suite would catch that, since it's the only layer where frontend and backend talk to each other for real.
- **The e2e suite sends real email** through live SMTP credentials in `backend/.env` — there is no test-mode stub or catcher (e.g. Mailhog/Ethereal) wired in at this layer, unlike the Jest integration suite, which mocks `EmailService` entirely.
- **All three suites are fully isolated from real dev/prod data.** Frontend tests touch no database at all; both the backend and e2e suites are hard-wired to a separate local `TEST_DATABASE_URL` Postgres database (distinct from the cloud-hosted `DATABASE_URL` used by `npm run dev`/normal usage) and will refuse to run at all if that variable isn't set.
