# 04 — Admin Flows

Every route below is mounted under `/admin` and requires `authenticate` + `authorize(ADMIN)`. **The admin domain's entire capability surface is invitation management — nothing else.** Confirmed by exhaustive grep (`deactivat|suspend|isActive|deletedAt`) across the backend: there is no admin endpoint to list, view, edit, deactivate, suspend, or delete an existing doctor or patient account. The `User.deletedAt` soft-delete column exists but no code path ever writes to it. The admin frontend (`AdminLayout.tsx`) has exactly one sidebar item: "Invitations".

```mermaid
flowchart LR
    subgraph ADMIN["Admin's only capabilities"]
        direction TB
        I1["Invite a user\n(DOCTOR or ADMIN only)"]
        I2["List / search / filter invitations"]
        I3["Revoke a pending invitation"]
        I4["Bulk-invite via CSV\n(DOCTOR / ADMIN rows only)"]
    end
    NOPE["✗ No doctor/patient account management\n✗ No deactivation or deletion\n✗ No 'list all doctors' or 'list all patients'\nadmin-exclusive endpoint\n(the shared GET /doctors discovery endpoint\nis available to PATIENT/DOCTOR/ADMIN alike,\nnot an admin management tool)"]
    ADMIN -.-> NOPE
    style NOPE fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
```

**PATIENT accounts can never be admin-invited** — `inviteUserSchema` and `bulkInviteRowSchema` both restrict `role` to `ADMIN`/`DOCTOR` only. Patients exist solely via `POST /auth/patient/self-register` ([doc 01](./01-authentication-authorization.md#4-post-authpatientself-register)).

## 1. Invite a single user — `POST /admin/invite`

```mermaid
flowchart TD
    A(["CLIENT\nPOST /admin/invite\n{email, role: DOCTOR|ADMIN}"]) --> B{{"MIDDLEWARE\nrate limit 'invitation' (500/15min) →\nauthenticate → authorize(ADMIN) →\nvalidate body: inviteUserSchema\n(role must be DOCTOR or ADMIN — PATIENT rejected here)"}}
    B -->|"fail"| B1["401 / 403 / 400 validation_error"]
    B -->|"ok"| C["SERVICE inviteUser(email, role, adminId)\nnormalize: trim + lowercase email"]
    C --> D{"user already exists?\n(findUserForLogin)"}
    D -->|"yes"| D1["409 USER_ALREADY_EXISTS"]
    D -->|"no"| E{"a pending invitation\nalready exists? (fast-path check;\nthe REAL guard is the partial unique\nindex hit in step F)"}
    E -->|"yes"| E1["409 INVITATION_ALREADY_SENT"]
    E -->|"no"| F["generate 32-byte random token,\nSHA-256 hash for storage, expiresAt = now+24h"]
    F --> G["REPOSITORY createInvitation\n(race-proof via idx_user_invitations_active_email\npartial unique index)"]
    G --> H{"23505 unique violation\n(concurrent duplicate insert)?"}
    H -->|"yes, conflicting row EXPIRED"| I["revoke the expired row, retry insert once"]
    H -->|"yes, conflicting row still ACTIVE"| E1
    H -->|"no"| J["EMAIL sendInvitationEmail\n(raw token, source=ADMIN_INVITATION)"]
    I --> J
    J --> K{"email send failed?"}
    K -->|"yes"| K1["DELETE the just-created invitation\n(compensating action)\n500 FAILED_TO_SEND_INVITATION"]
    K -->|"no"| L(["201\n{success:true, message: INVITATION_SENT,\ndata:{id,email,role,expiresAt}}"])
    D1 & E1 & K1 --> M(["error response\n{status:false, message:<constant above>}"])

    classDef client fill:#e5e7eb,stroke:#374151
    classDef mw fill:#bfdbfe,stroke:#1e40af
    classDef svc fill:#fed7aa,stroke:#9a3412
    classDef db fill:#bbf7d0,stroke:#166534
    classDef mail fill:#fbcfe8,stroke:#9d174d
    classDef ok fill:#86efac,stroke:#166534,color:#052e16
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class A client
    class B mw
    class C,D,E,H,K svc
    class F,G,I db
    class J mail
    class L ok
    class B1,D1,E1,K1,M err
```

This is **not wrapped in a database transaction** — each step (existence check, invitation check, insert, email) is a separate operation, unlike `AuthService.acceptInvitation`. The race-safety comes entirely from the partial unique index + the `23505` catch-and-retry, not from an explicit transaction boundary.

## 2. List / search / filter invitations — `GET /admin/invitations`

```mermaid
flowchart TD
    A(["CLIENT\nGET /admin/invitations?page&limit&search&status&role"]) --> B{{"MIDDLEWARE\nrate limit 'general' → authenticate →\nauthorize(ADMIN) → validate query"}}
    B -->|"fail"| B1["401 / 403 / 400"]
    B -->|"ok"| C["REPOSITORY findAllInvitations\nsearch: LOWER(email) LIKE %term% ·\nrole: exact match ·\nstatus → SQL WHERE:\n  REVOKED: revoked_at IS NOT NULL\n  USED: revoked_at IS NULL AND used_at IS NOT NULL\n  EXPIRED: revoked_at IS NULL AND used_at IS NULL\n           AND expires_at <= NOW()\n  PENDING: revoked_at IS NULL AND used_at IS NULL\n           AND expires_at > NOW()\nORDER BY created_at DESC"]
    C --> D["SERVICE computes 'status' per row in JS\n(REVOKED > USED > EXPIRED(expiresAt < now) > PENDING,\nchecked in that priority order — a documented\nSQL-uses-<= vs JS-uses-< discrepancy at the exact\nexpiry instant, covered by a dedicated regression test)"]
    D --> E(["200\n{success:true, message: INVITATIONS_FETCHED,\ndata:[{id,email,role,status,expiresAt,...}],\npagination:{page,limit,total,totalPages}}"])

    classDef client fill:#e5e7eb,stroke:#374151
    classDef mw fill:#bfdbfe,stroke:#1e40af
    classDef svc fill:#fed7aa,stroke:#9a3412
    classDef db fill:#bbf7d0,stroke:#166534
    classDef ok fill:#86efac,stroke:#166534,color:#052e16
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class A client
    class B mw
    class D svc
    class C db
    class E ok
    class B1 err
```

## 3. Revoke an invitation — `POST /admin/invitations/:id/revoke`

```mermaid
flowchart TD
    A(["CLIENT\nPOST /admin/invitations/:id/revoke"]) --> B{{"MIDDLEWARE\nrate limit 'general' → authenticate →\nauthorize(ADMIN) → validate params (id positive int)"}}
    B -->|"fail"| B1["401 / 403 / 400"]
    B -->|"ok"| C["REPOSITORY findById(id)"]
    C --> D{"found?"}
    D -->|"no"| D1["404 INVITATION_NOT_FOUND"]
    D -->|"yes"| E{"already revokedAt set?"}
    E -->|"yes"| E1["409 INVITATION_ALREADY_REVOKED"]
    E -->|"no"| F{"already usedAt set?\n(account already created\nfrom this invitation)"}
    F -->|"yes"| F1["400 CANNOT_REVOKE_USED_INVITATION"]
    F -->|"no"| G["REPOSITORY revokeInvitation\nSET revoked_at = now, updated_by = adminId"]
    G --> H(["200\n{success:true, message: INVITATION_REVOKED_SUCCESSFULLY,\ndata:{...,status:'REVOKED'}}"])
    D1 & E1 & F1 --> I(["error response\n{status:false, message:<constant above>}"])

    classDef client fill:#e5e7eb,stroke:#374151
    classDef mw fill:#bfdbfe,stroke:#1e40af
    classDef svc fill:#fed7aa,stroke:#9a3412
    classDef db fill:#bbf7d0,stroke:#166534
    classDef ok fill:#86efac,stroke:#166534,color:#052e16
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class A client
    class B mw
    class D,E,F svc
    class C,G db
    class H ok
    class B1,D1,E1,F1,I err
```

A revoked invitation cannot itself be un-revoked, and cannot transition to any other state — see [invitation state machine](#invitation-state-machine) below.

## 4. Bulk-invite via CSV — `POST /admin/invitations/bulk`

The one route with **no Joi body validator** — row-level validation happens inside the service, and the CSV/file handling happens in dedicated multer middleware.

```mermaid
flowchart TD
    A(["CLIENT\nPOST /admin/invitations/bulk\nmultipart/form-data, field name 'file'"]) --> B{{"MIDDLEWARE\nrate limit 'invitation' (500/15min) →\nauthenticate → authorize(ADMIN) →\nuploadCsv (multer, memory storage)"}}
    B --> C{"multer checks"}
    C -->|"file > 5MB"| C1["413 'exceeds max size (5MB)'"]
    C -->|"not .csv / not text/csv mimetype"| C2["400 'Only CSV files are allowed'"]
    C -->|"other multer error"| C3["400 (multer's message)"]
    C -->|"ok"| D["CONTROLLER bulkInviteUsers"]
    D --> E{"req.file present?"}
    E -->|"no"| E1["400 CSV_FILE_REQUIRED"]
    E -->|"yes"| F["parse CSV buffer as UTF-8\n(csv-parse/sync, columns:true, trim:true)"]
    F --> G{"rows.length > 500\n(MAX_BULK_INVITE_ROWS)?"}
    G -->|"yes"| G1["400 CSV_ROW_LIMIT_EXCEEDED"]
    G -->|"no"| H["SERVICE bulkInviteUsers(rows, adminId)\n— NOT wrapped in a single transaction;\neach row is independent, so one row's\nfailure never rolls back another's success"]
    H --> I["for each row, in order:"]
    I --> J{"Joi validate {email, role}\n(bulkInviteRowSchema — role must be\nDOCTOR or ADMIN; PATIENT rows always fail here)"}
    J -->|"invalid"| J1["row → FAILED\nreason: Joi message or INVALID_ROW_DATA"]
    J -->|"valid"| K{"email already seen\nEARLIER IN THIS SAME FILE?"}
    K -->|"yes"| K1["row → FAILED\nreason: DUPLICATE_EMAIL_IN_FILE"]
    K -->|"no"| L["reuses the EXACT single-invite logic\nfrom step 1 above (inviteUser):\nuser-exists / invitation-exists / race-proof\ninsert / send email — same checks, same errors"]
    L --> M{"inviteUser succeeded?"}
    M -->|"yes"| M1["row → INVITED"]
    M -->|"threw (409/500/etc.)"| M2["row → FAILED, reason: error.message"]
    J1 & K1 & M1 & M2 --> N{"more rows?"}
    N -->|"yes"| I
    N -->|"no"| O(["200 — ALWAYS 200 if the file itself was\nvalid, regardless of individual row outcomes\n{success:true, message: BULK_INVITATION_COMPLETED,\ndata:{total, successful, failed, results:[\n  {email, role, status:'INVITED'|'FAILED', reason?}\n]}}"])
    C1 & C2 & C3 & E1 & G1 --> P(["error response — the only cases where\nthe WHOLE request fails, not just a row"])

    classDef client fill:#e5e7eb,stroke:#374151
    classDef mw fill:#bfdbfe,stroke:#1e40af
    classDef ctrl fill:#ddd6fe,stroke:#5b21b6
    classDef svc fill:#fed7aa,stroke:#9a3412
    classDef db fill:#bbf7d0,stroke:#166534
    classDef ok fill:#86efac,stroke:#166534,color:#052e16
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class A client
    class B,C mw
    class D,E ctrl
    class F,G,H,I,J,K,M svc
    class L db
    class O ok
    class C1,C2,C3,E1,G1,J1,K1,M2,P err
```

Important distinction this diagram makes explicit: a **whole-request failure** (bad file, too many rows, no file) is a non-200 HTTP response; a **per-row failure** (bad email, duplicate, already invited) is still inside a `200` response, surfaced only in `data.results[i].status === "FAILED"`. The e2e test (`admin-bulk-invite.spec.ts`) exercises exactly this: a 2-row CSV with one good row and one bad row returns `200` with "Successful (1)" / "Failed (1)".

## Invitation state machine

`UserInvitation` has no `status` column — status is **computed live** from three nullable timestamp columns, identically (modulo the `<` vs `<=` boundary noted above) in both the SQL query (`InvitationRepository.findAllInvitations`) and the JS mapper (`AdminService.getAllInvitations`).

```mermaid
stateDiagram-v2
    [*] --> PENDING: created by\nPOST /admin/invite,\nPOST /admin/invitations/bulk (per row), or\nPOST /auth/patient/self-register\n(usedAt=NULL, revokedAt=NULL, expiresAt=+24h)

    PENDING --> USED: POST /auth/accept-invitation\nsucceeds (sets usedAt) — terminal
    PENDING --> EXPIRED: time passes\nexpiresAt <= now (computed, not written)
    PENDING --> REVOKED: admin POST\n/admin/invitations/:id/revoke — terminal

    EXPIRED --> REVOKED: only via the internal race-proof\nretry path (createInvitationRaceProof /\ncreateSelfRegistrationInvitation) when a NEW\ninvite request for the same email collides with\nthis expired-but-still-active row on the unique\nindex — the expired row is auto-revoked, then\na fresh PENDING row is inserted for the new request

    USED --> [*]: no further transition possible\n(revoke attempt → 400 CANNOT_REVOKE_USED_INVITATION)
    REVOKED --> [*]: no further transition possible\n(revoke attempt → 409 INVITATION_ALREADY_REVOKED)
```

`source` (`ADMIN_INVITATION` vs `PATIENT_SELF_REGISTRATION`) only records provenance — both sources feed the identical state machine and the identical `POST /auth/accept-invitation` acceptance endpoint.
