import { FRONTEND_URL } from "@config/secret";
import { AppointmentEmailDetails, EmailContent } from "../types";
import { renderTransactionalEmail } from "./layout.template";

export function buildAppointmentDeclinedEmail(
  details: AppointmentEmailDetails,
): EmailContent {
  const subject = "Appointment Request Declined";

  const { text, html } = renderTransactionalEmail({
    heading: subject,
    greeting: `Hello ${details.patientName},`,
    paragraphs: [
      `Your appointment request with ${details.doctorName} has been declined.`,
    ],
    details: [
      { label: "Date", value: details.date },
      { label: "Time", value: `${details.startTime} - ${details.endTime}` },
    ],
    cta: { label: "Find Another Doctor", url: `${FRONTEND_URL}/dashboard` },
    closingNote: "Please log in to DocPulse to book another appointment.",
  });

  return { subject, text, html };
}
