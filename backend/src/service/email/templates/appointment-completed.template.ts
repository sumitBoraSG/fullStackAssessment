import { FRONTEND_URL } from "@config/secret";
import { AppointmentEmailDetails, EmailContent } from "../types";
import { renderTransactionalEmail } from "./layout.template";

export function buildAppointmentCompletedEmail(
  details: AppointmentEmailDetails,
): EmailContent {
  const subject = "Appointment Completed";

  const { text, html } = renderTransactionalEmail({
    heading: subject,
    greeting: `Hello ${details.patientName},`,
    paragraphs: [
      `Your appointment with ${details.doctorName} has been marked as completed.`,
    ],
    details: [
      { label: "Date", value: details.date },
      { label: "Time", value: `${details.startTime} - ${details.endTime}` },
    ],
    badge: { label: "Completed", tone: "completed" },
    cta: { label: "View History", url: `${FRONTEND_URL}/dashboard` },
    closingNote:
      "Thank you for using DocPulse. Please log in to view your appointment history.",
  });

  return { subject, text, html };
}
