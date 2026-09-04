# 08 — Error & Decision Flows

## Where every response shape comes from

Three independent code paths produce a response, and none of them know about each other — this is why the envelope shape differs:

```mermaid
flowchart TD
    A(["Any request"]) --> B{"Rejected by\nexpress-rate-limit\nbefore reaching any route code?"}
    B -->|"yes"| B1(["429\n{success:false, message:'<limiter message>'}\n— the library's own response,\nnever touches ResponseParser"])
    B -->|"no"| C{"Rejected by\nHttpRequestValidator\n(Joi schema.validate fails)?"}
    C -->|"yes"| C1(["400\n{status:false, message:'Validation Error',\ncode:'validation_error', data:[{message,label},...]}\n— built and sent directly by the\nvalidator middleware; next() is never called"])
    C -->|"no"| D["Request reaches the controller"]
    D --> E{"Controller completes\nwithout throwing?"}
    E -->|"yes"| E1(["2xx\n{success:true, data:{...}}\n— hand-built in the controller,\nthe ONLY place this shape is produced"])
    E -->|"no — something threw\n(service, repository, or the\ncontroller's own manual throw)"| F["catch(error) { next(error) }\n(or, for an async handler, express-async-errors\nauto-forwards even without an explicit catch)"]
    F --> G["Global error middleware\nbackend/src/middleware/error.ts\n(last-registered middleware in app.ts)"]
    G --> H(["error.status || 500\n{status:false, message: error.message || i18n fallback,\ncode: error.code || 'ERR10001', data:{}}"])

    classDef ok fill:#86efac,stroke:#166534,color:#052e16
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class E1 ok
    class B1,C1,H err
```

Practically: **every domain/business error in this API is a `createError.X(message)` call from the `http-errors` package**, which sets `.status` to the right code and `.message` to the string you pass — but never sets a custom `.code`, so `code` in the JSON body is essentially always the generic `"ERR10001"` fallback. `code` is not a reliable machine-readable discriminator in this API today; **`message` is the only string worth matching on**, and the frontend's own error-normalization helpers (`authApi.ts`, `profileApi.ts`) are written accordingly.

## The seven check types this API actually performs, with real examples

The user-supplied "generic" checklist, filled in with one concrete example of each from the real codebase (not hypothetical):

```mermaid
flowchart TD
    Q1{"Authenticated?\n(AuthMiddleware.authenticate)"} -->|"NO"| A1["401 AUTH_TOKEN_REQUIRED / AUTH_TOKEN_INVALID"]
    Q1 -->|"YES"| Q2{"Correct role?\n(AuthorizationMiddleware.authorize)"}
    Q2 -->|"NO"| A2["403 ACCESS_FORBIDDEN"]
    Q2 -->|"YES"| Q3{"Input shape valid?\n(Joi schema via HttpRequestValidator)"}
    Q3 -->|"NO"| A3["400 validation_error\n(array of {message,label})"]
    Q3 -->|"YES"| Q4{"Resource exists?\ne.g. findDoctorById, findPatientAppointmentById"}
    Q4 -->|"NO"| A4["404 (DOCTOR_NOT_FOUND, APPOINTMENT_NOT_FOUND,\nINVITATION_NOT_FOUND, AVAILABILITY_NOT_FOUND, ...)"]
    Q4 -->|"YES"| Q5{"Caller owns the resource?\n(baked into the SAME query as Q4 —\ne.g. WHERE id=:id AND patient_id=:callerId)"}
    Q5 -->|"NO"| A4b["404 — identical to 'doesn't exist',\nby construction (no separate 403 for ownership\nanywhere in this API)"]
    Q5 -->|"YES"| Q6{"Business rule satisfied?\ne.g. status transition allowed, time not passed,\nactive-appointment cap not exceeded, doctor active/available"}
    Q6 -->|"NO"| A5["400 or 409, depending on the rule\n(see the full table below)"]
    Q6 -->|"YES"| Q7{"Database operation successful?\ne.g. compare-and-swap UPDATE affected>0,\nno exclusion-constraint violation"}
    Q7 -->|"NO — lost a race\nor hit a DB constraint"| A6["409 (APPOINTMENT_STATUS_CONFLICT,\nAPPOINTMENT_TIME_UNAVAILABLE, AVAILABILITY_OVERLAP, ...)\nor 500 for a genuinely unexpected DB error"]
    Q7 -->|"YES"| S(["2xx success"])

    classDef ok fill:#86efac,stroke:#166534,color:#052e16
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class S ok
    class A1,A2,A3,A4,A4b,A5,A6 err
```

Not every endpoint has all seven — see docs 02/03/04 for exactly which layers apply to each one. `GET /doctors/specializations` and the health check have only Q3 (trivial) before success; `POST /appointments` has all seven, several of them twice (Q4/Q5 run for both the doctor and the patient, Q6 runs three separate times — availability, per-doctor cap, global cap).

## Complete error-constant reference

Every non-2xx business/validation constant in `backend/src/config/constant.ts`, grouped by domain, with its actual HTTP status and where it's thrown. All reach the client via the `{status:false, message, code, data}` envelope (or, for Joi failures, the `validation_error` envelope) unless noted.

### Auth & session (doc 01)

| Constant | Status | Thrown when |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Login: no such user, or wrong password (identical message for both) |
| `AUTH_TOKEN_REQUIRED` | 401 | `authenticate`: no `accessToken` cookie |
| `AUTH_TOKEN_INVALID` | 401 | `authenticate`: JWT invalid/expired |
| `USER_NOT_AUTHENTICATED` | 401 | `authorize`: `req.user` unset (defensive; `authenticate` always runs first in practice) |
| `ACCESS_FORBIDDEN` | 403 | `authorize`: role not in the allowed list |
| `INVALID_REFRESH_TOKEN` | 401 | `/auth/refresh`: cookie missing, malformed token, or user gone |
| `REFRESH_TOKEN_EXPIRED` | 401 | `/auth/refresh`: `jwt.TokenExpiredError` |
| `INVALID_INVITATION` | 400 | Invitation not found by hashed token |
| `INVITATION_ALREADY_USED` | 400 | Accept/preview: `usedAt` already set |
| `INVITATION_REVOKED` | 400 | Accept/preview: `revokedAt` already set |
| `INVITATION_EXPIRED` | 400 | Accept/preview: `expiresAt <= now` |
| `SPECIALIZATION_ID_REQUIRED` / `EXPERIENCE_YEARS_REQUIRED` / `INVALID_SPECIALIZATION` | 400 | Accept-invitation, role=DOCTOR, missing/invalid profile field |
| `DOB_REQUIRED` / `INVALID_DOB` / `HEIGHT_REQUIRED` / `INVALID_HEIGHT` / `WEIGHT_REQUIRED` / `INVALID_WEIGHT` / `BLOOD_GROUP_REQUIRED` / `INVALID_BLOOD_GROUP` | 400 | Accept-invitation, role=PATIENT, missing/invalid profile field |

### Admin & invitations (doc 04)

| Constant | Status | Thrown when |
|---|---|---|
| `USER_ALREADY_EXISTS` | 409 | Invite: email already has an account |
| `INVITATION_ALREADY_SENT` | 409 | Invite / self-register: an active invitation already exists for this email |
| `CSV_FILE_REQUIRED` | 400 | Bulk invite: no file attached |
| `CSV_ROW_LIMIT_EXCEEDED` | 400 | Bulk invite: > 500 rows |
| `FAILED_TO_SEND_INVITATION` | 500 | Invite: email delivery threw (invitation row is compensating-deleted first) |
| `INVITATION_NOT_FOUND` | 404 | Revoke: no such invitation id |
| `INVITATION_ALREADY_REVOKED` | 409 | Revoke: already revoked |
| `CANNOT_REVOKE_USED_INVITATION` | 400 | Revoke: `usedAt` already set |
| `INVALID_ROW_DATA` / `DUPLICATE_EMAIL_IN_FILE` | n/a (per-row) | Bulk invite: never an HTTP error — the overall request is still `200`; these are per-row `"reason"` strings inside `data.results[]` |

### Doctor & availability (doc 03, 06)

| Constant | Status | Thrown when |
|---|---|---|
| `DOCTOR_NOT_FOUND` | 404 | Any lookup by doctor id that finds nothing |
| `AVAILABILITY_DATE_IN_PAST` / `AVAILABILITY_TIME_IN_PAST` / `INVALID_AVAILABILITY_TIME` | 400 | Create availability: date/time validation |
| `AVAILABILITY_OVERLAP` | 409 | Create availability: GIST exclusion constraint hit (`23P01`) |
| `AVAILABILITY_NOT_FOUND` | 404 | `deleteAvailability` (unreachable via any route today — see doc 06) |

### Patient (doc 02)

| Constant | Status | Thrown when |
|---|---|---|
| `PATIENT_NOT_FOUND` | 404 | Any lookup by patient id that finds nothing |

### Appointments (doc 05)

| Constant | Status | Thrown when |
|---|---|---|
| `APPOINTMENT_NOT_FOUND` | 404 | Ownership-scoped lookup finds nothing (doesn't exist, or belongs to someone else) |
| `APPOINTMENT_DATE_IN_PAST` / `APPOINTMENT_TIME_IN_PAST` / `INVALID_APPOINTMENT_TIME` | 400 | Create: date/time validation |
| `DOCTOR_NOT_AVAILABLE` | 409 | Create: requested range not covered by any availability window |
| `APPOINTMENT_TIME_UNAVAILABLE` | 409 | Create: GIST exclusion constraint hit (`23P01`) — the real double-booking guard |
| `MAX_ACTIVE_APPOINTMENTS_PER_DOCTOR_EXCEEDED` | 409 | Create: patient already has 2 active appointments with this doctor |
| `MAX_ACTIVE_APPOINTMENTS_TOTAL_EXCEEDED` | 409 | Create: patient already has 5 active appointments total |
| `INVALID_STATUS_TRANSITION` | 400 | Any disallowed status transition (from either the doctor or patient endpoint) |
| `PATIENT_CAN_ONLY_CANCEL` | 400 | Patient endpoint: requested status isn't literally `CANCELLED` (redundant with Joi, checked again) |
| `APPOINTMENT_TIME_ALREADY_PASSED` | 409 | Doctor confirms a `PENDING` appointment whose start time already passed |
| `APPOINTMENT_NOT_YET_STARTED` | 409 | Doctor completes a `CONFIRMED` appointment before its start time |
| `CANNOT_CANCEL_PAST_APPOINTMENT` | 409 | Patient cancels an appointment whose start time already passed |
| `APPOINTMENT_STATUS_CONFLICT` | 409 | Compare-and-swap update lost a race — another request changed the row first |
| `INVALID_DATE_FILTER` / `INVALID_DATE_RANGE` | 400 | Listing endpoints: conflicting or malformed date-range query params |

## Rate-limit map (doc 01, repeated here for completeness)

| Limiter | Max / 15 min | Routes |
|---|---|---|
| `general` | 1000 | Everything not listed below |
| `auth` | 300 | All 6 `/auth/*` routes except self-register |
| `invitation` | 500 | `/admin/invite`, `/admin/invitations/bulk` |
| `patientSelfRegistration` | 10 | `/auth/patient/self-register` only |

All four are IP-keyed, disabled entirely when `NODE_ENV=test`, and return `429 {success:false, message:"<limiter message>"}` — bypassing every other response mechanism in the app.
