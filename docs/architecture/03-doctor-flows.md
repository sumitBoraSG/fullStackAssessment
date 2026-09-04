# 03 — Doctor Flows

Every route below is mounted under `/doctor` and requires `authenticate` + `authorize(DOCTOR)`. See [doc 01](./01-authentication-authorization.md) for shared middleware mechanics, [doc 05](./05-appointment-lifecycle.md) for the full appointment state machine, and [doc 06](./06-availability-lifecycle.md) for the availability model in depth.

## 1. Create an availability window — `POST /doctor/availability`

```mermaid
flowchart TD
    A(["CLIENT\nPOST /doctor/availability\n{date, startTime, endTime}"]) --> B{{"MIDDLEWARE\nrate limit 'general' → authenticate →\nauthorize(DOCTOR) → validate body:\ncreateAvailabilitySchema (date YYYY-MM-DD,\nstart/end HH:mm 24h)"}}
    B -->|"fail"| B1["401 / 403 / 400 validation_error"]
    B -->|"ok"| C["SERVICE createAvailability(doctorId, date, start, end)"]
    C --> D{"date < today (IST)?"}
    D -->|"yes"| D1["400 AVAILABILITY_DATE_IN_PAST"]
    D -->|"no"| E{"startTime >= endTime?"}
    E -->|"yes"| E1["400 INVALID_AVAILABILITY_TIME"]
    E -->|"no"| F{"date === today AND\nstartTime <= now (IST)?"}
    F -->|"yes"| F1["400 AVAILABILITY_TIME_IN_PAST"]
    F -->|"no"| G["REPOSITORY findDoctorById(doctorId)"]
    G --> H{"doctor exists?"}
    H -->|"no"| H1["404 — plain 'Not Found'\n(this one check throws createError.NotFound()\nwith NO message argument — the only place in\nthe codebase that omits a custom message)"]
    H -->|"yes"| I["build availabilityTime tstzrange literal"]
    I --> J["REPOSITORY createAvailability\nINSERT INTO doctor_availabilities"]
    J --> K{"Postgres exclusion\nconstraint violated? (23P01 —\noverlaps an existing window for THIS doctor)"}
    K -->|"yes"| K1["409 AVAILABILITY_OVERLAP"]
    K -->|"no"| L(["201\n{success:true, data:{id,doctorId,date,\nstartTime,endTime,createdAt}}"])
    D1 & E1 & F1 & H1 & K1 --> M(["error response\n{status:false, message:<constant above, or\nhttp-errors default 'Not Found' for H1>}"])

    classDef client fill:#e5e7eb,stroke:#374151
    classDef mw fill:#bfdbfe,stroke:#1e40af
    classDef svc fill:#fed7aa,stroke:#9a3412
    classDef db fill:#bbf7d0,stroke:#166534
    classDef ok fill:#86efac,stroke:#166534,color:#052e16
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class A client
    class B mw
    class C,D,E,F,H,K svc
    class G,I,J db
    class L ok
    class B1,D1,E1,F1,H1,K1,M err
```

Overlap prevention is entirely a Postgres `GIST` exclusion constraint (`doctor_availability_no_overlap`) — there is no application-level "does this overlap?" query; the service only catches the resulting `23P01`.

## 2. View own availability — `GET /doctor/availability`

`authenticate → authorize(DOCTOR) → validate query (date optional)` → `DoctorService.getOwnAvailability(doctorId, date?)` → 404 `DOCTOR_NOT_FOUND` if the doctor record is somehow gone, else `findDoctorAvailability` (optionally filtered to one calendar day) → `200 {success:true, data:[{id,date,startTime,endTime}, ...]}`. **This is the raw list — unlike the patient-facing `GET /doctors/:id/availability`, it is not busy-adjusted** (a doctor sees their full published windows here, including ones already booked out; confirmed by `doctor-availability-query.test.ts`).

## 3. View own appointments — `GET /doctor/appointments`

```mermaid
flowchart TD
    A(["CLIENT\nGET /doctor/appointments?page&limit&status&\ndate|dateFrom/dateTo&patientId&sortBy&order"]) --> B{{"MIDDLEWARE\nauthenticate → authorize(DOCTOR) → validate query"}}
    B -->|"fail"| B1["401 / 403 / 400"]
    B -->|"ok"| C["SIDE EFFECT (runs first)\nexpireStalePendingForDoctor(doctorId)\n— auto-REJECTs this doctor's own PENDING requests\nolder than 48h. This is the path that reclaims a\nslot for OTHER patients even if the original\npatient never returns to trigger the patient-side sweep."]
    C --> D{"conflicting date filters?\n(date AND dateFrom/dateTo together,\nor dateFrom > dateTo)"}
    D -->|"yes"| D1["400 INVALID_DATE_FILTER / INVALID_DATE_RANGE"]
    D -->|"no"| E["REPOSITORY findDoctorAppointments\npaginated, filtered, sorted"]
    E --> F(["200\n{success:true, data:{\n  appointments:[{id,status,date,startTime,endTime,\n    createdAt,updatedAt,patient:{patientId,firstName,\n    lastName,email}}],\n  pagination:{page,limit,total,totalPages}\n}}"])
    D1 --> G(["400\n{status:false, message:<constant>}"])

    classDef client fill:#e5e7eb,stroke:#374151
    classDef mw fill:#bfdbfe,stroke:#1e40af
    classDef svc fill:#fed7aa,stroke:#9a3412
    classDef db fill:#bbf7d0,stroke:#166534
    classDef ok fill:#86efac,stroke:#166534,color:#052e16
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class A client
    class B mw
    class C,D svc
    class E db
    class F ok
    class B1,D1,G err
```

Note the doctor-side response nests `patient` (with `email`), whereas the patient-side listing nests `doctor` (without `email`) — an intentional asymmetry, not an inconsistency to "fix".

## 4. Confirm / reject / complete an appointment — `PATCH /doctor/appointments/:appointmentId/status`

The doctor-facing status endpoint accepts exactly `CONFIRMED`, `REJECTED`, or `COMPLETED` (`doctorAppointmentStatusBodySchema`) — a doctor can **never** set `CANCELLED` (that's patient-only) or `PENDING`.

```mermaid
flowchart TD
    A(["CLIENT\nPATCH /doctor/appointments/:id/status\n{status: CONFIRMED | REJECTED | COMPLETED}"]) --> B{{"MIDDLEWARE\nauthenticate → authorize(DOCTOR) →\nvalidate params + body"}}
    B -->|"fail"| B1["401 / 403 / 400"]
    B -->|"ok"| C["REPOSITORY findDoctorAppointmentById(id, doctorId)\n— ownership filter in the WHERE clause"]
    C --> D{"row found\n(exists AND belongs to this doctor)?"}
    D -->|"no"| D1["404 APPOINTMENT_NOT_FOUND"]
    D -->|"yes"| E{"allowed transition?\nPENDING → CONFIRMED or REJECTED ·\nCONFIRMED → COMPLETED ·\neverything else (including any transition\nFROM REJECTED/COMPLETED/CANCELLED) is blocked"}
    E -->|"no"| E1["400 INVALID_STATUS_TRANSITION"]
    E -->|"yes, target CONFIRMED"| F1{"appointment start time\nalready passed?"}
    F1 -->|"yes"| F1e["409 APPOINTMENT_TIME_ALREADY_PASSED"]
    E -->|"yes, target COMPLETED"| F2{"appointment start time\nNOT yet reached?"}
    F2 -->|"yes (too early)"| F2e["409 APPOINTMENT_NOT_YET_STARTED"]
    E -->|"yes, target REJECTED"| G["(no time guard for REJECTED)"]
    F1 -->|"no"| G
    F2 -->|"no"| G
    G --> H["REPOSITORY updateAppointmentStatusByDoctor\ncompare-and-swap:\nUPDATE ... WHERE id=:id AND doctor_id=:did\nAND status=:expectedStatus"]
    H --> I{"affected rows === 0?\n(lost a race to another\nconcurrent status update)"}
    I -->|"yes"| I1["409 APPOINTMENT_STATUS_CONFLICT"]
    I -->|"no"| J["EMAIL — one of, based on the transition:\nPENDING→CONFIRMED: sendAppointmentConfirmedEmail\nPENDING→REJECTED: sendAppointmentDeclinedEmail\nCONFIRMED→COMPLETED: sendAppointmentCompletedEmail\n(patient is always the recipient; failure is\nlogged and swallowed, never fails the request)"]
    J --> K(["200\n{success:true, data:{id,status:<new>,...}}"])
    D1 & E1 & F1e & F2e & I1 --> L(["error response\n{status:false, message:<constant above>}"])

    classDef client fill:#e5e7eb,stroke:#374151
    classDef mw fill:#bfdbfe,stroke:#1e40af
    classDef svc fill:#fed7aa,stroke:#9a3412
    classDef db fill:#bbf7d0,stroke:#166534
    classDef mail fill:#fbcfe8,stroke:#9d174d
    classDef ok fill:#86efac,stroke:#166534,color:#052e16
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class A client
    class B mw
    class D,E,F1,F2 svc
    class C,H db
    class J mail
    class K ok
    class B1,D1,E1,F1e,F2e,I1,L err
```

See [doc 05](./05-appointment-lifecycle.md) for the complete transition table including the patient-side `CANCELLED` path and the system-driven stale-`PENDING` auto-expiry.

## 5. View / update profile — `GET` / `PATCH /doctor/profile`

```mermaid
flowchart TD
    subgraph GET["GET /doctor/profile"]
        A1(["authenticate → authorize(DOCTOR)"]) --> A2["findDoctorById → 404 DOCTOR_NOT_FOUND if absent"] --> A3(["200 {id,firstName,lastName,email,\nspecialization,experienceYears}"])
    end
    subgraph PATCH["PATCH /doctor/profile — {experienceYears}"]
        B1(["authenticate → authorize(DOCTOR) →\nvalidate: experienceYears integer 0-80, REQUIRED\n— this is the ONLY field this endpoint accepts;\nany other key (e.g. specializationId) is REJECTED\nby Joi's default unknown-key behavior"]) --> B2{"validation ok?"}
        B2 -->|"no"| B2e["400 (missing, out of 0-80 range,\nor an unrecognized field like specializationId)"]
        B2 -->|"yes"| B3["findDoctorById → 404 if absent"]
        B3 --> B4["REPOSITORY updateExperienceYears(doctorId, value)"]
        B4 --> B5(["200 — updated profile, same shape as GET"])
    end

    classDef mw fill:#bfdbfe,stroke:#1e40af
    classDef svc fill:#fed7aa,stroke:#9a3412
    classDef db fill:#bbf7d0,stroke:#166534
    classDef ok fill:#86efac,stroke:#166534,color:#052e16
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class A1,B1 mw
    class B2 svc
    class A2,B3,B4 db
    class A3,B5 ok
    class B2e err
```

Specialization is **permanent after signup** — there is no endpoint, for the doctor or for an admin, that can change it (verified by `doctor.test.ts`: sending `specializationId` in the PATCH is rejected, and a follow-up GET confirms the specialization is unchanged).

## Availability deletion — does not exist as an API

`DoctorService.deleteAvailability(availabilityId, doctorId)` and `DoctorRepository.deleteAvailability` are fully implemented (ownership-scoped delete, 404 `AVAILABILITY_NOT_FOUND` if the row doesn't exist or belongs to another doctor) — **but no route or controller ever calls them.** A doctor has no way to remove a published availability window via the API today. See [doc 06](./06-availability-lifecycle.md#deletion--implemented-but-unreachable) for the full detail.
