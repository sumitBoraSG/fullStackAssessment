# 07 — Cross-Role Sequence Diagrams

Every diagram below is grounded in a real, passing test (integration or e2e) — cited under each one — not an idealized journey.

**Patient ↔ Admin has no direct interaction anywhere in this system.** Admin can only invite `DOCTOR`/`ADMIN` roles ([doc 04](./04-admin-flows.md)); patients exist solely via self-registration and never appear in any admin-facing screen or endpoint. No sequence diagram is drawn for it, per the instruction not to invent flows that don't exist.

## 1. Patient books, Doctor confirms

```mermaid
sequenceDiagram
    actor Patient
    participant Frontend
    participant API as API (Express)
    participant Service as AppointmentService
    participant DB as PostgreSQL
    participant Email as SMTP
    actor Doctor

    Patient->>Frontend: Click "Book Appointment" on a doctor's card
    Frontend->>API: GET /doctors/:id/availability
    API-->>Frontend: 200 free slots (busy-adjusted preview)
    Patient->>Frontend: Pick a slot, "Confirm Appointment Request"
    Frontend->>API: POST /appointments {doctorId, date, startTime, endTime}
    API->>Service: createAppointment(...)
    Service->>DB: validations + advisory-lock transaction\n(see doc 05 — booking-abuse caps)
    DB-->>Service: INSERT committed, status=PENDING
    Service-->>API: appointment (PENDING)
    API-->>Frontend: 201 Created
    Frontend-->>Patient: Appears under "My Appointments" as "Pending Approval"\n(the modal's own in-line success message is\npractically never seen — see doc 02, known frontend bug)

    par async, does not block the 201 above
        Service--)Email: sendAppointmentRequestedPatientEmail
        Email--)Patient: "Your request has been sent"
    and
        Service--)Email: sendAppointmentRequestedDoctorEmail
        Email--)Doctor: "New appointment request"
    end

    Doctor->>Frontend: Open "My Appointments", see "Pending Request"
    Doctor->>Frontend: Click "Confirm" → confirm modal
    Frontend->>API: PATCH /doctor/appointments/:id/status {status:CONFIRMED}
    API->>Service: updateAppointmentStatus(id, doctorId, CONFIRMED)
    Service->>DB: guard: start time not yet passed →\ncompare-and-swap UPDATE (PENDING→CONFIRMED)
    DB-->>Service: affected=1
    Service--)Email: sendAppointmentConfirmedEmail
    Email--)Patient: "Your appointment is confirmed"
    Service-->>API: appointment (CONFIRMED)
    API-->>Frontend: 200 OK
    Frontend-->>Doctor: badge → "Confirmed"

    Patient->>Frontend: (separately) refreshes "My Appointments"
    Frontend->>API: GET /appointments
    API-->>Frontend: 200 — this appointment now shows "Confirmed"
```

Grounded in `e2e/tests/patient-booking.spec.ts` + `e2e/tests/doctor-confirms-appointment.spec.ts` (run as two separate browser contexts, exactly as split above).

## 2. Patient books, Doctor rejects

```mermaid
sequenceDiagram
    actor Patient
    participant API as API
    participant Service as AppointmentService
    actor Doctor
    participant Email as SMTP

    Note over Patient,Doctor: Booking + request-email steps identical to Sequence 1

    Doctor->>API: PATCH /doctor/appointments/:id/status {status:REJECTED}
    API->>Service: updateAppointmentStatus(id, doctorId, REJECTED)
    Service->>Service: guard: current status PENDING? (no time guard for REJECTED)
    Service->>Service: compare-and-swap UPDATE (PENDING→REJECTED)
    Service--)Email: sendAppointmentDeclinedEmail
    Email--)Patient: "Your appointment request was declined"
    Service-->>API: appointment (REJECTED)
    API-->>Doctor: 200 — badge becomes "Declined"

    Patient->>API: GET /appointments
    API-->>Patient: 200 — badge shows "Declined"\n(no "Cancel Appointment" button offered —\nREJECTED is terminal, not cancellable)
```

Grounded in `e2e/tests/doctor-rejects-appointment.spec.ts`, which explicitly asserts the patient sees no cancel action on a declined appointment.

## 3. Patient cancels a confirmed appointment

```mermaid
sequenceDiagram
    actor Patient
    participant API as API
    participant Service as AppointmentService
    participant DB as PostgreSQL
    participant Email as SMTP
    actor Doctor

    Note over Patient,DB: Appointment already CONFIRMED

    Patient->>API: PATCH /appointments/:id/status {status:CANCELLED}
    API->>Service: cancelAppointment(id, patientId, CANCELLED)
    Service->>DB: ownership lookup + guards:\nstatus is CANCELLED? current is PENDING/CONFIRMED?\nstart time not yet passed?
    DB-->>Service: guards pass
    Service->>DB: compare-and-swap UPDATE (CONFIRMED→CANCELLED)
    DB-->>Service: affected=1
    Service--)Email: sendAppointmentCancelledEmail
    Email--)Doctor: "Appointment cancelled by patient"
    Service-->>API: appointment (CANCELLED)
    API-->>Patient: 200 — badge → "Cancelled"

    Doctor->>API: GET /doctor/appointments
    API-->>Doctor: 200 — shows "Cancelled by Patient" + patient's name
```

Grounded in `e2e/tests/patient-cancels-appointment.spec.ts`.

## 4. Doctor completes a past appointment

```mermaid
sequenceDiagram
    actor Doctor
    participant API as API
    participant Service as AppointmentService
    participant Email as SMTP
    actor Patient

    Note over Doctor,Patient: Appointment is CONFIRMED and its scheduled\ntime has already elapsed — the "Complete Visit"\nbutton is enabled only once this is true\n(frontend disables it beforehand, per DoctorAppointmentsSection.tsx)

    Doctor->>API: PATCH /doctor/appointments/:id/status {status:COMPLETED}
    API->>Service: updateAppointmentStatus(id, doctorId, COMPLETED)
    Service->>Service: guard: start time HAS passed (else 409 APPOINTMENT_NOT_YET_STARTED)
    Service->>Service: compare-and-swap UPDATE (CONFIRMED→COMPLETED)
    Service--)Email: sendAppointmentCompletedEmail
    Email--)Patient: "Your appointment has been completed"
    Service-->>API: appointment (COMPLETED)
    API-->>Doctor: 200 — badge → "Completed" (terminal)
```

Grounded in `e2e/tests/doctor-completes-past-appointment.spec.ts` (which must seed a past-dated CONFIRMED row directly in the DB, since the UI itself has no way to reach "CONFIRMED + already past" through normal booking timing in a short-lived test run).

## 5. Admin invites a Doctor → Doctor accepts → publishes availability

```mermaid
sequenceDiagram
    actor Admin
    participant API as API
    participant AdminSvc as AdminService
    participant AuthSvc as AuthService
    participant DB as PostgreSQL
    participant Email as SMTP
    actor Doctor as Invitee (Doctor)

    Admin->>API: POST /admin/invite {email, role:DOCTOR}
    API->>AdminSvc: inviteUser(email, DOCTOR, adminId)
    AdminSvc->>DB: user-exists? pending-invitation-exists?\nrace-proof INSERT user_invitations (PENDING)
    DB-->>AdminSvc: invitation row created
    AdminSvc--)Email: sendInvitationEmail(raw token, source=ADMIN_INVITATION)
    Email--)Doctor: invitation link containing the raw token
    AdminSvc-->>API: {id,email,role,expiresAt}
    API-->>Admin: 201 Created — row appears as "Pending" in the admin table

    Doctor->>API: GET /auth/invitation/:token\n(AcceptInvitationPage on mount)
    API->>AuthSvc: getInvitationDetails(token)
    AuthSvc->>DB: hash token, look up (no lock, no consumption)
    DB-->>AuthSvc: {email, role: DOCTOR}
    AuthSvc-->>API: {email, role}
    API-->>Doctor: 200 — form renders DOCTOR-specific fields\n(specialization dropdown populated via\nGET /doctors/specializations, experience years)

    Doctor->>API: POST /auth/accept-invitation\n{token, firstName, lastName, password,\nspecializationId, experienceYears}
    API->>AuthSvc: acceptInvitation(...)
    AuthSvc->>DB: BEGIN — SELECT...FOR UPDATE the invitation row
    AuthSvc->>DB: validate state, validate doctor profile fields,\nCREATE users row + doctors row, markAsUsed
    DB-->>AuthSvc: COMMIT
    AuthSvc-->>API: {id,firstName,lastName,email,role}
    API-->>Doctor: 201 Created → redirected to /login after ~1.2s

    Doctor->>API: POST /auth/login {email, password}
    API-->>Doctor: 200 — accessToken + refreshToken cookies set

    Doctor->>API: POST /doctor/availability {date, startTime, endTime}
    API-->>Doctor: 201 Created — now bookable by patients
```

Grounded end-to-end in `e2e/tests/doctor-onboarding.spec.ts` (which seeds the invitation token directly rather than reading real SMTP, since — per `admin-bulk-invite.spec.ts`'s comment — this environment has no test-mode SMTP catcher and invites go out over real Gmail SMTP). The individual steps are each verified in isolation by `admin-invitations.test.ts` and `invitation.test.ts`.

**The patient-self-registration variant of step 2 onward is identical from `GET /auth/invitation/:token` onward**, except there is no Admin actor at all — the invitation's `source` is `PATIENT_SELF_REGISTRATION` and it was created by the patient themselves via `POST /auth/patient/self-register` ([doc 01](./01-authentication-authorization.md#4-post-authpatientself-register)), not by an admin action.
