# DocPulse — Technical Documentation

This document describes the system **as it is currently implemented** in this repository. It is derived entirely from the source code (routes, controllers, services, repositories, entities, migrations, middleware, frontend components and API clients) rather than from design intent. Where the implementation has a gap, inconsistency, or an unusual choice relative to typical best practice, this is called out explicitly rather than glossed over. Anything that could not be established from the code is stated as such — nothing here is invented.

Audience: a developer joining the project who needs to understand what exists today before changing it.

---

## 1. Project Overview

DocPulse is a doctor–patient appointment booking system. It lets a clinic (or single admin) onboard doctors and patients by invitation, lets doctors publish blocks of time they are available and maintain a profile, and lets patients search for doctors and book appointments inside those time blocks. It manages the resulting appointment through a small state machine (request → confirm/reject → complete, or cancel) and prevents a doctor or patient from being double-booked at the database level.

### Roles

The system has exactly three roles, defined in `backend/src/database/enum/userRole.ts`:

- **ADMIN** — invites new doctor or other-admin users by email (patients can no longer be admin-invited — see below), manages the invitation list, can bulk-invite via CSV.
- **DOCTOR** — completes signup with a specialization and years of experience, publishes availability windows, views/searches their own appointments, confirms/rejects/completes appointment requests, and can update their years-of-experience afterwards.
- **PATIENT** — completes signup with date of birth/height/weight/blood group, searches for doctors, views a doctor's free slots, books an appointment, views/cancels their own appointments, and can update their height/weight afterwards.

Doctor and admin accounts are still created only by accepting an admin-issued invitation. This is a change from an earlier state of the repository, where the same was also true of patients: a prospective **patient** can now request their own signup link via `POST /auth/patient/self-register` (no admin action required), which — under the hood — creates the same kind of `user_invitations` row an admin-issued invite would, just tagged with a different `source` (see [Section 10](#10-invitation-system)). Consistent with this, `POST /admin/invite` and the bulk-invite CSV flow no longer accept `role: "PATIENT"` at all (see [Section 5](#5-admin-api--flow)) — an admin can still invite `ADMIN` or `DOCTOR` accounts, but a patient account can only originate from the self-registration flow.

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

This is a change from an earlier state of the repository, where no client-side test runner was configured at all: `frontend/package.json` now has `test`/`test:watch`/`test:coverage` scripts running **Vitest** (`vitest run`, `^4.1.11`), with **`@testing-library/react`**, **`@testing-library/user-event`**, and **`@testing-library/jest-dom`** for component tests (jsdom environment, configured in `vite.config.ts`'s `test` block with `setupFiles: ['./src/test/setupTests.ts']`), and **`msw`** (Mock Service Worker) providing request-level API mocks via `frontend/src/test/msw/{handlers,server}.ts`. Roughly 30 `*.test.ts(x)` files exist under `frontend/src`, covering pages, shared UI components, contexts, and API-wrapper modules — see [Section 18 — Testing](#18-testing).

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
| API documentation | **`swagger-ui-express`**, a hand-written `openapi-types`-typed spec under `backend/src/docs/` (`openapi.ts`, `meta.ts`, `paths/*.paths.ts` per resource, `components/schemas/*.schema.ts`, `components/parameters/*.parameters.ts`, `components/responses/common.responses.ts`) | This is a change from an earlier state of the repository, where no Swagger route was registered at all. `Kernel.initSwagger` (`backend/src/core/kernel.ts`) is now called from `app.ts` and, when `NODE_ENV !== "production"`, mounts `GET /api-docs.json` (the raw `openApiSpec` object) and `GET /api-docs` (`swagger-ui-express`'s `serve`/`setup`, rendering the same spec as an interactive UI). It strips the `Content-Security-Policy` header helmet sets globally, but only on requests under `/api-docs`, so Swagger UI's inline bootstrap script isn't blocked elsewhere. `openapi.ts` merges per-resource path modules (`authPaths`, `adminPaths`, `doctorPaths`, `appointmentPaths`, `patientPaths`, `healthPaths`) and throws at module load (i.e. at server startup) if two modules ever declare the same path key. In production the route is not mounted at all — `initSwagger` returns immediately. `swagger-jsdoc` remains listed in `package.json` but is still not used anywhere (the spec above is hand-assembled TypeScript objects, not JSDoc-annotated comments), and the `backend/swagger-doc/` directory is still empty. |
| Other notable dependencies present but not central to the reviewed flows | `aws-sdk`, `axios`, `typedi`, `swagger-jsdoc`, `express-handlebars`, `express-http-context`, `typeorm-pagination`, `moment-timezone` | Still present in `package.json` but **not found to be used** anywhere in `backend/src` (e.g. IST time handling uses `Intl.DateTimeFormat`, not `moment-timezone`). `swagger-ui-express` has moved out of this row — see the "API documentation" row above, since it is now genuinely wired up. Treat the rest as inherited/unused dependencies unless you find an active call site. |

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

**Migrations** — four migration files exist in `backend/src/database/migration/`, and together they provision the schema from an empty database (this is a change from an earlier state of the repository, where only an index-adding migration existed with no baseline):

1. `20260101000000-InitialSchema.ts` — the baseline. Creates the `btree_gist` extension (required to combine an equality column with a range column in a GIST exclusion constraint), the three enum types (`user_role`, `appointment_status`, `blood_group`), all seven tables with their foreign keys and exclusion constraints, and seeds four starter rows into `specializations`: *General Practitioner*, *Cardiology*, *Dermatology*, *Pediatrics*.
2. `20260827120000-AddAppointmentQueryIndexes.ts` — adds `idx_appointments_patient_id_status` on `(patient_id, status)`, `idx_appointments_doctor_id_status` on `(doctor_id, status)`, and a GIST index `idx_appointments_appointment_time_gist` on `appointment_time`.
3. `20260827130000-AddActiveInvitationUniqueIndex.ts` — adds the partial unique index above, to make duplicate-pending-invitation prevention race-proof at the database level (see [Section 10](#10-invitation-system)).
4. `20260903000000-AddInvitationSourceAndNullableCreatedBy.ts` — supports patient self-registration ("Option B", per the migration's own comment): creates a new `invitation_source` enum type (`ADMIN_INVITATION`, `PATIENT_SELF_REGISTRATION`), adds a `user_invitations.source` column of that enum type (`NOT NULL DEFAULT 'ADMIN_INVITATION'`, so every pre-existing row is retroactively classified as admin-issued), and drops the `NOT NULL` constraint on both `user_invitations.created_by` and `user_invitations.updated_by` — a self-requested invitation has no inviting admin, so those columns must be able to hold `NULL`. Its `down()` migration, by the same acknowledged limitation as `InitialSchema.ts`'s `down()`, only reverses cleanly while every row still has a non-null `created_by`/`updated_by`, i.e. before the feature has actually been used.

### Infrastructure / configuration

- **Environment variables** (from `backend/.env.example`; no values reproduced here beyond placeholders): `DATABASE_URL`, `TEST_DATABASE_URL`, `PORT`, `NODE_ENV`, `LOG_LEVEL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `ACCESS_TOKEN_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `FRONTEND_URL`. `backend/src/config/secret.ts` now calls a `validateEnv()` function at import time that **throws at startup** if any of `DATABASE_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, or `FRONTEND_URL` is missing. This is a partial fix relative to an earlier state of the codebase: the four variables above now fail fast, but `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`, `PORT`, `ACCESS_TOKEN_EXPIRES_IN`/`REFRESH_TOKEN_EXPIRES_IN`, and `LOG_LEVEL` are still read unvalidated — a missing SMTP variable, for example, will still only surface when an email actually tries to send.
- **Migrations**: run with `npm run migrate` (`typeorm migration:run`), reading `ormconfig.ts` at the backend root.
- **Dev/build/start commands**: see [Section 17](#17-development-guide).
- **Deployment assumptions**: `docker-compose.yml` in `backend/` defines a `ts-bp` app service (built from `dev/docker/Dockerfile`, which does exist in this repository at `backend/dev/docker/Dockerfile`) and a Postgres container (`ts-bp_postgres`), for local development only. A second, repository-root `docker-compose.yml` now also exists, orchestrating backend + frontend + Postgres together for full-stack local/team-preview use (see "Docker Compose (full stack)" in [Section 17](#17-development-guide)) — there is still no separate production deployment manifest (no Kubernetes/ECS config, no reverse-proxy config) in this repository. `app.ts` now calls `this.app.set("trust proxy", 1)` — the app trusts exactly one upstream proxy hop, which is what `express-rate-limit`'s `req.ip` detection and secure-cookie logic rely on when deployed behind a load balancer.

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
  - A path starting with `/register` → `PatientSelfRegisterPage` (public) — the entry point for the patient self-registration flow described in [Section 10](#10-invitation-system). This route, and the marketing landing page below, did not exist in an earlier state of the repository.
  - Not authenticated and `path === "/"` → `LandingPage`, a public marketing page (`frontend/src/components/landing/*`: `LandingHeader`, `HeroSection`, `WhatWeDoSection`, `ForPatientsSection`, `ForDoctorsSection`, `FeaturesSection`, `HowItWorksSection`, `FinalCtaSection`, `LandingFooter`) rendered outside the shared `Navbar`/footer chrome used by every other page. This is the unauthenticated home page; it has no API calls of its own.
  - Not authenticated (any other path) → `LoginPage`.
  - An authenticated user who navigates to `/login`, `/register*`, or `/accept-invitation*` is redirected away (`/admin`-role → unchanged default, everyone else → `/dashboard`) by an effect in `AppContent`, so a stale bookmark or back-button visit to a sign-in-only page doesn't render a "create your account" form to someone already logged in.
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

Four `express-rate-limit` instances (`backend/src/middleware/rateLimiter.middleware.ts`), all windowed at 15 minutes, all keyed on the default `express-rate-limit` identity (derived from `req.ip`), and all automatically **skipped when `NODE_ENV === "test"`** (`skip: () => ENVIRONMENT === "test"`) so the integration test suite isn't throttled:

| Limiter | Window | Max requests | Applied to |
|---|---|---|---|
| `general` | 15 min | **1000** | Most authenticated GET/PATCH/POST routes (availability, appointments, profiles, doctor discovery, invitation listing/revoke). |
| `auth` | 15 min | **300** | `/auth/login`, `/auth/refresh`, `/auth/accept-invitation`, `/auth/invitation/:token`, `/auth/logout`. |
| `invitation` | 15 min | **500** | `POST /admin/invite`, `POST /admin/invitations/bulk`. |
| `patientSelfRegistration` | 15 min | **10** | `POST /auth/patient/self-register` only. This is a new, dedicated limiter (`backend/src/middleware/rateLimiter.middleware.ts`) — a change from an earlier state of the repository, where this route did not exist. Its ceiling is deliberately far tighter than `auth`'s, per an explicit code comment: this endpoint is the platform's first fully public, unauthenticated *write* endpoint that requires neither a credential nor a possessed token, so it needs a stricter budget than routes that already gate on one of those. |

Because `app.set('trust proxy', 1)` is now called in `app.ts`, the limiter's `req.ip` resolution (and `secure`-cookie detection) correctly reflects the real client when the app sits behind exactly one reverse-proxy hop (its own load balancer). It would not correctly identify the client through more than one untrusted hop, but that is a deployment-topology concern outside this codebase.

---

## 5. Admin API / Flow

All admin routes live under `/admin` (`backend/src/api/route/admin.routes.ts`), require `authenticate` + `authorize(ADMIN)`.

### `POST /admin/invite`

- **Purpose**: invite a single user (any role) by email.
- **Auth**: ADMIN. Rate limit: `invitation`.
- **Body** (`inviteUserSchema`): `{ email: string (valid email, required), role: "ADMIN"|"DOCTOR" (required) }`. `"PATIENT"` is **no longer a valid value here** — this is a change from an earlier state of the repository, where an admin could invite any of the three roles; a code comment on the schema explains why: "patients self-register via `POST /auth/patient/self-register` instead of being admin-invited" (see [Section 10](#10-invitation-system)). Submitting `role: "PATIENT"` now fails Joi validation with a `400 validation_error` before it ever reaches `AdminService.inviteUser`.
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
- **Note on scope**: this endpoint (and the frontend's "Invite New User" modal) lets an admin issue an invitation for `ADMIN` or `DOCTOR` — there is no restriction preventing an admin from inviting another admin. `PATIENT` is excluded (see above).

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
- **Upload constraints** (`multer`, `upload.middleware.ts`): in-memory storage, **5 MB max file size**, mimetype/extension must be `text/csv` or `.csv`. A row-count cap now also exists: `AdminController.bulkInviteUsers` rejects the whole request with `400 CSV_ROW_LIMIT_EXCEEDED` ("CSV file exceeds the maximum allowed number of rows (500)") if the parsed row count exceeds `constant.MAX_BULK_INVITE_ROWS` (`500`), checked immediately after parsing and before any row is processed. This is a change from an earlier state of the repository, where only the 5 MB file-size limit existed and a large file could still carry many thousands of rows.
- **Flow**:
  1. `AdminController.bulkInviteUsers` parses the CSV synchronously (`csv-parse/sync`, `columns: true`) into `{ email, role }[]`, then applies the 500-row cap above.
  2. `AdminService.bulkInviteUsers` iterates rows **sequentially, in a single `for...of` loop, awaiting each one**. For each row: normalizes email/role, validates with `bulkInviteRowSchema` (which, like `inviteUserSchema`, now only accepts `role: "ADMIN"|"DOCTOR"` — `PATIENT` rows fail validation, per the same self-registration-only rule described in [Section 5](#5-admin-api--flow) above and [Section 10](#10-invitation-system)), rejects a row whose (normalized) email repeats **earlier in the same file** with `DUPLICATE_EMAIL_IN_FILE` (a check added since duplicate-invitation handling was hardened — it does not hit the database at all, just an in-memory `Set` of emails seen so far in this request), and otherwise processes the row through the exact same `inviteUser()` method as the single-invite endpoint — meaning **one SMTP send per valid row, one at a time, inside the same HTTP request**. There is still no batching, queueing, or background job; the request handler does not return until every row has been attempted.
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
- `GET /doctor/appointments` — paginated/filterable/sortable list of the doctor's own appointments (`AppointmentController.getDoctorAppointments` → `AppointmentService.getDoctorAppointments`, scoped to `doctorId = req.user.id`). Before running the actual listing query, `getDoctorAppointments` now calls `expireStalePendingForDoctor(doctorId)`, a lazy sweep that auto-rejects any of this doctor's own `PENDING` appointments older than `STALE_PENDING_APPOINTMENT_HOURS` (48h) — see [Section 8](#8-appointment-lifecycle) for the mechanics. This is a change from an earlier state of the repository, where a stale, never-answered request stayed `PENDING` indefinitely.
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
- **Flow**: `AppointmentService.getPatientAppointments` first calls `expireStalePendingForPatient(patientId)` — see [Section 8](#8-appointment-lifecycle) — before building and running the listing query, so a stale `PENDING` request from this patient is auto-rejected and reflected in the very response that lists it.
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
  6. Call `expireStalePendingForPatient(patientId)` (see [Section 8](#8-appointment-lifecycle)) so an old, never-answered request of this patient's own doesn't count against the caps in step 9 below. This is a change from an earlier state of the repository, where a stale `PENDING` row would sit indefinitely and could itself contribute to blocking a new booking.
  7. Build the `[start,end)` range literal with the hardcoded `+05:30` offset, exactly as for availability.
  8. **Availability check**: find a `doctor_availabilities` row for this doctor whose range **fully contains** (`@>`) the requested range (`findDoctorAvailabilityForAppointment`). If none → `409 DOCTOR_NOT_AVAILABLE`. This means the requested slot must fit entirely inside one published availability window — booking cannot span across two adjacent windows even if they're contiguous.
  9. **Booking-abuse caps, enforced inside a single `getManager().transaction(...)` block**: the transaction first takes a Postgres advisory lock scoped to this patient (`pg_advisory_xact_lock(837412, patientId)`, via `AppointmentRepository.acquirePatientBookingLock` — released automatically on commit/rollback), which serializes every concurrent booking attempt by the same patient so two simultaneous requests can't jointly slip past the counts below (a plain count-then-insert has a TOCTOU race at the default `READ COMMITTED` isolation level, and there's no existing row to `SELECT ... FOR UPDATE` when the patient's count starts at zero). Holding that lock, the service then counts this patient's own currently-active (`PENDING`/`CONFIRMED`, not yet ended) appointments two ways: with this specific doctor (`countActiveAppointmentsForPatientAndDoctor`) and across all doctors (`countActiveAppointmentsForPatient`). If the per-doctor count is already at or above `constant.MAX_ACTIVE_APPOINTMENTS_PER_DOCTOR` (**2**) → `409 MAX_ACTIVE_APPOINTMENTS_PER_DOCTOR_EXCEEDED`. Otherwise, if the total count is already at or above `constant.MAX_ACTIVE_APPOINTMENTS_TOTAL` (**5**) → `409 MAX_ACTIVE_APPOINTMENTS_TOTAL_EXCEEDED`. This entire cap-checking mechanism does not exist in an earlier state of the repository, where a patient could hold an unbounded number of simultaneous `PENDING`/`CONFIRMED` appointments.
  10. Still inside the same transaction, insert the appointment with `status: PENDING`. If Postgres raises `23P01` (an exclusion-constraint conflict — this doctor or this patient already has an overlapping active appointment) → caught and re-thrown as `409 APPOINTMENT_TIME_UNAVAILABLE`. This is the actual, database-enforced defense against double-booking; the availability-containment check in step 8 only tells you the slot is nominally open, not that a race with another booking hasn't just filled it — the exclusion constraint is what makes double-booking impossible even under concurrent requests. Note the caps in step 9 above are checked before this insert is attempted, so a patient at their cap gets the cap-specific `409` rather than reaching the exclusion-constraint path at all.
  11. On success, sends the "appointment requested" notification emails (patient + doctor, best-effort — see [Section 9 — Email System](#email-system)).
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
 ├── REJECTED    (system, automatic — stale-pending auto-expiry, see below)
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
| `PENDING → REJECTED` | System (automatic) | No endpoint — a side effect of `POST /appointments`, `GET /appointments`, and `GET /doctor/appointments` (see below) |

An admin has no endpoint to change appointment status directly — nothing in `admin.routes.ts` touches appointments.

### Stale-pending auto-expiry — a system-driven transition

This is new functionality that does not exist in an earlier state of the repository. `AppointmentService` defines `STALE_PENDING_WINDOW_MS` as `constant.STALE_PENDING_APPOINTMENT_HOURS` (**48**) hours in milliseconds, and exposes two private helpers, `expireStalePendingForPatient(patientId)` and `expireStalePendingForDoctor(doctorId)`, each of which:
1. Computes `cutoff = now - 48h`.
2. Calls `AppointmentRepository.expireStalePendingAppointmentsForPatient`/`...ForDoctor`, which issues a single atomic `UPDATE appointments SET status = 'REJECTED' WHERE {patient_id|doctor_id} = :id AND status = 'PENDING' AND created_at < :cutoff RETURNING id` — no row lock is needed, because whichever concurrent sweep's `UPDATE` statement reaches a given row first "claims" it (its `status = 'PENDING'` predicate no longer matches for the other).
3. For every id returned, loads the appointment (with its patient/user relations, via the new `findAppointmentsWithPatientByIds`) and re-uses the existing `notifyAppointmentStatusTransition(PENDING, REJECTED, appointment, doctorId)` path — the same one a doctor-initiated decline uses — so the patient receives the same "declined" email (`sendAppointmentDeclinedEmail`) they would if a doctor had rejected the request by hand. Each notification send is independently wrapped in try/catch-and-log, exactly as for every other appointment-lifecycle email (see [Section 9 — Email System](#email-system)), so one failing send never blocks the others or the expiry itself.

These sweeps are **not** a background job or a cron/scheduled task — there is no such mechanism anywhere in this codebase. They run lazily, as a side effect, at the start of three call paths: `AppointmentService.createAppointment` (for the booking patient, before the booking-abuse caps are evaluated — see [Section 7](#7-patient-api--flow)), `AppointmentService.getPatientAppointments` (for the requesting patient, before the listing query — see [Section 7](#7-patient-api--flow)), and `AppointmentService.getDoctorAppointments` (for the requesting doctor, before the listing query — see [Section 6](#6-doctor-api--flow)). This means a stale `PENDING` row for a patient/doctor who never triggers one of those three calls again will keep showing as `PENDING` indefinitely — the expiry is opportunistic, not guaranteed to run within 48 hours of actually going stale. It is also never surfaced to the client as an error; the caller only observes the state change afterward (e.g. a newly-`REJECTED` row appearing in a subsequent list response).

### Booking-abuse caps

Also new relative to an earlier state of the repository: `POST /appointments` now caps how many simultaneously-active (`PENDING`/`CONFIRMED`, not yet ended) appointments a single patient may hold, enforced inside the same database transaction as the insert (see step 9 of the booking flow in [Section 7](#7-patient-api--flow)) —
- at most `constant.MAX_ACTIVE_APPOINTMENTS_PER_DOCTOR` (**2**) active appointments with any one doctor → otherwise `409 MAX_ACTIVE_APPOINTMENTS_PER_DOCTOR_EXCEEDED`;
- at most `constant.MAX_ACTIVE_APPOINTMENTS_TOTAL` (**5**) active appointments in total, across all doctors → otherwise `409 MAX_ACTIVE_APPOINTMENTS_TOTAL_EXCEEDED`.

Both caps are counted only after that patient's own stale `PENDING` requests have just been auto-expired (see above), and both checks happen while holding a Postgres advisory lock scoped to the patient's id (`pg_advisory_xact_lock(837412, patientId)`), so two concurrent booking requests from the same patient cannot jointly land on the same doctor or total count and both slip under a cap that a serialized pair of requests would have caught.

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

Email is sent by a single `EmailService` (`backend/src/service/email/email.service.ts`), instantiated in both `AdminService` and `AppointmentService` (and, since patient self-registration was added, in `AuthService` as well — see [Section 10](#10-invitation-system)). It wraps one shared `nodemailer` transporter (`createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465, auth: { user: SMTP_USER, pass: SMTP_PASSWORD } })`, `from: SMTP_USER`) and exposes seven methods, each building its content from a dedicated template module under `backend/src/service/email/templates/`.

**Template architecture — a change from an earlier state of the repository**, where `layout.template.ts` rendered each email as one large inline-styled HTML string. The templates now compose a small set of shared, reusable pieces under `backend/src/service/email/components/`:
- `shell.ts` (`renderEmailShell`) — the outermost HTML document: doctype/head/meta tags, the Outlook/mso-specific style fixes and one mobile media query that genuinely can't be inlined, the page background, the centered `600px`-wide rounded card container, and a hidden inbox-preview "preheader" snippet (auto-derived from the email's own first paragraph, padded with zero-width-joiner characters to stop Gmail/Outlook from spilling real body text into the preview line).
- `header.ts` (`renderEmailHeader`) — a small dark rounded-square monogram ("D") plus the "DocPulse" wordmark, built from table cells and a text glyph rather than an image (there is no logo asset file in the repository).
- `footer.ts` (`renderEmailFooter`) — a divider followed by the brand name, tagline, and a copyright line with the current year.
- `divider.ts` (`renderDivider`) — a single thin horizontal rule, reused by the footer and available to any template.
- `button.ts` (`renderEmailButton`) — the CTA button, rendered as a table cell with a background color and inline-padded `<a>` tag (a "bulletproof-lite" pattern that renders correctly across Gmail/Apple Mail/Outlook.com/desktop Outlook without VML).
- `infoCard.ts` (`renderInfoCard`) — a bordered, rounded box that renders the label/value detail rows (e.g. Date, Time, Role/Status) as stacked "uppercase micro-label above bold value" pairs, mirroring the site's own appointment-card UI convention, plus an optional colored status **badge** (`success`/`pending`/`cancelled`/`completed`/`declined` tones, defined in `backend/src/service/email/theme.ts`) — replacing what used to be a flat two-column table.

`backend/src/service/email/theme.ts` centralizes the design tokens (brand name/tagline/monogram, font family, the page/surface/border/text colors, the five badge tone palettes, corner radii, and the `600`px content width) — translated from the live frontend's own CSS variables and status-badge palette so the emails read as an extension of the product rather than a generic template. `backend/src/service/email/utils.ts` provides the shared `escapeHtml`/`escapeAttribute` helpers and a preheader-text truncator.

`layout.template.ts`'s `renderTransactionalEmail` remains the single entry point every template calls: it now composes `renderEmailHeader()` + the heading/greeting/paragraphs/info-card/button/closing-note content block + `renderEmailFooter()` into one `bodyHtml` string, hands that to `renderEmailShell()`, and still separately produces a plain-text fallback body from the same input data (so the plain-text version is unaffected by the HTML redesign, and existing template tests that assert on plain-text wording did not need to change). Every appointment-lifecycle template (`appointment-confirmed`/`declined`/`completed`/`cancelled`/`requested`) now also passes a `badge` (e.g. `{ label: "Confirmed", tone: "success" }`) reflecting that email's status, and `invitation.template.ts` (see [Section 10](#10-invitation-system)) branches its subject line, CTA label, and body copy on whether the invitation's `source` is `ADMIN_INVITATION` or `PATIENT_SELF_REGISTRATION`.

| Method | Template | Recipient | Trigger |
|---|---|---|---|
| `sendInvitationEmail` | `invitation.template.ts` | The invitee (any role for an admin invite; always a prospective patient for self-registration) | `AdminService.inviteUser`, after the invitation row is committed; also `AuthService.requestPatientSelfRegistration`, after a self-registration invitation row is committed — see [Section 10](#10-invitation-system). The method now takes a fourth, defaulted `source: InvitationSource` parameter (`ADMIN_INVITATION` by default) that the template uses to vary its subject/copy. |
| `sendAppointmentRequestedPatientEmail` | `appointment-requested.template.ts` | Patient | `AppointmentService.createAppointment`, after the appointment is inserted (status `PENDING`). |
| `sendAppointmentRequestedDoctorEmail` | `appointment-requested.template.ts` | Doctor (if their user record has an email) | Same trigger as above, sent alongside the patient email. |
| `sendAppointmentConfirmedEmail` | `appointment-confirmed.template.ts` | Patient | `AppointmentService.updateAppointmentStatus`, on a `PENDING → CONFIRMED` transition. |
| `sendAppointmentDeclinedEmail` | `appointment-declined.template.ts` | Patient | Same method, on a doctor-initiated `PENDING → REJECTED` transition, **and** on the automatic system-driven `PENDING → REJECTED` stale-pending auto-expiry transition (see [Section 8](#8-appointment-lifecycle)) — both reuse the identical "declined" email with no wording distinguishing the two causes. |
| `sendAppointmentCompletedEmail` | `appointment-completed.template.ts` | Patient | Same method, on a `CONFIRMED → COMPLETED` transition. |
| `sendAppointmentCancelledEmail` | `appointment-cancelled.template.ts` | Doctor | `AppointmentService.cancelAppointment` (the patient-initiated cancellation flow) — there is only a doctor-facing cancellation template; nothing emails the patient back their own cancellation. |

**Failure handling differs by trigger, and now by caller**: the **admin-invitation** email (step 5 of [Section 5](#5-admin-api--flow)) is the one case where a send failure is surfaced to the caller — `AdminService.inviteUser` deletes the invitation row and throws a `500 FAILED_TO_SEND_INVITATION` back to the admin. The **patient self-registration** email (`AuthService.requestPatientSelfRegistration`, [Section 10](#10-invitation-system)) also deletes its just-created invitation row on a send failure, but — unlike the admin path — does **not** surface any error: the method simply returns, and the controller sends the same generic `200 SELF_REGISTRATION_LINK_SENT` response it would on any other silent no-op branch, consistent with that endpoint's enumeration-safety requirement (see [Section 10](#10-invitation-system)). Every appointment-lifecycle email (requested/confirmed/declined/completed/cancelled — including the stale-pending auto-expiry's reuse of the declined email, [Section 8](#8-appointment-lifecycle)), by contrast, is sent **after** the underlying database write (the appointment insert or status change) has already been committed, and each send is wrapped so that a failure is only logged (`logEmailFailure`) — it never rolls back the state change or fails the HTTP response. This is confirmed by `backend/test/integration/appointment.test.ts`'s "Appointment email notifications" suite, which explicitly asserts that a mocked email-send failure does not fail the underlying operation.

`backend/test/unit/email-templates.test.ts` unit-tests every template directly (not through `EmailService`), asserting subject lines, that each template mentions the right party/details, and negative assertions (e.g. the confirmed-patient email must not contain "declined" wording; the completed email must not leak diagnosis/prescription/notes text).

---

## 10. Invitation System

Sequence diagrams tracing both flows below (admin-issued and patient self-registration) step by step, cross-checked against the integration and e2e suites, live in `docs/architecture/` (see in particular `04-admin-flows.md` and `07-cross-role-sequences.md`); this section is the prose+API reference, not a diagram.

### Lifecycle (admin-issued invitation)

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

### Patient self-registration ("Option B")

New relative to an earlier state of the repository, where every account — including patients' — was created only by accepting an admin-issued invitation (see [Section 1](#1-project-overview)). A prospective patient can now request their own signup link, without any admin involvement:

```
Prospective patient submits { email }         POST /auth/patient/self-register
   │  (public route, no auth cookie; rate-limited by a dedicated
   │   `patientSelfRegistration` limiter — 10 requests / 15 min, see
   │   Section 4 — tighter than every other limiter, since this is the
   │   platform's first fully public, unauthenticated *write* endpoint)
   ▼
AuthController.requestPatientSelfRegistration
   │  always responds 200 { success: true, message: SELF_REGISTRATION_LINK_SENT }
   │  ("If this email is eligible for registration, you'll receive a
   │  verification link shortly.") — regardless of which branch below runs
   ▼
AuthService.requestPatientSelfRegistration(email)
   ├── trim/lowercase email
   ├── if a live (non-deleted) user already has this email → log + return (no-op)
   ├── if an active (not used/revoked) invitation already exists for this
   │     email → log + return (no-op)
   ├── generate a 32-byte random token; SHA-256 hash it; expiresAt = now + 24h
   ├── insert { email, role: PATIENT, hashedToken, expiresAt,
   │     createdBy: null, updatedBy: null, source: PATIENT_SELF_REGISTRATION }
   │     via createSelfRegistrationInvitation — the same race-proofed,
   │     retry-once-on-conflict pattern as AdminService.createInvitationRaceProof
   │     (backed by the same idx_user_invitations_active_email partial unique
   │     index), except an unresolvable conflict here resolves to a silent
   │     no-op (returns null) rather than throwing, since there is nothing
   │     for the controller to report back distinctly
   └── send the invitation email (EmailService.sendInvitationEmail(email,
         PATIENT, token, PATIENT_SELF_REGISTRATION)); on failure, delete the
         invitation row and return silently (no 500 — see Section 9 —
         Email System)
   │
   ▼
From here on, identical to the admin-issued flow above: the emailed link
opens AcceptInvitationPage, GET /auth/invitation/:token confirms role
PATIENT, and POST /auth/accept-invitation creates the account exactly as
described in "Lifecycle (admin-issued invitation)" — acceptInvitation has
no branch on invitation.source at all.
```

**Why the response never differentiates ("enumeration-safety")**: `requestPatientSelfRegistration` deliberately resolves (returns) identically — silently, with no thrown error and no distinguishable return value — whether the email belongs to an existing account, already has an active invitation, or is genuinely new and about to be emailed. `AuthController.requestPatientSelfRegistration` has nothing to branch on as a result, so it always sends the same generic `200` message. This means the endpoint cannot be used to determine whether a given email address already has an account on the platform (an "account enumeration" concern for a fully public endpoint) — a property the admin-invitation flow does **not** have, since `POST /admin/invite` returns a distinguishable `409 USER_ALREADY_EXISTS`/`409 INVITATION_ALREADY_SENT` (that endpoint is only reachable by an already-authenticated admin, so enumeration by an anonymous caller isn't a concern there).

**Role and source are never client-supplied**: the request body accepts only `{ email }` (`requestPatientSelfRegistrationSchema`) — `role` is hardcoded to `PATIENT` and `source` to `PATIENT_SELF_REGISTRATION` inside the service, exactly as the admin-issued flow always derives `role` from the invitation row rather than the client at acceptance time.

**Admin invite and bulk-invite no longer accept `PATIENT`**: consistent with self-registration being the only path to a new patient account, `inviteUserSchema` and `bulkInviteRowSchema` were both narrowed to `"ADMIN"|"DOCTOR"` only (see [Section 5](#5-admin-api--flow)) — an admin can no longer invite a patient directly.

### Token security

Applies identically to both invitation sources (admin-issued and self-registration):

- The link contains a **raw, high-entropy token** (`crypto.randomBytes(32)` → 64 hex characters). Only its **SHA-256 hash** is ever persisted (`hashedToken`, unique) — the raw token cannot be recovered from the database.
- Expiration is fixed at **24 hours** from creation, computed server-side, not configurable per invitation.

### Duplicate / concurrent-acceptance handling — current behavior

- **Duplicate invitations**: `AdminService.inviteUser`'s fast-path check (an existing pending invitation for the same email) is backed, since the `AddActiveInvitationUniqueIndex` migration, by the partial unique index `idx_user_invitations_active_email ON user_invitations (email) WHERE used_at IS NULL AND revoked_at IS NULL`. Two admin requests issued at almost the same instant for the same email can no longer both succeed: the database itself rejects the second insert with a unique-violation, which `createInvitationRaceProof` catches and turns into either a retry (if the conflicting row had actually expired) or a `409 INVITATION_ALREADY_SENT`. This is a genuine fix relative to an earlier state of the codebase, where this was only an application-level check-then-insert with no backing constraint. `AuthService.createSelfRegistrationInvitation` uses the identical index-backed retry-once pattern for the self-registration path — the only behavioral difference is that an unresolvable conflict there resolves to a silent no-op rather than a thrown `409`, per the enumeration-safety requirement described above.
- **Concurrent acceptance of the same invitation**: `acceptInvitation` now loads the invitation with `SELECT ... FOR UPDATE` inside a transaction (`InvitationRepository.findByHashedTokenForUpdate`). A second concurrent request for the same token blocks on that row lock until the first transaction commits (or rolls back), and then observes `usedAt` already set — so it is rejected as "already used" rather than racing to create a second account. This, together with the transaction wrapping described below, is a genuine fix relative to an earlier state of the codebase where no lock or transaction covered this window; `backend/test/integration/invitation.test.ts` includes a "concurrent accept-invitation race" test covering this.

### Transaction handling

Also applies identically regardless of how the invitation being accepted originated. `AuthService.acceptInvitation` now runs its entire body — the invitation row lock, profile-field validation, `users` row creation, `patients`/`doctors` profile row creation, and marking the invitation used — inside a single `getManager().transaction(async (manager) => { ... })` block. If any step fails (e.g. profile validation throws, or a later insert fails), the whole transaction rolls back: no orphaned `users` row without a matching profile row, and no invitation incorrectly marked used. `backend/test/integration/invitation.test.ts` includes a test asserting rollback behavior when a later step in this flow fails.

### Doctor and patient profile data are now collected at signup

Unlike an earlier version of this flow, **no profile field is hardcoded**. `AuthService.validateDoctorProfileData` (for `role === DOCTOR`) requires `specializationId` (→ `400 SPECIALIZATION_ID_REQUIRED` if missing) and `experienceYears` (→ `400 EXPERIENCE_YEARS_REQUIRED` if missing), and confirms the specialization exists and is active (→ `400 INVALID_SPECIALIZATION` otherwise) before the `doctors` row is created with the real submitted values. `AuthService.validatePatientProfileData` (for `role === PATIENT`) requires `dob` (→ `400 DOB_REQUIRED`; must be a real past date on/after `1900-01-01`, else `400 INVALID_DOB`), `heightCm` (→ `400 HEIGHT_REQUIRED`), `weightKg` (→ `400 WEIGHT_REQUIRED`), and `bloodGroup` (→ `400 BLOOD_GROUP_REQUIRED`, or `400 INVALID_BLOOD_GROUP` if it isn't one of the `BloodGroup` enum values). The role itself is always taken from the invitation row looked up server-side, never from the request body, so a client cannot self-assign a role during acceptance.

The password submitted at this step is also checked against a policy (`PASSWORD_MIN_LENGTH = 12`, requiring at least one lowercase letter, one uppercase letter, one digit, and one non-alphanumeric character, max 128 characters), enforced by `acceptInvitationSchema` (Joi) on the backend and mirrored on the frontend by `frontend/src/utils/passwordPolicy.ts` plus a live `PasswordRequirementChecklist` component — the same rule is checked in both places, not just cosmetically on the client.

### Email failure handling

If `EmailService.sendInvitationEmail` throws (SMTP error, bad credentials, etc.) for an **admin-issued** invitation, `AdminService.inviteUser` deletes the invitation row it had just inserted and throws `500 FAILED_TO_SEND_INVITATION` — see [Section 5](#5-admin-api--flow). There is still no automatic retry and no dedicated "resend" endpoint; re-inviting the same email is the only recourse once the failed row has been cleaned up. The **self-registration** path also deletes the invitation row on the same failure, but resolves silently instead of surfacing an error — see "Patient self-registration" above and [Section 9 — Email System](#email-system).

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
- `created_by`, `updated_by` (smallint, FK → `users.id`, **nullable**) — this is a change from an earlier state of the repository, where both columns were `NOT NULL`; the `20260903000000-AddInvitationSourceAndNullableCreatedBy.ts` migration (see [Section 2](#2-technology-stack)) dropped that constraint, because a patient self-registration invitation (see [Section 10](#10-invitation-system)) has no inviting admin to record here — both columns are `null` for a self-registration row.
- `source` (enum `invitation_source`: `ADMIN_INVITATION`|`PATIENT_SELF_REGISTRATION`, `NOT NULL DEFAULT 'ADMIN_INVITATION'`) — new column, added by the same migration, recording which of the two flows in [Section 10](#10-invitation-system) created this row. Every row that existed before the migration ran is retroactively classified as `ADMIN_INVITATION` by the column default.
- `created_at`, `updated_at`
- Status (`PENDING`/`USED`/`EXPIRED`/`REVOKED`) is **derived at read time**, not a stored column, and is independent of `source`.
- **Constraint**: partial unique index `idx_user_invitations_active_email ON (email) WHERE used_at IS NULL AND revoked_at IS NULL` — at most one *active* (not yet used or revoked) invitation can exist per email at a time, regardless of `source`; this does not prevent multiple *historical* (used/revoked) rows for the same email.

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
| POST | `/auth/patient/self-register` | none | Request a patient self-registration link by email (always the same generic response — see [Section 10](#10-invitation-system)) | none (rate-limited, dedicated `patientSelfRegistration` limiter) | `{ success: true, message: SELF_REGISTRATION_LINK_SENT }` |
| GET | `/auth/invitation/:token` | none | Preview an invitation's role (for the signup form) without consuming it | none (rate-limited) | `{ success, data: { role, email } }` |
| POST | `/auth/accept-invitation` | none (has token) | Complete signup from an invitation, including role-specific profile fields | none (rate-limited) | `{ success, message, data: user }` |
| POST | `/auth/logout` | any | Clear auth cookies | none | `{ success: true }` |

### Admin

| Method | Endpoint | Role | Purpose | Auth | Main Response |
|---|---|---|---|---|---|
| POST | `/admin/invite` | ADMIN | Invite one `ADMIN`/`DOCTOR` user by email+role (`PATIENT` is rejected — see [Section 10](#10-invitation-system)) | cookie + ADMIN | `{ success, data: invitation }` |
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
  - `400` — bad input / invalid state transition / conflicting filters / missing role-specific signup or profile fields (e.g. `SPECIALIZATION_ID_REQUIRED`, `EXPERIENCE_YEARS_REQUIRED`, `INVALID_SPECIALIZATION`, `DOB_REQUIRED`, `INVALID_DOB`, `HEIGHT_REQUIRED`, `WEIGHT_REQUIRED`, `BLOOD_GROUP_REQUIRED`, `INVALID_BLOOD_GROUP`) / a bulk-invite CSV exceeding the row cap (`CSV_ROW_LIMIT_EXCEEDED`, see [Section 5](#5-admin-api--flow)).
  - `401` — missing/invalid/expired JWT, invalid credentials, invalid/expired refresh token.
  - `403` — authenticated but wrong role.
  - `404` — resource not found or not owned by the caller (appointment/availability/doctor/patient/invitation lookups scoped by owner id return "not found" rather than "forbidden" when the id exists but belongs to someone else); also `DOCTOR_NOT_FOUND`/`PATIENT_NOT_FOUND` from the new profile endpoints.
  - `409` — genuine conflicts: `AVAILABILITY_OVERLAP`, `APPOINTMENT_TIME_UNAVAILABLE`, `DOCTOR_NOT_AVAILABLE`, `APPOINTMENT_TIME_ALREADY_PASSED`, `APPOINTMENT_NOT_YET_STARTED`, `CANNOT_CANCEL_PAST_APPOINTMENT`, `APPOINTMENT_STATUS_CONFLICT` (lost a concurrent status-update race — see [Section 8](#8-appointment-lifecycle)), `MAX_ACTIVE_APPOINTMENTS_PER_DOCTOR_EXCEEDED`, `MAX_ACTIVE_APPOINTMENTS_TOTAL_EXCEEDED` (the booking-abuse caps — see [Section 8](#8-appointment-lifecycle)), `USER_ALREADY_EXISTS`, `INVITATION_ALREADY_SENT`, `INVITATION_ALREADY_REVOKED`.
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
- **Rate limiting**: four tiers (`general`/`auth`/`invitation`/`patientSelfRegistration`) via `express-rate-limit`, automatically disabled in the test environment — see [Section 4](#4-authentication-and-authorization).
- **Enumeration-safe self-registration**: `POST /auth/patient/self-register` always returns the same generic `200` response regardless of whether the submitted email already has an account, already has a pending invitation, or is genuinely new — an anonymous caller cannot use it to probe which email addresses have accounts on the platform (see [Section 10](#10-invitation-system)).
- **Booking-abuse caps and stale-request auto-expiry**: a patient is capped at 2 simultaneously-active appointments with any one doctor and 5 in total, enforced under a per-patient Postgres advisory lock to close a count-then-insert race; unanswered `PENDING` requests older than 48 hours are automatically rejected the next time the patient's or doctor's own appointments are queried or a new booking is attempted (see [Section 8](#8-appointment-lifecycle)).
- **Soft deletion** on `users` (`deleted_at`), consistently checked (`deleted_at IS NULL`) in every login/lookup query that reads a user.
- **Database-level constraints** as the actual source of truth for "no double booking", "no overlapping availability", and (now) "no duplicate active invitation per email" — GIST exclusion constraints and a partial unique index — rather than relying solely on an application-level check-then-insert.
- **Transactional invitation acceptance**, with a row lock (`SELECT ... FOR UPDATE`) preventing a concurrent accept of the same token from creating two accounts (see [Section 10](#10-invitation-system)).
- **Concurrency-safe appointment status updates**: a compare-and-swap `UPDATE ... WHERE ... AND status = :expectedStatus`, returning `409 APPOINTMENT_STATUS_CONFLICT` on a lost race, rather than silently allowing one request to overwrite another (see [Section 8](#8-appointment-lifecycle)).
- **CORS**: locked to a single configured origin (`FRONTEND_URL`) with `credentials: true`, restricted to the methods and headers the app actually uses.
- **A real automated test suite**, including a dedicated `security.test.ts` that asserts standard security headers are present on API responses (see [Section 18 — Testing](#18-testing)).

### What was not found in the codebase (still-open items)

- **No refresh-token rotation or revocation list** — a refresh token remains valid for its full lifetime once issued; there is no server-side way to invalidate a single outstanding refresh token before it expires (logout only clears the cookie client-side). Unchanged from an earlier review of this code.
- **CSV row-count is now capped** (`MAX_BULK_INVITE_ROWS = 500`, `400 CSV_ROW_LIMIT_EXCEEDED` beyond it — see [Section 5](#5-admin-api--flow)), but rows are still processed strictly one at a time, in-request, with no batching/queueing/background job — a full 500-row file still means up to 500 sequential SMTP sends inside a single HTTP request.
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
- A patient cannot hold more than 2 simultaneously-active (`PENDING`/`CONFIRMED`) appointments with the same doctor, nor more than 5 in total across all doctors — both counted and enforced inside one transaction, under a per-patient Postgres advisory lock, at the moment of booking (`appointment.service.ts::createAppointment`, `constant.MAX_ACTIVE_APPOINTMENTS_PER_DOCTOR`/`MAX_ACTIVE_APPOINTMENTS_TOTAL`).
- A `PENDING` appointment a doctor has not responded to within 48 hours (`constant.STALE_PENDING_APPOINTMENT_HOURS`) is automatically transitioned to `REJECTED` — lazily, the next time that patient's or that doctor's own appointments are listed or a new booking is attempted, not on a fixed schedule (`appointment.service.ts::expireStalePendingForPatient`/`expireStalePendingForDoctor`).
- A new patient account can only be created through patient self-registration (`POST /auth/patient/self-register` followed by `POST /auth/accept-invitation`); an admin can no longer create a `PATIENT`-role invitation through `POST /admin/invite` or the bulk-invite CSV flow (`inviteUser.validator.ts`/`bulkInvite.validation.ts`, both restricted to `ADMIN`/`DOCTOR`).
- `POST /auth/patient/self-register` never reveals whether a submitted email already has an account or a pending invitation — it resolves identically (a generic `200`) in every case, by design (`auth.service.ts::requestPatientSelfRegistration`).
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
Same link/flow as above, but for a patient invite: `AcceptInvitationPage` renders date-of-birth, height, weight, and blood-group fields instead of a specialization dropdown → `POST /auth/accept-invitation` → `AuthService.acceptInvitation` validates all four fields and creates the `patients` row with the submitted values. This is now reachable only via the self-registration flow below — an admin can no longer create a `PATIENT`-role invitation.

### 4. Patient self-registers
New flow, absent from an earlier state of the repository. Prospective patient → the public `/register` route → `PatientSelfRegisterPage` ("Create Your Patient Account") → enters an email address → `requestPatientRegistrationApi` → `POST /auth/patient/self-register` → `AuthService.requestPatientSelfRegistration` creates a `PATIENT_SELF_REGISTRATION`-sourced invitation and emails the same kind of link an admin invite would, unless the email already has an account or an active invitation, in which case it silently no-ops → the page always shows the same "Check Your Inbox" confirmation regardless of which branch ran, so the response never reveals which case occurred. From here the flow rejoins step 3 above verbatim: the emailed link opens `AcceptInvitationPage`, which behaves identically regardless of the invitation's `source`.

### 5. Doctor creates availability
Doctor logs in → `DashboardPage` (role DOCTOR) → "My Availability" tab → `DoctorAvailabilitySection` form (date/start/end, `min={today}` on the date input) → `createDoctorAvailabilityApi` → `POST /doctor/availability` → validated, checked against past-date/time, inserted (409 on overlap) → list refetched via `GET /doctor/availability`.

### 6. Doctor or patient updates their profile
Any authenticated user → "Profile" (Navbar, or the admin profile dropdown) → `/profile` → `ProfilePage` fetches `GET /doctor/profile` or `GET /patient/profile` depending on role and renders `DoctorProfileForm`/`PatientProfileForm` (an ADMIN sees a "not applicable" message instead) → editing the allowed field(s) and saving calls `PATCH /doctor/profile` or `PATCH /patient/profile` → updated profile re-rendered on success.

### 7. Patient searches for a doctor
Patient logs in → `DashboardPage` (role PATIENT) → "Find & Book Doctors" tab (default) → `PatientDoctorDiscovery` loads specializations + doctor list on mount, refetches on any filter change (`search`/`specialization`/`date`) → `GET /doctors`.

### 8. Patient views availability and books an appointment
Patient clicks "Book Appointment" on a doctor card → `GET /doctors/:doctorId/availability` → busy-subtracted, now-clamped free slots returned, grouped by date in the modal (the modal resets its state for the newly opened doctor) → patient picks a date and a suggested 30-min slot (or a custom range) → client-side re-validation → `POST /appointments` → backend re-validates independently (past-check, doctor/patient existence, availability containment, and — new — the per-doctor/total active-appointment caps described in [Section 8](#8-appointment-lifecycle)) → inserted as `PENDING` (409 on a race/overlap via the exclusion constraint, or on a cap being exceeded) → both patient and doctor receive an "appointment requested" email (best-effort) → modal shows success, `onSuccess` switches the dashboard to "My Appointments".

### 9. Doctor confirms/rejects the appointment
Doctor → "Patient Appointments" tab → `DoctorAppointmentsSection` lists appointments (filter/sort/paginate) → for a `PENDING` row, "Confirm" or "Decline" opens a confirmation dialog → `PATCH /doctor/appointments/:id/status` with `CONFIRMED` or `REJECTED` → backend checks the transition is allowed, that the time hasn't passed, and applies the compare-and-swap update (409 if the status changed underneath it) → patient receives a confirmation or decline email (best-effort) → list refetched. Separately, simply *loading* this list (`GET /doctor/appointments`) can itself flip an old, unanswered `PENDING` row to `REJECTED` before the list is even returned — see the stale-pending auto-expiry in [Section 8](#8-appointment-lifecycle).

### 10. Doctor completes the appointment
For a `CONFIRMED` row whose start time has arrived, "Complete Visit" → `PATCH .../status` with `COMPLETED` → backend checks the appointment has started → updated → patient receives a completion email (best-effort).

### 11. Patient cancels an appointment
"My Appointments" → for a cancellable row (status `PENDING`/`CONFIRMED` and not yet started), "Cancel Appointment" → confirmation dialog → `PATCH /appointments/:id/status` with `CANCELLED` → backend re-checks ownership, current status, and that the time hasn't passed → doctor receives a cancellation email (best-effort) → list refetched. Once cancelled, the appointment's time range no longer counts as "active," so it stops blocking that doctor's/patient's availability for other bookings.

### 12. User refreshes an expired access token
Any authenticated request returns `401` → `apiFetch` (unless `skipAuthRefresh`) calls `getRefreshedAccessToken()` (deduped across concurrent callers) → `POST /auth/refresh` reads the `refreshToken` cookie, verifies it, issues a new `accessToken` cookie → the original request is retried once. If the refresh call itself fails, the client calls `/auth/logout`, clears local storage, and dispatches `docpulse:session-expired`, which `AuthContext` picks up to clear `user` and fall back to the login screen.

### 13. User logs out
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
Production-style run: `npm run start` (`build-ts` then `serve`, i.e. `node dist/server.js`). Backend listens on `PORT` (falls back to `3001` if unset). This is a change from an earlier state of the repository: `apiClient.ts`'s `API_BASE_URL` used to be hardcoded to `http://localhost:3000`, which broke as soon as the frontend was accessed from any origin other than the machine running the backend (e.g. through an ngrok tunnel, where a teammate's `localhost:3000` resolves to their own machine, not the tunnel host). `API_BASE_URL` is now `""` (a relative path), so every `apiFetch` call resolves against whatever origin served the page; in dev this relies on `frontend/vite.config.ts`'s `server.proxy` entries (`/auth`, `/admin`, `/doctor`, `/doctors`, `/patient`, `/appointments`, all forwarded to `backendTarget`) to reach the backend server-side, avoiding both CORS and cross-site-cookie issues since the browser only ever sees one origin. `backendTarget` defaults to `http://localhost:3000` (read from `process.env.VITE_BACKEND_URL` if set) — so for local dev, `PORT=3000` in `backend/.env` (the `.env.example` default) must still match this default, or `VITE_BACKEND_URL` must be set to override it (see "Docker Compose (full stack)" below, where it's set to `http://backend:3000`).

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
- `docker-compose.yml` in `backend/` spins up the app plus a Postgres container for local development, building from `dev/docker/Dockerfile` (confirmed present at `backend/dev/docker/Dockerfile`, alongside a separate top-level `backend/Dockerfile`). This file is scoped to the backend only — it does not build or run the frontend.

### Docker Compose (full stack)

A second, repository-root `docker-compose.yml` (distinct from the backend-only one above) now exists, orchestrating all three services needed to run the whole app in containers — intended for sharing a running instance with a team (e.g. behind an ngrok tunnel), not as a production deployment manifest:

- **`postgres`** — `postgres:16-alpine`, credentials `root`/`root`, database `docpulse`, with a `pg_isready` healthcheck and a named volume (`docpulse-postgres-data`) for persistence.
- **`backend`** — built from `backend/dev/docker/Dockerfile` (the same dev image the backend-only compose file uses), started with `npm run watch`. Reads `backend/.env` via `env_file` (so real secrets are never baked into the image — see the `.dockerignore` note below), with `DATABASE_URL` and `PORT` overridden in `environment:` to point at the `postgres` service (`postgresql://root:root@postgres:5432/docpulse`) rather than whatever `backend/.env` has configured for bare-metal local dev. `depends_on: postgres: condition: service_healthy` delays backend startup until Postgres is actually accepting connections. The backend source is bind-mounted (`./backend:/var/app/ts-bp-be`) for live-reload via `nodemon`/`tsc -w`, with an anonymous volume over `node_modules` so the container's own (Linux-compiled) `node_modules` isn't shadowed by the host's — this matters because `bcrypt` compiles native bindings, which are platform-specific.
- **`frontend`** — built from a new `frontend/Dockerfile` (previously did not exist), a single-stage `node:20-alpine` image that runs `npm run dev -- --host 0.0.0.0` (the `--host` flag is required for the Vite dev server to be reachable from outside its container; it does not bind non-loopback interfaces by default). `VITE_BACKEND_URL=http://backend:3000` is set so `vite.config.ts`'s proxy resolves the backend by its Docker Compose service name rather than `localhost`, mirroring the fix described above. Source is bind-mounted the same way as the backend, with the same anonymous-volume-over-`node_modules` pattern.

All three services share one bridge network (`docpulse-net`) so they can resolve each other by service name. Ports are published to the host unchanged from local dev: `5173` (frontend), `3000` (backend), `5432` (Postgres, for connecting a host-side DB client if needed).

**Usage**:
```
docker compose up --build          # from the repository root
docker compose exec backend npm run migrate   # first run only, once Postgres/backend are up
```

**`backend/.dockerignore`** was widened at the same time this compose file was added — it previously excluded only `node_modules`, which meant `backend/dev/docker/Dockerfile`'s `COPY . /var/app/ts-bp-be` would have copied the real `backend/.env` (containing `JWT_SECRET`, `SMTP_PASSWORD`, `DATABASE_URL`, etc.) directly into the built image layer, readable by anyone with access to that image regardless of the bind-mount used at runtime. It now also excludes `.env`, `.env.*` (re-allowing `.env.example`), `dist`, `coverage`, and log files. A corresponding `frontend/.dockerignore` (previously absent, since `frontend/Dockerfile` itself did not exist) excludes the same categories.

This setup has not been build-tested end-to-end in this repository's environment, since Docker itself is not installed on the machine this was authored on — verify `docker compose up --build` succeeds, particularly that `bcrypt`'s native build step completes inside the Alpine image (if it fails, `backend/dev/docker/Dockerfile` would need `python3`, `make`, and `g++` added via `apk add --no-cache`), before relying on it.

---

## 18. Testing

An automated test suite now exists under `backend/test/` (Jest + `ts-jest` + `supertest`), where an earlier version of this document found none. A frontend Vitest/React Testing Library suite and a root-level Playwright end-to-end suite also now exist (see "Frontend tests" and "End-to-end tests" below) — an earlier version of this document found neither.

### Architecture

- **Real PostgreSQL, no mocking**: `backend/test/util/testEnv.ts` requires `TEST_DATABASE_URL` (throws if unset) and forces `NODE_ENV=test`, loaded as a Jest `setupFiles` entry so it runs before any application module reads `process.env`.
- `backend/test/util/testApp.ts` imports the **real** `app` from `backend/src/app.ts` (not a stripped-down test build) and exposes `setupIntegrationTest()`, which: awaits `app.locals.ready` and runs migrations once (`beforeAll`); truncates all application tables and re-seeds two specializations, restores mocks, and mocks all `EmailService` sends (`beforeEach`); closes the DB connection (`afterAll`).
- `backend/test/util/testDb.ts` provides `runMigrationsForTests()`, `resetDatabase()` (a `TRUNCATE ... RESTART IDENTITY CASCADE` across all tables plus reseeding), and `closeTestDb()`.
- `backend/test/util/factories.ts` provides helpers to create an admin/doctor/patient user, log in as an agent, create availability/appointment rows directly, and mock or spy on every `EmailService` method — used throughout the integration suite so tests don't depend on a real SMTP server.

### Coverage (by file)

- `appointment.test.ts` — appointment correctness and concurrency (past-date rejection, cancellation rules, elapsed-availability exclusion, slot clamping, double-booking prevention via the exclusion constraint, the concurrent status-update compare-and-swap, response shape), the booking-abuse caps (per-doctor and total active-appointment limits), and the stale-pending auto-expiry sweep (see [Section 8](#8-appointment-lifecycle)), plus a dedicated block asserting each appointment-lifecycle email fires (and that an email failure doesn't fail the underlying operation).
- `appointment-listing.test.ts` — additional coverage of the doctor/patient appointment-listing endpoints' filter/sort/pagination behavior.
- `auth.test.ts` — login/refresh token flow, and IDOR protection (a patient/doctor cannot read or act on another account's data).
- `doctor.test.ts` and `doctor-availability-query.test.ts` — inactive specializations are excluded from the discovery list and rejected at signup, plus additional coverage of the doctor-availability query/free-slot endpoints.
- `patient.test.ts` — additional patient-profile and patient-facing endpoint coverage.
- `patient-self-register.test.ts` — the full self-registration flow: requesting a link, its enumeration-safe response for an existing account/pending invitation, email failure cleanup, and that the resulting invitation is accepted through the same `POST /auth/accept-invitation` path as an admin-issued one (see [Section 10](#10-invitation-system)).
- `invitation.test.ts` — the full invite → accept-invitation → signup flow for both roles, rejection of a nonexistent specialization, rejection of missing role-specific fields, confirmation that a client-supplied role is ignored, transaction rollback on a mid-flow failure, and the concurrent-accept race.
- `admin-bulk-invite.test.ts` and `admin-invitations.test.ts` — bulk CSV invite behavior (including the `PATIENT`-role rejection and the CSV row-count cap, [Section 5](#5-admin-api--flow)) and invitation listing/filtering.
- `security.test.ts` — asserts standard Helmet security headers are present on API responses, including on the auth endpoints.
- `backend/test/unit/email-templates.test.ts` — unit-tests every email template directly (see [Section 9 — Email System](#email-system)).
- `backend/test/unit/rateLimiter.test.ts` — unit-tests the `RateLimitMiddleware` limiters directly, including the new `patientSelfRegistration` limiter's stricter ceiling (see [Section 4](#4-authentication-and-authorization)).

### Frontend tests

Also new relative to an earlier state of the repository (see [Section 2](#2-technology-stack)): roughly 30 **Vitest** + **React Testing Library** test files exist under `frontend/src`, exercising pages (`LoginPage`, `PatientSelfRegisterPage`, `AcceptInvitationPage`, `ProfilePage`, `DashboardPage`, `AdminInvitationsPage`), shared components (`AdminLayout`, `BulkInviteModal`, `AppointmentBookingModal`, `DoctorAppointmentsSection`, `DoctorAvailabilitySection`, `PatientAppointmentsList`, `PatientDoctorDiscovery`, `Navbar`, and UI-kit primitives like `Button`/`Modal`/`FormField`), the two contexts (`AuthContext`, `RouterContext`), and the API-wrapper modules (`authApi`, `adminApi`, `doctorApi`, `appointmentApi`, `profileApi`, `apiClient`) plus utility modules (`cn`, `istDateTime`, `passwordPolicy`). API calls in these tests are intercepted at the request level by **MSW** (`frontend/src/test/msw/handlers.ts`/`server.ts`), not by mocking `fetch`/`apiFetch` directly. Run via `npm run test` (`vitest run`) inside `frontend/`, or `npm run test:watch`/`npm run test:coverage` for watch mode/coverage.

### End-to-end tests

A `playwright.config.ts`-driven Playwright suite lives under the repository-root `e2e/` directory (a separate workspace from both `backend/` and `frontend/`, with its own `tsconfig.json`, `global-setup.ts`/`global-teardown.ts`, and `utils/{fixtures,db}.ts`), also not previously documented. `e2e/tests/*.spec.ts` covers, among other flows, `patient-self-register.spec.ts` (the new self-registration flow end-to-end), `patient-booking.spec.ts`/`patient-booking-conflict.spec.ts`, `doctor-confirms-appointment.spec.ts`/`doctor-rejects-appointment.spec.ts`/`doctor-completes-past-appointment.spec.ts`, `patient-cancels-appointment.spec.ts`, `doctor-onboarding.spec.ts`, `admin-bulk-invite.spec.ts`, `auth-failure-paths.spec.ts`, `profile-updates.spec.ts`, and a `smoke.spec.ts`. These run against the real backend and frontend (not mocked), driven by a real browser. The repository root's own `package.json` (`fullstack-project-root`) wires this up: `npm run test:e2e` (`playwright test --config=e2e/playwright.config.ts`), `test:e2e:ui` for the interactive UI mode, and `test:all` (`test:backend && test:frontend && test:e2e`) to run all three suites in sequence.

### Running tests

- Backend: `npm run test` (`jest --detectOpenHandles --forceExit --runInBand --coverage`, `--verbose`) or `npm run watch-test` for watch mode. There are no separate `test:unit`/`test:integration` scripts — a single Jest run picks up everything under `backend/test/**/*.test.ts`. Coverage is collected but no `coverageThreshold` is enforced. Requires `TEST_DATABASE_URL` to point at a reachable, disposable Postgres database (see [Environment variables](#environment-variables-backend) above) — this is not started automatically by the test run itself; `docker-compose.yml`'s Postgres service is a general-purpose dev database, not a dedicated test one, so provisioning a second database (or reusing the same instance under a different database name) is a manual step.
- Frontend: `npm run test` (`vitest run`) inside `frontend/` — see "Frontend tests" above.
- End-to-end: `npm run test:e2e` from the repository root — see "End-to-end tests" above. Requires both the backend and frontend to be reachable (per `e2e/playwright.config.ts`/`e2e/env.ts`), which is a separate setup step from either the Jest or Vitest suites.

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
| No automated frontend or end-to-end test suite | **Fixed** — a Vitest/React Testing Library suite under `frontend/src` and a root-level Playwright suite under `e2e/` | [2](#2-technology-stack), [18 — Testing](#18-testing) |
| No CSV row-count limit for bulk invitations (only a 5 MB file-size limit); rows processed serially in-request | **Partially fixed** — a 500-row cap now exists (`400 CSV_ROW_LIMIT_EXCEEDED`); rows are still processed strictly one at a time, in-request | [5](#5-admin-api--flow), [14](#14-security) |
| No Swagger/OpenAPI documentation wired up despite `swagger-ui-express`/`swagger-jsdoc` being installed | **Fixed** — a hand-assembled OpenAPI 3.0.3 spec under `backend/src/docs/` is now served at `GET /api-docs` (UI) and `GET /api-docs.json` (raw spec) outside production | [2](#2-technology-stack) |
| No patient self-registration; every account (including patients') required an admin-issued invitation | **Fixed** — `POST /auth/patient/self-register` lets a patient request their own signup link; admin invite/bulk-invite no longer accept `role: "PATIENT"` at all | [1](#1-project-overview), [10](#10-invitation-system) |
| A patient could hold an unbounded number of simultaneous `PENDING`/`CONFIRMED` appointments, and a never-answered request stayed `PENDING` forever | **Fixed** — per-doctor (2) and total (5) active-appointment caps at booking time, plus a lazy 48-hour stale-`PENDING`-to-`REJECTED` auto-expiry | [8](#8-appointment-lifecycle) |
| Email templates were built as one large inline-styled HTML string per template | **Refactored** (not a behavior change) — templates now compose shared components (`shell`/`header`/`footer`/`button`/`divider`/`infoCard`) plus a shared `theme.ts`; plain-text output is unaffected | [9 — Email System](#email-system) |
| No refresh-token rotation or server-side revocation list | **Still open** | [4](#4-authentication-and-authorization), [14](#14-security) |
| An invitation email failure has no dedicated "resend" endpoint | **Still open** (though the orphaned-row side effect is now cleaned up automatically) | [5](#5-admin-api--flow), [10](#10-invitation-system) |
| Availability "now" clamping truncates to the current second rather than rounding up to the next whole minute | **Still open** | [9](#9-availability-system) |
