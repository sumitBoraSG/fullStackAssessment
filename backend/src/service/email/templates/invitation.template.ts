import { FRONTEND_URL } from "@config/secret";
import { EmailContent } from "../types";
import { renderTransactionalEmail } from "./layout.template";

export function buildInvitationEmail(
  role: string,
  invitationToken: string,
): EmailContent {
  const subject = "You're invited to join our platform";
  const invitationUrl = `${FRONTEND_URL}/accept-invitation?token=${invitationToken}`;

  const { text, html } = renderTransactionalEmail({
    heading: subject,
    greeting: "Hello,",
    paragraphs: ["You have been invited to join our platform."],
    details: [{ label: "Role", value: role }],
    cta: { label: "Accept Invitation", url: invitationUrl },
    closingNote:
      "This invitation will expire in 24 hours. If you did not expect this invitation, you can ignore this email.",
  });

  return { subject, text, html };
}
