import bcrypt from "bcrypt";
import { getConnection } from "typeorm";
import request from "supertest";
import { Application } from "express";
import { EmailService } from "@service/email.service";
import { UserRole } from "@database/enum/userRole";

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
): Promise<number> {
  const [{ id }] = await getConnection().query(
    `INSERT INTO appointments (patient_id, doctor_id, status, appointment_time)
     VALUES ($1, $2, $3, $4::tstzrange) RETURNING id`,
    [patientId, doctorId, status, rangeLiteral],
  );
  return id;
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
