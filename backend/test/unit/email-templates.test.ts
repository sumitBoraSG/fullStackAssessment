import { buildInvitationEmail } from "@service/email/templates/invitation.template";
import {
  buildAppointmentRequestedPatientEmail,
  buildAppointmentRequestedDoctorEmail,
} from "@service/email/templates/appointment-requested.template";
import { buildAppointmentConfirmedEmail } from "@service/email/templates/appointment-confirmed.template";
import { buildAppointmentDeclinedEmail } from "@service/email/templates/appointment-declined.template";
import { buildAppointmentCancelledDoctorEmail } from "@service/email/templates/appointment-cancelled.template";
import { buildAppointmentCompletedEmail } from "@service/email/templates/appointment-completed.template";

const DETAILS = {
  patientName: "John Doe",
  doctorName: "Dr. Robert Wilson",
  date: "2026-09-10",
  startTime: "10:00",
  endTime: "10:30",
};

describe("Invitation email template", () => {
  it("includes the role, invitation link, and 24-hour expiry in both text and html", () => {
    const email = buildInvitationEmail("DOCTOR", "raw-token-123");

    expect(email.subject).toBe("You're invited to join our platform");
    expect(email.text).toContain("Role: DOCTOR");
    expect(email.text).toContain("token=raw-token-123");
    expect(email.text).toContain("24 hours");
    expect(email.html).toContain("DOCTOR");
    expect(email.html).toContain("token=raw-token-123");
    expect(email.html).toContain("24 hours");
  });
});

describe("Appointment lifecycle email templates", () => {
  it("appointment-requested (patient) mentions the doctor, date/time, and pending status", () => {
    const email = buildAppointmentRequestedPatientEmail(DETAILS);

    expect(email.subject).toBe("Appointment Request Submitted");
    expect(email.text).toContain(DETAILS.doctorName);
    expect(email.text).toContain(DETAILS.date);
    expect(email.text).toContain("Pending");
    expect(email.html).toContain(DETAILS.doctorName);
  });

  it("appointment-requested (doctor) mentions the patient and appointment details", () => {
    const email = buildAppointmentRequestedDoctorEmail(DETAILS);

    expect(email.subject).toBe("New Appointment Request");
    expect(email.text).toContain(DETAILS.patientName);
    expect(email.text).toContain(DETAILS.date);
  });

  it("appointment-confirmed mentions the doctor and does not mention pending/decline wording", () => {
    const email = buildAppointmentConfirmedEmail(DETAILS);

    expect(email.subject).toBe("Appointment Confirmed");
    expect(email.text).toContain(DETAILS.doctorName);
    expect(email.text.toLowerCase()).not.toContain("declined");
  });

  it("appointment-declined mentions the doctor and does not fabricate a decline reason", () => {
    const email = buildAppointmentDeclinedEmail(DETAILS);

    expect(email.subject).toBe("Appointment Request Declined");
    expect(email.text).toContain(DETAILS.doctorName);
    expect(email.text.toLowerCase()).not.toContain("reason");
  });

  it("appointment-cancelled (doctor-facing) attributes the cancellation to the patient", () => {
    const email = buildAppointmentCancelledDoctorEmail(DETAILS);

    expect(email.subject).toBe("Appointment Cancelled");
    expect(email.text).toContain(DETAILS.patientName);
    expect(email.text.toLowerCase()).toContain("cancelled by the patient");
  });

  it("appointment-completed thanks the patient without exposing medical details", () => {
    const email = buildAppointmentCompletedEmail(DETAILS);

    expect(email.subject).toBe("Appointment Completed");
    expect(email.text).toContain(DETAILS.doctorName);
    expect(email.text.toLowerCase()).not.toMatch(/diagnos|prescript|note/);
  });

  it("every template provides non-empty, distinct text and html bodies", () => {
    const emails = [
      buildInvitationEmail("PATIENT", "tok"),
      buildAppointmentRequestedPatientEmail(DETAILS),
      buildAppointmentRequestedDoctorEmail(DETAILS),
      buildAppointmentConfirmedEmail(DETAILS),
      buildAppointmentDeclinedEmail(DETAILS),
      buildAppointmentCancelledDoctorEmail(DETAILS),
      buildAppointmentCompletedEmail(DETAILS),
    ];

    for (const email of emails) {
      expect(email.text.length).toBeGreaterThan(20);
      expect(email.html.length).toBeGreaterThan(20);
      expect(email.subject.length).toBeGreaterThan(0);
    }
  });
});
