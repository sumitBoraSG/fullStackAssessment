import bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import { getConnection } from "typeorm";
import request from "supertest";
import { Application } from "express";
import { EmailService } from "@service/email/email.service";
import { UserRole } from "@database/enum/userRole";
import { InvitationSource } from "@database/enum/invitationSource";
import { REFRESH_TOKEN_SECRET } from "@config/secret";

export const SPECIALIZATION_IDS = {
  GENERAL_PRACTITIONER: 1,
  CARDIOLOGY: 2,
};

export async function createAdminUser(
  email = "admin@test.com",
  password = "AdminPass123",
): Promise<{ id: number; email: string; password: string }> {
  const hashedPassword = await bcrypt.hash(password, 12);
  const result = await getConnection().query(
    `INSERT INTO users (first_name, last_name, email, hashed_password, role)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    ["Test", "Admin", email, hashedPassword, UserRole.ADMIN],
  );
  return { id: result[0].id, email, password };
}

export async function loginAgent(
  app: Application,
  email: string,
  password: string,
): Promise<ReturnType<typeof request.agent>> {
  const agent = request.agent(app);
  const res = await agent.post("/auth/login").send({ email, password });
  if (!res.body.success) {
    throw new Error(`Test login failed for ${email}: ${JSON.stringify(res.body)}`);
  }
  return agent;
}

export async function createDoctorUser(
  email: string,
  password: string,
  specializationId = SPECIALIZATION_IDS.GENERAL_PRACTITIONER,
  experienceYears = 5,
): Promise<{ id: number; email: string; password: string }> {
  const hashedPassword = await bcrypt.hash(password, 12);
  const [{ id }] = await getConnection().query(
    `INSERT INTO users (first_name, last_name, email, hashed_password, role)
     VALUES ('Test', 'Doctor', $1, $2, 'DOCTOR') RETURNING id`,
    [email, hashedPassword],
  );
  await getConnection().query(
    `INSERT INTO doctors (doctor_id, specialization_id, experience_years) VALUES ($1, $2, $3)`,
    [id, specializationId, experienceYears],
  );
  return { id, email, password };
}

export async function createPatientUser(
  email: string,
  password: string,
): Promise<{ id: number; email: string; password: string }> {
  const hashedPassword = await bcrypt.hash(password, 12);
  const [{ id }] = await getConnection().query(
    `INSERT INTO users (first_name, last_name, email, hashed_password, role)
     VALUES ('Test', 'Patient', $1, $2, 'PATIENT') RETURNING id`,
    [email, hashedPassword],
  );
  await getConnection().query(
    `INSERT INTO patients (patient_id, dob, height_cm, weight_kg, blood_group)
     VALUES ($1, '1990-01-01', 170, 70, 'O+')`,
    [id],
  );
  return { id, email, password };
}

export async function createAvailabilityRow(
  doctorId: number,
  rangeLiteral: string,
): Promise<number> {
  const [{ id }] = await getConnection().query(
    `INSERT INTO doctor_availabilities (doctor_id, availability_time) VALUES ($1, $2::tstzrange) RETURNING id`,
    [doctorId, rangeLiteral],
  );
  return id;
}

export async function createAppointmentRow(
  doctorId: number,
  patientId: number,
  status: string,
  rangeLiteral: string,
  options: { createdAt?: Date } = {},
): Promise<number> {
  if (options.createdAt) {
    const [{ id }] = await getConnection().query(
      `INSERT INTO appointments (patient_id, doctor_id, status, appointment_time, created_at)
       VALUES ($1, $2, $3, $4::tstzrange, $5) RETURNING id`,
      [patientId, doctorId, status, rangeLiteral, options.createdAt],
    );
    return id;
  }

  const [{ id }] = await getConnection().query(
    `INSERT INTO appointments (patient_id, doctor_id, status, appointment_time)
     VALUES ($1, $2, $3, $4::tstzrange) RETURNING id`,
    [patientId, doctorId, status, rangeLiteral],
  );
  return id;
}

/**
 * Seeds an invitation row directly (bypassing the HTTP invite flow) so a
 * test can put it straight into EXPIRED/USED/REVOKED state — states that
 * are otherwise only reachable via a real 24h wait, a full accept flow, or
 * an admin revoke call. `createdBy`/`updatedBy` are nullable FK columns to
 * `users` (null for a patient-self-registration-sourced row); pass a real
 * user id (e.g. an admin created via createAdminUser) for an
 * admin-issued-style row. Defaults to a pending, admin-issued invitation
 * expiring in 24h.
 */
export async function createInvitationRow(
  email: string,
  role: UserRole,
  hashedToken: string,
  createdBy: number | null,
  options: {
    expiresAt?: Date;
    usedAt?: Date | null;
    revokedAt?: Date | null;
    source?: InvitationSource;
  } = {},
): Promise<number> {
  const expiresAt = options.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
  const usedAt = options.usedAt ?? null;
  const revokedAt = options.revokedAt ?? null;
  const source = options.source ?? InvitationSource.ADMIN_INVITATION;

  const [{ id }] = await getConnection().query(
    `INSERT INTO user_invitations
       (email, role, hashed_token, expires_at, used_at, revoked_at, created_by, updated_by, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8) RETURNING id`,
    [email.toLowerCase(), role, hashedToken, expiresAt, usedAt, revokedAt, createdBy, source],
  );
  return id;
}

/**
 * Signs a refresh token that's already expired (expiresIn: "-1s"), so a
 * test can deterministically hit AuthService.refresh's TokenExpiredError
 * branch without waiting out the real refresh-token lifetime.
 */
export function signExpiredRefreshToken(userId: number): string {
  return jwt.sign(
    { id: userId, type: "refresh" },
    REFRESH_TOKEN_SECRET as string,
    { expiresIn: "-1s" },
  );
}

/**
 * Intercepts EmailService.sendInvitationEmail (mocked, so no real email is
 * ever sent) and captures the raw invitation token passed to it — the only
 * place the raw token is ever available, since only its hash is persisted.
 */
export function mockInvitationEmails(): { getLastToken: () => string } {
  let lastToken = "";

  jest
    .spyOn(EmailService.prototype, "sendInvitationEmail")
    .mockImplementation(async (_email: string, _role: string, token: string) => {
      lastToken = token;
    });

  return { getLastToken: () => lastToken };
}

const APPOINTMENT_EMAIL_METHODS = [
  "sendAppointmentRequestedPatientEmail",
  "sendAppointmentRequestedDoctorEmail",
  "sendAppointmentConfirmedEmail",
  "sendAppointmentDeclinedEmail",
  "sendAppointmentCancelledEmail",
  "sendAppointmentCompletedEmail",
] as const;

/**
 * Mocks every EmailService method (invitation + appointment lifecycle) so no
 * integration test can ever attempt a real SMTP send, regardless of whether
 * it exercises a code path that now triggers email notifications. Wired into
 * setupIntegrationTest()'s beforeEach. Individual tests that want to assert
 * on a specific call can re-spy afterwards — jest.spyOn is idempotent, so
 * re-spying just lets the test reconfigure/inspect the existing mock.
 */
export function mockAllEmailDelivery(): void {
  jest.spyOn(EmailService.prototype, "sendInvitationEmail").mockResolvedValue(undefined);

  for (const method of APPOINTMENT_EMAIL_METHODS) {
    jest.spyOn(EmailService.prototype, method).mockResolvedValue(undefined);
  }
}

/**
 * Spies on every appointment lifecycle email method and returns each spy so
 * a test can assert recipient/details without having to re-derive the method
 * name list itself.
 */
export function spyOnAppointmentEmails() {
  return {
    requestedPatient: jest.spyOn(
      EmailService.prototype,
      "sendAppointmentRequestedPatientEmail",
    ),
    requestedDoctor: jest.spyOn(
      EmailService.prototype,
      "sendAppointmentRequestedDoctorEmail",
    ),
    confirmed: jest.spyOn(EmailService.prototype, "sendAppointmentConfirmedEmail"),
    declined: jest.spyOn(EmailService.prototype, "sendAppointmentDeclinedEmail"),
    cancelled: jest.spyOn(EmailService.prototype, "sendAppointmentCancelledEmail"),
    completed: jest.spyOn(EmailService.prototype, "sendAppointmentCompletedEmail"),
  };
}
