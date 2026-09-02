# DocPulse — Technical Documentation

This document describes the system **as it is currently implemented** in this repository. It is derived entirely from the source code (routes, controllers, services, repositories, entities, middleware, frontend components and API clients) rather than from design intent. Where the implementation has a gap, inconsistency, or an unusual choice relative to typical best practice, this is called out explicitly rather than glossed over. Anything that could not be established from the code is stated as such — nothing here is invented.

Audience: a developer joining the project who needs to understand what exists today before changing it.

---

## 1. Project Overview

DocPulse is a doctor–patient appointment booking system. It lets a clinic (or single admin) onboard doctors and patients by invitation, lets doctors publish blocks of time they are available, and lets patients search for doctors and book appointments inside those time blocks. It manages the resulting appointment through a small state machine (request → confirm/reject → complete, or cancel) and prevents a doctor or patient from being double-booked at the database level.

### Roles

The system has exactly three roles, defined in `backend/src/database/enum/userRole.ts`:

- **ADMIN** — invites new users (doctors, patients, or other admins) by email, manages the invitation list, can bulk-invite via CSV.
- **DOCTOR** — publishes availability windows, views/searches their own appointments, confirms/rejects/completes appointment requests.
- **PATIENT** — searches for doctors, views a doctor's free slots, books an appointment, views/cancels their own appointments.

There is no self-registration: every account is created by accepting an admin-issued invitation (see [Section 10](#10-invitation-system)).

### High-level architecture

```
┌────────────────────┐        HTTPS (cookies)        ┌──────────────────────────────┐
│  React SPA (Vite)   │ ─────────────────────────────▶ │  Express API (TypeScript)    │
│  frontend/src        │ ◀───────────────────────────── │  backend/src                 │
└────────────────────┘                                 │   routes → middleware →      │
                                                         │   controllers → services →   │
                                                         │   repositories (TypeORM)     │
                                                         └───────────────┬──────────────┘
                                                                         │
                                                                         ▼
                                                         ┌──────────────────────────────┐
                                                         │  PostgreSQL                  │
                                                         │  (tstzrange + GIST exclusion  │
                                                         │   constraints for booking)    │
                                                         └──────────────────────────────┘
                                                                         │
                                                                         ▼
                                                         ┌──────────────────────────────┐
                                                         │  SMTP (Nodemailer)            │
                                                         │  invitation emails            │
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
| Styling | **Tailwind CSS 4** (via `@tailwindcss/vite`) | Utility-first styling used throughout every page/component; no separate CSS-in-JS library. |
| Icons | **lucide-react** | Icon set used across all pages/components. |
| Class merging | **clsx**, **tailwind-merge** | Present as dependencies for conditional/merged Tailwind class strings. |
| State management | **React Context** (`AuthContext`, `RouterContext`) — no Redux/Zustand | Two small global contexts are sufficient for this app's scope: authenticated user + notification state, and current path/navigation. |
| Routing | **Custom router** (`RouterContext.tsx`) built on `window.history` (`pushState`/`replaceState`) and `popstate` | There is **no `react-router` dependency**. Routing is a hand-rolled context that exposes `path`, `search`, `getParam`, and `navigate`; `App.tsx` then does manual `if (path === ...)` branching to decide which page to render. |
| HTTP/API communication | Native `fetch`, wrapped in `frontend/src/api/apiClient.ts` | A single `apiFetch()` helper attaches `credentials: "include"` (so cookies are sent), and transparently retries a request once after a silent `/auth/refresh` call if the server returns 401. |
| Linting | **oxlint** | Frontend lint script (`npm run lint`). |

There is no client-side test runner configured in `frontend/package.json` (no Jest/Vitest/RTL scripts present).

### Backend (`backend/`)

| Concern | Technology | Why it's used here |
|---|---|---|
| Runtime | **Node.js** (`engines.node >= 18.15.0`) | |
| Framework | **Express 4** | REST API; routes registered per resource (`/auth`, `/admin`, `/doctor`, `/doctors`, `/appointments`). |
| Language | **TypeScript** (compiled via `tsc`, path aliases resolved at runtime with `module-alias`) | |
| ORM | **TypeORM 0.2.x** with `typeorm-naming-strategies` (`SnakeNamingStrategy`) | Maps camelCase entity properties to snake_case columns/tables. Decorator-based entities (`@Entity`, `@Column`, `@Exclusion`, …). |
| Authentication | **jsonwebtoken** (JWT, HS256 by default) + **bcrypt** for password hashing | Access + refresh tokens signed with two separate secrets; passwords hashed with `bcrypt` at cost factor 12. |
| Request validation | **Joi** (`@hapi/joi`) via a small `HttpRequestValidator` middleware | Every route validates `body`/`query`/`params` against a Joi schema before reaching the controller. |
| Security middleware | **cors**, **cookie-parser**, **express-rate-limit** | See [Section 14](#14-security) for what is and is not present (no `helmet`, no explicit `trust proxy`). |
| Logging | **winston** | Structured logs to console (colorized) and to `debug.log` file; log level is `debug` outside production, `error` in production. |
| Email/SMTP | **nodemailer** | Sends invitation emails (HTML + plain text) via a configured SMTP transport. |
| CSV parsing | **csv-parse** | Parses the uploaded CSV for bulk invitations. |
| File upload | **multer** (in-memory storage, 5 MB limit, CSV mimetype/extension filter) | Used only for the bulk-invite CSV endpoint. |
| i18n | **i18n** | Configured with English/Spanish locales; used only for the generic fallback error message (`i18n.__("ERR10001")`) in the error middleware — the rest of the app's user-facing strings are plain English constants in `constant.ts`, not i18n keys. |
| Error monitoring | **@sentry/node** | Initialized unconditionally; the error handler middleware is only attached if `SENTRY_DSN` is set. |
| Request tracing | Custom `RequestIDMiddleware` (`uuid`) | Adds an `x-request-id` response header per request. |
| Rate limiting | **express-rate-limit** | Three named limiters: `general`, `auth`, `invitation` (see [Section 4](#4-authentication-and-authorization)). |
| Other notable dependencies present but not central to the reviewed flows | `aws-sdk`, `axios`, `typedi`, `swagger-jsdoc`, `swagger-ui-express`, `express-handlebars`, `express-http-context`, `typeorm-pagination`, `moment-timezone` | These appear in `package.json` but were **not found to be used** in any of the controllers/services/middleware read for this document (e.g. IST time handling uses `Intl.DateTimeFormat`, not `moment-timezone`; no Swagger route is registered in `api/route/index.ts`). They are listed here for completeness but their actual usage could not be confirmed — treat as inherited/unused dependencies unless you find an active call site. |

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

- Indexes: one migration exists, `AddAppointmentQueryIndexes` (`backend/src/database/migration/20260827120000-AddAppointmentQueryIndexes.ts`), adding:
  - `idx_appointments_patient_id_status` on `(patient_id, status)`
  - `idx_appointments_doctor_id_status` on `(doctor_id, status)`
  - `idx_appointments_appointment_time_gist` — a GIST index on `appointment_time`

  **This is the only migration file in the repository.** There is no baseline migration that creates the `users`/`doctors`/`patients`/`specializations`/`doctor_availabilities`/`appointments`/`user_invitations` tables or the enum types (`user_role`, `appointment_status`, `blood_group`) or the exclusion constraints. How the schema was originally provisioned (a dropped/squashed migration, a manual SQL script, or `synchronize: true` at some earlier point) **could not be determined from this repository.** This means `npm run migrate` alone, against a genuinely empty database, will fail — see [Section 17](#17-development-guide).

### Infrastructure / configuration

- **Environment variables** (from `backend/.env.example`; no values reproduced here beyond placeholders): `DATABASE_URL`, `PORT`, `NODE_ENV`, `LOG_LEVEL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `ACCESS_TOKEN_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `FRONTEND_URL`. `backend/src/config/secret.ts` reads these via `dotenv` with **no validation** — if a required variable is missing, the relevant code (JWT signing, SMTP transport, CORS origin) simply receives `undefined` at runtime rather than failing fast at startup.
- **Migrations**: run with `npm run migrate` (`typeorm migration:run`), reading `ormconfig.ts` at the backend root.
- **Dev/build/start commands**: see [Section 17](#17-development-guide).
- **Deployment assumptions**: `docker-compose.yml` in `backend/` defines a `ts-bp` service and a Postgres container (`ts-bp_postgres`) for local development; there is no separate production deployment manifest (no Kubernetes/ECS config, no reverse-proxy config) in this repository. `app.set('trust proxy', ...)` is **not called anywhere**, so if the API is deployed behind a reverse proxy/load balancer, `express-rate-limit` and any code relying on `req.ip` will see the proxy's IP rather than the real client IP unless this is configured at deploy time outside the code shown here.

---

## 3. Architecture

### Backend layering

```
Request
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
  — RateLimitMiddleware: general / auth / invitation limiters (express-rate-limit)
  │
  ▼
Controller (backend/src/api/controller/*.ts)
  — thin: pulls values off req.body/req.query/req.params/req.user, calls one service method,
    shapes the HTTP response, forwards errors to next(error)
  │
  ▼
Service (backend/src/service/*.ts)
  — business rules: past/future validation, status-transition rules, invitation lifecycle rules,
    availability/free-slot computation, response shaping (formatPatientAppointment, etc.)
  — throws http-errors (createError.BadRequest/NotFound/Conflict/Unauthorized) on rule violations
  │
  ▼
Repository (backend/src/database/repository/*.ts)
  — TypeORM QueryBuilder / Repository calls only; no business rules here
  — some repositories are `@EntityRepository` classes fetched via `getManager().getCustomRepository(...)`,
    others are plain classes wrapping `getManager().getRepository(...)`
  │
  ▼
PostgreSQL (via TypeORM connection, entities defined with decorators)
```

Errors thrown anywhere in a service (or a rejected promise anywhere, since `express-async-errors` is imported in `app.ts`) are caught and passed to the global `errorMiddleware` (`backend/src/middleware/error.ts`), which reads `.status`, `.message`, `.code` off the error (the shape used by both `HttpException` and the `http-errors` library) and returns a uniform JSON envelope.

### Frontend architecture

- `main.tsx` mounts `<App />` inside `<StrictMode>`.
- `App.tsx` wraps everything in `RouterProvider` → `AuthProvider`, then does manual path-based branching (no route table/config) to decide which top-level page to show: `/accept-invitation*` → `AcceptInvitationPage`; unauthenticated → `LoginPage`; authenticated ADMIN → `AdminLayout` + `AdminInvitationsPage` (or `DashboardPage` if the admin explicitly navigates to `/dashboard`); authenticated DOCTOR/PATIENT → `DashboardPage`, which itself switches between sub-sections (`PatientDoctorDiscovery`/`PatientAppointmentsList` or `DoctorAppointmentsSection`/`DoctorAvailabilitySection`) via local tab state, not the router.
- **API modules** (`frontend/src/api/*Api.ts`) are the only place `fetch`/`apiFetch` is called. Each function: builds the request, calls `apiFetch`, parses JSON, and normalizes the result into a consistent `{ success, message?, data?, error? }` shape for the UI — regardless of whether the backend responded with its `{status,message,code,data}` envelope (used by most endpoints) or `{success,...}` (used by auth/appointment endpoints). Components never call `fetch` directly.
- **Contexts**: `AuthContext` holds `user`, `isAuthenticated`, `isLoading`, and a single global `notification` (auto-dismissed after 5s), plus `login`/`logout`. `RouterContext` holds `path`/`search`/`navigate`/`getParam`.
- **Persistence**: only the logged-in `user` object is cached in `localStorage` (`docpulse_user`) for the initial render; the actual auth tokens live only in HttpOnly cookies and are never touched by JavaScript.
- No dedicated state-management or data-fetching library (no React Query/SWR/Redux) — each component manages its own `useState`/`useEffect`/`useCallback` fetch lifecycle.

---

## 4. Authentication and Authorization

### Login flow

1. `POST /auth/login` (rate-limited: `auth` limiter, 15 requests / 15 min per IP) → validated with `loginSchema` (`email`, `password` required).
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
ACCESS_TOKEN_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=15m
```
This is the **opposite** of the usual pattern (short-lived access token, long-lived refresh token). As shipped, an access token cookie is valid for 7 days while the refresh token that's meant to renew it expires in 15 minutes — meaning the refresh mechanism (below) will start failing with `REFRESH_TOKEN_EXPIRED` well before the access token itself would need renewing. There is no code that validates or enforces a particular relationship between the two values; whatever is set in the deployed `.env` is used as-is. Document this as the current configuration, not as a recommendation.

### Refresh flow

- `POST /auth/refresh` (rate-limited: `auth` limiter) reads the `refreshToken` cookie only — no request body.
- `AuthService.refresh`: verifies the refresh JWT against `REFRESH_TOKEN_SECRET`, checks `decoded.type === "refresh"`, re-fetches the user (`findUserForRefresh`, filtered on `deleted_at IS NULL`), and — if all checks pass — issues a **new access token only**. The refresh token itself is **not rotated/reissued**, and there is no server-side revocation list, so a given refresh token remains valid (and reusable) until it expires or the user's account is deleted.
- On an expired refresh token: `401` with `REFRESH_TOKEN_EXPIRED`. On any other JWT error: `401` with `INVALID_REFRESH_TOKEN`.
- **Frontend integration** (`frontend/src/api/apiClient.ts`): `apiFetch()` wraps every request. If a response comes back `401` (and the caller hasn't opted out with `skipAuthRefresh`, and this isn't already a retry), it calls `getRefreshedAccessToken()` — which de-dupes concurrent refreshes behind a single shared in-flight promise — then retries the original request exactly once. If the refresh call itself fails, the client calls `POST /auth/logout` (best-effort, ignoring network errors), clears `localStorage`, and dispatches a `docpulse:session-expired` window event, which `AuthContext` listens for to clear `user` and fall back to the login page.

### Logout

- `POST /auth/logout` (rate-limited: `auth` limiter) clears both cookies with the same options they were set with (`httpOnly`, `secure` in prod, `sameSite: "lax"`, `path: "/"`). This is a client-side-cookie-clear only — since JWTs are stateless and not tracked server-side, a token that was already copied out of its cookie (which shouldn't be possible from JS given `httpOnly`) would still validate until it expires.

### Authentication middleware

`AuthMiddleware.authenticate` (`backend/src/middleware/auth.middleware.ts`) — applied to nearly every route except `/auth/login`, `/auth/refresh`, `/auth/accept-invitation`, `/auth/logout`:
- Reads `req.cookies.accessToken`.
- Missing cookie → `401 AUTH_TOKEN_REQUIRED`.
- `jwt.verify` against `process.env.JWT_SECRET` directly (note: this reads `process.env` again rather than the `JWT_SECRET` re-exported from `config/secret.ts`, though both resolve to the same underlying value in practice).
- On success, sets `req.user = { id: decoded.id, role: decoded.role }`.
- Any verification failure (expired, malformed, wrong secret) → `401 AUTH_TOKEN_INVALID`.

### Authorization middleware

`AuthorizationMiddleware.authorize(...allowedRoles)` (`backend/src/middleware/authorization.middleware.ts`) — a factory that returns middleware checking `req.user.role` is in the allowed list:
- No `req.user` (shouldn't happen after `authenticate`, but defensive) → `401 USER_NOT_AUTHENTICATED`.
- Role not in the allow-list → `403 ACCESS_FORBIDDEN`.

Applied per-route, e.g.:
- `POST /admin/invite`, `GET /admin/invitations`, `POST /admin/invitations/:id/revoke`, `POST /admin/invitations/bulk` → `UserRole.ADMIN` only.
- `POST/GET /doctor/availability`, `GET /doctor/appointments`, `PATCH /doctor/appointments/:id/status` → `UserRole.DOCTOR` only.
- `GET /doctors` and `GET /doctors/:doctorId/availability` → `PATIENT`, `DOCTOR`, and `ADMIN` (any authenticated role can browse doctors and their availability).
- `GET /doctors/specializations` → authenticated (any role — no explicit `authorize()` call on this one route, only `authenticate`).
- `GET/POST /appointments`, `PATCH /appointments/:id/status` → `UserRole.PATIENT` only.

**IDOR protection**: appointment and availability lookups are always scoped to the authenticated user's own id in the repository query itself (e.g. `findDoctorAppointmentById(appointmentId, doctorId)` filters `WHERE id = :appointmentId AND doctor_id = :doctorId`; `findPatientAppointmentById` filters by `patient_id`), not just checked after the fact — so a doctor cannot act on another doctor's appointment, and a patient cannot act on another patient's appointment, even if they guess a valid id.

### Rate limiting

Three `express-rate-limit` instances (`backend/src/middleware/rateLimiter.middleware.ts`), all windowed at 15 minutes:
- `general`: 100 requests — applied to most authenticated GET/PATCH/POST routes.
- `auth`: 15 requests — applied to `/auth/login`, `/auth/refresh`, `/auth/accept-invitation`, `/auth/logout`.
- `invitation`: 30 requests — applied to `POST /admin/invite` and `POST /admin/invitations/bulk`.

All are keyed on the default `express-rate-limit` identity, which by default derives from `req.ip`. Because `app.set('trust proxy', ...)` is never called, behind a reverse proxy this will key on the proxy's address rather than the real client unless the deployment environment sets this some other way outside the code in this repo.

---

## 5. Admin API / Flow

All admin routes live under `/admin` (`backend/src/api/route/admin.routes.ts`), require `authenticate` + `authorize(ADMIN)`.

### `POST /admin/invite`

- **Purpose**: invite a single user (any role) by email.
- **Auth**: ADMIN. Rate limit: `invitation` (30/15min).
- **Body** (`inviteUserSchema`): `{ email: string (valid email, required), role: "ADMIN"|"DOCTOR"|"PATIENT" (required) }`.
- **Flow** (`AdminService.inviteUser`):
  1. Trim/lowercase email.
  2. Reject if a non-deleted user with that email already exists → `409 USER_ALREADY_EXISTS`.
  3. Reject if a **pending** invitation already exists for that email (`findPendingInvitation`: not used, not revoked, not expired) → `409 INVITATION_ALREADY_SENT`.
  4. Generate a raw 32-byte random token (`crypto.randomBytes(32).toString("hex")`), SHA-256 hash it, and persist **only the hash** (`hashedToken`, unique column) with `expiresAt = now + 24h`.
  5. Send the invitation email (Nodemailer) containing a link `${FRONTEND_URL}/accept-invitation?token=<raw token>`. **If sending fails, the exception propagates up and the request fails with the email error** — but the invitation row has already been committed in step 4 (these are two separate, non-transactional operations), so a send failure leaves a valid, usable invitation row in the database with no email having reached the recipient. There is no automatic retry and no explicit "resend" endpoint; the admin's only recourse today is to invite the same email again, which step 2/3 above will reject as `USER_ALREADY_EXISTS`/`INVITATION_ALREADY_SENT` until that row is manually revoked or expires.
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
- **Auth**: ADMIN. Rate limit: `invitation` (30/15min — shared budget with single invites). Body: `multipart/form-data`, field `file`.
- **Upload constraints** (`multer`, `upload.middleware.ts`): in-memory storage, **5 MB max file size**, mimetype/extension must be `text/csv` or `.csv`. **There is no limit on the number of rows** in the CSV — a large file (up to 5 MB) can still contain many thousands of rows.
- **Flow**:
  1. `AdminController.bulkInviteUsers` parses the CSV synchronously (`csv-parse/sync`, `columns: true`) into `{ email, role }[]`.
  2. `AdminService.bulkInviteUsers` iterates rows **sequentially, in a single `for` loop, awaiting each one** — each row is validated with `bulkInviteRowSchema`, then (if valid) processed through the exact same `inviteUser()` method as the single-invite endpoint, which means **one SMTP send per row, one at a time, inside the same HTTP request**. There is no batching, queueing, or background job — the request handler does not return until every row has been attempted. For a CSV with many rows this ties up one HTTP connection, one or more DB round-trips per row, and one SMTP send per row for the full duration of the request.
  3. Each row's outcome is collected into a `results[]` array with `status: "INVITED"|"FAILED"` and a `reason` on failure (validation error or whatever error `inviteUser` threw, e.g. `USER_ALREADY_EXISTS`).
- **Response**: `200` `{ success: true, message: "Bulk invitation process completed", data: { total, successful, failed, results } }` — note this always returns `200` even if every row failed; the per-row status must be inspected in `data.results`.

---

## 6. Doctor API / Flow

Split across two route groups: `/doctor` (doctor-only actions) and `/doctors` (discovery, open to PATIENT/DOCTOR/ADMIN).

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

### `GET /doctors` (discovery)

- **Purpose**: search/browse doctors.
- **Auth**: PATIENT, DOCTOR, or ADMIN. Rate limit: `general`.
- **Query** (`getDoctorsQuerySchema`): `search` (name substring), `specialization` (numeric id **or** name substring), `date` (only return doctors with at least one availability window overlapping that date), `page`, `limit` (default 1/10, max 100).
- **Flow** (`DoctorRepository.findAllDoctors`): joins `doctors` → `user` (inner, `deleted_at IS NULL`) → `specialization` (left); applies the optional filters; the `date` filter uses a correlated subquery against `doctor_availabilities`.
- **Response shape** (`DoctorService.getDoctors`): `{ doctors: [{ id, firstName, lastName, email, specialization, experienceYears }], pagination }`. **Note**: this list response includes each doctor's `email`. The frontend type (`DoctorListItem`) carries this field through, but `PatientDoctorDiscovery.tsx` never renders it in the UI — it is fetched and typed but not displayed.

### `GET /doctors/:doctorId/availability`

- **Purpose**: the view a patient uses to decide what to book — a doctor's **bookable** free time.
- **Auth**: PATIENT, DOCTOR, or ADMIN. Rate limit: `general`. Query: optional `date`.
- **Flow** (`DoctorService.getDoctorAvailability`) — see [Section 9](#9-availability-system) for the full algorithm. In short: start from the doctor's raw availability windows, subtract any time already covered by that doctor's `PENDING`/`CONFIRMED` appointments, then drop/clamp segments relative to "now".
- **Response**: `{ doctor: { id, firstName, lastName, specialization, experienceYears }, availability: AvailabilitySlot[] }` — note this doctor summary does **not** include email (unlike the list endpoint above).

### `GET /doctors/specializations`

- **Purpose**: populate the specialization filter/dropdown.
- **Auth**: any authenticated user (no `authorize()` call — just `authenticate`). Rate limit: `general`.
- **Flow**: `DoctorRepository.getSpecializations()` — all rows from `specializations`, ordered by name. (There is no `isActive` filter applied here even though the `Specialization` entity has an `isActive` column — every row in the table is returned regardless of that flag.)
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
- **Response**: `201` `{ success: true, data: { id, patientId, doctorId, status: "PENDING", date, startTime, endTime, createdAt } }`.
  - **Frontend/backend type note**: the frontend's `createAppointmentApi` types this response as `PatientAppointment` (which expects a nested `doctor: {...}` object and `updatedAt`), but the actual backend response shape here is flatter (`patientId`, `doctorId` as raw ids, no nested `doctor` object, no `updatedAt`). This is a real mismatch between the declared frontend type and the actual API response for this one endpoint — every other appointment-returning endpoint (`GET /appointments`, `PATCH .../status`) does return the full nested `PatientAppointment`/`DoctorAppointment` shape via `formatPatientAppointment`/`formatDoctorAppointment`; only the creation response is shaped differently, straight off the raw repository insert.

### `PATCH /appointments/:appointmentId/status` — cancellation

- **Purpose**: patient cancels their own appointment.
- **Auth**: PATIENT. Rate limit: `general`.
- **Body** (`patientAppointmentStatusBodySchema`): `{ status: "CANCELLED" }` — this is the **only** value the schema accepts; a patient cannot set any other status through this endpoint.
- **Flow** (`AppointmentService.cancelAppointment`):
  1. Load the appointment scoped to `id + patientId` → `404` if not found/not owned.
  2. Confirm requested status is `CANCELLED` (defensive — schema already enforces this) → else `400 PATIENT_CAN_ONLY_CANCEL`.
  3. Confirm current status is `PENDING` or `CONFIRMED` → else `400 INVALID_STATUS_TRANSITION` (blocks cancelling an already `COMPLETED`/`REJECTED`/`CANCELLED` appointment).
  4. **Confirm the scheduled time has not already passed** (`isISTDateTimeInPast(scheduled.date, scheduled.startTime)`) → `409 CANNOT_CANCEL_PAST_APPOINTMENT` if it has. This is enforced on the backend, not only hidden in the UI.
  5. Update status to `CANCELLED`.
- **Response**: `200` with the updated, fully-formatted `PatientAppointment`.
- **Frontend enforcement**: `PatientAppointmentsList.tsx` computes `isCancellable = (status is PENDING or CONFIRMED) && !isISTDateTimeInPast(apt.date, apt.startTime)` and only renders the "Cancel Appointment" button when true — so the UI and the backend apply the same past/future rule independently (the frontend's `frontend/src/utils/istDateTime.ts` mirrors the backend's `backend/src/util/dateTimeRange.ts` logic).

### Booking flow, end to end (search → book)

1. `PatientDoctorDiscovery` loads `GET /doctors/specializations` (for the filter dropdown) and `GET /doctors` (the list, with search/specialization/date filters and pagination).
2. Clicking "Book Appointment" on a doctor card calls `GET /doctors/:doctorId/availability` to fetch that doctor's free slots, and opens `AppointmentBookingModal` with the result.
3. The modal groups the doctor's free slots by date (client-side, filtering out any date earlier than "today" in IST as a UI-level safeguard) and offers 30-minute sub-slots computed by walking each availability window in 30-minute steps; a "custom time range" `<details>` panel lets the patient override the exact start/end within the chosen window instead.
4. On submit, the modal re-validates date/time-not-in-the-past client-side (mirroring the backend rules) before calling `POST /appointments`.
5. On success, `onSuccess` bubbles the created appointment up to `PatientDoctorDiscovery` → `DashboardPage`, which switches the active tab to "My Appointments".

**Known gap**: `AppointmentBookingModal`'s `selectedDate`/`startTime`/`endTime`/`errorMsg`/`successMsg` state is initialized once via `useState` and is **not reset** when the `doctorDetails` prop changes (there is no `useEffect` keyed on `doctorDetails.doctor.id` or similar) or when the modal is reopened for a different doctor. If a patient opens the modal for Doctor A, picks a date/time, closes without submitting, then opens it again for Doctor B, the previously selected date/time (and any leftover error/success message) can still be present, even though `groupedAvailabilities`/`availableDates` are recomputed for Doctor B via `useMemo`. This does not allow booking an invalid slot (the backend independently validates doctor/date/time on submit) but it is a real UI state leak.

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

### Concurrent status updates

Both `updateAppointmentStatusByDoctor` and `updateAppointmentStatusByPatient` (`AppointmentRepository`) issue a plain `UPDATE appointments SET status = :status WHERE id = :id AND doctor_id/patient_id = :ownerId` — **the `WHERE` clause does not also require the row's current status to match what the service just read**. The service performs a `SELECT` (to read the current status and run the transition/timing checks above) and then a separate `UPDATE`, with no transaction or row lock tying the two together, and no optimistic-concurrency column (e.g. no version check) in the `UPDATE`'s `WHERE`.

Practical effect: if two requests race to change the same appointment's status (e.g. a doctor confirms while, in the same instant, a patient's earlier cancel request is still in flight against the previous status), both `UPDATE`s can succeed sequentially against the database — the second `UPDATE` will silently overwrite the first, and the caller of the "losing" request gets a normal success response with `result.affected` truthy (the row was found and updated), **not** a `409 Conflict`. The double-booking-specific race (two different appointments landing on the same doctor/time) *is* prevented — that's the job of the `EXCLUDE` constraint on `appointment_time`. But a race between two different *status transitions on the same existing appointment* is not currently guarded against at the database level.

---

## 9. Availability System

All of the logic below lives in `backend/src/service/doctor.service.ts` and `backend/src/util/dateTimeRange.ts`.

### Creating availability

A doctor submits `{ date, startTime, endTime }` (wall-clock, IST implied). The service builds a Postgres range literal `[YYYY-MM-DDTHH:mm:00+05:30, YYYY-MM-DDTHH:mm:00+05:30)` — a half-open interval, inclusive of the start minute, exclusive of the end minute — and inserts it into `doctor_availabilities.availability_time` (a `tstzrange` column). The `+05:30` offset is a literal string suffix, not computed via a timezone-conversion library.

The `doctor_availability_no_overlap` GIST exclusion constraint on `(doctor_id, availability_time)` means a doctor cannot create two windows that overlap at all, regardless of appointments — this is a hard DB-level rule independent of booking state.

### How busy time is computed

`DoctorService.getDoctorAvailability(doctorId, date?)`:
1. Fetch the doctor's raw availability rows for the (optionally filtered) date.
2. Fetch that doctor's **active** appointments for the same date window (`findActiveAppointmentsForDoctor` — filtered to `status IN (PENDING, CONFIRMED)`). Appointments in `CANCELLED`, `REJECTED`, or `COMPLETED` are **not** fetched here, so they never occupy a slot — cancelling or rejecting an appointment immediately frees that time for rebooking (there is no separate "release the slot" step; it falls out naturally from the query only ever looking at `PENDING`/`CONFIRMED` rows).
3. Parse each busy appointment's `tstzrange` into `{ start, end }` Date bounds (`parseRangeBounds`).

### Free-slot computation (per availability window)

For each availability window:
1. `subtractBusyRanges(window, overlappingBusyRanges)` — a straightforward interval-subtraction: start from `[window]`, and for every busy range that overlaps it, split the current free segment(s) around the busy range (keep the part before it, keep the part after it, drop anything fully covered). This correctly handles zero, one, or multiple busy ranges within a single window, including a busy range in the middle producing two free segments.
2. Each resulting free segment is passed through `clampSegmentToNow(segment, now)`:
   - If the segment's end is at or before `now` → **drop it entirely** (fully elapsed).
   - If the segment's start is before `now` but its end is after `now` → **clamp the start to exactly `now`** (partially elapsed — return only the remaining future portion).
   - Otherwise (fully in the future) → return unchanged.

   **Note on the clamp precision**: `now` here is `new Date()` — the exact current instant, including seconds/milliseconds. A 09:00–17:00 window queried at 14:07:23 will be clamped to start at exactly `14:07:23`, which — once formatted down to `HH:mm` for the API response via `formatTimeIST` — is displayed to the patient as starting at `14:07`. The remaining free segment is **not** rounded forward to the next whole minute (e.g. to `14:08`); it truncates to the current minute, which can display (and, if a patient tried to book exactly that `HH:mm`, potentially attempt to book) a start time that is technically already a few seconds in the past relative to when the response was generated.
3. Each surviving segment is formatted to `{ id: availabilityId, date, startTime, endTime }` via `formatDateIST`/`formatTimeIST` — note the `id` on every returned free segment is the **availability row's** id, not a per-segment id; if one window produces two free segments (busy time in the middle), both segments carry the same `id`.

### What this means for booking

- The patient only ever sees free (not-yet-booked, not-yet-elapsed) time through `GET /doctors/:doctorId/availability`.
- Booking itself (`POST /appointments`) does **not** re-run this free-slot computation — it independently checks that the requested range is fully contained in a raw availability window (`@>` containment, ignoring busy ranges) and then relies on the database's exclusion constraint to reject a conflict. So the free-slot view and the booking-time validation are two separate code paths that happen to agree in the common case, but the actual non-double-booking guarantee comes from the database constraint, not from the free-slot computation.
- The doctor's own availability view (`GET /doctor/availability`, `getOwnAvailability`) does **not** apply any of this busy-subtraction or now-clamping — it shows raw windows only.

---

## 10. Invitation System

### Lifecycle

```
Admin submits { email, role }
   │
   ▼
AdminService.inviteUser
   ├── reject if a live user already has this email
   ├── reject if a still-pending invitation already exists for this email
   ├── generate 32-byte random token; SHA-256 hash it
   ├── persist { email, role, hashedToken, expiresAt: now+24h, createdBy, updatedBy }
   └── send email with link {FRONTEND_URL}/accept-invitation?token=<raw token>
   │
   ▼
Doctor/Patient/Admin-invitee opens the link
   │
   ▼
POST /auth/accept-invitation { token, firstName, lastName, password }
   │
   ▼
AuthService.acceptInvitation
   ├── SHA-256 hash the submitted token, look up by hashedToken
   ├── reject if not found / already used / revoked / expired
   ├── bcrypt-hash the password (cost 12)
   ├── create the `users` row (email + role come from the invitation, not the request body)
   ├── if role == PATIENT: create a `patients` row
   ├── if role == DOCTOR: create a `doctors` row with specializationId = 0, experienceYears = 0 (hardcoded)
   └── mark the invitation used (usedAt = now, updatedBy = new user's id)
```

### Token security

- The link contains a **raw, high-entropy token** (`crypto.randomBytes(32)` → 64 hex characters). Only its **SHA-256 hash** is ever persisted (`hashedToken`, `unique`) — the raw token cannot be recovered from the database, matching the standard "store a hash, not the secret" pattern already used correctly here.
- Expiration is fixed at **24 hours** from creation, computed server-side, not configurable per invitation.

### Duplicate / concurrent-acceptance handling — current behavior

- **Duplicate invitations**: `inviteUser` checks for an existing pending invitation for the same email before creating a new one, and rejects with `409 INVITATION_ALREADY_SENT` if one exists. This check-then-insert is **not wrapped in a transaction or backed by a unique constraint on `(email)` for non-terminal invitations** — the only DB-level uniqueness is on `hashedToken` (which is always unique anyway, being a random value). Two admin requests issued at almost the same instant for the same email could both pass the "no pending invitation" check before either has committed its insert, resulting in two live invitations for the same email. Revoking one does not affect the other, since revocation targets a specific `id`, not "every invitation for this email."
- **Concurrent acceptance of the same invitation**: `acceptInvitation` does a `SELECT` (by `hashedToken`) to check `usedAt`/`revokedAt`/`expiresAt`, and only marks the invitation used **after** creating the user and profile rows. There is no transaction spanning the read-check, user-creation, and mark-used steps, and no unique constraint that would stop two near-simultaneous accept requests for the same still-valid token from both passing the "not yet used" check. In that scenario, both requests could each create a `users` row — but since `users.email` is a **unique** column, the second `INSERT` would fail with a Postgres unique-violation once it reaches `AuthRepository.createUser`, which propagates as an unhandled database error at the service layer (not one of the deliberately thrown `http-errors`, so it will surface as whatever the generic error middleware does with an unexpected TypeORM/pg error — likely a 500). So the unique email constraint is what actually prevents two accounts, not any explicit application-level locking around invitation consumption.

### Transaction handling

**No explicit database transaction (`queryRunner`/`manager.transaction`) is used anywhere in `AuthService.acceptInvitation`.** User creation, patient/doctor profile creation, and marking the invitation as used are four separate, independently-committed operations (`createUser`, then `createPatientProfile` or `createDoctorProfile`, then `markAsUsed`). If a later step fails (e.g. the doctor-profile insert fails for any reason after the user row has already committed), the `users` row remains committed and the invitation remains unused — leaving a user account that exists without a corresponding `doctors`/`patients` profile row, and an invitation that still shows as pending/usable. This is a real gap in the current implementation, not something wrapped in a rollback-safe transaction.

### Hardcoded doctor profile fields

`AuthService.acceptInvitation` calls `this.authRepository.createDoctorProfile(user.id, 0, 0)` for any invitee with role `DOCTOR` — `specializationId` and `experienceYears` are both hardcoded to `0`. The doctor never selects a specialization during signup in the current flow; the `Doctor.specializationId` column has no `nullable: true` and no explicit foreign-key `ON DELETE`/`ON UPDATE` behavior declared on the entity, so whether `specializationId = 0` succeeds depends on whether a `specializations` row with `id = 0` exists in the target database — this could not be confirmed from the codebase (no seed data was found in this repository). If no such row exists, this insert would fail with a foreign-key violation, which — per the same non-transactional flow above — would leave a `users` row already committed with no matching `doctors` row.

Separately, `DoctorRepository.ensureDoctorProfile(doctorId)` (`backend/src/database/repository/doctor.repository.ts`) exists as a raw-SQL `INSERT ... ON CONFLICT DO NOTHING` that inserts `specialization_id = 1, experience_years = 1` — but **this method is not called from anywhere** in the controllers/services read for this document; it appears to be dead/unused code.

### Email failure handling

If `EmailService.sendInvitationEmail` throws (SMTP error, bad credentials, etc.), `AdminService.inviteUser` re-throws it after logging — the invitation row from step 4 has already been committed, so the failure surfaces to the admin as a generic error response while a usable (but never-emailed) invitation row persists. There is no automatic cleanup/rollback of the invitation row on email failure, and no dedicated "resend" endpoint.

---

## 11. Database Design

All entities live in `backend/src/database/model/*.ts`, table names/columns via `SnakeNamingStrategy`.

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
- `specialization_id` (smallint, FK → `specializations.id`)
- `experience_years` (smallint)
- Relations: → `User` (1:1), → `Specialization` (many:1), → `Appointment[]` (1:many), → `DoctorAvailability[]` (1:many)

### `patients`
- PK/FK: `patient_id` (smallint) — same shared-PK pattern with `users.id`.
- `height_cm`, `weight_kg` (smallint, nullable)
- `blood_group` (enum `blood_group`, nullable)
- `dob` (date, nullable)
- Relations: → `User` (1:1), → `Appointment[]` (1:many)

### `specializations`
- PK: `id` (smallint, auto-increment)
- `name` (varchar 100), `description` (varchar 500, nullable), `is_active` (boolean, default true)
- `created_at`, `updated_at`
- Relations: → `Doctor[]` (1:many)
- **Note**: `is_active` exists on the entity but is not filtered on by `getSpecializations()` — see [Section 6](#6-doctor-api--flow).

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
- **Indexes** (from the one migration in the repo): `(patient_id, status)`, `(doctor_id, status)`, GIST on `appointment_time`.

### `user_invitations`
- PK: `id` (smallint, auto-increment)
- `email` (varchar 255) — **not unique** at the column level (uniqueness of "no duplicate pending invite" is enforced only in application code, see [Section 10](#10-invitation-system))
- `role` (enum `user_role`)
- `hashed_token` (varchar 255, **unique**)
- `expires_at` (timestamptz)
- `used_at`, `revoked_at` (timestamptz, nullable)
- `created_by`, `updated_by` (smallint, FK → `users.id`)
- `created_at`, `updated_at`
- Status (`PENDING`/`USED`/`EXPIRED`/`REVOKED`) is **derived at read time**, not a stored column.

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
| POST | `/auth/accept-invitation` | none (has token) | Complete signup from an invitation | none (rate-limited) | `{ success, message, data: user }` |
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

### Doctor discovery (shared: Patient/Doctor/Admin)

| Method | Endpoint | Role | Purpose | Auth | Main Response |
|---|---|---|---|---|---|
| GET | `/doctors/specializations` | any authenticated | List specializations | cookie | `{ success, data: [] }` |
| GET | `/doctors/:doctorId/availability` | PATIENT, DOCTOR, ADMIN | A doctor's free/bookable slots | cookie + role | `{ success, data: { doctor, availability } }` |
| GET | `/doctors` | PATIENT, DOCTOR, ADMIN | Search/browse doctors | cookie + role | `{ success, data: { doctors, pagination } }` |

### Patient

| Method | Endpoint | Role | Purpose | Auth | Main Response |
|---|---|---|---|---|---|
| GET | `/appointments` | PATIENT | List own appointments (filter/sort/paginate) | cookie + PATIENT | `{ success, data: { appointments, pagination } }` |
| POST | `/appointments` | PATIENT | Book an appointment | cookie + PATIENT | `{ success, data: appointment }` (flatter shape — see [Section 7](#7-patient-api--flow)) |
| PATCH | `/appointments/:appointmentId/status` | PATIENT | Cancel own appointment (`CANCELLED` only) | cookie + PATIENT | `{ success, data: appointment }` |

### Misc

| Method | Endpoint | Role | Purpose | Auth | Main Response |
|---|---|---|---|---|---|
| GET | `/` | none | Liveness check | none | `{ success: true, data: { status: "ok" } }` |

---

## 13. Error Handling

- **How errors are raised**: services throw either the project's own `HttpException` (`backend/src/util/http-exception.ts` — `status`, `message`, `code`) or, more commonly, instances from the **`http-errors`** package (`createError.BadRequest(...)`, `.NotFound(...)`, `.Conflict(...)`, `.Unauthorized(...)`), which also expose `.status`/`.statusCode` and `.message`.
- **Propagation**: every controller method is `async` and wrapped in a `try { ... } catch (error) { next(error); }`. Because `express-async-errors` is imported once in `app.ts`, any rejected promise anywhere in the middleware chain is also automatically forwarded to Express's error pipeline even without an explicit `try/catch` (defense in depth, though the controllers in this codebase do use explicit `try/catch` throughout).
- **Global handler** (`backend/src/middleware/error.ts`): reads `error.status` (default `500`), `error.message` (default the i18n fallback `ERR10001`), `error.code` (default `"ERR10001"`), and responds via `ResponseParser` as `{ status: false, message, code, data: {} }`. **Note the field name is `status` (boolean) here, not `success`** — this differs from the `{ success, ... }` shape most controllers use directly, which is one of the two response envelope styles the frontend has to normalize (see [Section 12](#12-api-reference)).
- **Validation errors**: `HttpRequestValidator` middleware runs Joi's `.validate()` against `body`/`query`/`params`; on failure it responds directly (not via `next(error)`) with `400`, `code: "validation_error"`, `message: "Validation Error"`, and `data` containing an array of `{ message, label }` per failing field.
- **Specific status codes used across the app**:
  - `400` — bad input / invalid state transition / conflicting filters (e.g. both `date` and `dateFrom`/`dateTo` supplied).
  - `401` — missing/invalid/expired JWT, invalid credentials, invalid/expired refresh token.
  - `403` — authenticated but wrong role.
  - `404` — resource not found or not owned by the caller (appointment/availability/doctor/patient/invitation lookups scoped by owner id return "not found" rather than "forbidden" when the id exists but belongs to someone else).
  - `409` — genuine conflicts: `AVAILABILITY_OVERLAP`, `APPOINTMENT_TIME_UNAVAILABLE`, `DOCTOR_NOT_AVAILABLE`, `APPOINTMENT_TIME_ALREADY_PASSED`, `APPOINTMENT_NOT_YET_STARTED`, `CANNOT_CANCEL_PAST_APPOINTMENT`, `USER_ALREADY_EXISTS`, `INVITATION_ALREADY_SENT`, `INVITATION_ALREADY_REVOKED`.
  - `429` — rate limit exceeded (message text set per-limiter in `constant.ts`).
  - `500` — anything unhandled (e.g. an unexpected database error, such as the unique-email-violation race described in [Section 10](#10-invitation-system)).
- **Database constraint errors**: Postgres exclusion-constraint violations surface to Node as an error with `code === "23P01"`; this is caught explicitly in `DoctorService.createAvailability` and `AppointmentService.createAppointment` and translated into a `409` with a specific message. Any *other* database error (unique-constraint violation, FK violation, etc.) is **not** specifically caught anywhere in the services reviewed — it propagates up as a generic error and is handled by the fallback path of the global error middleware (effectively a `500`, unless the driver error happens to carry a `.status`, which it does not).

---

## 14. Security

### What is implemented

- **JWT authentication**, two separate secrets for access vs. refresh tokens, both delivered exclusively via **HttpOnly** cookies (`sameSite: "lax"`, `secure` in production) — the tokens are never exposed to page JavaScript or present in any JSON response body.
- **Password hashing**: `bcrypt`, cost factor `12`.
- **Invitation token hashing**: raw token only ever exists transiently (generated, emailed, and — briefly — in the accept-invitation request body); the database stores only its SHA-256 hash.
- **Role-based authorization** on every non-public route via `AuthorizationMiddleware.authorize(...)`.
- **IDOR protection**: every "get/act on my own X" repository method filters by the owner id (`doctorId`/`patientId`) in the same query as the lookup, not as a separate post-fetch check — see [Section 4](#4-authentication-and-authorization).
- **Parameterized queries** throughout: all TypeORM `QueryBuilder` usage seen in this codebase uses named parameters (`:paramName`) rather than string concatenation — no raw string interpolation of user input into SQL was found in the reviewed repositories, **with one exception**: `DoctorRepository.ensureDoctorProfile` uses `manager.query(...)` with `$1` positional parameters (still parameterized, not concatenated) — but as noted in [Section 10](#10-invitation-system), this method is not called from anywhere.
- **Rate limiting**: three tiers (`general`/`auth`/`invitation`) via `express-rate-limit` — see [Section 4](#4-authentication-and-authorization).
- **Soft deletion** on `users` (`deleted_at`), consistently checked (`deleted_at IS NULL`) in every login/lookup query that reads a user.
- **Database-level constraints** as the actual source of truth for "no double booking" and "no overlapping availability" (GIST exclusion constraints), rather than relying solely on an application-level check-then-insert.
- **CORS**: locked to a single configured origin (`FRONTEND_URL`) with `credentials: true`.

### What was not found in the codebase (visible limitations)

- **No `helmet()`** (or equivalent) is registered anywhere in `Kernel`/`app.ts` — no baseline security headers (CSP, `X-Content-Type-Options`, `X-Frame-Options`, HSTS, etc.) are being set by the application itself.
- **No `app.set('trust proxy', ...)`** anywhere — if deployed behind a reverse proxy/load balancer, `express-rate-limit` (and anything else relying on `req.ip`) will not correctly identify the originating client IP unless configured outside this codebase.
- **No environment-variable validation at startup**: `backend/src/config/secret.ts` destructures `process.env` directly with no schema/assertion step. A missing `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `DATABASE_URL`, `SMTP_*`, or `FRONTEND_URL` does not stop the server from starting — it fails later, at first use (e.g. `jwt.sign(..., undefined, ...)`), with a less specific error.
- **Access/refresh token lifetimes are inverted** relative to convention in the shipped `.env.example` (`ACCESS_TOKEN_EXPIRES_IN=7d`, `REFRESH_TOKEN_EXPIRES_IN=15m`) — see [Section 4](#4-authentication-and-authorization).
- **No refresh-token rotation or revocation list** — a refresh token remains valid for its full lifetime once issued; there is no server-side way to invalidate a single outstanding refresh token before it expires (logout only clears the cookie client-side).
- **Non-atomic status updates** on appointments (no expected-status condition in the `UPDATE ... WHERE`) — see [Section 8](#8-appointment-lifecycle).
- **Non-transactional invitation acceptance** — see [Section 10](#10-invitation-system).
- **No CSV row-count limit** on bulk invitations, only a file-size limit — see [Section 5](#5-admin-api--flow).
- **Doctor email is exposed** by the `GET /doctors` list endpoint (though not rendered in the current UI) — see [Section 6](#6-doctor-api--flow).

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
- Invitation tokens are single-use in intent (`usedAt` set on acceptance) and expire 24 hours after creation; a revoked or expired or already-used invitation cannot be accepted (`auth.service.ts::acceptInvitation`).
- A user (by email) cannot be invited if a live (non-deleted) account with that email already exists, or if a still-pending invitation for that email already exists (`admin.service.ts::inviteUser`).
- A patient can only ever set an appointment's status to `CANCELLED` through the patient-facing endpoint; a doctor can only ever set `CONFIRMED`/`REJECTED`/`COMPLETED` through the doctor-facing endpoint — enforced both by Joi schema (`patientAppointmentStatusBodySchema`/`doctorAppointmentStatusBodySchema`) and, for the transition itself, by the allow-list in `AppointmentService.updateAppointmentStatus`.
- Every appointment/availability lookup that a doctor or patient performs on "their own" data is scoped by their own id in the query itself, not checked after the fact.

---

## 16. End-to-End User Flows

### 1. Admin invites a doctor
`AdminInvitationsPage` → "Invite User" modal (email + role = DOCTOR) → `inviteUserApi` → `POST /admin/invite` → `AdminService.inviteUser` → invitation row committed → `EmailService.sendInvitationEmail` → admin sees a success toast and the new row appears in the (refetched) invitations table.

### 2. Doctor accepts invitation and completes signup
Doctor opens the emailed link `{FRONTEND_URL}/accept-invitation?token=...` → `AcceptInvitationPage` reads `token` from the URL via `RouterContext.getParam` → doctor fills first/last name + password (confirm-password is a client-only check, not sent to the server) → `acceptInvitationApi` → `POST /auth/accept-invitation` → `AuthService.acceptInvitation` validates the token, creates the `users` row, creates a `doctors` row with `specializationId=0, experienceYears=0` (see [Section 10](#10-invitation-system) for the caveats here), marks the invitation used → frontend shows a success notification and redirects to `/login` after 1.2s. **The doctor never selects a specialization or enters experience during this flow** — those fields are fixed at `0` and there is no subsequent screen in this codebase where a doctor edits them.

### 3. Doctor creates availability
Doctor logs in → `DashboardPage` (role DOCTOR) → "My Availability" tab → `DoctorAvailabilitySection` form (date/start/end, `min={today}` on the date input) → `createDoctorAvailabilityApi` → `POST /doctor/availability` → validated, checked against past-date/time, inserted (409 on overlap) → list refetched via `GET /doctor/availability`.

### 4. Patient searches for a doctor
Patient logs in → `DashboardPage` (role PATIENT) → "Find & Book Doctors" tab (default) → `PatientDoctorDiscovery` loads specializations + doctor list on mount, refetches on any filter change (`search`/`specialization`/`date`) → `GET /doctors`.

### 5. Patient views availability
Patient clicks "Book Appointment" on a doctor card → `GET /doctors/:doctorId/availability` → busy-subtracted, now-clamped free slots returned, grouped by date in the modal.

### 6. Patient books an appointment
Patient picks a date, then a suggested 30-min slot (or a custom range) → client-side re-validation → `POST /appointments` → backend re-validates independently (past-check, doctor/patient existence, availability containment) → inserted as `PENDING` (409 on a race/overlap via the exclusion constraint) → modal shows success, `onSuccess` switches the dashboard to "My Appointments".

### 7. Doctor confirms/rejects the appointment
Doctor → "Patient Appointments" tab → `DoctorAppointmentsSection` lists appointments (filter/sort/paginate) → for a `PENDING` row, "Confirm" or "Decline" opens a confirmation dialog → `PATCH /doctor/appointments/:id/status` with `CONFIRMED` or `REJECTED` → backend checks the transition is allowed and (for `CONFIRMED`) that the time hasn't passed → list refetched. The "Confirm" button is disabled client-side if the appointment's time has already passed (`isISTDateTimeInPast`), mirroring the backend's `409 APPOINTMENT_TIME_ALREADY_PASSED` rule.

### 8. Doctor completes the appointment
For a `CONFIRMED` row whose start time has arrived, "Complete Visit" → `PATCH .../status` with `COMPLETED` → backend checks the appointment has started → updated. The button is disabled client-side until `isISTDateTimeInPast(apt.date, apt.startTime)` is true.

### 9. Patient cancels an appointment
"My Appointments" → for a cancellable row (status `PENDING`/`CONFIRMED` and not yet started), "Cancel Appointment" → confirmation dialog → `PATCH /appointments/:id/status` with `CANCELLED` → backend re-checks ownership, current status, and that the time hasn't passed → list refetched. Once cancelled, the appointment's time range no longer counts as "active," so it stops blocking that doctor's/patient's availability for other bookings.

### 10. User refreshes an expired access token
Any authenticated request returns `401` → `apiFetch` (unless `skipAuthRefresh`) calls `getRefreshedAccessToken()` (deduped across concurrent callers) → `POST /auth/refresh` reads the `refreshToken` cookie, verifies it, issues a new `accessToken` cookie → the original request is retried once. If the refresh call itself fails (e.g. refresh token also expired), the client calls `/auth/logout`, clears local storage, and dispatches `docpulse:session-expired`, which `AuthContext` picks up to clear `user` and fall back to the login screen.

### 11. User logs out
"Sign Out" (Navbar / AdminLayout / DashboardPage) → `logout()` in `AuthContext` → `POST /auth/logout` (clears both cookies server-side) → `clearAuthStorage()` removes cached `localStorage` keys → `user` set to `null` → app re-renders to the login page.

---

## 17. Development Guide

### Prerequisites
- Node.js ≥ 18.15.0
- PostgreSQL (local or a hosted instance such as Neon, per the README)

### Environment variables (backend)
Copy `backend/.env.example` to `backend/.env` and fill in real values for: `DATABASE_URL`, `PORT`, `NODE_ENV`, `LOG_LEVEL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `ACCESS_TOKEN_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `FRONTEND_URL`. None of these are validated at startup (see [Section 14](#14-security)) — double-check each is actually set before relying on auth/email to work.

### Database setup
1. Provision a PostgreSQL database and point `DATABASE_URL` at it.
2. Run migrations: `cd backend && npm run migrate` (equivalently `npm run migrate:run`, both invoke `typeorm migration:run` against `ormconfig.ts`).

   **Important**: as established in [Section 2](#2-technology-stack), the only migration present in this repository adds indexes to an `appointments` table that must already exist — it does **not** create any table, enum type, or exclusion constraint. Running migrations alone against a genuinely empty database will fail (or, if it "succeeds" by silently no-op'ing on a missing table depending on how the migration is written, will leave the database without any usable schema). **How the base schema is meant to be provisioned in a fresh environment could not be determined from this repository** — before relying on "migrations alone," locate (or write) a baseline migration that creates `users`, `doctors`, `patients`, `specializations`, `doctor_availabilities`, `appointments`, `user_invitations`, their enum types, and their exclusion constraints, or otherwise confirm how the current running database's schema was actually created.

### Running the backend
```
cd backend
npm install
npm run watch     # concurrently runs `tsc -w` and nodemon against dist/server.js
```
Production-style run: `npm run start` (`build-ts` then `serve`, i.e. `node dist/server.js`). Backend listens on `PORT` (falls back to `3001` if unset — note the frontend's hardcoded `API_BASE_URL` in `apiClient.ts` is `http://localhost:3000`, so for local dev the two must be kept in sync manually).

### Running the frontend
```
cd frontend
npm install
npm run dev        # Vite dev server, default http://localhost:5173
```

### Build commands
- Backend: `npm run build` (`eslint` then `tsc`).
- Frontend: `npm run build` (`tsc -b && vite build`).

### Test commands
- Backend: `npm run test` (`jest --detectOpenHandles --forceExit --verbose --runInBand --coverage`) — a Jest config (`jest.config.js`) and the `test`/`ts-jest` dependencies are present, but **no `*.test.ts`/`*.spec.ts` files were found** under `backend/src` in this repository as of this document — there is currently no automated test suite to run.
- Frontend: **no test runner is configured** (`frontend/package.json` has no test script, and no Jest/Vitest/RTL dependency is present).

### Development considerations
- Path aliases (`@api`, `@config`, `@core`, `@database`, `@middleware`, `@service`, `@util`, …) are resolved via `module-alias`, registered once in `app.ts` (`import "module-alias/register"`) against the compiled `dist/` paths declared in `package.json`'s `_moduleAliases` — this only works after a build; running `ts-node` directly against `src/` without the equivalent `tsconfig-paths` setup would not resolve these.
- `docker-compose.yml` in `backend/` spins up the app plus a Postgres container for local development, but references `dev/docker/Dockerfile`, a path not confirmed to exist in this repository snapshot — the top-level `Dockerfile` is at `backend/Dockerfile`, not `backend/dev/docker/Dockerfile`. This mismatch could not be resolved from the files reviewed; verify before relying on `docker-compose up`.

---

## Appendix: Summary of Notable Gaps Found in the Current Implementation

For quick reference — each of these is described in full, with file references, in the section noted:

| Gap | Section |
|---|---|
| No baseline schema migration in the repo (only an index-adding migration exists) | [2](#2-technology-stack), [17](#17-development-guide) |
| Doctor signup hardcodes `specializationId = 0, experienceYears = 0`; no specialization selection step exists | [10](#10-invitation-system), [16](#16-end-to-end-user-flows) |
| Invitation acceptance (`AuthService.acceptInvitation`) is not wrapped in a database transaction | [10](#10-invitation-system) |
| Appointment status updates are not concurrency-safe (`UPDATE` has no expected-status condition, no `409` on a lost race) | [8](#8-appointment-lifecycle) |
| Availability "now" clamping truncates to the current second rather than rounding up to the next whole minute | [9](#9-availability-system) |
| `ACCESS_TOKEN_EXPIRES_IN`/`REFRESH_TOKEN_EXPIRES_IN` are inverted in `.env.example` (7d access / 15m refresh) | [4](#4-authentication-and-authorization) |
| No environment-variable validation at startup | [14](#14-security) |
| No `helmet()`, no explicit `trust proxy` configuration | [14](#14-security) |
| No unique constraint / atomic guard preventing duplicate pending invitations for the same email under concurrency | [10](#10-invitation-system) |
| No CSV row-count limit for bulk invitations (only a 5 MB file-size limit); rows processed serially in-request | [5](#5-admin-api--flow) |
| An invitation email failure leaves a valid, unemailed invitation row with no built-in resend path | [5](#5-admin-api--flow), [10](#10-invitation-system) |
| `POST /appointments`'s response shape doesn't match the frontend's declared `PatientAppointment` type | [7](#7-patient-api--flow) |
| `GET /doctors` returns each doctor's email, which the current UI never displays | [6](#6-doctor-api--flow) |
| `AppointmentBookingModal` does not reset its date/time/message state when reopened for a different doctor | [7](#7-patient-api--flow) |

