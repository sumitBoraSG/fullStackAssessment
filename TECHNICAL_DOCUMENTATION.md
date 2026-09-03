# DocPulse — Technical Documentation

This document describes the system **as it is currently implemented** in this repository. It is derived entirely from the source code (routes, controllers, services, repositories, entities, migrations, middleware, frontend components and API clients) rather than from design intent. Where the implementation has a gap, inconsistency, or an unusual choice relative to typical best practice, this is called out explicitly rather than glossed over. Anything that could not be established from the code is stated as such — nothing here is invented.

Audience: a developer joining the project who needs to understand what exists today before changing it.

---

## 1. Project Overview

DocPulse is a doctor–patient appointment booking system. It lets a clinic (or single admin) onboard doctors and patients by invitation, lets doctors publish blocks of time they are available and maintain a profile, and lets patients search for doctors and book appointments inside those time blocks. It manages the resulting appointment through a small state machine (request → confirm/reject → complete, or cancel) and prevents a doctor or patient from being double-booked at the database level.

### Roles

The system has exactly three roles, defined in `backend/src/database/enum/userRole.ts`:

- **ADMIN** — invites new users (doctors, patients, or other admins) by email, manages the invitation list, can bulk-invite via CSV.
- **DOCTOR** — completes signup with a specialization and years of experience, publishes availability windows, views/searches their own appointments, confirms/rejects/completes appointment requests, and can update their years-of-experience afterwards.
- **PATIENT** — completes signup with date of birth/height/weight/blood group, searches for doctors, views a doctor's free slots, books an appointment, views/cancels their own appointments, and can update their height/weight afterwards.

There is no self-registration: every account is created by accepting an admin-issued invitation (see [Section 10](#10-invitation-system)).

### High-level architecture

```
┌────────────────────┐        HTTPS (cookies)         ┌──────────────────────────────┐
│  React SPA (Vite)  │ ─────────────────────────────▶ │  Express API (TypeScript)    │
│  frontend/src      │ ◀───────────────────────────── │  backend/src                 │
└────────────────────┘                                |   Helmet → CORS → routes →   │
                                                      |   middleware → controllers → │
                                                      │   services → repositories    │
                                                      │   (TypeORM)                  │
                                                      └───────────────┬──────────────┘
                                                                      │
                                                                      ▼
                                                      ┌──────────────────────────────┐
                                                      │  PostgreSQL                  │
                                                      │  (tstzrange + GIST exclusion │
                                                      │   constraints for booking)   │
                                                      └──────────────────────────────┘
                                                                      │
                                                                      ▼
                                                      ┌──────────────────────────────┐
                                                      │  SMTP (Nodemailer)           │
                                                      │  invitation + appointment    │
                                                      │  lifecycle emails            │
                                                      └──────────────────────────────┘
```

The backend is a single Express application (no microservices, no queue/worker layer). Authentication is stateless JWT carried in HttpOnly cookies. There is no server-side session store — "logout" simply clears cookies.

---

## 2. Technology Stack

### Frontend (`frontend/`)

| Concern | Technology | Why it's used here |
|---|---|---|
| UI framework | **React 19** | Component-based SPA; the whole UI is client-rendered. |
| Language | **TypeScript** (`~6.0.2`) | Type safety across API payloads and component props. |
| Build tool / dev server | **Vite 8** (`@vitejs/plugin-react`) | Fast dev server + production bundling for the SPA. |
| Styling | **Tailwind CSS 4** (via `@tailwindcss/vite`) | Utility-first styling used throughout every page/component. |
| Shared UI kit | `frontend/src/components/ui/` (`Alert`, `Badge`, `Button`, `Card`, `EmptyState`, `FormField`, `Modal`, `Skeleton`, `Spinner`, `TextInput`) | A small internal component library — buttons, form fields, modals, badges, alerts, skeleton/spinner loading states — shared across admin, doctor, and patient screens instead of each page hand-rolling markup. |
| Class merging | **clsx**, **tailwind-merge**, wrapped in `frontend/src/utils/cn.ts` (`cn(...inputs) => twMerge(clsx(inputs))`) | Used throughout the UI kit and pages for conditional/merged Tailwind class strings. |
| Icons | **lucide-react** | Icon set used across all pages/components. |
| State management | **React Context** (`AuthContext`, `RouterContext`) — no Redux/Zustand | Two small global contexts are sufficient for this app's scope: authenticated user + notification state, and current path/navigation. |
| Routing | **Custom router** (`RouterContext.tsx`) built on `window.history` (`pushState`/`replaceState`) and `popstate` | There is **no `react-router` dependency**. Routing is a hand-rolled context that exposes `path`, `search`, `getParam`, and `navigate`; `App.tsx` does manual `if (path === ...)` branching to decide which page to render. |
| HTTP/API communication | Native `fetch`, wrapped in `frontend/src/api/apiClient.ts` | A single `apiFetch()` helper attaches `credentials: "include"` (so cookies are sent), and transparently retries a request once after a silent `/auth/refresh` call if the server returns 401. |
| Linting | **oxlint** | Frontend lint script (`npm run lint`). |

There is still no client-side test runner configured in `frontend/package.json` (no Jest/Vitest/RTL/Playwright dependency or script present).

### Backend (`backend/`)

| Concern | Technology | Why it's used here |
|---|---|---|
| Runtime | **Node.js** (`engines.node >= 18.15.0`) | |
| Framework | **Express 4** | REST API; routes registered per resource (`/auth`, `/admin`, `/doctor`, `/doctors`, `/patient`, `/appointments`). |
| Language | **TypeScript** (compiled via `tsc`, path aliases resolved at runtime with `module-alias`) | |
| ORM | **TypeORM 0.2.x** with `typeorm-naming-strategies` (`SnakeNamingStrategy`) | Maps camelCase entity properties to snake_case columns/tables. Decorator-based entities (`@Entity`, `@Column`, `@Exclusion`, …). |
| Authentication | **jsonwebtoken** (JWT, HS256 by default) + **bcrypt** for password hashing | Access + refresh tokens signed with two separate secrets; passwords hashed with `bcrypt` at cost factor 12. |
| Request validation | **Joi** (`@hapi/joi`) via a small `HttpRequestValidator` middleware | Every route validates `body`/`query`/`params` against a Joi schema before reaching the controller. |
| Security headers | **helmet** (`^7.2.0`) | Applied unconditionally via `Kernel.initSecurityHeaders` — see [Section 14](#14-security). |
| Security middleware | **cors**, **cookie-parser**, **express-rate-limit** | See [Section 14](#14-security). |
| Logging | **winston** | Structured logs to console (colorized) and to `debug.log` file; log level is `debug` outside production, `error` in production. |
| Email/SMTP | **nodemailer**, via a modular `EmailService` (`backend/src/service/email/`) | Sends invitation emails and the full appointment-lifecycle email set — see [Section 9 — Email System](#email-system). |
| CSV parsing | **csv-parse** | Parses the uploaded CSV for bulk invitations. |
| File upload | **multer** (in-memory storage, 5 MB limit, CSV mimetype/extension filter) | Used only for the bulk-invite CSV endpoint. |
| i18n | **i18n** | Configured with English/Spanish locales; used only for the generic fallback error message (`i18n.__("ERR10001")`) in the error middleware — the rest of the app's user-facing strings are plain English constants in `constant.ts`, not i18n keys. |
| Error monitoring | **@sentry/node** | Request handler is registered unconditionally; the Sentry **error** handler middleware is only attached if `SENTRY_DSN` is set. |
| Request tracing | Custom `RequestIDMiddleware` (`uuid`) | Adds an `x-request-id` response header per request. |
| Rate limiting | **express-rate-limit** (`^8.6.2`) | Three named limiters: `general`, `auth`, `invitation` (see [Section 4](#4-authentication-and-authorization)) — all bypassed automatically when `NODE_ENV=test`. |
| Testing | **Jest** + **ts-jest** + **supertest** | A real integration + unit test suite now exists under `backend/test/` — see [Section 18](#18-testing). |
| Other notable dependencies present but not central to the reviewed flows | `aws-sdk`, `axios`, `typedi`, `swagger-jsdoc`, `swagger-ui-express`, `express-handlebars`, `express-http-context`, `typeorm-pagination`, `moment-timezone` | Still present in `package.json` but **not found to be used** anywhere in `backend/src` (e.g. IST time handling uses `Intl.DateTimeFormat`, not `moment-timezone`; no Swagger route is registered in `api/route/index.ts`, and the `backend/swagger-doc/` directory exists but is empty). Treat as inherited/unused dependencies unless you find an active call site. |

### Database

| Concern | Detail |
|---|---|
| Engine | **PostgreSQL** (via `pg` driver) |
| ORM | TypeORM 0.2.x, `synchronize: false` — schema changes must go through migrations, not auto-sync |
| Naming | `SnakeNamingStrategy` — e.g. entity property `firstName` → column `first_name` |
| Core tables/entities | `users`, `doctors`, `patients`, `specializations`, `doctor_availabilities`, `appointments`, `user_invitations` (see [Section 11](#11-database-design)) |
| Range types | `doctor_availabilities.availability_time` and `appointments.appointment_time` are **`tstzrange`** columns (Postgres timestamp-with-timezone ranges), not separate start/end timestamp columns |
| Double-booking prevention | PostgreSQL **`EXCLUDE ... USING GIST`** constraints (see below) — enforced by the database itself, not just application logic |
| Soft deletion | `users.deleted_at` (`@DeleteDateColumn`) — user queries explicitly filter `deleted_at IS NULL`; there is no soft-delete column on `doctors`, `patients`, `appointments`, or `doctor_availabilities` |

Constraints declared on the entities:

- `doctor_availabilities`: `EXCLUDE USING GIST (doctor_id WITH =, availability_time WITH &&)` — a doctor cannot have two overlapping availability windows, regardless of status.
- `appointments`: two exclusion constraints —
  - `appointments_no_doctor_overlap`: `USING GIST (doctor_id WITH =, appointment_time WITH &&) WHERE (status IN ('PENDING','CONFIRMED'))`
  - `appointments_no_patient_overlap`: `USING GIST (patient_id WITH =, appointment_time WITH &&) WHERE (status IN ('PENDING','CONFIRMED'))`

  Together these mean: a doctor cannot hold two overlapping PENDING/CONFIRMED appointments, and a patient cannot hold two overlapping PENDING/CONFIRMED appointments — but a `CANCELLED`, `REJECTED`, or `COMPLETED` appointment does **not** block a new booking over the same time range, because it's excluded by the `WHERE` clause.

- `user_invitations`: a **partial unique index**, `idx_user_invitations_active_email ON user_invitations (email) WHERE used_at IS NULL AND revoked_at IS NULL` — see [Section 10](#10-invitation-system).

**Migrations** — three migration files exist in `backend/src/database/migration/`, and together they provision the schema from an empty database (this is a change from an earlier state of the repository, where only an index-adding migration existed with no baseline):

1. `20260101000000-InitialSchema.ts` — the baseline. Creates the `btree_gist` extension (required to combine an equality column with a range column in a GIST exclusion constraint), the three enum types (`user_role`, `appointment_status`, `blood_group`), all seven tables with their foreign keys and exclusion constraints, and seeds four starter rows into `specializations`: *General Practitioner*, *Cardiology*, *Dermatology*, *Pediatrics*.
2. `20260827120000-AddAppointmentQueryIndexes.ts` — adds `idx_appointments_patient_id_status` on `(patient_id, status)`, `idx_appointments_doctor_id_status` on `(doctor_id, status)`, and a GIST index `idx_appointments_appointment_time_gist` on `appointment_time`.
3. `20260827130000-AddActiveInvitationUniqueIndex.ts` — adds the partial unique index above, to make duplicate-pending-invitation prevention race-proof at the database level (see [Section 10](#10-invitation-system)).

### Infrastructure / configuration

- **Environment variables** (from `backend/.env.example`; no values reproduced here beyond placeholders): `DATABASE_URL`, `TEST_DATABASE_URL`, `PORT`, `NODE_ENV`, `LOG_LEVEL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `ACCESS_TOKEN_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `FRONTEND_URL`. `backend/src/config/secret.ts` now calls a `validateEnv()` function at import time that **throws at startup** if any of `DATABASE_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, or `FRONTEND_URL` is missing. This is a partial fix relative to an earlier state of the codebase: the four variables above now fail fast, but `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`, `PORT`, `ACCESS_TOKEN_EXPIRES_IN`/`REFRESH_TOKEN_EXPIRES_IN`, and `LOG_LEVEL` are still read unvalidated — a missing SMTP variable, for example, will still only surface when an email actually tries to send.
- **Migrations**: run with `npm run migrate` (`typeorm migration:run`), reading `ormconfig.ts` at the backend root.
- **Dev/build/start commands**: see [Section 17](#17-development-guide).
- **Deployment assumptions**: `docker-compose.yml` in `backend/` defines a `ts-bp` app service (built from `dev/docker/Dockerfile`, which does exist in this repository at `backend/dev/docker/Dockerfile`) and a Postgres container (`ts-bp_postgres`), for local development only — there is no separate production deployment manifest (no Kubernetes/ECS config, no reverse-proxy config) in this repository. `app.ts` now calls `this.app.set("trust proxy", 1)` — the app trusts exactly one upstream proxy hop, which is what `express-rate-limit`'s `req.ip` detection and secure-cookie logic rely on when deployed behind a load balancer.

---

## 3. Architecture

### Backend layering

```
Request
  │
  ▼
Kernel bootstrap (backend/src/core/kernel.ts, wired from app.ts)
  — Sentry request handler → helmet() → body-parser (json/urlencoded) →
    request-id + CORS → cookie-parser → DB connection → i18n.init → routes →
    Sentry error handler (if SENTRY_DSN set) → global error middleware
  │
  ▼
Route (backend/src/api/route/*.ts)
  — wires: rate limiter → auth middleware → authorization middleware → Joi validator → controller method
  │
  ▼
Middleware (backend/src/middleware/*)
  — AuthMiddleware: verifies the accessToken cookie, sets req.user = { id, role }
  — AuthorizationMiddleware: checks req.user.role against an allow-list
  — HttpRequestValidator: validates body/query/params against a Joi schema, else sends a 400
  — RateLimitMiddleware: general / auth / invitation limiters (express-rate-limit), skipped when NODE_ENV=test
  │
  ▼
Controller (backend/src/api/controller/*.ts)
  — thin: pulls values off req.body/req.query/req.params/req.user, calls one service method,
    shapes the HTTP response, forwards errors to next(error)
  │
  ▼
Service (backend/src/service/*.ts)
  — business rules: past/future validation, status-transition rules, invitation lifecycle rules,
    profile validation, availability/free-slot computation, response shaping
  — throws http-errors (createError.BadRequest/NotFound/Conflict/Unauthorized) on rule violations
  │
  ▼
Repository (backend/src/database/repository/*.ts)
  — TypeORM QueryBuilder / Repository calls only; no business rules here
  │
  ▼
PostgreSQL (via TypeORM connection, entities defined with decorators)
```

Errors thrown anywhere in a service (or a rejected promise anywhere, since `express-async-errors` is imported as a side effect in `app.ts`) are caught and passed to the global `errorMiddleware` (`backend/src/middleware/error.ts`), which reads `.status`, `.message`, `.code` off the error (the shape used by both `HttpException` and the `http-errors` library) and returns a uniform JSON envelope.

### Frontend architecture

- `main.tsx` mounts `<App />` inside `<StrictMode>`.
- `App.tsx` wraps everything in `RouterProvider` → `AuthProvider`, then does manual path-based branching (no route table/config) to decide which top-level page to show:
  - `/accept-invitation*` → `AcceptInvitationPage` (public, works regardless of auth state).
  - Not authenticated (any other path) → `LoginPage`.
  - Authenticated **ADMIN**: `/dashboard` → `DashboardPage`; `/profile` → `ProfilePage`; anything else (the default) → `AdminLayout` wrapping `AdminInvitationsPage`.
  - Authenticated **DOCTOR/PATIENT**: a path starting with `/admin` redirects to `/dashboard` with an error notification; `/profile` → `ProfilePage`; anything else (the default) → `DashboardPage`, which itself switches between sub-sections (`PatientDoctorDiscovery`/`PatientAppointmentsList` or `DoctorAppointmentsSection`/`DoctorAvailabilitySection`) via local tab state, not the router.
  - `/profile` is available to **every** authenticated role and is reachable from a "Profile" button in `Navbar.tsx` (all roles) and from the profile dropdown in `AdminLayout.tsx` (admin only).
- **API modules** (`frontend/src/api/*Api.ts`) are the only place `fetch`/`apiFetch` is called. Each function: builds the request, calls `apiFetch`, parses JSON, and normalizes the result into a consistent `{ success, message?, data?, error? }` shape for the UI — regardless of whether the backend responded with its `{status,message,code,data}` envelope or `{success,...}` envelope (see [Section 12](#12-api-reference)). Components never call `fetch` directly.
- **Contexts**: `AuthContext` holds `user`, `isAuthenticated`, `isLoading`, and a single global `notification` (auto-dismissed after 5s), plus `login`/`logout`. `RouterContext` holds `path`/`search`/`navigate`/`getParam`.
- **Persistence**: only the logged-in `user` object is cached in `localStorage` (`docpulse_user`) for the initial render; the actual auth tokens live only in HttpOnly cookies and are never touched by JavaScript.
- **Shared UI kit**: `frontend/src/components/ui/` provides `Button`, `TextInput`, `FormField`, `Card`, `Modal`, `Alert`, `Badge`, `EmptyState`, `Spinner`, and `Skeleton`. Newer pages/components (`ProfilePage`, its forms, and the updated admin/dashboard/login pages) are built on this shared kit rather than one-off markup.
- No dedicated state-management or data-fetching library (no React Query/SWR/Redux) — each component manages its own `useState`/`useEffect`/`useCallback` fetch lifecycle.

---

## 4. Authentication and Authorization

### Login flow

1. `POST /auth/login` (rate-limited: `auth` limiter) → validated with `loginSchema` (`email`, `password` required).
2. `AuthController.login` calls `AuthService.login(email, password)`.
3. `AuthService.login`:
   - Looks up the user by lowercased email where `deleted_at IS NULL` (`AuthRepository.findUserForLogin`).
   - Compares the supplied password with `bcrypt.compare` against `hashedPassword`.
   - On failure (`user` not found or wrong password): throws `401 Unauthorized` with `INVALID_CREDENTIALS` — the same message either way (no user-enumeration signal).
   - On success: signs an **access token** (`jwt.sign({ id, role }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN })`) and a **refresh token** (`jwt.sign({ id, type: "refresh" }, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN })`).
4. `AuthController.login` sets both tokens as **HttpOnly cookies** (`accessToken`, `refreshToken`), `sameSite: "lax"`, `secure` only when `NODE_ENV === "production"`, `path: "/"`, with `maxAge` derived from the same expiry strings. The JSON response body contains only `{ user: { id, firstName, lastName, email, role } }` — the tokens themselves are never present in the response body or accessible to JavaScript.

### Token lifetimes — as currently configured

`backend/.env.example` ships with:
```
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
```
This is the conventional pattern (short-lived access token, long-lived refresh token). There is no code that validates or enforces a particular relationship between the two values — whatever is set in the deployed `.env` is used as-is — but the shipped example values are now sane.

### Refresh flow

- `POST /auth/refresh` (rate-limited: `auth` limiter) reads the `refreshToken` cookie only — no request body.
- `AuthService.refresh`: verifies the refresh JWT against `REFRESH_TOKEN_SECRET`, checks `decoded.type === "refresh"`, re-fetches the user (`findUserForRefresh`, filtered on `deleted_at IS NULL`), and — if all checks pass — issues a **new access token only**. The refresh token itself is **not rotated/reissued**, and there is no server-side revocation list, so a given refresh token remains valid (and reusable) until it expires or the user's account is deleted. This is unchanged from the prior implementation — it is a still-open item, not something recently fixed.
- On an expired refresh token or any other JWT verification error: `401` with `INVALID_REFRESH_TOKEN`.
- **Frontend integration** (`frontend/src/api/apiClient.ts`): `apiFetch()` wraps every request. If a response comes back `401` (and the caller hasn't opted out with `skipAuthRefresh`, and this isn't already a retry), it calls `getRefreshedAccessToken()` — which de-dupes concurrent refreshes behind a single shared in-flight promise — then retries the original request exactly once. If the refresh call itself fails, the client calls `POST /auth/logout` (best-effort, ignoring network errors), clears `localStorage`, and dispatches a `docpulse:session-expired` window event, which `AuthContext` listens for to clear `user` and fall back to the login page.

### Logout

- `POST /auth/logout` (rate-limited: `auth` limiter) clears both cookies with the same options they were set with (`httpOnly`, `secure` in prod, `sameSite: "lax"`, `path: "/"`). This is a client-side-cookie-clear only — since JWTs are stateless and not tracked server-side, a token that was already copied out of its cookie (which shouldn't be possible from JS given `httpOnly`) would still validate until it expires.

### Authentication middleware

`AuthMiddleware.authenticate` (`backend/src/middleware/auth.middleware.ts`) — applied to nearly every route except `/auth/login`, `/auth/refresh`, `/auth/accept-invitation`, `/auth/invitation/:token`, `/auth/logout`, and `/doctors/specializations`:
- Reads `req.cookies.accessToken`.
- Missing cookie → `401 AUTH_TOKEN_REQUIRED`.
- `jwt.verify` against `JWT_SECRET`.
- On success, sets `req.user = { id: decoded.id, role: decoded.role }`.
- Any verification failure (expired, malformed, wrong secret) → `401 AUTH_TOKEN_INVALID`.

### Authorization middleware

`AuthorizationMiddleware.authorize(...allowedRoles)` (`backend/src/middleware/authorization.middleware.ts`) — a factory that returns middleware checking `req.user.role` is in the allowed list:
- No `req.user` (shouldn't happen after `authenticate`, but defensive) → `401 USER_NOT_AUTHENTICATED`.
- Role not in the allow-list → `403 ACCESS_FORBIDDEN`.

Applied per-route, e.g.:
- `POST /admin/invite`, `GET /admin/invitations`, `POST /admin/invitations/:id/revoke`, `POST /admin/invitations/bulk` → `UserRole.ADMIN` only.
- `POST/GET /doctor/availability`, `GET /doctor/appointments`, `PATCH /doctor/appointments/:id/status`, `GET/PATCH /doctor/profile` → `UserRole.DOCTOR` only.
- `GET/PATCH /patient/profile` → `UserRole.PATIENT` only.
- `GET /doctors` and `GET /doctors/:doctorId/availability` → `PATIENT`, `DOCTOR`, and `ADMIN` (any authenticated role can browse doctors and their availability).
- `GET /doctors/specializations` → **public**, no `authenticate` call at all (see below) — only the `general` rate limiter applies.
- `GET/POST /appointments`, `PATCH /appointments/:id/status` → `UserRole.PATIENT` only.

**IDOR protection**: appointment and availability lookups are always scoped to the authenticated user's own id in the repository query itself (e.g. `findDoctorAppointmentById(appointmentId, doctorId)` filters `WHERE id = :appointmentId AND doctor_id = :doctorId`; `findPatientAppointmentById` filters by `patient_id`), not just checked after the fact — so a doctor cannot act on another doctor's appointment, and a patient cannot act on another patient's appointment, even if they guess a valid id.

### Rate limiting

Three `express-rate-limit` instances (`backend/src/middleware/rateLimiter.middleware.ts`), all windowed at 15 minutes, all keyed on the default `express-rate-limit` identity (derived from `req.ip`), and all automatically **skipped when `NODE_ENV === "test"`** (`skip: () => ENVIRONMENT === "test"`) so the integration test suite isn't throttled:

| Limiter | Window | Max requests | Applied to |
|---|---|---|---|
| `general` | 15 min | **1000** | Most authenticated GET/PATCH/POST routes (availability, appointments, profiles, doctor discovery, invitation listing/revoke). |
| `auth` | 15 min | **300** | `/auth/login`, `/auth/refresh`, `/auth/accept-invitation`, `/auth/invitation/:token`, `/auth/logout`. |
| `invitation` | 15 min | **500** | `POST /admin/invite`, `POST /admin/invitations/bulk`. |

Because `app.set('trust proxy', 1)` is now called in `app.ts`, the limiter's `req.ip` resolution (and `secure`-cookie detection) correctly reflects the real client when the app sits behind exactly one reverse-proxy hop (its own load balancer). It would not correctly identify the client through more than one untrusted hop, but that is a deployment-topology concern outside this codebase.

---

## 5. Admin API / Flow

All admin routes live under `/admin` (`backend/src/api/route/admin.routes.ts`), require `authenticate` + `authorize(ADMIN)`.

### `POST /admin/invite`

- **Purpose**: invite a single user (any role) by email.
- **Auth**: ADMIN. Rate limit: `invitation`.
- **Body** (`inviteUserSchema`): `{ email: string (valid email, required), role: "ADMIN"|"DOCTOR"|"PATIENT" (required) }`.
- **Flow** (`AdminService.inviteUser`):
  1. Trim/lowercase email.
  2. Reject if a non-deleted user with that email already exists → `409 USER_ALREADY_EXISTS`.
  3. Fast-path reject if a **pending** invitation already exists for that email (`findPendingInvitation`) → `409 INVITATION_ALREADY_SENT`. This check alone is not race-proof (see step 4); it just avoids an unnecessary insert attempt in the common case.
  4. Generate a raw 32-byte random token (`crypto.randomBytes(32).toString("hex")`), SHA-256 hash it, and insert `{ email, role, hashedToken, expiresAt: now + 24h, createdBy, updatedBy }` via `createInvitationRaceProof`, which is backed by the partial unique index `idx_user_invitations_active_email` (see [Section 2](#2-technology-stack) and [Section 10](#10-invitation-system)):
     - If the insert succeeds, continue.
     - If Postgres raises a unique-violation (`23505`) on that index, look up the conflicting active invitation. If it has actually **expired** (`expiresAt <= now` but not yet marked used/revoked), revoke it and retry the insert exactly once. If it is still genuinely active, throw `409 INVITATION_ALREADY_SENT` — the same code as the fast-path check, just now backed by a real database constraint rather than a plain check-then-insert race.
  5. Send the invitation email (Nodemailer, via `EmailService.sendInvitationEmail`) containing a link `${FRONTEND_URL}/accept-invitation?token=<raw token>`. **If sending fails**, `AdminService.inviteUser` now catches the error, deletes the just-created invitation row (`invitationRepository.deleteInvitation`), and throws `500 FAILED_TO_SEND_INVITATION` — this is a compensating action, so (unlike an earlier version of this flow) a failed send no longer leaves an orphaned, never-emailed invitation row behind. There is still no automatic retry and no dedicated "resend" endpoint; the admin's only recourse is to invite the same email again.
  6. Returns `{ id, email, role, expiresAt }`.
- **Response**: `201` `{ success: true, message: "Invitation sent successfully", data: { id, email, role, expiresAt } }`.
- **Note on scope**: this endpoint (and the frontend's "Invite New User" modal) lets an admin issue an invitation for **any** of the three roles, including `ADMIN` — there is no restriction preventing an admin from inviting another admin.

### `GET /admin/invitations`

- **Purpose**: paginated, searchable, filterable list of all invitations.
- **Auth**: ADMIN. Rate limit: `general`.
- **Query** (`getInvitationsQuerySchema`): `page`, `limit` (≤100), `search` (matches email, case-insensitive substring), `status` (`PENDING`/`USED`/`EXPIRED`/`REVOKED`), `role`.
- **Flow** (`AdminService.getAllInvitations` → `InvitationRepository.findAllInvitations`): builds a query with the optional filters, orders by `created_at DESC`, paginates. **Status is derived, not stored** — computed per row as: `revokedAt` set → `REVOKED`; else `usedAt` set → `USED`; else `expiresAt < now` → `EXPIRED`; else `PENDING`.
- **Response**: `200` `{ success, message, data: InvitationItem[], pagination: { page, limit, total, totalPages } }`.

### `POST /admin/invitations/:id/revoke`

- **Purpose**: invalidate a pending invitation.
- **Auth**: ADMIN. Rate limit: `general`.
- **Params**: `id` (positive integer).
- **Flow** (`AdminService.revokeInvitation`): loads the invitation by id → `404 INVITATION_NOT_FOUND` if missing; `409 INVITATION_ALREADY_REVOKED` if already revoked; `400 CANNOT_REVOKE_USED_INVITATION` if already used; otherwise sets `revokedAt = now`.
- **Response**: `200` with the updated invitation, `status: "REVOKED"`.

### `POST /admin/invitations/bulk`

- **Purpose**: invite many users at once from a CSV upload.
- **Auth**: ADMIN. Rate limit: `invitation` (shared budget with single invites). Body: `multipart/form-data`, field `file`.
- **Upload constraints** (`multer`, `upload.middleware.ts`): in-memory storage, **5 MB max file size**, mimetype/extension must be `text/csv` or `.csv`. **There is still no limit on the number of rows** in the CSV — a large file (up to 5 MB) can still contain many thousands of rows.
- **Flow**:
  1. `AdminController.bulkInviteUsers` parses the CSV synchronously (`csv-parse/sync`, `columns: true`) into `{ email, role }[]`.
  2. `AdminService.bulkInviteUsers` iterates rows **sequentially, in a single `for...of` loop, awaiting each one**. For each row: normalizes email/role, validates with `bulkInviteRowSchema`, rejects a row whose (normalized) email repeats **earlier in the same file** with `DUPLICATE_EMAIL_IN_FILE` (a check added since duplicate-invitation handling was hardened — it does not hit the database at all, just an in-memory `Set` of emails seen so far in this request), and otherwise processes the row through the exact same `inviteUser()` method as the single-invite endpoint — meaning **one SMTP send per valid row, one at a time, inside the same HTTP request**. There is still no batching, queueing, or background job; the request handler does not return until every row has been attempted.
  3. Each row's outcome is collected into a `results[]` array with `status: "INVITED"|"FAILED"` and a `reason` on failure (validation error, `DUPLICATE_EMAIL_IN_FILE`, or whatever error `inviteUser` threw, e.g. `USER_ALREADY_EXISTS`/`INVITATION_ALREADY_SENT`).
- **Response**: `200` `{ success: true, message: "Bulk invitation process completed", data: { total, successful, failed, results } }` — note this always returns `200` even if every row failed; the per-row status must be inspected in `data.results`.

---

## 6. Doctor API / Flow

Split across two route groups: `/doctor` (doctor-only actions, all `authorize(DOCTOR)`) and `/doctors` (discovery, open more broadly).

### `POST /doctor/availability`

- **Purpose**: publish a new availability window.
- **Auth**: DOCTOR. Rate limit: `general`.
- **Body** (`createAvailabilitySchema`): `date` (`YYYY-MM-DD`), `startTime`/`endTime` (`HH:mm`, 24h) — all required.
- **Flow** (`DoctorService.createAvailability`):
  1. Reject if `date` is before today **in IST** (`getISTTodayString`) → `400 AVAILABILITY_DATE_IN_PAST`.
  2. Reject if `startTime >= endTime` → `400 INVALID_AVAILABILITY_TIME`.
  3. If `date` is today, reject if `startTime <= current IST time` → `400 AVAILABILITY_TIME_IN_PAST`.
  4. Confirm the doctor profile row exists (FK requirement) → `404` if not.
  5. Build the range literal as `[date T startTime:00+05:30, date T endTime:00+05:30)` — the `+05:30` UTC offset is hardcoded directly into the string (this is how "IST" is encoded on write; it is not derived from a timezone library at this point).
  6. Insert via `DoctorAvailabilityRepo`. If Postgres raises `23P01` (exclusion constraint violation, i.e. overlaps an existing window for this doctor) → caught and re-thrown as `409 AVAILABILITY_OVERLAP`.
- **Response**: `201` `{ success: true, data: { id, doctorId, date, startTime, endTime, createdAt } }`.

### `GET /doctor/availability`

- **Purpose**: doctor views their **own** availability windows (raw, unfiltered).
- **Auth**: DOCTOR. Rate limit: `general`. Query: optional `date`.
- **Flow** (`DoctorService.getOwnAvailability`): confirms the doctor exists, fetches raw availability rows (optionally overlapping the given date), parses each `tstzrange` into `{ id, date, startTime, endTime }` via `parseRangeToIST`. **This view does not subtract busy (booked) time or clamp to "now"** — it shows the doctor's published windows exactly as stored, including past and fully-booked ones. (Contrast with the patient-facing view below.)
- **Response**: `200` `{ success: true, data: AvailabilitySlot[] }`.

### `GET /doctor/appointments` and `PATCH /doctor/appointments/:appointmentId/status`

Documented together with the patient equivalents in [Section 8](#8-appointment-lifecycle), since the underlying service (`AppointmentService`) is shared. In short:
- `GET /doctor/appointments` — paginated/filterable/sortable list of the doctor's own appointments (`AppointmentController.getDoctorAppointments` → `AppointmentService.getDoctorAppointments`, scoped to `doctorId = req.user.id`).
- `PATCH /doctor/appointments/:appointmentId/status` — body `{ status: "CONFIRMED"|"REJECTED"|"COMPLETED" }` (`doctorAppointmentStatusBodySchema`); doctors cannot set `CANCELLED` through this endpoint.

### `GET /doctor/profile` and `PATCH /doctor/profile`

- **Purpose**: a doctor views and partially updates their own profile.
- **Auth**: DOCTOR. Rate limit: `general`.
- **GET flow** (`DoctorService.getProfile`, backed by `DoctorController.getProfile`): `404 DOCTOR_NOT_FOUND` if the doctor row is missing; otherwise returns `{ id, firstName, lastName, email, specialization, experienceYears }`, where `specialization` is the specialization **name** (a string), not the id.
- **PATCH body** (`updateDoctorProfileSchema`, `profile.validation.ts`): `{ experienceYears: integer, 0–80, required }`. **`specializationId` is not accepted by this endpoint at all** — a doctor's specialization is fixed at signup (see [Section 10](#10-invitation-system)) and cannot be changed through the API. The frontend's `DoctorProfileForm.tsx` renders specialization in a read-only card and only exposes years-of-experience as an editable field, consistent with this.
- **Response**: `200` with the same shape as the GET. Errors: `404 DOCTOR_NOT_FOUND`; `400` Joi validation error if `experienceYears` is missing or out of range.

### `GET /doctors` (discovery)

- **Purpose**: search/browse doctors.
- **Auth**: PATIENT, DOCTOR, or ADMIN. Rate limit: `general`.
- **Query** (`getDoctorsQuerySchema`): `search` (name substring), `specialization` (numeric id **or** name substring), `date` (only return doctors with at least one availability window overlapping that date), `page`, `limit` (default 1/10, max 100).
- **Flow** (`DoctorRepository.findAllDoctors`): joins `doctors` → `user` (inner, `deleted_at IS NULL`) → `specialization` (left); applies the optional filters; the `date` filter uses a correlated subquery against `doctor_availabilities`.
- **Response shape** (`DoctorService.getDoctors`): `{ doctors: [{ id, firstName, lastName, specialization, experienceYears }], pagination }`. The list response **does not** include the doctor's email — only `id`, `firstName`, `lastName`, `specialization` (name, falling back to `"General Practitioner"` if unset), and `experienceYears` are mapped through.

### `GET /doctors/:doctorId/availability`

- **Purpose**: the view a patient uses to decide what to book — a doctor's **bookable** free time.
- **Auth**: PATIENT, DOCTOR, or ADMIN. Rate limit: `general`. Query: optional `date`.
- **Flow** (`DoctorService.getDoctorAvailability`) — see [Section 9 — Availability System](#9-availability-system) for the full algorithm. In short: start from the doctor's raw availability windows, subtract any time already covered by that doctor's `PENDING`/`CONFIRMED` appointments, then drop/clamp segments relative to "now".
- **Response**: `{ doctor: { id, firstName, lastName, specialization, experienceYears }, availability: AvailabilitySlot[] }` — note this doctor summary does **not** include email (same as the list endpoint above).

### `GET /doctors/specializations`

- **Purpose**: populate the specialization dropdown/filter — including on the invitation-acceptance signup form, before the user has an account.
- **Auth**: **public** — no `authenticate` call on this route at all, only the `general` rate limiter. This is a deliberate change: the accept-invitation signup flow needs a doctor invitee to pick a specialization before they have any session/cookie, so the endpoint has to be reachable pre-authentication.
- **Flow**: `DoctorRepository.getSpecializations()` — rows from `specializations` **filtered to `is_active = true`**, ordered by name. `findSpecializationById` (used to validate a submitted `specializationId` at signup and profile-update time) applies the same `isActive = true` filter, so an inactive specialization can neither be selected at signup nor pass validation, and is consistently excluded from the dropdown — this is now consistent, whereas an earlier version of the endpoint returned every row regardless of `is_active`.
- **Response**: `{ success: true, data: [{ id, name, description }] }`.

---

## 7. Patient API / Flow

### `GET /appointments`

- **Purpose**: the patient's own appointment list.
- **Auth**: PATIENT. Rate limit: `general`.
- **Query** (`getPatientAppointmentsQuerySchema`): `page`, `limit` (≤100), `status`, `date` **or** `dateFrom`/`dateTo` (mutually exclusive — supplying both `date` and a range → `400 INVALID_DATE_FILTER`), `doctorId`, `sortBy` (`appointmentTime`|`createdAt`|`updatedAt`), `order`.
- **Response**: `{ appointments: PatientAppointment[], pagination }`, where each appointment is formatted by `formatPatientAppointment` (status, date/startTime/endTime in IST, timestamps, and an embedded `doctor: { doctorId, firstName, lastName, specialization, experienceYears }` — no doctor email).

### `POST /appointments` — booking

- **Purpose**: request an appointment with a doctor.
- **Auth**: PATIENT. Rate limit: `general`.
- **Body** (`createAppointmentSchema`): `doctorId` (positive int), `date` (`YYYY-MM-DD`), `startTime`/`endTime` (`HH:mm`) — all required.
- **Flow** (`AppointmentService.createAppointment`):
  1. Reject if `date` is before today in IST → `400 APPOINTMENT_DATE_IN_PAST`.
  2. Reject if `startTime >= endTime` → `400 INVALID_APPOINTMENT_TIME`.
  3. If `date` is today, reject if `startTime <= current IST time` → `400 APPOINTMENT_TIME_IN_PAST`.
  4. Confirm the doctor exists → `404 DOCTOR_NOT_FOUND`.
  5. Confirm the patient profile exists → `404 PATIENT_NOT_FOUND`.
  6. Build the `[start,end)` range literal with the hardcoded `+05:30` offset, exactly as for availability.
  7. **Availability check**: find a `doctor_availabilities` row for this doctor whose range **fully contains** (`@>`) the requested range (`findDoctorAvailabilityForAppointment`). If none → `409 DOCTOR_NOT_AVAILABLE`. This means the requested slot must fit entirely inside one published availability window — booking cannot span across two adjacent windows even if they're contiguous.
  8. Insert the appointment with `status: PENDING`. If Postgres raises `23P01` (an exclusion-constraint conflict — this doctor or this patient already has an overlapping active appointment) → caught and re-thrown as `409 APPOINTMENT_TIME_UNAVAILABLE`. This is the actual, database-enforced defense against double-booking; the availability-containment check in step 7 only tells you the slot is nominally open, not that a race with another booking hasn't just filled it — the exclusion constraint is what makes double-booking impossible even under concurrent requests.
  9. On success, sends the "appointment requested" notification emails (patient + doctor, best-effort — see [Section 9 — Email System](#email-system)).
- **Response**: `201` `{ success: true, data: { id, status: "PENDING", date, startTime, endTime, createdAt, updatedAt, doctor: { doctorId, firstName, lastName, specialization, experienceYears } } }` — this now matches the same nested shape (`PatientAppointment`) that `GET /appointments` and the status-update endpoint return; an earlier version of this endpoint returned a flatter, differently-shaped object here, which no longer applies.

### `PATCH /appointments/:appointmentId/status` — cancellation

- **Purpose**: patient cancels their own appointment.
- **Auth**: PATIENT. Rate limit: `general`.
- **Body** (`patientAppointmentStatusBodySchema`): `{ status: "CANCELLED" }` — this is the **only** value the schema accepts; a patient cannot set any other status through this endpoint.
- **Flow** (`AppointmentService.cancelAppointment`):
  1. Load the appointment scoped to `id + patientId` → `404` if not found/not owned.
  2. Confirm requested status is `CANCELLED` (defensive — schema already enforces this) → else `400 PATIENT_CAN_ONLY_CANCEL`.
  3. Confirm current status is `PENDING` or `CONFIRMED` → else `400 INVALID_STATUS_TRANSITION` (blocks cancelling an already `COMPLETED`/`REJECTED`/`CANCELLED` appointment).
  4. **Confirm the scheduled time has not already passed** (`isISTDateTimeInPast(scheduled.date, scheduled.startTime)`) → `409 CANNOT_CANCEL_PAST_APPOINTMENT` if it has.
  5. Update status to `CANCELLED` via a compare-and-swap update (see [Section 8](#8-appointment-lifecycle)) and send the doctor-facing cancellation email (best-effort).
- **Response**: `200` with the updated, fully-formatted `PatientAppointment`.
- **Frontend enforcement**: `PatientAppointmentsList.tsx` computes `isCancellable = (status is PENDING or CONFIRMED) && !isISTDateTimeInPast(apt.date, apt.startTime)` and only renders the "Cancel Appointment" button when true.

### `GET /patient/profile` and `PATCH /patient/profile`

- **Purpose**: a patient views and partially updates their own profile.
- **Auth**: PATIENT. Rate limit: `general`.
- **GET flow** (`PatientService.getProfile`): `404 PATIENT_NOT_FOUND` if the patient row is missing; otherwise returns `{ id, firstName, lastName, email, heightCm, weightKg, bloodGroup, dob }`.
- **PATCH body** (`updatePatientProfileSchema`, `profile.validation.ts`): `{ heightCm?: integer 30–300, weightKg?: integer 2–500 }`, with the object required to carry **at least one** of the two fields (`.min(1)`) — otherwise a `400` validation error. **`bloodGroup` and `dob` are not accepted by this endpoint** — both are fixed at signup and cannot be changed afterwards through the API. Only the fields actually present in the body are persisted (`PatientService.updateProfile` drops `undefined` keys before calling the repository, so patching `heightCm` alone does not null out `weightKg`). The frontend's `PatientProfileForm.tsx` renders `dob`/`bloodGroup` in a read-only card and only exposes height/weight as editable fields, consistent with this.
- **Response**: `200` with the same shape as the GET. Errors: `404 PATIENT_NOT_FOUND`; `400` Joi validation error.

### Booking flow, end to end (search → book)

1. `PatientDoctorDiscovery` loads `GET /doctors/specializations` (for the filter dropdown) and `GET /doctors` (the list, with search/specialization/date filters and pagination).
2. Clicking "Book Appointment" on a doctor card calls `GET /doctors/:doctorId/availability` to fetch that doctor's free slots, and opens `AppointmentBookingModal` with the result.
3. The modal groups the doctor's free slots by date (client-side, filtering out any date earlier than "today" in IST as a UI-level safeguard) and offers 30-minute sub-slots computed by walking each availability window in 30-minute steps; a "custom time range" `<details>` panel lets the patient override the exact start/end within the chosen window instead.
4. On submit, the modal re-validates date/time-not-in-the-past client-side (mirroring the backend rules) before calling `POST /appointments`.
5. On success, `onSuccess` bubbles the created appointment up to `PatientDoctorDiscovery` → `DashboardPage`, which switches the active tab to "My Appointments".

`AppointmentBookingModal` now resets its `selectedDate`/`startTime`/`endTime`/error/success state via a `useEffect` keyed on `[isOpen, doctorDetails?.doctor.id]` — reopening the modal for a different doctor (or reopening it at all) no longer leaves stale selections or messages from a previous doctor visible.

---

## 8. Appointment Lifecycle

### Statuses

Defined in `backend/src/database/enum/AppointmentStatus.ts`: `PENDING`, `CONFIRMED`, `REJECTED`, `COMPLETED`, `CANCELLED`.

### Valid transitions (enforced in `AppointmentService.updateAppointmentStatus` / `cancelAppointment`)

```
PENDING
 ├── CONFIRMED   (doctor only, via PATCH /doctor/appointments/:id/status)
 ├── REJECTED    (doctor only)
 └── CANCELLED   (patient only, via PATCH /appointments/:id/status)

CONFIRMED
 ├── COMPLETED   (doctor only)
 └── CANCELLED   (patient only)

REJECTED    — terminal, no further transitions
COMPLETED   — terminal, no further transitions
CANCELLED   — terminal, no further transitions
```

The doctor-side allow-list is defined explicitly in code as:
```ts
PENDING:   [CONFIRMED, REJECTED]
CONFIRMED: [COMPLETED]
REJECTED:  []
COMPLETED: []
CANCELLED: []
```
Any request outside this map → `400 INVALID_STATUS_TRANSITION`.

### Timing restrictions

- A doctor **cannot confirm** an appointment whose scheduled start time has already passed (`assertAppointmentTimeAllowsTransition`) → `409 APPOINTMENT_TIME_ALREADY_PASSED`.
- A doctor **cannot mark an appointment completed** before its scheduled start time has arrived → `409 APPOINTMENT_NOT_YET_STARTED`. (Note: this check is based on the appointment's **start** time having passed, not its end time — a doctor can mark an appointment `COMPLETED` as soon as its start time is reached, even before the scheduled end time.)
- A patient **cannot cancel** a `PENDING`/`CONFIRMED` appointment once its scheduled start time has passed → `409 CANNOT_CANCEL_PAST_APPOINTMENT`. This applies uniformly regardless of whether the appointment was `PENDING` or `CONFIRMED`.
- All of the above "has it passed" checks use the same `isISTDateTimeInPast` helper (`backend/src/util/dateTimeRange.ts`), anchored to `Asia/Kolkata` wall-clock time via `Intl.DateTimeFormat`.

### Who can do what — summary

| Transition | Actor | Endpoint |
|---|---|---|
| `PENDING → CONFIRMED` | Doctor (owner) | `PATCH /doctor/appointments/:id/status` |
| `PENDING → REJECTED` | Doctor (owner) | `PATCH /doctor/appointments/:id/status` |
| `CONFIRMED → COMPLETED` | Doctor (owner) | `PATCH /doctor/appointments/:id/status` |
| `PENDING → CANCELLED` | Patient (owner) | `PATCH /appointments/:id/status` |
| `CONFIRMED → CANCELLED` | Patient (owner) | `PATCH /appointments/:id/status` |

An admin has no endpoint to change appointment status directly — nothing in `admin.routes.ts` touches appointments.

### Concurrent status updates — now guarded with a compare-and-swap

`AppointmentRepository.updateAppointmentStatusByDoctor` / `updateAppointmentStatusByPatient` now issue:

```sql
UPDATE appointments
SET status = :status
WHERE id = :appointmentId AND doctor_id = :ownerId AND status = :expectedStatus
```

i.e. the `UPDATE`'s `WHERE` clause requires the row's status to still equal the status the service read moments earlier (`expectedStatus`), not just the id and owner. `AppointmentService.updateAppointmentStatus`/`cancelAppointment` check `result.affected`: if it is falsy — meaning some other request changed the status in between the service's read and this write — the service throws `409 APPOINTMENT_STATUS_CONFLICT` ("This appointment was already updated by another request. Please refresh and try again.") instead of silently succeeding. This resolves what used to be a genuine race: two concurrent status-change requests against the same appointment can no longer both silently "succeed" with the second one overwriting the first — the loser of the race now gets an explicit `409`. The double-booking-specific race (two different appointments landing on the same doctor/time) continues to be handled separately by the `EXCLUDE` constraint on `appointment_time`.

---

## 9. Availability System

All of the logic below lives in `backend/src/service/doctor.service.ts` and `backend/src/util/dateTimeRange.ts`.

### Creating availability

A doctor submits `{ date, startTime, endTime }` (wall-clock, IST implied). The service builds a Postgres range literal `[YYYY-MM-DDTHH:mm:00+05:30, YYYY-MM-DDTHH:mm:00+05:30)` — a half-open interval, inclusive of the start minute, exclusive of the end minute — and inserts it into `doctor_availabilities.availability_time` (a `tstzrange` column). The `+05:30` offset is a literal string suffix, not computed via a timezone-conversion library.

The `doctor_availability_no_overlap` GIST exclusion constraint on `(doctor_id, availability_time)` means a doctor cannot create two windows that overlap at all, regardless of appointments — this is a hard DB-level rule independent of booking state.

### How busy time is computed

`DoctorService.getDoctorAvailability(doctorId, date?)`:
1. Fetch the doctor's raw availability rows for the (optionally filtered) date.
2. Fetch that doctor's **active** appointments for the same date window (`findActiveAppointmentsForDoctor` — filtered to `status IN (PENDING, CONFIRMED)`). Appointments in `CANCELLED`, `REJECTED`, or `COMPLETED` are **not** fetched here, so they never occupy a slot — cancelling or rejecting an appointment immediately frees that time for rebooking.
3. Parse each busy appointment's `tstzrange` into `{ start, end }` Date bounds (`parseRangeBounds`).

### Free-slot computation (per availability window)

For each availability window:
1. `subtractBusyRanges(window, overlappingBusyRanges)` — a straightforward interval-subtraction: start from `[window]`, and for every busy range that overlaps it, split the current free segment(s) around the busy range (keep the part before it, keep the part after it, drop anything fully covered).
2. Each resulting free segment is passed through `clampSegmentToNow(segment, now)`:
   - If the segment's end is at or before `now` → **drop it entirely** (fully elapsed).
   - If the segment's start is before `now` but its end is after `now` → **clamp the start to exactly `now`** (partially elapsed — return only the remaining future portion).
   - Otherwise (fully in the future) → return unchanged.

   **Note on the clamp precision**: `now` here is `new Date()` — the exact current instant, including seconds/milliseconds. A 09:00–17:00 window queried at 14:07:23 will be clamped to start at exactly `14:07:23`, which — once formatted down to `HH:mm` for the API response via `formatTimeIST` — is displayed to the patient as starting at `14:07`. The remaining free segment is **not** rounded forward to the next whole minute; it truncates to the current minute, which can display a start time that is technically a few seconds in the past relative to when the response was generated.
3. Each surviving segment is formatted to `{ id: availabilityId, date, startTime, endTime }` via `formatDateIST`/`formatTimeIST` — the `id` on every returned free segment is the **availability row's** id, not a per-segment id; if one window produces two free segments (busy time in the middle), both segments carry the same `id`.

### What this means for booking

- The patient only ever sees free (not-yet-booked, not-yet-elapsed) time through `GET /doctors/:doctorId/availability`.
- Booking itself (`POST /appointments`) does **not** re-run this free-slot computation — it independently checks that the requested range is fully contained in a raw availability window (`@>` containment, ignoring busy ranges) and then relies on the database's exclusion constraint to reject a conflict. So the free-slot view and the booking-time validation are two separate code paths that happen to agree in the common case, but the actual non-double-booking guarantee comes from the database constraint, not from the free-slot computation.
- The doctor's own availability view (`GET /doctor/availability`, `getOwnAvailability`) does **not** apply any of this busy-subtraction or now-clamping — it shows raw windows only.

### Email System

Email is sent by a single `EmailService` (`backend/src/service/email/email.service.ts`), instantiated in both `AdminService` and `AppointmentService`. It wraps one shared `nodemailer` transporter (`createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465, auth: { user: SMTP_USER, pass: SMTP_PASSWORD } })`, `from: SMTP_USER`) and exposes seven methods, each building its content from a dedicated template module under `backend/src/service/email/templates/` and rendering it through a shared `layout.template.ts` wrapper (`renderTransactionalEmail`, which produces branded HTML + a plain-text fallback, escapes interpolated values, and optionally renders a details table and/or a CTA button).

| Method | Template | Recipient | Trigger |
|---|---|---|---|
| `sendInvitationEmail` | `invitation.template.ts` | The invitee (any role) | `AdminService.inviteUser`, after the invitation row is committed. |
| `sendAppointmentRequestedPatientEmail` | `appointment-requested.template.ts` | Patient | `AppointmentService.createAppointment`, after the appointment is inserted (status `PENDING`). |
| `sendAppointmentRequestedDoctorEmail` | `appointment-requested.template.ts` | Doctor (if their user record has an email) | Same trigger as above, sent alongside the patient email. |
| `sendAppointmentConfirmedEmail` | `appointment-confirmed.template.ts` | Patient | `AppointmentService.updateAppointmentStatus`, on a `PENDING → CONFIRMED` transition. |
| `sendAppointmentDeclinedEmail` | `appointment-declined.template.ts` | Patient | Same method, on a `PENDING → REJECTED` transition. |
| `sendAppointmentCompletedEmail` | `appointment-completed.template.ts` | Patient | Same method, on a `CONFIRMED → COMPLETED` transition. |
| `sendAppointmentCancelledEmail` | `appointment-cancelled.template.ts` | Doctor | `AppointmentService.cancelAppointment` (the patient-initiated cancellation flow) — there is only a doctor-facing cancellation template; nothing emails the patient back their own cancellation. |

**Failure handling differs by trigger**: the invitation email (step 5 of [Section 5](#5-admin-api--flow)) is the one case where a send failure is **not** swallowed — it deletes the invitation row and surfaces a `500` to the admin. Every appointment-lifecycle email (requested/confirmed/declined/completed/cancelled), by contrast, is sent **after** the underlying database write (the appointment insert or status change) has already been committed, and each send is wrapped so that a failure is only logged (`logEmailFailure`) — it never rolls back the state change or fails the HTTP response. This is confirmed by `backend/test/integration/appointment.test.ts`'s "Appointment email notifications" suite, which explicitly asserts that a mocked email-send failure does not fail the underlying operation.

`backend/test/unit/email-templates.test.ts` unit-tests every template directly (not through `EmailService`), asserting subject lines, that each template mentions the right party/details, and negative assertions (e.g. the confirmed-patient email must not contain "declined" wording; the completed email must not leak diagnosis/prescription/notes text).

---

## 10. Invitation System

### Lifecycle

```
Admin submits { email, role }
   │
   ▼
AdminService.inviteUser
   ├── reject if a live user already has this email
   ├── reject (fast path) if a still-pending invitation already exists for this email
   ├── generate 32-byte random token; SHA-256 hash it
   ├── insert { email, role, hashedToken, expiresAt: now+24h, createdBy, updatedBy }
   │     race-proofed by a partial unique index on (email); on conflict, revoke-and-retry
   │     once if the conflicting row is expired, else reject as INVITATION_ALREADY_SENT
   └── send email with link {FRONTEND_URL}/accept-invitation?token=<raw token>
         (on send failure: delete the invitation row, return 500)
   │
   ▼
Doctor/Patient/Admin-invitee opens the link
   │
   ▼
Frontend calls GET /auth/invitation/:token (public) to learn the invited role,
and — for a DOCTOR invite — GET /doctors/specializations (also public) to
populate the specialization dropdown
   │
   ▼
POST /auth/accept-invitation
  { token, firstName, lastName, password,
    // role-conditional profile fields, validated server-side against the
    // role recorded on the invitation (never a client-supplied role):
    specializationId?, experienceYears?,      // required if invitation.role === DOCTOR
    dob?, heightCm?, weightKg?, bloodGroup? }  // required if invitation.role === PATIENT
   │
   ▼
AuthService.acceptInvitation — runs inside a single DB transaction (getManager().transaction)
   ├── SELECT ... FOR UPDATE the invitation row by hashedToken (row lock)
   ├── reject if not found / already used / revoked / expired
   ├── validate the role-appropriate profile fields (see below)
   ├── bcrypt-hash the password (cost 12)
   ├── create the `users` row (email + role come from the invitation, not the request body)
   ├── if role == PATIENT: create a `patients` row with the submitted dob/heightCm/weightKg/bloodGroup
   ├── if role == DOCTOR: create a `doctors` row with the submitted specializationId/experienceYears
   └── mark the invitation used (usedAt = now, updatedBy = new user's id)
   — all of the above commits or rolls back together
```

### Token security

- The link contains a **raw, high-entropy token** (`crypto.randomBytes(32)` → 64 hex characters). Only its **SHA-256 hash** is ever persisted (`hashedToken`, unique) — the raw token cannot be recovered from the database.
- Expiration is fixed at **24 hours** from creation, computed server-side, not configurable per invitation.

### Duplicate / concurrent-acceptance handling — current behavior

- **Duplicate invitations**: `AdminService.inviteUser`'s fast-path check (an existing pending invitation for the same email) is backed, since the `AddActiveInvitationUniqueIndex` migration, by the partial unique index `idx_user_invitations_active_email ON user_invitations (email) WHERE used_at IS NULL AND revoked_at IS NULL`. Two admin requests issued at almost the same instant for the same email can no longer both succeed: the database itself rejects the second insert with a unique-violation, which `createInvitationRaceProof` catches and turns into either a retry (if the conflicting row had actually expired) or a `409 INVITATION_ALREADY_SENT`. This is a genuine fix relative to an earlier state of the codebase, where this was only an application-level check-then-insert with no backing constraint.
- **Concurrent acceptance of the same invitation**: `acceptInvitation` now loads the invitation with `SELECT ... FOR UPDATE` inside a transaction (`InvitationRepository.findByHashedTokenForUpdate`). A second concurrent request for the same token blocks on that row lock until the first transaction commits (or rolls back), and then observes `usedAt` already set — so it is rejected as "already used" rather than racing to create a second account. This, together with the transaction wrapping described below, is a genuine fix relative to an earlier state of the codebase where no lock or transaction covered this window; `backend/test/integration/invitation.test.ts` includes a "concurrent accept-invitation race" test covering this.

### Transaction handling

`AuthService.acceptInvitation` now runs its entire body — the invitation row lock, profile-field validation, `users` row creation, `patients`/`doctors` profile row creation, and marking the invitation used — inside a single `getManager().transaction(async (manager) => { ... })` block. If any step fails (e.g. profile validation throws, or a later insert fails), the whole transaction rolls back: no orphaned `users` row without a matching profile row, and no invitation incorrectly marked used. `backend/test/integration/invitation.test.ts` includes a test asserting rollback behavior when a later step in this flow fails.

### Doctor and patient profile data are now collected at signup

Unlike an earlier version of this flow, **no profile field is hardcoded**. `AuthService.validateDoctorProfileData` (for `role === DOCTOR`) requires `specializationId` (→ `400 SPECIALIZATION_ID_REQUIRED` if missing) and `experienceYears` (→ `400 EXPERIENCE_YEARS_REQUIRED` if missing), and confirms the specialization exists and is active (→ `400 INVALID_SPECIALIZATION` otherwise) before the `doctors` row is created with the real submitted values. `AuthService.validatePatientProfileData` (for `role === PATIENT`) requires `dob` (→ `400 DOB_REQUIRED`; must be a real past date on/after `1900-01-01`, else `400 INVALID_DOB`), `heightCm` (→ `400 HEIGHT_REQUIRED`), `weightKg` (→ `400 WEIGHT_REQUIRED`), and `bloodGroup` (→ `400 BLOOD_GROUP_REQUIRED`, or `400 INVALID_BLOOD_GROUP` if it isn't one of the `BloodGroup` enum values). The role itself is always taken from the invitation row looked up server-side, never from the request body, so a client cannot self-assign a role during acceptance.

The password submitted at this step is also checked against a policy (`PASSWORD_MIN_LENGTH = 12`, requiring at least one lowercase letter, one uppercase letter, one digit, and one non-alphanumeric character, max 128 characters), enforced by `acceptInvitationSchema` (Joi) on the backend and mirrored on the frontend by `frontend/src/utils/passwordPolicy.ts` plus a live `PasswordRequirementChecklist` component — the same rule is checked in both places, not just cosmetically on the client.

### Email failure handling

If `EmailService.sendInvitationEmail` throws (SMTP error, bad credentials, etc.), `AdminService.inviteUser` now deletes the invitation row it had just inserted and throws `500 FAILED_TO_SEND_INVITATION` — see [Section 5](#5-admin-api--flow). There is still no automatic retry and no dedicated "resend" endpoint; re-inviting the same email is the only recourse once the failed row has been cleaned up.

---

## 11. Database Design

All entities live in `backend/src/database/model/*.ts`; table names/columns are derived via `SnakeNamingStrategy`. The schema below is generated directly from the entity decorators and the baseline migration (`20260101000000-InitialSchema.ts`), not from any prior documentation.

### Schema diagram

![DocPulse database schema](docs/images/database-schema.png)

*Generated with Graphviz directly from the TypeORM entities and migrations in this repository (see [Section 2](#2-technology-stack) for the migration list). `PK` = primary key, `FK` = foreign key, `UQ` = unique constraint/index, italic = nullable column, red text = a GIST exclusion constraint, and cardinality (`1`/`N`) is marked at each end of a relationship line. Tables are color-coded by domain: indigo = identity/access (`users`, `user_invitations`), teal = doctor domain (`specializations`, `doctors`, `doctor_availabilities`), pink = patient domain (`patients`), orange = scheduling (`appointments`).*

### `users`
- PK: `id` (smallint, auto-increment)
- `first_name`, `last_name` (varchar 50)
- `email` (varchar 255, **unique**)
- `hashed_password` (varchar 255)
- `role` (enum `user_role`: `ADMIN`|`PATIENT`|`DOCTOR`)
- `created_at`, `updated_at`, `deleted_at` (soft delete, nullable)
- Relations: one-to-one → `Patient`/`Doctor` (via the child table's PK also being the FK, see below), one-to-many → `UserInvitation` (as `createdByUser`/`updatedByUser`)

### `doctors`
- PK **and** FK: `doctor_id` (smallint) — shared-PK pattern with `users.id` (`@OneToOne(User) @JoinColumn({ name: "doctor_id" })`), i.e. a doctor's id *is* their user id.
- `specialization_id` (smallint, FK → `specializations.id`) — set once at signup (see [Section 10](#10-invitation-system)); not editable via `PATCH /doctor/profile`.
- `experience_years` (smallint) — editable via `PATCH /doctor/profile` (0–80).
- Relations: → `User` (1:1), → `Specialization` (many:1), → `Appointment[]` (1:many), → `DoctorAvailability[]` (1:many)

### `patients`
- PK/FK: `patient_id` (smallint) — same shared-PK pattern with `users.id`.
- `height_cm`, `weight_kg` (smallint, nullable) — editable via `PATCH /patient/profile` (30–300 / 2–500 respectively).
- `blood_group` (enum `blood_group`, nullable) — set once at signup; not editable afterwards via the API.
- `dob` (date, nullable) — set once at signup; not editable afterwards via the API.
- Relations: → `User` (1:1), → `Appointment[]` (1:many)

### `specializations`
- PK: `id` (smallint, auto-increment)
- `name` (varchar 100), `description` (varchar 500, nullable), `is_active` (boolean, default true)
- `created_at`, `updated_at`
- Relations: → `Doctor[]` (1:many)
- Seeded by the baseline migration with four rows: *General Practitioner*, *Cardiology*, *Dermatology*, *Pediatrics*.
- `is_active` is now consistently enforced: both `GET /doctors/specializations` and the specialization-existence check used at doctor signup filter to `is_active = true`.

### `doctor_availabilities`
- PK: `id` (smallint, auto-increment)
- `doctor_id` (smallint, FK → `doctors.doctor_id`)
- `availability_time` (`tstzrange`)
- `created_at`, `updated_at`
- **Constraint**: `EXCLUDE USING GIST (doctor_id WITH =, availability_time WITH &&)` — no two windows for the same doctor may overlap, unconditionally.

### `appointments`
- PK: `id` (smallint, auto-increment)
- `patient_id` (smallint, FK → `patients.patient_id`), `doctor_id` (smallint, FK → `doctors.doctor_id`)
- `status` (enum `appointment_status`: `PENDING`|`CONFIRMED`|`REJECTED`|`COMPLETED`|`CANCELLED`)
- `appointment_time` (`tstzrange`)
- `created_at`, `updated_at`
- **Constraints**:
  - `EXCLUDE USING GIST (doctor_id WITH =, appointment_time WITH &&) WHERE status IN ('PENDING','CONFIRMED')`
  - `EXCLUDE USING GIST (patient_id WITH =, appointment_time WITH &&) WHERE status IN ('PENDING','CONFIRMED')`
- **Indexes**: `(patient_id, status)`, `(doctor_id, status)`, GIST on `appointment_time`.

### `user_invitations`
- PK: `id` (smallint, auto-increment)
- `email` (varchar 255) — not unique unconditionally; see the partial unique index below.
- `role` (enum `user_role`)
- `hashed_token` (varchar 255, **unique**)
- `expires_at` (timestamptz)
- `used_at`, `revoked_at` (timestamptz, nullable)
- `created_by`, `updated_by` (smallint, FK → `users.id`)
- `created_at`, `updated_at`
- Status (`PENDING`/`USED`/`EXPIRED`/`REVOKED`) is **derived at read time**, not a stored column.
- **Constraint**: partial unique index `idx_user_invitations_active_email ON (email) WHERE used_at IS NULL AND revoked_at IS NULL` — at most one *active* (not yet used or revoked) invitation can exist per email at a time; this does not prevent multiple *historical* (used/revoked) rows for the same email.

### Entity-relationship summary

```
users 1───1 patients            patients 1───* appointments
users 1───1 doctors              doctors 1───* appointments
doctors *───1 specializations    doctors 1───* doctor_availabilities
users 1───* user_invitations (as createdByUser)
users 1───* user_invitations (as updatedByUser)
```

---

## 12. API Reference

Response envelope note: most endpoints return `{ success, message?, data, ... }`; a few older-style ones (Joi validation failures, and anything routed through `ResponseParser`) use `{ status, message, code, data }`. Both shapes are handled by the frontend's per-endpoint API wrappers (see [Section 3](#3-architecture)).

### Authentication (shared)

| Method | Endpoint | Role | Purpose | Auth | Main Response |
|---|---|---|---|---|---|
| POST | `/auth/login` | any | Log in, set access+refresh cookies | none (rate-limited) | `{ success, data: { user } }` |
| POST | `/auth/refresh` | any (valid refresh cookie) | Issue a new access token cookie | refresh cookie | `{ success: true }` |
| GET | `/auth/invitation/:token` | none | Preview an invitation's role (for the signup form) without consuming it | none (rate-limited) | `{ success, data: { role, email } }` |
| POST | `/auth/accept-invitation` | none (has token) | Complete signup from an invitation, including role-specific profile fields | none (rate-limited) | `{ success, message, data: user }` |
| POST | `/auth/logout` | any | Clear auth cookies | none | `{ success: true }` |

### Admin

| Method | Endpoint | Role | Purpose | Auth | Main Response |
|---|---|---|---|---|---|
| POST | `/admin/invite` | ADMIN | Invite one user by email+role | cookie + ADMIN | `{ success, data: invitation }` |
| GET | `/admin/invitations` | ADMIN | Paginated/filterable invitation list | cookie + ADMIN | `{ success, data: [], pagination }` |
| POST | `/admin/invitations/:id/revoke` | ADMIN | Revoke a pending invitation | cookie + ADMIN | `{ success, data: invitation }` |
| POST | `/admin/invitations/bulk` | ADMIN | CSV bulk invite | cookie + ADMIN | `{ success, data: { total, successful, failed, results } }` |

### Doctor

| Method | Endpoint | Role | Purpose | Auth | Main Response |
|---|---|---|---|---|---|
| POST | `/doctor/availability` | DOCTOR | Create an availability window | cookie + DOCTOR | `{ success, data: availability }` |
| GET | `/doctor/availability` | DOCTOR | List own raw availability | cookie + DOCTOR | `{ success, data: [] }` |
| GET | `/doctor/appointments` | DOCTOR | List own appointments (filter/sort/paginate) | cookie + DOCTOR | `{ success, data: { appointments, pagination } }` |
| PATCH | `/doctor/appointments/:appointmentId/status` | DOCTOR | Confirm/Reject/Complete | cookie + DOCTOR | `{ success, data: appointment }` |
| GET | `/doctor/profile` | DOCTOR | View own profile | cookie + DOCTOR | `{ success, data: profile }` |
| PATCH | `/doctor/profile` | DOCTOR | Update `experienceYears` | cookie + DOCTOR | `{ success, data: profile }` |

### Doctor discovery (shared: Patient/Doctor/Admin, plus a public endpoint)

| Method | Endpoint | Role | Purpose | Auth | Main Response |
|---|---|---|---|---|---|
| GET | `/doctors/specializations` | **public** | List active specializations | none | `{ success, data: [] }` |
| GET | `/doctors/:doctorId/availability` | PATIENT, DOCTOR, ADMIN | A doctor's free/bookable slots | cookie + role | `{ success, data: { doctor, availability } }` |
| GET | `/doctors` | PATIENT, DOCTOR, ADMIN | Search/browse doctors (no email in response) | cookie + role | `{ success, data: { doctors, pagination } }` |

### Patient

| Method | Endpoint | Role | Purpose | Auth | Main Response |
|---|---|---|---|---|---|
| GET | `/appointments` | PATIENT | List own appointments (filter/sort/paginate) | cookie + PATIENT | `{ success, data: { appointments, pagination } }` |
| POST | `/appointments` | PATIENT | Book an appointment | cookie + PATIENT | `{ success, data: appointment }` (full nested shape — see [Section 7](#7-patient-api--flow)) |
| PATCH | `/appointments/:appointmentId/status` | PATIENT | Cancel own appointment (`CANCELLED` only) | cookie + PATIENT | `{ success, data: appointment }` |
| GET | `/patient/profile` | PATIENT | View own profile | cookie + PATIENT | `{ success, data: profile }` |
| PATCH | `/patient/profile` | PATIENT | Update `heightCm`/`weightKg` | cookie + PATIENT | `{ success, data: profile }` |

### Misc

| Method | Endpoint | Role | Purpose | Auth | Main Response |
|---|---|---|---|---|---|
| GET | `/` | none | Liveness check | none | `{ success: true, data: { status: "ok" } }` |

---

## 13. Error Handling

- **How errors are raised**: services throw either the project's own `HttpException` (`backend/src/util/http-exception.ts` — `status`, `message`, `code`) or, more commonly, instances from the **`http-errors`** package (`createError.BadRequest(...)`, `.NotFound(...)`, `.Conflict(...)`, `.Unauthorized(...)`), which also expose `.status`/`.statusCode` and `.message`.
- **Propagation**: every controller method is `async` and wrapped in a `try { ... } catch (error) { next(error); }`. Because `express-async-errors` is imported once in `app.ts`, any rejected promise anywhere in the middleware chain is also automatically forwarded to Express's error pipeline even without an explicit `try/catch`.
- **Global handler** (`backend/src/middleware/error.ts`): reads `error.status` (default `500`), `error.message` (default the i18n fallback `ERR10001`), `error.code` (default `"ERR10001"`), and responds via `ResponseParser` as `{ status: false, message, code, data: {} }`. **Note the field name is `status` (boolean) here, not `success`** — this differs from the `{ success, ... }` shape most controllers use directly, which is one of the two response envelope styles the frontend has to normalize (see [Section 12](#12-api-reference)).
- **Validation errors**: `HttpRequestValidator` middleware runs Joi's `.validate()` against `body`/`query`/`params`; on failure it responds directly (not via `next(error)`) with `400`, `code: "validation_error"`, `message: "Validation Error"`, and `data` containing an array of `{ message, label }` per failing field.
- **Specific status codes used across the app**:
  - `400` — bad input / invalid state transition / conflicting filters / missing role-specific signup or profile fields (e.g. `SPECIALIZATION_ID_REQUIRED`, `EXPERIENCE_YEARS_REQUIRED`, `INVALID_SPECIALIZATION`, `DOB_REQUIRED`, `INVALID_DOB`, `HEIGHT_REQUIRED`, `WEIGHT_REQUIRED`, `BLOOD_GROUP_REQUIRED`, `INVALID_BLOOD_GROUP`).
  - `401` — missing/invalid/expired JWT, invalid credentials, invalid/expired refresh token.
  - `403` — authenticated but wrong role.
  - `404` — resource not found or not owned by the caller (appointment/availability/doctor/patient/invitation lookups scoped by owner id return "not found" rather than "forbidden" when the id exists but belongs to someone else); also `DOCTOR_NOT_FOUND`/`PATIENT_NOT_FOUND` from the new profile endpoints.
  - `409` — genuine conflicts: `AVAILABILITY_OVERLAP`, `APPOINTMENT_TIME_UNAVAILABLE`, `DOCTOR_NOT_AVAILABLE`, `APPOINTMENT_TIME_ALREADY_PASSED`, `APPOINTMENT_NOT_YET_STARTED`, `CANNOT_CANCEL_PAST_APPOINTMENT`, `APPOINTMENT_STATUS_CONFLICT` (lost a concurrent status-update race — see [Section 8](#8-appointment-lifecycle)), `USER_ALREADY_EXISTS`, `INVITATION_ALREADY_SENT`, `INVITATION_ALREADY_REVOKED`.
  - `429` — rate limit exceeded (message text set per-limiter in `constant.ts`).
  - `500` — anything unhandled (e.g. an unexpected database error), and the deliberate `FAILED_TO_SEND_INVITATION` case when an invitation email fails to send.
- **Database constraint errors**: Postgres exclusion-constraint violations surface to Node as an error with `code === "23P01"`; this is caught explicitly in `DoctorService.createAvailability` and `AppointmentService.createAppointment` and translated into a `409` with a specific message. A unique-constraint violation on the invitation table's partial unique index (`code === "23505"`) is likewise caught explicitly in `AdminService.createInvitationRaceProof`. Any *other* database error is not specifically caught anywhere in the services reviewed — it propagates up as a generic error and is handled by the fallback path of the global error middleware (effectively a `500`).

---

## 14. Security

### What is implemented

- **JWT authentication**, two separate secrets for access vs. refresh tokens, both delivered exclusively via **HttpOnly** cookies (`sameSite: "lax"`, `secure` in production) — the tokens are never exposed to page JavaScript or present in any JSON response body. Access tokens now default to a short (`15m`) lifetime with a longer-lived (`7d`) refresh token, per the shipped `.env.example` — the conventional pattern, not inverted.
- **Password hashing**: `bcrypt`, cost factor `12`. A minimum password policy (12+ characters, mixed case, digit, special character) is enforced on both the signup form and the backend Joi schema.
- **Security headers**: `helmet()` is applied unconditionally to every response (`Kernel.initSecurityHeaders`) — this was not the case in an earlier version of the codebase.
- **`trust proxy` is configured**: `app.set("trust proxy", 1)` trusts exactly one upstream hop, so `express-rate-limit`'s `req.ip` resolution and secure-cookie detection work correctly behind a single reverse proxy/load balancer.
- **Partial startup env-var validation**: `DATABASE_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, and `FRONTEND_URL` are checked for presence at process start and the app refuses to boot if any is missing (see [Section 2](#2-technology-stack)) — though SMTP and token-expiry variables are still unvalidated.
- **Invitation token hashing**: raw token only ever exists transiently (generated, emailed, and — briefly — in the accept-invitation request body); the database stores only its SHA-256 hash.
- **Role-based authorization** on every non-public route via `AuthorizationMiddleware.authorize(...)`.
- **IDOR protection**: every "get/act on my own X" repository method filters by the owner id (`doctorId`/`patientId`) in the same query as the lookup, not as a separate post-fetch check.
- **Parameterized queries** throughout: all TypeORM `QueryBuilder` usage seen in this codebase uses named parameters (`:paramName`) rather than string concatenation.
- **Rate limiting**: three tiers (`general`/`auth`/`invitation`) via `express-rate-limit`, automatically disabled in the test environment — see [Section 4](#4-authentication-and-authorization).
- **Soft deletion** on `users` (`deleted_at`), consistently checked (`deleted_at IS NULL`) in every login/lookup query that reads a user.
- **Database-level constraints** as the actual source of truth for "no double booking", "no overlapping availability", and (now) "no duplicate active invitation per email" — GIST exclusion constraints and a partial unique index — rather than relying solely on an application-level check-then-insert.
- **Transactional invitation acceptance**, with a row lock (`SELECT ... FOR UPDATE`) preventing a concurrent accept of the same token from creating two accounts (see [Section 10](#10-invitation-system)).
- **Concurrency-safe appointment status updates**: a compare-and-swap `UPDATE ... WHERE ... AND status = :expectedStatus`, returning `409 APPOINTMENT_STATUS_CONFLICT` on a lost race, rather than silently allowing one request to overwrite another (see [Section 8](#8-appointment-lifecycle)).
- **CORS**: locked to a single configured origin (`FRONTEND_URL`) with `credentials: true`, restricted to the methods and headers the app actually uses.
- **A real automated test suite**, including a dedicated `security.test.ts` that asserts standard security headers are present on API responses (see [Section 18 — Testing](#18-testing)).

### What was not found in the codebase (still-open items)

- **No refresh-token rotation or revocation list** — a refresh token remains valid for its full lifetime once issued; there is no server-side way to invalidate a single outstanding refresh token before it expires (logout only clears the cookie client-side). Unchanged from an earlier review of this code.
- **No CSV row-count limit** on bulk invitations, only a 5 MB file-size limit, and rows are still processed strictly one at a time, in-request — see [Section 5](#5-admin-api--flow).
- **Partial env-var validation** — SMTP credentials, `PORT`, `LOG_LEVEL`, and the token-expiry strings are still read without any startup check; a misconfigured SMTP variable, for example, still only surfaces when an email attempt fails at runtime.
- **No dedicated "resend invitation" endpoint** — a failed invitation email requires re-inviting the same email from scratch (the failed row is now cleaned up automatically, but there's no direct retry).

---

## 15. Important Business Rules

Rules actually enforced by the current code (file references given so you can verify/modify them directly):

- An appointment/availability date cannot be in the past, and if the date is today, the start time cannot be at or before the current IST time — enforced identically for both availability creation and appointment creation (`doctor.service.ts::createAvailability`, `appointment.service.ts::createAppointment`).
- A doctor cannot confirm an appointment whose scheduled start time has already passed (`appointment.service.ts::assertAppointmentTimeAllowsTransition`).
- A doctor cannot mark an appointment completed before its scheduled **start** time has arrived (same function) — completion is not gated on the end time having passed.
- A patient cannot cancel a `PENDING` or `CONFIRMED` appointment once its scheduled start time has passed (`appointment.service.ts::cancelAppointment`).
- Only `PENDING`/`CONFIRMED` appointments occupy a doctor's availability in the patient-facing free-slot view; `CANCELLED`/`REJECTED`/`COMPLETED` appointments do not (`appointment.repository.ts::findActiveAppointmentsForDoctor`, filtered by status).
- Overlapping `PENDING`/`CONFIRMED` appointments for the same doctor, or for the same patient, are impossible — enforced by PostgreSQL `EXCLUDE` constraints, not just application code (`Appointment` entity).
- A doctor's two availability windows can never overlap, regardless of appointment status (`DoctorAvailability` entity exclusion constraint).
- A requested appointment slot must fit entirely inside one existing availability window — it cannot span two separate windows even if contiguous (`appointment.repository.ts::findDoctorAvailabilityForAppointment`, uses range containment `@>`).
- A concurrent status change that races against another status change on the same appointment loses cleanly with a `409`, rather than silently overwriting (`appointment.repository.ts::updateAppointmentStatusByDoctor`/`ByPatient`, compare-and-swap on `status`).
- Invitation tokens are single-use in intent (`usedAt` set on acceptance) and expire 24 hours after creation; a revoked or expired or already-used invitation cannot be accepted (`auth.service.ts::acceptInvitation`).
- A user (by email) cannot be invited if a live (non-deleted) account with that email already exists, or if a still-active (not used/revoked) invitation for that email already exists — the latter now backed by a database-level partial unique index, not just an application check (`admin.service.ts::inviteUser`/`createInvitationRaceProof`).
- A doctor invitee must supply a valid, active `specializationId` and an `experienceYears` (0–80) at signup; a patient invitee must supply `dob`, `heightCm`, `weightKg`, and a valid `bloodGroup` at signup — none of these are optional or defaulted (`auth.service.ts::validateDoctorProfileData`/`validatePatientProfileData`).
- After signup, a doctor may only update `experienceYears` (0–80) and a patient may only update `heightCm` (30–300) / `weightKg` (2–500) through the profile endpoints; specialization, blood group, and date of birth are permanent once set (`doctor.service.ts`/`patient.service.ts`, `profile.validation.ts`).
- A password submitted at signup must be at least 12 characters and include a lowercase letter, an uppercase letter, a digit, and a special character (`acceptInvitation.validation.ts`).
- A patient can only ever set an appointment's status to `CANCELLED` through the patient-facing endpoint; a doctor can only ever set `CONFIRMED`/`REJECTED`/`COMPLETED` through the doctor-facing endpoint — enforced both by Joi schema and, for the transition itself, by the allow-list in `AppointmentService.updateAppointmentStatus`.
- Every appointment/availability/profile lookup that a doctor or patient performs on "their own" data is scoped by their own id in the query itself, not checked after the fact.

---

## 16. End-to-End User Flows

### 1. Admin invites a doctor
`AdminInvitationsPage` → "Invite User" modal (email + role = DOCTOR) → `inviteUserApi` → `POST /admin/invite` → `AdminService.inviteUser` → invitation row committed (race-proofed against duplicate active invitations) → `EmailService.sendInvitationEmail` → admin sees a success toast and the new row appears in the (refetched) invitations table. If the email fails to send, the invitation row is deleted and the admin sees an error instead.

### 2. Doctor accepts invitation and completes signup
Doctor opens the emailed link `{FRONTEND_URL}/accept-invitation?token=...` → `AcceptInvitationPage` reads `token` from the URL, calls `GET /auth/invitation/:token` to learn the role, and (for a doctor invite) calls the now-public `GET /doctors/specializations` to populate a specialization dropdown → doctor fills first/last name, password, selects a specialization, and enters years of experience → `acceptInvitationApi` → `POST /auth/accept-invitation` → `AuthService.acceptInvitation` (inside a transaction) validates the token and the submitted specialization/experience, creates the `users` row, creates a `doctors` row with the real submitted values, marks the invitation used → frontend shows a success notification and redirects to `/login`.

### 3. Patient accepts invitation and completes signup
Same link/flow as above, but for a patient invite: `AcceptInvitationPage` renders date-of-birth, height, weight, and blood-group fields instead of a specialization dropdown → `POST /auth/accept-invitation` → `AuthService.acceptInvitation` validates all four fields and creates the `patients` row with the submitted values.

### 4. Doctor creates availability
Doctor logs in → `DashboardPage` (role DOCTOR) → "My Availability" tab → `DoctorAvailabilitySection` form (date/start/end, `min={today}` on the date input) → `createDoctorAvailabilityApi` → `POST /doctor/availability` → validated, checked against past-date/time, inserted (409 on overlap) → list refetched via `GET /doctor/availability`.

### 5. Doctor or patient updates their profile
Any authenticated user → "Profile" (Navbar, or the admin profile dropdown) → `/profile` → `ProfilePage` fetches `GET /doctor/profile` or `GET /patient/profile` depending on role and renders `DoctorProfileForm`/`PatientProfileForm` (an ADMIN sees a "not applicable" message instead) → editing the allowed field(s) and saving calls `PATCH /doctor/profile` or `PATCH /patient/profile` → updated profile re-rendered on success.

### 6. Patient searches for a doctor
Patient logs in → `DashboardPage` (role PATIENT) → "Find & Book Doctors" tab (default) → `PatientDoctorDiscovery` loads specializations + doctor list on mount, refetches on any filter change (`search`/`specialization`/`date`) → `GET /doctors`.

### 7. Patient views availability and books an appointment
Patient clicks "Book Appointment" on a doctor card → `GET /doctors/:doctorId/availability` → busy-subtracted, now-clamped free slots returned, grouped by date in the modal (the modal resets its state for the newly opened doctor) → patient picks a date and a suggested 30-min slot (or a custom range) → client-side re-validation → `POST /appointments` → backend re-validates independently (past-check, doctor/patient existence, availability containment) → inserted as `PENDING` (409 on a race/overlap via the exclusion constraint) → both patient and doctor receive an "appointment requested" email (best-effort) → modal shows success, `onSuccess` switches the dashboard to "My Appointments".

### 8. Doctor confirms/rejects the appointment
Doctor → "Patient Appointments" tab → `DoctorAppointmentsSection` lists appointments (filter/sort/paginate) → for a `PENDING` row, "Confirm" or "Decline" opens a confirmation dialog → `PATCH /doctor/appointments/:id/status` with `CONFIRMED` or `REJECTED` → backend checks the transition is allowed, that the time hasn't passed, and applies the compare-and-swap update (409 if the status changed underneath it) → patient receives a confirmation or decline email (best-effort) → list refetched.

### 9. Doctor completes the appointment
For a `CONFIRMED` row whose start time has arrived, "Complete Visit" → `PATCH .../status` with `COMPLETED` → backend checks the appointment has started → updated → patient receives a completion email (best-effort).

### 10. Patient cancels an appointment
"My Appointments" → for a cancellable row (status `PENDING`/`CONFIRMED` and not yet started), "Cancel Appointment" → confirmation dialog → `PATCH /appointments/:id/status` with `CANCELLED` → backend re-checks ownership, current status, and that the time hasn't passed → doctor receives a cancellation email (best-effort) → list refetched. Once cancelled, the appointment's time range no longer counts as "active," so it stops blocking that doctor's/patient's availability for other bookings.

### 11. User refreshes an expired access token
Any authenticated request returns `401` → `apiFetch` (unless `skipAuthRefresh`) calls `getRefreshedAccessToken()` (deduped across concurrent callers) → `POST /auth/refresh` reads the `refreshToken` cookie, verifies it, issues a new `accessToken` cookie → the original request is retried once. If the refresh call itself fails, the client calls `/auth/logout`, clears local storage, and dispatches `docpulse:session-expired`, which `AuthContext` picks up to clear `user` and fall back to the login screen.

### 12. User logs out
"Sign Out" (Navbar / AdminLayout / DashboardPage) → `logout()` in `AuthContext` → `POST /auth/logout` (clears both cookies server-side) → `clearAuthStorage()` removes cached `localStorage` keys → `user` set to `null` → app re-renders to the login page.

---

## 17. Development Guide

### Prerequisites
- Node.js ≥ 18.15.0
- PostgreSQL (local or a hosted instance such as Neon, per the README)

### Environment variables (backend)
Copy `backend/.env.example` to `backend/.env` and fill in real values for: `DATABASE_URL`, `TEST_DATABASE_URL`, `PORT`, `NODE_ENV`, `LOG_LEVEL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `ACCESS_TOKEN_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `FRONTEND_URL`. `DATABASE_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, and `FRONTEND_URL` are now validated at startup (the app refuses to boot without them); the rest are still unvalidated — double-check each is actually set before relying on SMTP/email to work. `TEST_DATABASE_URL` should point at a **separate, disposable** database — the integration test suite truncates its tables between tests.

### Database setup
1. Provision a PostgreSQL database and point `DATABASE_URL` at it.
2. Run migrations: `cd backend && npm run migrate` (equivalently `npm run migrate:run`, both invoke `typeorm migration:run` against `ormconfig.ts`). Unlike an earlier state of this repository, a baseline migration (`20260101000000-InitialSchema.ts`) now exists and provisions the full schema — enums, tables, foreign keys, exclusion constraints, and four seed `specializations` rows — from a genuinely empty database, so `npm run migrate` alone is now sufficient for a fresh environment.

### Running the backend
```
cd backend
npm install
npm run watch     # concurrently runs `tsc -w` and nodemon against dist/server.js
```
Production-style run: `npm run start` (`build-ts` then `serve`, i.e. `node dist/server.js`). Backend listens on `PORT` (falls back to `3001` if unset — the frontend's hardcoded `API_BASE_URL` in `apiClient.ts` is `http://localhost:3000`, so for local dev, `PORT=3000` in `.env` — which is what `.env.example` ships — keeps the two in sync; leaving `PORT` unset would not).

### Running the frontend
```
cd frontend
npm install
npm run dev        # Vite dev server, default http://localhost:5173
```

### Build commands
- Backend: `npm run build` (`eslint` then `tsc`).
- Frontend: `npm run build` (`tsc -b && vite build`).

### Development considerations
- Path aliases (`@api`, `@config`, `@core`, `@database`, `@middleware`, `@service`, `@util`, …) are resolved via `module-alias`, registered once in `app.ts` (`import "module-alias/register"`) against the compiled `dist/` paths declared in `package.json`'s `_moduleAliases` — this only works after a build; running `ts-node` directly against `src/` without the equivalent `tsconfig-paths` setup would not resolve these.
- `docker-compose.yml` in `backend/` spins up the app plus a Postgres container for local development, building from `dev/docker/Dockerfile` (confirmed present at `backend/dev/docker/Dockerfile`, alongside a separate top-level `backend/Dockerfile`).

---

## 18. Testing

An automated test suite now exists under `backend/test/` (Jest + `ts-jest` + `supertest`), where an earlier version of this document found none.

### Architecture

- **Real PostgreSQL, no mocking**: `backend/test/util/testEnv.ts` requires `TEST_DATABASE_URL` (throws if unset) and forces `NODE_ENV=test`, loaded as a Jest `setupFiles` entry so it runs before any application module reads `process.env`.
- `backend/test/util/testApp.ts` imports the **real** `app` from `backend/src/app.ts` (not a stripped-down test build) and exposes `setupIntegrationTest()`, which: awaits `app.locals.ready` and runs migrations once (`beforeAll`); truncates all application tables and re-seeds two specializations, restores mocks, and mocks all `EmailService` sends (`beforeEach`); closes the DB connection (`afterAll`).
- `backend/test/util/testDb.ts` provides `runMigrationsForTests()`, `resetDatabase()` (a `TRUNCATE ... RESTART IDENTITY CASCADE` across all tables plus reseeding), and `closeTestDb()`.
- `backend/test/util/factories.ts` provides helpers to create an admin/doctor/patient user, log in as an agent, create availability/appointment rows directly, and mock or spy on every `EmailService` method — used throughout the integration suite so tests don't depend on a real SMTP server.

### Coverage (by file)

- `appointment.test.ts` — appointment correctness and concurrency (past-date rejection, cancellation rules, elapsed-availability exclusion, slot clamping, double-booking prevention via the exclusion constraint, the concurrent status-update compare-and-swap, response shape), plus a dedicated block asserting each appointment-lifecycle email fires (and that an email failure doesn't fail the underlying operation).
- `auth.test.ts` — login/refresh token flow, and IDOR protection (a patient/doctor cannot read or act on another account's data).
- `doctor.test.ts` — inactive specializations are excluded from the discovery list and rejected at signup.
- `invitation.test.ts` — the full invite → accept-invitation → signup flow for both roles, rejection of a nonexistent specialization, rejection of missing role-specific fields, confirmation that a client-supplied role is ignored, transaction rollback on a mid-flow failure, and the concurrent-accept race.
- `security.test.ts` — asserts standard Helmet security headers are present on API responses, including on the auth endpoints.
- `backend/test/unit/email-templates.test.ts` — unit-tests every email template directly (see [Section 9 — Email System](#email-system)).

### Running tests

- Backend: `npm run test` (`jest --detectOpenHandles --forceExit --runInBand --coverage`, `--verbose`) or `npm run watch-test` for watch mode. There are no separate `test:unit`/`test:integration` scripts — a single Jest run picks up everything under `backend/test/**/*.test.ts`. Coverage is collected but no `coverageThreshold` is enforced. Requires `TEST_DATABASE_URL` to point at a reachable, disposable Postgres database (see [Environment variables](#environment-variables-backend) above) — this is not started automatically by the test run itself; `docker-compose.yml`'s Postgres service is a general-purpose dev database, not a dedicated test one, so provisioning a second database (or reusing the same instance under a different database name) is a manual step.
- Frontend: still no test runner configured (`frontend/package.json` has no test script and no Jest/Vitest/RTL/Playwright dependency).

---

## Appendix: Summary of Notable Items in the Current Implementation

Items previously flagged as gaps in an earlier version of this document, and their current status, followed by what's still genuinely open:

| Item | Status | Section |
|---|---|---|
| No baseline schema migration in the repo | **Fixed** — `20260101000000-InitialSchema.ts` now provisions the full schema from empty | [2](#2-technology-stack), [17](#17-development-guide) |
| Doctor signup hardcoded `specializationId=0, experienceYears=0`; no specialization selection step | **Fixed** — both are now required, validated fields at signup, sourced from the invitee | [10](#10-invitation-system), [16](#16-end-to-end-user-flows) |
| Invitation acceptance not wrapped in a database transaction | **Fixed** — the whole flow runs in `getManager().transaction(...)` with a row lock | [10](#10-invitation-system) |
| Appointment status updates not concurrency-safe | **Fixed** — compare-and-swap `UPDATE`, `409 APPOINTMENT_STATUS_CONFLICT` on a lost race | [8](#8-appointment-lifecycle) |
| No unique constraint preventing duplicate pending invitations under concurrency | **Fixed** — partial unique index + catch/retry logic | [10](#10-invitation-system) |
| `ACCESS_TOKEN_EXPIRES_IN`/`REFRESH_TOKEN_EXPIRES_IN` inverted in `.env.example` | **Fixed** — now `15m` access / `7d` refresh | [4](#4-authentication-and-authorization) |
| No `helmet()` | **Fixed** — applied unconditionally | [14](#14-security) |
| No explicit `trust proxy` configuration | **Fixed** — `app.set("trust proxy", 1)` | [2](#2-technology-stack), [14](#14-security) |
| No environment-variable validation at startup | **Partially fixed** — 4 core variables now validated; SMTP/port/expiry strings still are not | [2](#2-technology-stack), [14](#14-security) |
| `POST /appointments`'s response shape didn't match the frontend's declared type | **Fixed** — now returns the full nested shape | [7](#7-patient-api--flow) |
| `GET /doctors` returned each doctor's email, unused by the UI | **Fixed** — the list response no longer includes email | [6](#6-doctor-api--flow) |
| `Specialization.isActive` not filtered by `getSpecializations()` | **Fixed** — now filtered consistently everywhere it's checked | [6](#6-doctor-api--flow), [11](#11-database-design) |
| `AppointmentBookingModal` didn't reset state when reopened for a different doctor | **Fixed** — a `useEffect` now resets on `[isOpen, doctorDetails?.doctor.id]` | [7](#7-patient-api--flow) |
| No automated backend test suite | **Fixed** — integration + unit suite under `backend/test/` | [18 — Testing](#18-testing) |
| No CSV row-count limit for bulk invitations (only a 5 MB file-size limit); rows processed serially in-request | **Still open** | [5](#5-admin-api--flow) |
| No refresh-token rotation or server-side revocation list | **Still open** | [4](#4-authentication-and-authorization), [14](#14-security) |
| An invitation email failure has no dedicated "resend" endpoint | **Still open** (though the orphaned-row side effect is now cleaned up automatically) | [5](#5-admin-api--flow), [10](#10-invitation-system) |
| Availability "now" clamping truncates to the current second rather than rounding up to the next whole minute | **Still open** | [9](#9-availability-system) |
