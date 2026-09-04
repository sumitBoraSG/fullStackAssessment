# 09 — Complete API Endpoint Matrix

All 25 routes in the application (confirmed against `backend/src/api/route/index.ts` and every router file — nothing omitted, nothing invented). "Actor" is who is actually authorized to call it, not just who the feature is "for." Full request/response detail for any row lives in the linked flow doc. Response envelopes are explained in [doc 08](./08-error-decision-flows.md#where-every-response-shape-comes-from).

## Auth (`/auth`) — public, no route in this group uses `authenticate`/`authorize`

| Actor | Method | Endpoint | Rate limiter | Main checks | Success | Main errors |
|---|---|---|---|---|---|---|
| Anyone | POST | `/auth/login` | `auth` | email/password shape · user exists · bcrypt match | `200 {success:true,data:{user}}` | `401` INVALID_CREDENTIALS · `429` |
| Anyone (session) | POST | `/auth/refresh` | `auth` | `refreshToken` cookie present · JWT valid · `type=refresh` · user still exists | `200 {success:true}` | `401` INVALID_REFRESH_TOKEN / REFRESH_TOKEN_EXPIRED · `429` |
| Anyone | POST | `/auth/accept-invitation` | `auth` | body shape · invitation not used/revoked/expired · role-specific profile fields valid | `201 {success:true,message,data:{id,firstName,lastName,email,role}}` | `400` (10+ variants, see doc 08) · `429` |
| Anyone | POST | `/auth/patient/self-register` | `patientSelfRegistration` (10/15min) | email shape only | `200 {success:true,message}` **always** (enumeration-safe) | `429` · `500` (rare, infra only) |
| Anyone | GET | `/auth/invitation/:token` | `auth` | invitation not used/revoked/expired | `200 {success:true,data:{email,role}}` | `400` (4 variants) · `429` |
| Anyone (session) | POST | `/auth/logout` | `auth` | none | `200 {success:true}` | `429` |

Full detail: [doc 01](./01-authentication-authorization.md).

## Admin (`/admin`) — every route: `authenticate` + `authorize(ADMIN)`

| Actor | Method | Endpoint | Main checks | Success | Main errors |
|---|---|---|---|---|---|
| Admin | POST | `/admin/invite` | role ∈ {DOCTOR,ADMIN} (PATIENT rejected) · user doesn't exist · no active invitation · race-proof insert · email sent | `201 {success:true,message,data:{id,email,role,expiresAt}}` | `400` · `401` · `403` · `409` USER_ALREADY_EXISTS/INVITATION_ALREADY_SENT · `500` FAILED_TO_SEND_INVITATION · `429` |
| Admin | GET | `/admin/invitations` | query shape (page/limit/search/status/role) | `200 {success:true,message,data:[...],pagination}` | `400` · `401` · `403` |
| Admin | POST | `/admin/invitations/:id/revoke` | invitation exists · not already revoked · not already used | `200 {success:true,message,data:{...,status:'REVOKED'}}` | `400` CANNOT_REVOKE_USED_INVITATION · `401` · `403` · `404` · `409` INVITATION_ALREADY_REVOKED |
| Admin | POST | `/admin/invitations/bulk` | file attached · valid CSV · ≤500 rows · **per-row**: shape, role∈{DOCTOR,ADMIN}, no in-file duplicate, reuses single-invite checks | `200 {success:true,message,data:{total,successful,failed,results}}` **even if every row failed** | `400` CSV_FILE_REQUIRED/CSV_ROW_LIMIT_EXCEEDED/bad-file · `401` · `403` · `413` file>5MB · `429` |

Full detail: [doc 04](./04-admin-flows.md).

## Doctor (`/doctor`) — every route: `authenticate` + `authorize(DOCTOR)`

| Actor | Method | Endpoint | Main checks | Success | Main errors |
|---|---|---|---|---|---|
| Doctor | POST | `/doctor/availability` | date/time not in past, start<end · doctor exists · no overlap (DB exclusion) | `201 {success:true,data:{id,doctorId,date,startTime,endTime,createdAt}}` | `400` (x3) · `401` · `403` · `404` (unmessaged) · `409` AVAILABILITY_OVERLAP |
| Doctor | GET | `/doctor/availability` | query shape (date optional) | `200 {success:true,data:[{id,date,startTime,endTime}]}` — raw, NOT busy-adjusted | `400` · `401` · `403` |
| Doctor | GET | `/doctor/appointments` | side effect: stale-PENDING sweep (own) · date-filter shape | `200 {success:true,data:{appointments,pagination}}` | `400` · `401` · `403` |
| Doctor | PATCH | `/doctor/appointments/:id/status` | ownership · transition allowed (PENDING→CONFIRMED/REJECTED, CONFIRMED→COMPLETED only) · time guard · compare-and-swap | `200 {success:true,data:{...,status:<new>}}` | `400` INVALID_STATUS_TRANSITION / validation · `401` · `403` · `404` · `409` APPOINTMENT_TIME_ALREADY_PASSED/APPOINTMENT_NOT_YET_STARTED/APPOINTMENT_STATUS_CONFLICT |
| Doctor | GET | `/doctor/profile` | doctor exists | `200 {success:true,data:{id,firstName,lastName,email,specialization,experienceYears}}` | `401` · `403` · `404` |
| Doctor | PATCH | `/doctor/profile` | `experienceYears` 0-80, required, no other field accepted · doctor exists | `200` — same shape as GET | `400` (missing/out-of-range/unknown key) · `401` · `403` · `404` |
| ❌ nobody | — | *(availability deletion — no route exists)* | — | — | fully implemented in `DoctorService`/`DoctorRepository`, unreachable — see [doc 06](./06-availability-lifecycle.md#deletion--implemented-but-unreachable) |

## Doctor discovery (`/doctors`) — mixed auth

| Actor | Method | Endpoint | Auth | Main checks | Success | Main errors |
|---|---|---|---|---|---|---|
| **Anyone** (public) | GET | `/doctors/specializations` | none | `isActive=true` filter only | `200 {success:true,data:[{id,name,description}]}` | `429` only |
| Patient, Doctor, Admin | GET | `/doctors/:doctorId/availability` | JWT + role | doctor exists · busy-slot subtraction · now-clamping | `200 {success:true,data:{doctor,availability}}` | `400` · `401` · `403` · `404` DOCTOR_NOT_FOUND |
| Patient, Doctor, Admin | GET | `/doctors` | JWT + role | query shape (search/specialization/date/page/limit) | `200 {success:true,data:{doctors,pagination}}` | `400` · `401` · `403` |

Full detail: [doc 02](./02-patient-flows.md) (patient perspective), [doc 03](./03-doctor-flows.md) (doctor's own availability), [doc 06](./06-availability-lifecycle.md) (lifecycle).

## Appointments (`/appointments`) — every route: `authenticate` + `authorize(PATIENT)`

| Actor | Method | Endpoint | Main checks | Success | Main errors |
|---|---|---|---|---|---|
| Patient | GET | `/appointments` | side effect: stale-PENDING sweep (own) · date-filter shape | `200 {success:true,data:{appointments,pagination}}` | `400` INVALID_DATE_FILTER/INVALID_DATE_RANGE · `401` · `403` |
| Patient | POST | `/appointments` | date/time valid · doctor & patient exist · stale-PENDING sweep · availability covers slot · **per-doctor cap (2)** · **global cap (5)** · DB exclusion constraint | `201 {success:true,data:{id,status:'PENDING',...,doctor:{...}}}` | `400` (x3) · `401` · `403` · `404` (x2) · `409` DOCTOR_NOT_AVAILABLE/APPOINTMENT_TIME_UNAVAILABLE/MAX_ACTIVE_APPOINTMENTS_PER_DOCTOR_EXCEEDED/MAX_ACTIVE_APPOINTMENTS_TOTAL_EXCEEDED |
| Patient | PATCH | `/appointments/:id/status` | ownership · status must be literal `CANCELLED` · current PENDING/CONFIRMED · time not passed · compare-and-swap | `200 {success:true,data:{...,status:'CANCELLED'}}` | `400` PATIENT_CAN_ONLY_CANCEL/INVALID_STATUS_TRANSITION/validation · `401` · `403` · `404` · `409` CANNOT_CANCEL_PAST_APPOINTMENT/APPOINTMENT_STATUS_CONFLICT |

Full detail: [doc 02](./02-patient-flows.md), state machine in [doc 05](./05-appointment-lifecycle.md).

## Patient (`/patient`) — every route: `authenticate` + `authorize(PATIENT)`

| Actor | Method | Endpoint | Main checks | Success | Main errors |
|---|---|---|---|---|---|
| Patient | GET | `/patient/profile` | patient exists | `200 {success:true,data:{id,firstName,lastName,email,heightCm,weightKg,bloodGroup,dob}}` | `401` · `403` · `404` |
| Patient | PATCH | `/patient/profile` | `heightCm` 30-300 / `weightKg` 2-500, at least one required, no other field accepted (dob/bloodGroup permanent) · patient exists | `200` — same shape as GET | `400` (empty body/out-of-range/unknown key) · `401` · `403` · `404` |

## Misc

| Actor | Method | Endpoint | Auth | Success |
|---|---|---|---|---|
| Anyone | GET | `/` | none | `200 {success:true,data:{status:'ok'}}` — health check |

---

**Totals**: 25 application routes (6 auth + 4 admin + 6 doctor + 3 discovery + 3 appointments + 2 patient + 1 health), spanning 6 router files. Every route's exact middleware order, decision tree, and database interaction is diagrammed in docs 01–06; cross-role journeys tying multiple rows in this table together are in [doc 07](./07-cross-role-sequences.md).
