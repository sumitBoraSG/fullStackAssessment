# 06 — Availability Lifecycle

`DoctorAvailability` (`backend/src/database/model/DoctorAvailability.ts`, table `doctor_availabilities`) represents one published block of time a doctor is bookable. Unlike appointments, this entity has **no status column at all** — a row either exists (available, modulo whatever's booked inside it) or it doesn't.

```mermaid
flowchart LR
    A(["Doctor publishes a window\nPOST /doctor/availability"]) --> B["Row exists in doctor_availabilities"]
    B --> C{{"Patients can now book\nappointments inside this window\n(subject to the busy-slot subtraction\ndescribed below)"}}
    C --> D["✗ NO update endpoint exists —\na window can never be resized/moved"]
    C --> E["✗ NO delete endpoint exists —\nsee 'Deletion' below"]
    B -.->|"only way out: never"| F["A published window is permanent\nfor the lifetime of the application"]

    classDef ok fill:#86efac,stroke:#166534,color:#052e16
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class A,B,C ok
    class D,E,F err
```

## Creation — `POST /doctor/availability`

Full request lifecycle diagrammed in [doc 03 §1](./03-doctor-flows.md#1-create-an-availability-window--post-doctoravailability). Summary of the checks, in order: date not in the past → start before end → (if today) start time not already passed → doctor exists (a bare 404 with no custom message — the one place in the codebase that omits one) → insert, relying entirely on a Postgres **GIST exclusion constraint** (`doctor_availability_no_overlap`, `USING GIST (doctor_id WITH =, availability_time WITH &&)`) to reject an overlapping window for the *same* doctor with a `23P01` error, translated to `409 AVAILABILITY_OVERLAP`. There is no application-level "does this overlap?" query — the database is the sole source of truth for this invariant.

Different doctors' windows may freely overlap in time (the constraint is scoped `WITH doctor_id =`, i.e. per-doctor only).

## Modification — does not exist

There is no `PATCH`/`PUT` endpoint for `DoctorAvailability` anywhere in the codebase. The only way to change a published window is to leave it as-is; a doctor who needs a different time must publish a new, non-overlapping window alongside it.

## Deletion — implemented, but unreachable

```mermaid
flowchart TD
    A["DoctorService.deleteAvailability(availabilityId, doctorId)\nbackend/src/service/doctor.service.ts:337-355"] --> B["DoctorRepository.deleteAvailability(availabilityId, doctorId)\nDELETE FROM doctor_availabilities\nWHERE id=:availabilityId AND doctor_id=:doctorId\n(ownership scoped in the WHERE clause itself)"]
    B --> C{"result.affected === 0?\n(either the row doesn't exist,\nor it belongs to a different doctor —\nindistinguishable from the caller's\nperspective, same as every other\nownership check in this app)"}
    C -->|"yes"| D["throws 404 AVAILABILITY_NOT_FOUND"]
    C -->|"no"| E["returns void — deletion succeeded"]
    F["✗ NO ROUTE\n✗ NO CONTROLLER METHOD\ncalls this service method"] -.->|"confirmed by exhaustive grep\nof backend/src for 'deleteAvailability' —\nonly the service+repository definitions exist"| A

    classDef svc fill:#fed7aa,stroke:#9a3412
    classDef db fill:#bbf7d0,stroke:#166534
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class A svc
    class B,E db
    class C,D,F err
```

This is fully-implemented, tested-at-the-repository-level logic that the API surface simply never exposes — a doctor has **no way**, via the frontend or any documented endpoint, to remove a published availability window once created. (Confirmed independently by the frontend agent: `DoctorAvailabilitySection.tsx` calls only `createDoctorAvailabilityApi` and `getOwnDoctorAvailabilityApi` — no delete action exists in the UI, consistent with there being no route to call.)

If this is ever wired up, note the existing service method has **no check for existing appointments booked against the window being deleted** — deleting an availability row does not cascade to or block on the `appointments` that were booked inside it (appointments don't have a foreign key to `doctor_availabilities` at all, only to `doctors` directly). Wiring a delete route without adding that check would let a doctor pull the rug out from under already-confirmed appointments.

## Booking / conflict behavior

Two entirely separate mechanisms are involved, and it's important not to conflate them:

```mermaid
flowchart TD
    subgraph PREVIEW["1 · READ-MODEL PREVIEW (no locking, no enforcement)\nGET /doctors/:doctorId/availability"]
        A["Fetch raw availability_time windows\nfor this doctor (+ optional date filter)"]
        B["Fetch this doctor's active appointments\n(status IN PENDING, CONFIRMED) for the same window\n— CANCELLED/REJECTED/COMPLETED are NOT busy"]
        C["Subtract busy ranges from each\navailability window → free sub-ranges"]
        D["Clamp to 'now': drop fully-elapsed sub-ranges,\nbump partially-elapsed ones forward to\nceil-to-next-minute(now)"]
        A --> C
        B --> C --> D --> E["Returned to the client as\n'free slots' — a snapshot,\nalready stale the instant it's sent"]
    end

    subgraph ENFORCE["2 · ACTUAL ENFORCEMENT (at the database)\nPOST /appointments"]
        F["Application checks the requested range\nis CONTAINED in an availability window\n(a normal query, not a race guard)"]
        G["INSERT the appointment row"]
        H{{"Postgres GIST exclusion constraints\nappointments_no_doctor_overlap /\nappointments_no_patient_overlap\n(both scoped WHERE status IN PENDING,CONFIRMED)"}}
        F --> G --> H
        H -->|"violated (23P01)"| I["409 APPOINTMENT_TIME_UNAVAILABLE\n— this is what actually stops two\npatients booking the same freed slot,\nnot the preview endpoint"]
        H -->|"ok"| J["Row committed — now counts as\n'busy' for every future preview call"]
    end

    E -.->|"client picks a slot from\nthe preview, then submits"| F

    classDef db fill:#bbf7d0,stroke:#166534
    classDef ok fill:#86efac,stroke:#166534,color:#052e16
    classDef err fill:#fca5a5,stroke:#7f1d1d,color:#450a0a
    class A,B,C,D,F,G,H,J db
    class E ok
    class I err
```

**The preview endpoint (`GET /doctors/:id/availability`) never locks or reserves anything** — it's a point-in-time read. Two patients can be shown the same free slot simultaneously; only the `POST /appointments` insert (and its underlying exclusion constraint) decides who actually wins. This exact race is exercised end-to-end by `e2e/tests/patient-booking-conflict.spec.ts`: a conflicting appointment is inserted directly into the database *between* the patient selecting a slot in the UI and submitting the booking, and the submit correctly surfaces `"Appointment time is no longer available"` without closing the modal — proving the frontend handles the 409 from the real enforcement layer, not from the (nonexistent) preview-time lock.

A cancelled appointment's time immediately becomes bookable again in the preview (verified by `doctor-availability-query.test.ts`), since cancellation just changes `status` away from `PENDING`/`CONFIRMED` — the busy-range computation re-evaluates live on every call, there is no cached/denormalized "slots remaining" counter anywhere.
