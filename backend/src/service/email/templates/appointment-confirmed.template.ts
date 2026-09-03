import { FRONTEND_URL } from "@config/secret";
import { AppointmentEmailDetails, EmailContent } from "../types";
import { renderTransactionalEmail } from "./layout.template";

export function buildAppointmentConfirmedEmail(
  details: AppointmentEmailDetails,
): EmailContent {
  const subject = "Appointment Confirmed";

  const { text, html } = renderTransactionalEmail({
    heading: subject,
    greeting: `Hello ${details.patientName},`,
    paragraphs: [
      `Your appointment with ${details.doctorName} has been confirmed.`,
    ],
    details: [
      { label: "Date", value: details.date },
      { label: "Time", value: `${details.startTime} - ${details.endTime}` },
    ],
    cta: { label: "View Appointment", url: `${FRONTEND_URL}/dashboard` },
    closingNote: "Please log in to DocPulse to view the appointment details.",
  });

  return { subject, text, html };
}
