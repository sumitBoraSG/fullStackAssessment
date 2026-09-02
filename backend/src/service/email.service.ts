import nodemailer from "nodemailer";
import logger from "@core/logger";

import {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASSWORD,
  FRONTEND_URL,
} from "@config/secret";

export class EmailService {
  private transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
  });

  public async sendInvitationEmail(
    email: string,
    role: string,
    invitationToken: string,
  ): Promise<void> {
    const invitationUrl =
      `${FRONTEND_URL}/accept-invitation?token=${invitationToken}`;

    await this.transporter.sendMail({
      from: SMTP_USER,
      to: email,
      subject: "You're invited to join our platform",

      text: `
You have been invited to join our platform.

Role: ${role}

Please use the following link to create your account:

${invitationUrl}

This invitation will expire in 24 hours.

If you did not expect this invitation, you can ignore this email.
      `,

      html: `
        <h2>You're invited to join our platform</h2>

        <p>
          You have been invited to join our platform.
        </p>

        <p>
          <strong>Role:</strong> ${role}
        </p>

        <p>
          Click the button below to create your account:
        </p>

        <p>
          <a
            href="${invitationUrl}"
            style="
              display: inline-block;
              padding: 10px 20px;
              background-color: #000;
              color: #fff;
              text-decoration: none;
              border-radius: 5px;
            "
          >
            Accept Invitation
          </a>
        </p>

        <p>
          This invitation will expire in 24 hours.
        </p>

        <p>
          If you did not expect this invitation, you can ignore this email.
        </p>
      `,
    });

    logger.info("Invitation email sent successfully", {
      data: { email, role },
    });
  }
}