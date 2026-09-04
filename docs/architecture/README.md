# DocPulse — System Flow Diagrams

This directory is the **visual, request-to-response counterpart** to [`TECHNICAL_DOCUMENTATION.md`](../../TECHNICAL_DOCUMENTATION.md). That document explains the system in prose; this directory traces every important operation as an actual diagram — what happens, in order, from the moment a Patient, Doctor, or Admin triggers a request until the server responds, including every authentication check, authorization check, validation rule, business rule, database operation, side effect, and error branch.

**Everything here is derived directly from the current source code** (routes → middleware → controllers → services → repositories → models/migrations), cross-checked against the integration and e2e test suites. Nothing is invented, simplified away, or assumed. Where the code has a gap, an inconsistency, or dead/unreachable code, it is called out explicitly rather than smoothed over — see the "Documented gaps and inconsistencies" list below.

If anything here ever conflicts with the code, **the code is correct and this documentation is stale** — treat a conflict as a bug in these docs, not in the app, and fix the diagram.

## How to read these diagrams

All diagrams are [Mermaid](https://mermaid.js.org/), rendered natively by GitHub, GitLab, VS Code (with the Mermaid extension), and most modern doc tooling.

### Endpoint request-lifecycle diagrams (docs 02–04, 06)

Each important endpoint gets a top-to-bottom flowchart. Layers are color-coded and label-prefixed consistently across every diagram in this directory:

| Swimlane | Color | Meaning |
|---|---|---|
| `CLIENT` | gray | The frontend/HTTP caller issuing the request |
| `MIDDLEWARE` | blue | Rate limiter → auth → authorization → Joi validation, in the exact order the route wires them |
| `CONTROLLER` | violet | The thin Express handler — extracts the request, calls one service method, shapes the response |
| `SERVICE` | orange | Business rules, validation-beyond-shape, orchestration — this is where most decision diamonds live |
| `REPOSITORY / DATABASE` | green | TypeORM repository calls, raw SQL fragments, constraints, transactions |
| `EMAIL` | pink | Side-effect notifications via Nodemailer |
| Success response | solid green box | Terminal node — exact status code + body shape |
| Error response | solid red box | Terminal node — exact status code + body shape |

A decision diamond always has explicit Yes/No (or exact condition) labels on its outgoing edges — never an unlabeled fork. Only the layers that actually exist for a given endpoint are shown (e.g. an unauthenticated route has no `authenticate`/`authorize` boxes at all).

### Cross-role sequence diagrams (doc 07)

These use Mermaid `sequenceDiagram`, where each actor (`Patient`, `Frontend`, `API`, `Service`, `Database`, `Email`, `Doctor`, ...) is a true vertical swimlane with horizontal arrows showing exactly who talks to whom and in what order, including async/side-effect messages (emails) drawn as dashed arrows.

### State machine diagrams (docs 05, 06)

These use Mermaid `stateDiagram-v2` for the `Appointment.status` and `UserInvitation` (derived) state machines, with every guard condition labeled on the transition arrow.

### Response envelope conventions (used verbatim throughout)

This API has **two different JSON envelopes** depending on how a response is produced — this is a real, verified characteristic of the code, not a documentation simplification:

1. **Controller-authored success responses** (every `2xx` in this API is built by hand in the controller): `{ "success": true, "data": {...} }`, sometimes with a sibling `"message"` key (e.g. admin invite endpoints) or a sibling `"pagination"` key (admin invitation listing).
2. **Errors that reach the global error handler** (`backend/src/middleware/error.ts`, anything thrown via `http-errors`'s `createError.*`): `{ "status": false, "message": "...", "code": "ERR10001", "data": {} }` — note the key is `status`, not `success`, and `code` is almost always the generic i18n fallback `"ERR10001"` because domain errors in this codebase never set a custom `.code`.
3. **Joi validation failures** (`backend/src/middleware/http-request-validator.ts`, never reaches the error handler — it responds directly): `{ "status": false, "message": "Validation Error", "code": "validation_error", "data": [{ "message": "...", "label": "..." }] }`.
4. **Rate-limit rejections** (`express-rate-limit`, bypasses both of the above): `{ "success": false, "message": "<limiter message>" }`, HTTP `429`.

Every diagram's terminal response boxes use the exact envelope that applies.

## Contents

| # | Document | Covers |
|---|---|---|
| 00 | [System Overview](./00-system-overview.md) | Architecture diagram, tech stack, route mount map, DB schema ER diagram, request pipeline (middleware order) |
| 01 | [Authentication & Authorization](./01-authentication-authorization.md) | Login/refresh/logout, JWT mechanics, `authenticate`/`authorize` middleware, invitation acceptance, password rules — and what does **not** exist (password reset, email verification) |
| 02 | [Patient Flows](./02-patient-flows.md) | Doctor discovery/search, availability viewing, booking, listing, cancelling, profile |
| 03 | [Doctor Flows](./03-doctor-flows.md) | Availability creation/viewing, profile, appointment listing, confirm/reject/complete |
| 04 | [Admin Flows](./04-admin-flows.md) | Single invite, bulk invite (CSV), invitation listing/filtering, revoke |
| 05 | [Appointment Lifecycle](./05-appointment-lifecycle.md) | Full `AppointmentStatus` state machine, every guard, the booking-abuse caps, stale-request auto-expiry |
| 06 | [Availability Lifecycle](./06-availability-lifecycle.md) | Creation, overlap prevention, the orphaned delete method, busy-slot subtraction that powers booking |
| 07 | [Cross-Role Sequence Diagrams](./07-cross-role-sequences.md) | Patient↔Server↔Doctor booking/confirm/cancel journeys, Admin↔Server↔invitee onboarding |
| 08 | [Error & Decision Flows](./08-error-decision-flows.md) | Where the three response envelopes come from, consolidated error-code reference, rate-limit map |
| 09 | [API Endpoint Matrix](./09-api-endpoint-matrix.md) | Every one of the 25 routes: method, path, auth, role, checks, success shape, error shapes |

## Documented gaps and inconsistencies (verified against the code, not assumptions)

These are real characteristics of the current implementation, referenced from the relevant diagrams rather than repeated everywhere:

- **No password-reset ("forgot password") flow exists anywhere** in the backend or frontend.
- **No email-verification flow distinct from invitation acceptance** exists — the "Verify Email" button on the self-registration page is UI copy layered on the same invitation-token mechanism, not a separate feature.
- **No admin doctor/patient management exists.** Admin can only invite, list/filter, and revoke invitations. There is no admin endpoint to view, edit, deactivate, suspend, or delete an existing doctor or patient account, even though `User.deletedAt` (soft-delete) exists as a column — it is never written to by any code path.
- **`DoctorService.deleteAvailability` / `DoctorRepository.deleteAvailability` exist but are wired to no route or controller.** They are unreachable from the API. See [doc 06](./06-availability-lifecycle.md).
- **No "no-show" concept exists.** A `CONFIRMED` appointment whose time passes with no doctor action stays `CONFIRMED` forever — there is no automatic transition and no penalty. See [doc 05](./05-appointment-lifecycle.md).
- **Two response envelopes coexist** (`{success,...}` vs `{status,...}`) depending on whether a controller hand-built the response or an error passed through the shared middleware — see "Response envelope conventions" above.
- **A known frontend bug**: `AppointmentBookingModal`'s own "Appointment requested successfully!" message is essentially never visible to the user, because `onSuccess()` fires synchronously right after `setSuccessMsg(...)` and unmounts the modal before it can render (documented in `e2e/tests/patient-booking.spec.ts`, lines 107-121). Noted in [doc 02](./02-patient-flows.md).
- **`GET /doctors/specializations` is the only unauthenticated resource route** in the entire API (deliberately, so the not-yet-registered accept-invitation page can populate a dropdown) — every other non-`/auth` route requires a valid session.
