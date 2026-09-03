import { FRONTEND_URL } from "@config/secret";
import { AppointmentEmailDetails, EmailContent } from "../types";
import { renderTransactionalEmail } from "./layout.template";

export function buildAppointmentRequestedPatientEmail(
  details: AppointmentEmailDetails,
): EmailContent {
  const subject = "Appointment Request Submitted";

  const { text, html } = renderTransactionalEmail({
    heading: subject,
    greeting: `Hello ${details.patientName},`,
    paragraphs: [
      `Your appointment request with ${details.doctorName} has been submitted.`,
    ],
    details: [
      { label: "Date", value: details.date },
      { label: "Time", value: `${details.startTime} - ${details.endTime}` },
      { label: "Status", value: "Pending" },
    ],
    cta: { label: "View Appointment", url: `${FRONTEND_URL}/dashboard` },
    closingNote: "Please log in to DocPulse to view your appointment details.",
  });

  return { subject, text, html };
}

export function buildAppointmentRequestedDoctorEmail(
  details: AppointmentEmailDetails,
): EmailContent {
  const subject = "New Appointment Request";

  const { text, html } = renderTransactionalEmail({
    heading: subject,
    greeting: `Hello ${details.doctorName},`,
    paragraphs: [
      `You have received a new appointment request from ${details.patientName}.`,
    ],
    details: [
      { label: "Patient", value: details.patientName },
      { label: "Date", value: details.date },
      { label: "Time", value: `${details.startTime} - ${details.endTime}` },
      { label: "Status", value: "Pending" },
    ],
    cta: { label: "Review Request", url: `${FRONTEND_URL}/dashboard` },
    closingNote:
      "Please log in to DocPulse to confirm or decline this request.",
  });

  return { subject, text, html };
}
