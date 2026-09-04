# 01 — Authentication & Authorization

Every route in this file group (`/auth/*`) is **public** — none of them use `AuthMiddleware.authenticate` or `AuthorizationMiddleware.authorize`. This is the only router in the app where that's true.

Session state is two JWTs (`HS256`, default algorithm, no `algorithms` restriction passed to `jwt.verify`), signed with `JWT_SECRET`/`REFRESH_TOKEN_SECRET`, carried as **HttpOnly cookies** (`accessToken`, `refreshToken`) — never returned in a JSON body. There is no server-side session store or refresh-token blocklist; validity is purely signature + expiry + (for refresh) `type: "refresh"` in the payload + the user still existing (not soft-deleted).

## What does NOT exist here

Confirmed absent by exhaustive grep, not assumed:
- **No password-reset / forgot-password flow** — no route, controller, service method, or validator anywhere in `backend/src` or `frontend/src`.
- **No email-verification flow separate from invitation acceptance.** The self-registration page's "Verify Email" button is UI copy on top of the same invitation-token mechanism described below — there is no `emailVerifiedAt` column and no standalone verify endpoint.
- **No account-status / active flag beyond soft-delete.** `AuthRepository.findUserForLogin`/`findUserForRefresh` both filter `deleted_at IS NULL`; there is no separate `isActive` check, and nothing in the codebase ever sets `deletedAt` on a `User`.

## Password rules

| Context | Rule | Enforced by |
|---|---|---|
| Login (`POST /auth/login`) | Non-empty string only — no complexity check | `loginSchema` (Joi) |
| Account creation (`POST /auth/accept-invitation`) | 12–128 chars; must contain lowercase, uppercase, a digit, and a special character | `acceptInvitationSchema` (Joi) |
| Hashing | `bcrypt`, cost factor **12** | `AuthService.acceptInvitation` |
| Verification | `bcrypt.compare` | `AuthService.login` |

## 1. `POST /auth/login`

```mermaid
flowchart TD
    A(["CLIENT\nPOST /auth/login\n{ email, password }"]) --> B{{"MIDDLEWARE\nrate limit 'auth'\n300 / 15 min"}}
    B -->|"exceeded"| B1["429\n{success:false, message: RATE_LIMIT_AUTH}"]
    B -->|"ok"| C{{"MIDDLEWARE\nvalidate body: loginSchema\nemail format + both required"}}
    C -->|"invalid"| C1["400\n{status:false, message:'Validation Error', code:'validation_error', data:[...]}"]
    C -->|"valid"| D["CONTROLLER\nauthController.login\nextract {email, password}"]
    D --> E["SERVICE\nAuthService.login(email, password)"]
    E --> F["REPOSITORY\nfindUserForLogin(email)\nWHERE email = :email AND deleted_at IS NULL"]
    F --> G{"user found?"}
    G -->|"no"| H1["throw 401 Unauthorized\nINVALID_CREDENTIALS\n'Invalid email or password'"]
    G -->|"yes"| I["bcrypt.compare(password, user.hashedPassword)"]
    I --> J{"match?"}
    J -->|"no"| H1
    J -->|"yes"| K["Sign accessToken\n{id, role}, JWT_SECRET, ACCESS_TOKEN_EXPIRES_IN\n\nSign refreshToken\n{id, type:'refresh'}, REFRESH_TOKEN_SECRET, REFRESH_TOKEN_EXPIRES_IN"]
    K --> L["CONTROLLER\nSet-Cookie: accessToken (httpOnly, sameSite=lax, secure=prod-only)\nSet-Cookie: refreshToken (same options)"]
    L --> M(["200 OK\n{success:true, data:{user:{id,firstName,lastName,email,role}}}"])
    H1 --> H2(["401\n{status:false, message:'Invalid email or password', code:'ERR10001'}"])

    classDef client fill:#e5e7eb,stroke:#374151
    classDef mw fill:#bfdbfe,stroke:#1e40af
    classDef ctrl fill:#ddd6fe,stroke:#5b21b6
    classDef svc fill:#fed7aa,stroke:#9a3412
    classDef db fill:#bbf7d0,stroke:#166534
    classDef ok fill:#86efac,stroke:#166534,color:#052e16
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class A client
    class B,C mw
    class D,L ctrl
    class E,I,K svc
    class F db
    class M ok
    class B1,C1,H1,H2 err
```

The response deliberately gives **identical** `INVALID_CREDENTIALS` for "no such user" and "wrong password" — no user-enumeration signal.

## 2. `POST /auth/refresh`

Reads the refresh token from the `refreshToken` HttpOnly cookie only — no body, no validator on this route.

```mermaid
flowchart TD
    A(["CLIENT\nPOST /auth/refresh\ncookie: refreshToken"]) --> B{{"MIDDLEWARE\nrate limit 'auth'"}}
    B -->|"exceeded"| B1["429"]
    B -->|"ok"| C["CONTROLLER\nread req.cookies.refreshToken"]
    C --> D{"cookie present?"}
    D -->|"no"| D1(["401 (built inline, not thrown)\n{success:false, message: INVALID_REFRESH_TOKEN}"])
    D -->|"yes"| E["SERVICE\nAuthService.refresh(token)"]
    E --> F["jwt.verify(token, REFRESH_TOKEN_SECRET)"]
    F --> G{"verify outcome"}
    G -->|"TokenExpiredError"| G1["throw 401\nREFRESH_TOKEN_EXPIRED"]
    G -->|"JsonWebTokenError / malformed"| G2["throw 401\nINVALID_REFRESH_TOKEN"]
    G -->|"ok"| H{"payload.id truthy AND\npayload.type === 'refresh'?"}
    H -->|"no"| G2
    H -->|"yes"| I["REPOSITORY findUserForRefresh(id)\nWHERE id=:id AND deleted_at IS NULL"]
    I --> J{"user exists?"}
    J -->|"no (soft-deleted/gone)"| G2
    J -->|"yes"| K["Sign a NEW accessToken only\n{id, role} — refresh token is NOT rotated"]
    K --> L["CONTROLLER Set-Cookie: accessToken"]
    L --> M(["200\n{success:true}\n(no data/user in body)"])
    G1 --> N(["401\n{status:false, message: REFRESH_TOKEN_EXPIRED}"])
    G2 --> O(["401\n{status:false, message: INVALID_REFRESH_TOKEN}"])

    classDef client fill:#e5e7eb,stroke:#374151
    classDef mw fill:#bfdbfe,stroke:#1e40af
    classDef ctrl fill:#ddd6fe,stroke:#5b21b6
    classDef svc fill:#fed7aa,stroke:#9a3412
    classDef db fill:#bbf7d0,stroke:#166534
    classDef ok fill:#86efac,stroke:#166534,color:#052e16
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class A client
    class B mw
    class C,L ctrl
    class E,F,K svc
    class I db
    class M ok
    class B1,D1,N,O err
```

**Frontend usage** (`frontend/src/api/apiClient.ts`): `apiFetch` automatically calls this endpoint once, silently, on any `401` from any other endpoint, then retries the original request. If the refresh itself fails, it clears `localStorage`, best-effort calls `/auth/logout`, and dispatches a `docpulse:session-expired` event that `AuthContext` listens for to drop the client-side user state — this is how `e2e/tests/auth-failure-paths.spec.ts`'s "cleared cookies mid-session" test ends up back at the login screen without an explicit logout click.

## 3. `POST /auth/logout`

No service call, no DB access, no auth required. Clears both cookies (matching `httpOnly`/`secure`/`sameSite`/`path`, no `maxAge` needed) and always returns `200 {success:true}`. (`req.user` is logged for an audit line but is always `undefined` here since this route has no `authenticate` middleware.)

## 4. `POST /auth/patient/self-register`

Enumeration-safe by design: **every** outcome except a genuine infrastructure failure returns the same `200`.

```mermaid
flowchart TD
    A(["CLIENT\nPOST /auth/patient/self-register\n{ email }"]) --> B{{"rate limit\n'patientSelfRegistration'\n10 / 15 min — the strictest limiter in the app"}}
    B -->|"exceeded"| B1["429"]
    B -->|"ok"| C{{"validate body\nemail format required"}}
    C -->|"invalid"| C1["400 validation_error"]
    C -->|"valid"| D["CONTROLLER → SERVICE\nrequestPatientSelfRegistration(email)"]
    D --> E["normalize: trim + lowercase"]
    E --> F{"user already exists?\n(findUserForLogin)"}
    F -->|"yes"| Z["log + return silently\n— no email sent"]
    F -->|"no"| G{"an ACTIVE invitation\nalready exists for this email?"}
    G -->|"yes"| Z
    G -->|"no"| H["generate 32-byte random token\nSHA-256 hash it for storage\nexpiresAt = now + 24h"]
    H --> I["REPOSITORY createInvitation\n(race-proof: partial unique index\non user_invitations(email)\nWHERE used_at IS NULL AND revoked_at IS NULL)"]
    I --> J{"23505 unique violation\n(concurrent duplicate)?"}
    J -->|"yes, conflicting row expired"| K["revoke the expired row, retry insert once"]
    J -->|"yes, conflicting row still active"| Z
    J -->|"no"| L["EMAIL sendInvitationEmail\n(raw token, source=PATIENT_SELF_REGISTRATION)"]
    K --> L
    L --> M{"email send failed?"}
    M -->|"yes"| M1["delete the just-created invitation\n(compensating action)"] --> Z
    M -->|"no"| Z
    Z --> R(["200\n{success:true, message: SELF_REGISTRATION_LINK_SENT}\n'If this email is eligible for registration,\nyou'll receive a verification link shortly.'"])
    D -.->|"genuine DB error\n(not 23505)"| X(["500 — the only non-200 outcome"])

    classDef client fill:#e5e7eb,stroke:#374151
    classDef mw fill:#bfdbfe,stroke:#1e40af
    classDef ctrl fill:#ddd6fe,stroke:#5b21b6
    classDef svc fill:#fed7aa,stroke:#9a3412
    classDef db fill:#bbf7d0,stroke:#166534
    classDef mail fill:#fbcfe8,stroke:#9d174d
    classDef ok fill:#86efac,stroke:#166534,color:#052e16
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class A client
    class B,C mw
    class D ctrl
    class E,F,G,H,J,M,Z svc
    class I,K db
    class L mail
    class R ok
    class B1,C1,X err
```

The frontend (`PatientSelfRegisterPage.tsx`) is written to match this contract exactly: it always shows a "Check Your Inbox" confirmation regardless of whether the email was new, already-registered, or mid-invitation (verified by `e2e/tests/patient-self-register.spec.ts`, test 3).

## 5. `GET /auth/invitation/:token`

Public, read-only preview — does **not** consume the invitation (no `usedAt` write). Used by `AcceptInvitationPage` on mount to resolve the invited role/email before rendering the right form fields.

```mermaid
flowchart TD
    A(["CLIENT\nGET /auth/invitation/:token"]) --> B{{"rate limit 'auth'"}} -->|"ok"| C["SERVICE\nSHA-256 hash token, look up by hash\n(no row lock — read-only)"]
    C --> D{"state check"}
    D -->|"not found"| D1["400 INVALID_INVITATION"]
    D -->|"usedAt set"| D2["400 INVITATION_ALREADY_USED"]
    D -->|"revokedAt set"| D3["400 INVITATION_REVOKED"]
    D -->|"expiresAt <= now"| D4["400 INVITATION_EXPIRED"]
    D -->|"none of the above"| E(["200\n{success:true, data:{email, role}}"])
    D1 & D2 & D3 & D4 --> F(["400\n{status:false, message:<one of the above>}"])

    classDef client fill:#e5e7eb,stroke:#374151
    classDef mw fill:#bfdbfe,stroke:#1e40af
    classDef svc fill:#fed7aa,stroke:#9a3412
    classDef ok fill:#86efac,stroke:#166534,color:#052e16
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class A client
    class B mw
    class C,D svc
    class E ok
    class D1,D2,D3,D4,F err
```

## 6. `POST /auth/accept-invitation` — the most involved auth endpoint

This is the **only** transaction in the auth domain, and the only place a row lock is taken outside the appointment/availability exclusion constraints.

```mermaid
flowchart TD
    A(["CLIENT\nPOST /auth/accept-invitation\n{token, firstName, lastName, password,\nspecializationId?, experienceYears?,\ndob?, heightCm?, weightKg?, bloodGroup?}"]) --> B{{"rate limit 'auth'"}}
    B -->|"ok"| C{{"validate body: acceptInvitationSchema\nnames 2-100 chars · password 12-128 chars,\nmust contain lower+upper+digit+special ·\nrole-specific fields optional at THIS layer"}}
    C -->|"invalid"| C1["400 validation_error"]
    C -->|"valid"| D["SERVICE\nhash token (SHA-256) · bcrypt.hash(password, 12)"]
    D --> E["BEGIN TRANSACTION"]
    E --> F["REPOSITORY findByHashedTokenForUpdate\nSELECT ... FOR UPDATE\n(locks the row — a concurrent accept on the\nSAME token blocks here until this commits)"]
    F --> G{"assertInvitationIsValid"}
    G -->|"not found"| G1["400 INVALID_INVITATION"]
    G -->|"usedAt set"| G2["400 INVITATION_ALREADY_USED"]
    G -->|"revokedAt set"| G3["400 INVITATION_REVOKED"]
    G -->|"expired"| G4["400 INVITATION_EXPIRED"]
    G -->|"valid"| H{"invitation.role\n(server-side, NEVER from request body)"}
    H -->|"DOCTOR"| I["validateDoctorProfileData:\nspecializationId required (400 if missing) ·\nexperienceYears required (400 if missing) ·\nfindSpecializationById → must exist AND\nspecialization.isActive=true (else 400 INVALID_SPECIALIZATION)"]
    H -->|"PATIENT"| J["validatePatientProfileData:\ndob required, must be 1900-01-01..today (else 400) ·\nheightCm required (400) · weightKg required (400) ·\nbloodGroup required + must be a valid enum value (400)"]
    I -->|"any check fails"| K1["400 (specific constant above)\nTRANSACTION ROLLS BACK — no user row created"]
    J -->|"any check fails"| K1
    I -->|"all pass"| L["REPOSITORY createUser\n{firstName,lastName,\nemail: invitation.email (NOT from body),\nhashedPassword, role: invitation.role}"]
    J -->|"all pass"| L
    L --> M["REPOSITORY create Patient or Doctor profile row\n(shared PK with the new user)"]
    M --> N["REPOSITORY markAsUsed(invitation.id, newUser.id)\nsets usedAt = now"]
    N --> O["COMMIT TRANSACTION"]
    O --> P(["201\n{success:true, message: ACCOUNT_CREATED_SUCCESSFULLY,\ndata:{id,firstName,lastName,email,role}}"])
    G1 & G2 & G3 & G4 --> Q(["400\n{status:false, message:<constant>}"])
    K1 --> Q

    classDef client fill:#e5e7eb,stroke:#374151
    classDef mw fill:#bfdbfe,stroke:#1e40af
    classDef svc fill:#fed7aa,stroke:#9a3412
    classDef db fill:#bbf7d0,stroke:#166534
    classDef ok fill:#86efac,stroke:#166534,color:#052e16
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class A client
    class B,C mw
    class D,H,I,J svc
    class E,F,L,M,N,O db
    class P ok
    class C1,G1,G2,G3,G4,K1,Q err
```

**Concurrency guarantee** (verified by `invitation.test.ts`, "two concurrent accept-invitation calls with the same token"): the `SELECT ... FOR UPDATE` means the second concurrent request for the same token blocks until the first commits, then re-reads the row and sees `usedAt` already set → 400, not a duplicate user. **Any failure inside the transaction rolls back everything** — a bad `specializationId` leaves no `users` row and the invitation's `usedAt` stays `NULL`, so the same token can be retried successfully afterward (verified by the same test file).

## Authorization architecture (used by every other protected route)

Two independent, composable middlewares — every protected route in the app (everything except `/auth/*` and `GET /doctors/specializations`) uses both, in this order:

```mermaid
flowchart TD
    A(["Incoming request to a protected route"]) --> B["AuthMiddleware.authenticate\nbackend/src/middleware/auth.middleware.ts"]
    B --> C{"req.cookies.accessToken present?"}
    C -->|"no"| C1(["401\nAUTH_TOKEN_REQUIRED\n'Authentication token is required'"])
    C -->|"yes"| D["jwt.verify(token, JWT_SECRET)"]
    D --> E{"valid signature + not expired?"}
    E -->|"no"| E1(["401\nAUTH_TOKEN_INVALID\n'Invalid or expired authentication token'"])
    E -->|"yes"| F["req.user = {id: decoded.id, role: decoded.role}"]
    F --> G["AuthorizationMiddleware.authorize(...allowedRoles)\nbackend/src/middleware/authorization.middleware.ts"]
    G --> H{"req.user set?\n(defensive — authenticate always\nruns first on every real route)"}
    H -->|"no"| H1(["401\nUSER_NOT_AUTHENTICATED"])
    H -->|"yes"| I{"req.user.role IN allowedRoles?"}
    I -->|"no"| I1(["403\nACCESS_FORBIDDEN\n'You do not have permission\nto access this resource'"])
    I -->|"yes"| J(["next() → route's Joi validator, then controller"])

    classDef mw fill:#bfdbfe,stroke:#1e40af
    classDef ok fill:#86efac,stroke:#166534,color:#052e16
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class B,D,F,G,H,I mw
    class J ok
    class C1,E1,H1,I1 err
```

**Authentication vs. authorization vs. resource ownership — three distinct, separately-enforced concerns in this codebase:**

| Concern | Where enforced | Failure |
|---|---|---|
| **Authentication** — "is there a valid session at all?" | `AuthMiddleware.authenticate`, every protected route | 401 |
| **Authorization (role)** — "is this role allowed to hit this route at all?" | `AuthorizationMiddleware.authorize(...)`, every protected route | 403 |
| **Resource ownership** — "does this specific resource belong to this specific user?" | **Not middleware** — enforced inside repository queries by scoping `WHERE`, e.g. `findDoctorAppointmentById(id, doctorId)`, `findPatientAppointmentById(id, patientId)`, `deleteAvailability({id, doctorId})`. A mismatch surfaces as a **404** ("not found"), not a 403, because the row is fetched *with* the ownership filter already applied — the API never confirms the resource exists before checking ownership, so a request for someone else's resource looks identical to a request for a non-existent one. |

There is no separate "resource ownership" middleware layer anywhere in the app — every ownership check documented in docs 02/03 is a `WHERE ... AND {ownerId} = :callerId` clause inside the relevant repository method.

## Rate limiters (full map)

All four `express-rate-limit` instances share a 15-minute window and are fully **disabled when `NODE_ENV=test`** (`skipInTestEnv()`); every one keys by IP (no custom `keyGenerator`), and on rejection returns `429` with `{success:false, message:"<limiter message>"}` directly from the library — this bypasses both the controller-authored envelope and the global error middleware entirely.

| Limiter | Max / 15 min | Applied to |
|---|---|---|
| `general` | 1000 | Nearly everything except the four rows below |
| `auth` | 300 | `/auth/login`, `/auth/refresh`, `/auth/accept-invitation`, `/auth/invitation/:token`, `/auth/logout` |
| `invitation` | 500 | `/admin/invite`, `/admin/invitations/bulk` |
| `patientSelfRegistration` | **10** | `/auth/patient/self-register` only — the strictest limiter in the app, on the one fully-public, unauthenticated write endpoint |
