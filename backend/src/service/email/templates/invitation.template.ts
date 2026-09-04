import { FRONTEND_URL } from "@config/secret";
import { InvitationSource } from "@database/enum/invitationSource";
import { EmailContent } from "../types";
import { renderTransactionalEmail } from "./layout.template";

export function buildInvitationEmail(
  role: string,
  invitationToken: string,
  source: InvitationSource = InvitationSource.ADMIN_INVITATION,
): EmailContent {
  const isSelfRegistration = source === InvitationSource.PATIENT_SELF_REGISTRATION;

  const subject = isSelfRegistration
    ? "Complete your DocPulse registration"
    : "You're invited to join our platform";
  const invitationUrl = `${FRONTEND_URL}/accept-invitation?token=${invitationToken}`;

  const paragraphs = isSelfRegistration
    ? ["Thanks for requesting to join our platform. Click below to finish setting up your account."]
    : ["You have been invited to join our platform."];

  const cta = {
    label: isSelfRegistration ? "Complete Registration" : "Accept Invitation",
    url: invitationUrl,
  };

  const closingNote = isSelfRegistration
    ? "This link will expire in 24 hours. If you did not request this, you can ignore this email."
    : "This invitation will expire in 24 hours. If you did not expect this invitation, you can ignore this email.";

  const { text, html } = renderTransactionalEmail({
    heading: subject,
    greeting: "Hello,",
    paragraphs,
    details: [{ label: "Role", value: role }],
    cta,
    closingNote,
  });

  return { subject, text, html };
}
