import { FRONTEND_URL } from "@config/secret";
import { AppointmentEmailDetails, EmailContent } from "../types";
import { renderTransactionalEmail } from "./layout.template";

// Only the patient-initiated cancellation flow currently exists in the
// appointment state machine, so this template is doctor-facing: it notifies
// the doctor that a patient cancelled their appointment.
export function buildAppointmentCancelledDoctorEmail(
  details: AppointmentEmailDetails,
): EmailContent {
  const subject = "Appointment Cancelled";

  const { text, html } = renderTransactionalEmail({
    heading: subject,
    greeting: `Hello ${details.doctorName},`,
    paragraphs: [
      `Your appointment with ${details.patientName} has been cancelled by the patient.`,
    ],
    details: [
      { label: "Date", value: details.date },
      { label: "Time", value: `${details.startTime} - ${details.endTime}` },
    ],
    badge: { label: "Cancelled", tone: "cancelled" },
    cta: { label: "View Schedule", url: `${FRONTEND_URL}/dashboard` },
    closingNote: "Please log in to DocPulse to view your updated schedule.",
  });

  return { subject, text, html };
}
