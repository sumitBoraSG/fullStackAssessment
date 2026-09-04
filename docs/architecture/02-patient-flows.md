# 02 — Patient Flows

Every route below except `GET /doctors/specializations` requires `authenticate` + `authorize(PATIENT)` (for `/doctors` discovery routes: `authorize(PATIENT, DOCTOR, ADMIN)` — they're shared, not patient-exclusive). See [doc 01](./01-authentication-authorization.md) for the shared middleware mechanics and [doc 05](./05-appointment-lifecycle.md) for the full appointment state machine.

## 1. Browse / search / filter doctors — `GET /doctors`

A genuine server-side search with three simultaneous, independent filters (confirmed against `PatientDoctorDiscovery.tsx`'s actual rendered controls: a name-search text box, a specialization `<select>`, and a native date picker) plus pagination — not a static list.

```mermaid
flowchart TD
    A(["CLIENT\nGET /doctors?search=&specialization=&date=&page=&limit="]) --> B{{"MIDDLEWARE\nrate limit 'general' → authenticate →\nauthorize(PATIENT,DOCTOR,ADMIN) →\nvalidate query: getDoctorsQuerySchema"}}
    B -->|"auth fail"| B1["401 / 403"]
    B -->|"validation fail"| B2["400 validation_error\n(search/specialization max 100 chars,\ndate must be YYYY-MM-DD, limit 1-100)"]
    B -->|"ok"| C["CONTROLLER getDoctors\npage default 1, limit default 10"]
    C --> D["SERVICE DoctorService.getDoctors(options)"]
    D --> E["REPOSITORY findAllDoctors\nbase: doctors JOIN users JOIN specialization\nWHERE user.deleted_at IS NULL"]
    E --> F{"search provided?"}
    F -->|"yes"| F1["AND LOWER(first/last/full name) LIKE %search%"]
    F -->|"no"| G
    F1 --> G{"specialization provided?"}
    G -->|"numeric string"| G1["AND specialization.id = :id"]
    G -->|"text"| G2["AND LOWER(specialization.name) LIKE %text%"]
    G -->|"no"| H
    G1 & G2 --> H{"date provided?"}
    H -->|"yes"| H1["AND doctor.id IN (subquery:\nany doctor_availabilities row overlapping\nthat calendar day — raw, NOT busy-adjusted)"]
    H -->|"no"| I
    H1 --> I["ORDER BY user.firstName ASC\nskip/take · getManyAndCount()"]
    I --> J["map each row → {id, firstName, lastName,\nspecialization (name, default 'General Practitioner'),\nexperienceYears}"]
    J --> K(["200\n{success:true, data:{doctors:[...],\npagination:{page,limit,total,totalPages}}}"])

    classDef client fill:#e5e7eb,stroke:#374151
    classDef mw fill:#bfdbfe,stroke:#1e40af
    classDef ctrl fill:#ddd6fe,stroke:#5b21b6
    classDef svc fill:#fed7aa,stroke:#9a3412
    classDef db fill:#bbf7d0,stroke:#166534
    classDef ok fill:#86efac,stroke:#166534,color:#052e16
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class A client
    class B mw
    class C ctrl
    class D,F,G,H svc
    class E,F1,G1,G2,H1,I,J db
    class K ok
    class B1,B2 err
```

An empty result set is **not an error** — 200 with `doctors: []` and `total: 0`.

## 2. View a doctor's free slots — `GET /doctors/:doctorId/availability`

This is a **read-model preview**, not a reservation — it does not lock or hold anything. The actual non-overlap guarantee is enforced later, at booking time, by the database (see step 4 and [doc 06](./06-availability-lifecycle.md)).

```mermaid
flowchart TD
    A(["CLIENT\nGET /doctors/:doctorId/availability?date="]) --> B{{"MIDDLEWARE\nauthenticate → authorize(PATIENT,DOCTOR,ADMIN) →\nvalidate query: date optional, YYYY-MM-DD"}}
    B -->|"fail"| B1["401 / 403 / 400"]
    B -->|"ok"| C["SERVICE getDoctorAvailability(doctorId, date)"]
    C --> D["REPOSITORY findDoctorById\nWHERE doctorId=:id AND user.deleted_at IS NULL"]
    D --> E{"doctor exists?"}
    E -->|"no"| E1(["404 DOCTOR_NOT_FOUND"])
    E -->|"yes"| F["REPOSITORY findDoctorAvailability(doctorId, date)\n— raw availability_time windows"]
    F --> G["REPOSITORY findActiveAppointmentsForDoctor(doctorId, date)\nWHERE status IN (PENDING, CONFIRMED)"]
    G --> H["compute busyRanges from those appointments"]
    H --> I["for each raw availability window:\nsubtract every overlapping busy range\n→ 0, 1, or more free sub-ranges"]
    I --> J["clamp each free sub-range to 'now':\nfully-elapsed → dropped entirely ·\npartially-elapsed → start bumped forward\nto ceil-to-next-minute(now)"]
    J --> K(["200\n{success:true, data:{\n  doctor:{id,firstName,lastName,specialization,experienceYears},\n  availability:[{id,date,startTime,endTime}, ...]\n}}"])
    E1 --> L(["404\n{status:false, message: DOCTOR_NOT_FOUND}"])

    classDef client fill:#e5e7eb,stroke:#374151
    classDef mw fill:#bfdbfe,stroke:#1e40af
    classDef svc fill:#fed7aa,stroke:#9a3412
    classDef db fill:#bbf7d0,stroke:#166534
    classDef ok fill:#86efac,stroke:#166534,color:#052e16
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class A client
    class B mw
    class C,E svc
    class D,F,G,H,I,J db
    class K ok
    class B1,E1,L err
```

`CANCELLED`, `REJECTED`, and `COMPLETED` appointments are **not** treated as busy — only `PENDING`/`CONFIRMED` subtract from availability. A slot freed by a cancellation reappears here immediately (verified by `doctor-availability-query.test.ts`).

## 3. View specializations — `GET /doctors/specializations`

The **only** unauthenticated resource endpoint in the app (deliberately — the not-yet-registered accept-invitation page needs it). `rate limit 'general'` only, no `authenticate`/`authorize`. Returns `{success:true, data:[{id,name,description}]}` for every `Specialization` row where `isActive = true`, ordered by name. No error path beyond the rate limiter.

## 4. Book an appointment — `POST /appointments`

The most involved endpoint in the whole system: 3 pre-checks, 2 existence checks, a side-effect sweep, an availability check, then a **database transaction** holding a Postgres advisory lock while two abuse-prevention caps are evaluated, guarded on the outside by a DB exclusion constraint. See [doc 05](./05-appointment-lifecycle.md#booking-abuse-limits) for why the caps exist and how the lock makes them race-safe.

```mermaid
flowchart TD
    A(["CLIENT\nPOST /appointments\n{doctorId, date, startTime, endTime}"]) --> B{{"MIDDLEWARE\nrate limit 'general' → authenticate →\nauthorize(PATIENT) → validate body:\ncreateAppointmentSchema (doctorId positive int,\ndate YYYY-MM-DD, start/end HH:mm)"}}
    B -->|"fail"| B1["401 / 403 / 400 validation_error"]
    B -->|"ok"| C["SERVICE createAppointment(patientId, doctorId, date, start, end)"]
    C --> D{"date < today (IST)?"}
    D -->|"yes"| D1["400 APPOINTMENT_DATE_IN_PAST"]
    D -->|"no"| E{"startTime >= endTime?"}
    E -->|"yes"| E1["400 INVALID_APPOINTMENT_TIME"]
    E -->|"no"| F{"date === today AND\nstartTime <= now (IST)?"}
    F -->|"yes"| F1["400 APPOINTMENT_TIME_IN_PAST"]
    F -->|"no"| G["REPOSITORY findDoctorById"]
    G --> H{"doctor exists?"}
    H -->|"no"| H1["404 DOCTOR_NOT_FOUND"]
    H -->|"yes"| I["REPOSITORY findPatientById"]
    I --> J{"patient exists?"}
    J -->|"no"| J1["404 PATIENT_NOT_FOUND"]
    J -->|"yes"| K["SIDE EFFECT: expireStalePendingForPatient(patientId)\n— auto-REJECTs any of this patient's own PENDING\nrequests older than 48h, across ALL doctors,\nso a forgotten request can't block these checks\n(see doc 05). Fires a 'declined' email per row expired."]
    K --> L["build appointmentTime tstzrange literal"]
    L --> M["REPOSITORY findDoctorAvailabilityForAppointment\n(does an availability window CONTAIN this exact range?)"]
    M --> N{"covered by an\navailability window?"}
    N -->|"no"| N1["409 DOCTOR_NOT_AVAILABLE"]
    N -->|"yes"| O["BEGIN TRANSACTION"]
    O --> P["acquirePatientBookingLock(patientId)\nSELECT pg_advisory_xact_lock(ns, patientId)\n— serializes ALL of this patient's concurrent\nbooking attempts, across any doctor"]
    P --> Q["COUNT active (PENDING/CONFIRMED, not-yet-ended)\nappointments for (patientId, doctorId)"]
    Q --> R{"count >= MAX_ACTIVE_APPOINTMENTS_PER_DOCTOR (2)?"}
    R -->|"yes"| R1["409 MAX_ACTIVE_APPOINTMENTS_PER_DOCTOR_EXCEEDED\nROLLBACK"]
    R -->|"no"| S["COUNT active appointments for patientId\n(across ALL doctors)"]
    S --> T{"count >= MAX_ACTIVE_APPOINTMENTS_TOTAL (5)?"}
    T -->|"yes"| T1["409 MAX_ACTIVE_APPOINTMENTS_TOTAL_EXCEEDED\nROLLBACK"]
    T -->|"no"| U["INSERT appointments row, status=PENDING"]
    U --> V{"Postgres exclusion\nconstraint violated?\n(23P01 — another active appointment\nnow overlaps this exact time range,\nfor this doctor OR this patient)"}
    V -->|"yes"| V1["409 APPOINTMENT_TIME_UNAVAILABLE\nROLLBACK"]
    V -->|"no"| W["COMMIT — advisory lock released"]
    W --> X["EMAIL notifyAppointmentRequested\n→ patient: request-confirmation email\n→ doctor: new-request email\n(both awaited; a delivery failure is\nlogged and swallowed, never fails the request)"]
    X --> Y(["201\n{success:true, data:{id,status:'PENDING',date,\nstartTime,endTime,createdAt,updatedAt,\ndoctor:{doctorId,firstName,lastName,\nspecialization,experienceYears}}}"])
    D1 & E1 & F1 & H1 & J1 & N1 & R1 & T1 & V1 --> Z(["error response\n{status:false, message:<constant above>}"])

    classDef client fill:#e5e7eb,stroke:#374151
    classDef mw fill:#bfdbfe,stroke:#1e40af
    classDef svc fill:#fed7aa,stroke:#9a3412
    classDef db fill:#bbf7d0,stroke:#166534
    classDef mail fill:#fbcfe8,stroke:#9d174d
    classDef ok fill:#86efac,stroke:#166534,color:#052e16
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class A client
    class B mw
    class C,D,E,F,H,J,K,N,R,T,V svc
    class G,I,L,M,O,P,Q,S,U,W db
    class X mail
    class Y ok
    class B1,D1,E1,F1,H1,J1,N1,R1,T1,V1,Z err
```

**Why the lock is on `patientId` alone, not `(patientId, doctorId)`**: a plain `SELECT COUNT(*)` inside a transaction cannot see another concurrent transaction's uncommitted insert (READ COMMITTED). Locking on the patient id serializes *every* booking attempt by that one patient — sufficient to make both cap checks race-safe, since the patient is the only actor who could jointly violate their own caps. See `backend/src/database/repository/appointment.repository.ts` (`acquirePatientBookingLock`) and [doc 05](./05-appointment-lifecycle.md#booking-abuse-limits) for the full reasoning.

**Known frontend bug** (not a backend issue): `AppointmentBookingModal`'s own in-modal "Appointment requested successfully!" message is almost never visible — `onSuccess()` runs synchronously right after `setSuccessMsg(...)`, which switches `DashboardPage`'s active tab and unmounts the modal before the message can render. The booking itself succeeds; only the transient success toast inside the modal is effectively dead code. Documented in `e2e/tests/patient-booking.spec.ts` (lines 107-121), which instead asserts the new appointment shows up under "My Appointments" as "Pending Approval".

## 5. View own appointments — `GET /appointments`

```mermaid
flowchart TD
    A(["CLIENT\nGET /appointments?page&limit&status&date|dateFrom/dateTo&doctorId&sortBy&order"]) --> B{{"MIDDLEWARE\nauthenticate → authorize(PATIENT) →\nvalidate query"}}
    B -->|"fail"| B1["401 / 403 / 400"]
    B -->|"ok"| C["SIDE EFFECT (runs BEFORE the query)\nexpireStalePendingForPatient(patientId)\n— same 48h auto-reject sweep as booking,\nso a stale request never shows as PENDING here"]
    C --> D{"both 'date' AND\n'dateFrom/dateTo' given?"}
    D -->|"yes"| D1["400 INVALID_DATE_FILTER"]
    D -->|"no"| E{"dateFrom > dateTo?"}
    E -->|"yes"| E1["400 INVALID_DATE_RANGE"]
    E -->|"no"| F["REPOSITORY findPatientAppointments\npaginated, filtered, sorted\n(default sort: appointmentTime ASC)"]
    F --> G(["200\n{success:true, data:{\n  appointments:[{id,status,date,startTime,endTime,\n    createdAt,updatedAt,doctor:{...}}],\n  pagination:{page,limit,total,totalPages}\n}}"])
    D1 & E1 --> H(["400\n{status:false, message:<constant>}"])

    classDef client fill:#e5e7eb,stroke:#374151
    classDef mw fill:#bfdbfe,stroke:#1e40af
    classDef svc fill:#fed7aa,stroke:#9a3412
    classDef db fill:#bbf7d0,stroke:#166534
    classDef ok fill:#86efac,stroke:#166534,color:#052e16
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class A client
    class B mw
    class C,D,E svc
    class F db
    class G ok
    class B1,D1,E1,H err
```

## 6. Cancel an appointment — `PATCH /appointments/:appointmentId/status`

The patient-facing status endpoint accepts **exactly one** target status: `CANCELLED` — enforced twice, once by the Joi schema (`patientAppointmentStatusBodySchema` only allows the literal `"CANCELLED"`) and again inside the service.

```mermaid
flowchart TD
    A(["CLIENT\nPATCH /appointments/:id/status\n{status:'CANCELLED'}"]) --> B{{"MIDDLEWARE\nauthenticate → authorize(PATIENT) →\nvalidate params (id positive int) →\nvalidate body (status must literally be CANCELLED)"}}
    B -->|"fail"| B1["401 / 403 / 400"]
    B -->|"ok"| C["REPOSITORY findPatientAppointmentById(id, patientId)\n— ownership filter baked into the WHERE clause"]
    C --> D{"row found\n(exists AND belongs to this patient)?"}
    D -->|"no"| D1["404 APPOINTMENT_NOT_FOUND\n(identical whether it doesn't exist\nor belongs to someone else)"]
    D -->|"yes"| E{"requested status === CANCELLED?\n(redundant with Joi, checked again)"}
    E -->|"no"| E1["400 PATIENT_CAN_ONLY_CANCEL"]
    E -->|"yes"| F{"current status IN\n(PENDING, CONFIRMED)?"}
    F -->|"no (already REJECTED/\nCOMPLETED/CANCELLED)"| F1["400 INVALID_STATUS_TRANSITION"]
    F -->|"yes"| G{"appointment start time\nalready passed?"}
    G -->|"yes"| G1["409 CANNOT_CANCEL_PAST_APPOINTMENT"]
    G -->|"no"| H["REPOSITORY updateAppointmentStatusByPatient\ncompare-and-swap:\nUPDATE ... WHERE id=:id AND patient_id=:pid\nAND status=:expectedStatus"]
    H --> I{"affected rows === 0?\n(another request changed it\nbetween the read and this write)"}
    I -->|"yes"| I1["409 APPOINTMENT_STATUS_CONFLICT"]
    I -->|"no"| J["EMAIL notifyAppointmentCancelledByPatient\n→ doctor receives a cancellation email"]
    J --> K(["200\n{success:true, data:{id,status:'CANCELLED',...}}"])
    D1 & E1 & F1 & G1 & I1 --> L(["error response\n{status:false, message:<constant above>}"])

    classDef client fill:#e5e7eb,stroke:#374151
    classDef mw fill:#bfdbfe,stroke:#1e40af
    classDef svc fill:#fed7aa,stroke:#9a3412
    classDef db fill:#bbf7d0,stroke:#166534
    classDef mail fill:#fbcfe8,stroke:#9d174d
    classDef ok fill:#86efac,stroke:#166534,color:#052e16
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class A client
    class B mw
    class D,E,F,G,I svc
    class C,H db
    class J mail
    class K ok
    class B1,D1,E1,F1,G1,I1,L err
```

## 7. View / update profile — `GET` / `PATCH /patient/profile`

```mermaid
flowchart TD
    subgraph GET["GET /patient/profile"]
        A1(["authenticate → authorize(PATIENT)"]) --> A2["findByPatientId → 404 PATIENT_NOT_FOUND if absent"] --> A3(["200 {id,firstName,lastName,email,\nheightCm,weightKg,bloodGroup,dob}"])
    end
    subgraph PATCH["PATCH /patient/profile — {heightCm?, weightKg?}"]
        B1(["authenticate → authorize(PATIENT) →\nvalidate: heightCm 30-300, weightKg 2-500,\nat least ONE of the two required,\nUNKNOWN KEYS REJECTED (bloodGroup/dob\ncannot be changed after signup)"]) --> B2{"validation ok?"}
        B2 -->|"no"| B2e["400 (empty body, out-of-range,\nor unknown key like bloodGroup)"]
        B2 -->|"yes"| B3["re-fetch existing patient\n(404 if somehow gone)"]
        B3 --> B4["build definedUpdates: only include\nfields that are !== undefined\n(a field omitted from the PATCH\nmust NOT be overwritten with NULL)"]
        B4 --> B5["REPOSITORY updateProfile(patientId, definedUpdates)"]
        B5 --> B6(["200 — updated profile, same shape as GET"])
    end

    classDef mw fill:#bfdbfe,stroke:#1e40af
    classDef svc fill:#fed7aa,stroke:#9a3412
    classDef db fill:#bbf7d0,stroke:#166534
    classDef ok fill:#86efac,stroke:#166534,color:#052e16
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class A1,B1 mw
    class B2,B4 svc
    class A2,B3,B5 db
    class A3,B6 ok
    class B2e err
```

`dob` and `bloodGroup` are permanent after signup — there is no endpoint that can change them (confirmed by `patient.test.ts`'s unknown-key-rejection assertions and `e2e/tests/profile-updates.spec.ts`, which shows them as read-only in the UI).
