import { Client } from "pg";
import bcrypt from "bcrypt";
import crypto from "crypto";

// Mirrors the `pg` Client pattern in e2e/utils/db.ts: a short-lived
// connection scoped to a single call, never held open across the run, so it
// never fights the live server's own connection pool. These helpers exist so
// each spec file can seed data that isn't reasonably reachable through the
// UI in a real user's timeframe (e.g. a past-due CONFIRMED appointment, or
// an already-hashed invitation token — see the invitation-token note below).
async function withClient<T>(databaseUrl: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export type SeedRole = "ADMIN" | "DOCTOR" | "PATIENT";

export interface SeedUser {
  id: number;
  email: string;
  password: string;
}

export async function getUserIdByEmail(databaseUrl: string, email: string): Promise<number> {
  return withClient(databaseUrl, async (client) => {
    const { rows } = await client.query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase()]);
    if (!rows[0]) {
      throw new Error(`getUserIdByEmail: no user found with email ${email}`);
    }
    return rows[0].id;
  });
}

/**
 * Seeds a doctor account directly (bypassing the invite/accept-invitation
 * UI flow). Used by specs whose journey is NOT about onboarding itself (the
 * onboarding journey is covered end-to-end by doctor-onboarding.spec.ts).
 */
export async function createDoctorUser(
  databaseUrl: string,
  email: string,
  password: string,
  specializationId = 1,
  experienceYears = 5,
): Promise<SeedUser> {
  return withClient(databaseUrl, async (client) => {
    const hashedPassword = await bcrypt.hash(password, 12);
    const { rows } = await client.query(
      `INSERT INTO users (first_name, last_name, email, hashed_password, role)
       VALUES ('E2E', 'Doctor', $1, $2, 'DOCTOR') RETURNING id`,
      [email.toLowerCase(), hashedPassword],
    );
    const id = rows[0].id;
    await client.query(
      `INSERT INTO doctors (doctor_id, specialization_id, experience_years) VALUES ($1, $2, $3)`,
      [id, specializationId, experienceYears],
    );
    return { id, email, password };
  });
}

/**
 * Seeds a patient account directly (bypassing the invite/accept-invitation
 * UI flow). Used by specs whose journey is NOT about onboarding itself.
 */
export async function createPatientUser(
  databaseUrl: string,
  email: string,
  password: string,
  options: { dob?: string; heightCm?: number; weightKg?: number; bloodGroup?: string } = {},
): Promise<SeedUser> {
  return withClient(databaseUrl, async (client) => {
    const hashedPassword = await bcrypt.hash(password, 12);
    const { rows } = await client.query(
      `INSERT INTO users (first_name, last_name, email, hashed_password, role)
       VALUES ('E2E', 'Patient', $1, $2, 'PATIENT') RETURNING id`,
      [email.toLowerCase(), hashedPassword],
    );
    const id = rows[0].id;
    await client.query(
      `INSERT INTO patients (patient_id, dob, height_cm, weight_kg, blood_group)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, options.dob ?? "1990-01-01", options.heightCm ?? 170, options.weightKg ?? 70, options.bloodGroup ?? "O+"],
    );
    return { id, email, password };
  });
}

/** Inserts a doctor_availabilities row directly from a Postgres tstzrange literal. */
export async function createAvailabilityRow(
  databaseUrl: string,
  doctorId: number,
  rangeLiteral: string,
): Promise<number> {
  return withClient(databaseUrl, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO doctor_availabilities (doctor_id, availability_time) VALUES ($1, $2::tstzrange) RETURNING id`,
      [doctorId, rangeLiteral],
    );
    return rows[0].id;
  });
}

/**
 * Inserts an appointments row directly from a Postgres tstzrange literal.
 * Needed for the "doctor completes a past appointment" journey: the real UI
 * has no way to create a CONFIRMED appointment whose time has already
 * passed (the "Confirm" button is disabled once the scheduled time has
 * passed, by design), so that precondition can only be reached by seeding.
 */
export async function createAppointmentRow(
  databaseUrl: string,
  doctorId: number,
  patientId: number,
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "REJECTED",
  rangeLiteral: string,
): Promise<number> {
  return withClient(databaseUrl, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO appointments (patient_id, doctor_id, status, appointment_time)
       VALUES ($1, $2, $3, $4::tstzrange) RETURNING id`,
      [patientId, doctorId, status, rangeLiteral],
    );
    return rows[0].id;
  });
}

/**
 * Generates a raw invitation token + its sha256 hash, mirroring exactly how
 * AdminService.inviteUser derives/stores tokens (crypto.randomBytes(32) hex
 * -> sha256 hex digest — see backend/src/service/admin.service.ts and
 * backend/src/service/auth.service.ts) so a directly-seeded invitation row
 * is byte-for-byte indistinguishable, from the accept-invitation endpoint's
 * point of view, from one created through the real admin-invite API.
 */
export function generateInvitationToken(): { rawToken: string; hashedToken: string } {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, hashedToken };
}

/**
 * Seeds a user_invitations row directly and returns the raw (unhashed)
 * token needed to drive the real /accept-invitation UI.
 *
 * WHY THIS EXISTS (read before assuming this is a shortcut around the thing
 * under test): backend/.env has a real, working SMTP_* configuration (see
 * backend/src/service/email/email.service.ts) — there is no test-mode email
 * stub at the infrastructure level the way the Jest integration suite gets
 * one (it mocks EmailService.sendInvitationEmail via jest.spyOn — see
 * backend/test/util/factories.ts's mockInvitationEmails/mockAllEmailDelivery
 * — but that mock lives inside the Jest process and can't reach the real
 * `npm run serve` server process Playwright's webServer spawns). There is
 * also no test SMTP catcher (Mailhog/Ethereal/etc.) wired into this repo.
 * The raw invitation token only ever exists (a) in the admin's original API
 * response call stack, and (b) inside the outgoing email body — never in
 * the database, which stores only its sha256 hash. So for any journey where
 * the invited user (not the inviting admin) is the thing under test, the
 * only realistic way to obtain a usable token without modifying backend
 * source/config is to generate one exactly the way the backend does and
 * seed the (still-real, still-hashed) invitation row directly. The user
 * still goes through the entire real accept-invitation form, validation,
 * and API call — nothing about *that* flow is bypassed. Admin-driven
 * invite creation itself (the other half of the invitation lifecycle) is
 * exercised for real, end-to-end, via the actual admin UI + a real SMTP
 * send, in admin-bulk-invite.spec.ts.
 */
export async function seedPendingInvitation(
  databaseUrl: string,
  email: string,
  role: SeedRole,
  createdByUserId: number,
  options: { expiresAt?: Date; usedAt?: Date | null; revokedAt?: Date | null } = {},
): Promise<{ rawToken: string; invitationId: number }> {
  const { rawToken, hashedToken } = generateInvitationToken();
  const expiresAt = options.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000);

  const invitationId = await withClient(databaseUrl, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO user_invitations
         (email, role, hashed_token, expires_at, used_at, revoked_at, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING id`,
      [
        email.toLowerCase(),
        role,
        hashedToken,
        expiresAt,
        options.usedAt ?? null,
        options.revokedAt ?? null,
        createdByUserId,
      ],
    );
    return rows[0].id;
  });

  return { rawToken, invitationId };
}

/**
 * `YYYY-MM-DD` for N calendar days from "now", anchored to the IST calendar
 * date (not the test runner's local timezone) — the backend's own
 * past-date/past-time rules are anchored to IST (see
 * backend/src/util/dateTimeRange.ts's getISTTodayString), so any date this
 * helper produces for a positive `days` is guaranteed to compare as
 * strictly "in the future" from the backend's point of view, regardless of
 * what timezone this test runner's host machine happens to be in.
 */
export function istDateString(days: number): string {
  const now = new Date();
  // Re-anchor to IST wall-clock date components, independent of host tz.
  const istNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  istNow.setDate(istNow.getDate() + days);
  const y = istNow.getFullYear();
  const m = String(istNow.getMonth() + 1).padStart(2, "0");
  const d = String(istNow.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Builds a Postgres `tstzrange` literal in IST, mirroring
 * backend/src/util/dateTimeRange.ts's buildISTRangeLiteral exactly, e.g.
 * `[2026-08-28T09:00:00+05:30,2026-08-28T09:30:00+05:30)`. */
export function buildISTRangeLiteral(date: string, startTime: string, endTime: string): string {
  return `[${date}T${startTime}:00+05:30,${date}T${endTime}:00+05:30)`;
}
