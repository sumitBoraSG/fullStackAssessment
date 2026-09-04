import nodemailer from "nodemailer";
import logger from "@core/logger";

import { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } from "@config/secret";

import { InvitationSource } from "@database/enum/invitationSource";
import { AppointmentEmailDetails, EmailContent } from "./types";
import { buildInvitationEmail } from "./templates/invitation.template";
import {
  buildAppointmentRequestedDoctorEmail,
  buildAppointmentRequestedPatientEmail,
} from "./templates/appointment-requested.template";
import { buildAppointmentConfirmedEmail } from "./templates/appointment-confirmed.template";
import { buildAppointmentDeclinedEmail } from "./templates/appointment-declined.template";
import { buildAppointmentCancelledDoctorEmail } from "./templates/appointment-cancelled.template";
import { buildAppointmentCompletedEmail } from "./templates/appointment-completed.template";

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

  private async deliver(to: string, content: EmailContent): Promise<void> {
    await this.transporter.sendMail({
      from: SMTP_USER,
      to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
  }

  public async sendInvitationEmail(
    email: string,
    role: string,
    invitationToken: string,
    source: InvitationSource = InvitationSource.ADMIN_INVITATION,
  ): Promise<void> {
    await this.deliver(email, buildInvitationEmail(role, invitationToken, source));

    logger.info("Invitation email sent successfully", {
      data: { email, role, source },
    });
  }

  public async sendAppointmentRequestedPatientEmail(
    to: string,
    appointmentId: number,
    details: AppointmentEmailDetails,
  ): Promise<void> {
    await this.deliver(to, buildAppointmentRequestedPatientEmail(details));

    logger.info("Appointment requested email sent to patient", {
      data: {
        appointmentId,
        recipient: to,
        emailType: "APPOINTMENT_REQUESTED_PATIENT",
      },
    });
  }

  public async sendAppointmentRequestedDoctorEmail(
    to: string,
    appointmentId: number,
    details: AppointmentEmailDetails,
  ): Promise<void> {
    await this.deliver(to, buildAppointmentRequestedDoctorEmail(details));

    logger.info("Appointment requested email sent to doctor", {
      data: {
        appointmentId,
        recipient: to,
        emailType: "APPOINTMENT_REQUESTED_DOCTOR",
      },
    });
  }

  public async sendAppointmentConfirmedEmail(
    to: string,
    appointmentId: number,
    details: AppointmentEmailDetails,
  ): Promise<void> {
    await this.deliver(to, buildAppointmentConfirmedEmail(details));

    logger.info("Appointment confirmed email sent to patient", {
      data: {
        appointmentId,
        recipient: to,
        emailType: "APPOINTMENT_CONFIRMED",
      },
    });
  }

  public async sendAppointmentDeclinedEmail(
    to: string,
    appointmentId: number,
    details: AppointmentEmailDetails,
  ): Promise<void> {
    await this.deliver(to, buildAppointmentDeclinedEmail(details));

    logger.info("Appointment declined email sent to patient", {
      data: {
        appointmentId,
        recipient: to,
        emailType: "APPOINTMENT_DECLINED",
      },
    });
  }

  public async sendAppointmentCancelledEmail(
    to: string,
    appointmentId: number,
    details: AppointmentEmailDetails,
  ): Promise<void> {
    await this.deliver(to, buildAppointmentCancelledDoctorEmail(details));

    logger.info("Appointment cancelled email sent to doctor", {
      data: {
        appointmentId,
        recipient: to,
        emailType: "APPOINTMENT_CANCELLED",
      },
    });
  }

  public async sendAppointmentCompletedEmail(
    to: string,
    appointmentId: number,
    details: AppointmentEmailDetails,
  ): Promise<void> {
    await this.deliver(to, buildAppointmentCompletedEmail(details));

    logger.info("Appointment completed email sent to patient", {
      data: {
        appointmentId,
        recipient: to,
        emailType: "APPOINTMENT_COMPLETED",
      },
    });
  }
}
