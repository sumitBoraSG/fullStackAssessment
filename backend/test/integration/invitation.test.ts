import crypto from "crypto";
import request from "supertest";
import { getConnection } from "typeorm";
import { app, setupIntegrationTest } from "../util/testApp";
import {
  createAdminUser,
  createInvitationRow,
  loginAgent,
  mockInvitationEmails,
  SPECIALIZATION_IDS,
} from "../util/factories";
import { UserRole } from "@database/enum/userRole";

setupIntegrationTest();

function rawTokenAndHash(): { token: string; hashedToken: string } {
  const token = crypto.randomBytes(16).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hashedToken };
}

describe("Invitation -> signup flow", () => {
  it("doctor invite -> signup persists specialization and experience", async () => {
    const { getLastToken } = mockInvitationEmails();
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    const inviteRes = await adminAgent
      .post("/admin/invite")
      .send({ email: "doctor1@test.com", role: "DOCTOR" });
    expect(inviteRes.status).toBe(201);

    const token = getLastToken();
    expect(token).toBeTruthy();

    const detailsRes = await request(app).get(`/auth/invitation/${token}`);
    expect(detailsRes.status).toBe(200);
    expect(detailsRes.body.data.role).toBe("DOCTOR");
    expect(detailsRes.body.data.email).toBe("doctor1@test.com");

    const acceptRes = await request(app).post("/auth/accept-invitation").send({
      token,
      firstName: "Greg",
      lastName: "House",
      password: "SecurePass123!",
      specializationId: SPECIALIZATION_IDS.CARDIOLOGY,
      experienceYears: 12,
    });

    expect(acceptRes.status).toBe(201);
    expect(acceptRes.body.data.role).toBe("DOCTOR");

    const [doctorRow] = await getConnection().query(
      `SELECT d.specialization_id, d.experience_years, u.role
       FROM doctors d JOIN users u ON u.id = d.doctor_id
       WHERE u.email = $1`,
      ["doctor1@test.com"],
    );
    expect(doctorRow.specialization_id).toBe(SPECIALIZATION_IDS.CARDIOLOGY);
    expect(doctorRow.experience_years).toBe(12);
    expect(doctorRow.role).toBe("DOCTOR");
  });

  it("patient invite -> signup persists patient profile fields", async () => {
    const { getLastToken } = mockInvitationEmails();
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    await adminAgent
      .post("/admin/invite")
      .send({ email: "patient1@test.com", role: "PATIENT" });
    const token = getLastToken();

    const acceptRes = await request(app).post("/auth/accept-invitation").send({
      token,
      firstName: "Jane",
      lastName: "Doe",
      password: "SecurePass123!",
      dob: "1990-05-15",
      heightCm: 165,
      weightKg: 60,
      bloodGroup: "O+",
    });

    expect(acceptRes.status).toBe(201);
    expect(acceptRes.body.data.role).toBe("PATIENT");

    const [patientRow] = await getConnection().query(
      `SELECT p.dob, p.height_cm, p.weight_kg, p.blood_group
       FROM patients p JOIN users u ON u.id = p.patient_id
       WHERE u.email = $1`,
      ["patient1@test.com"],
    );
    expect(patientRow.height_cm).toBe(165);
    expect(patientRow.weight_kg).toBe(60);
    expect(patientRow.blood_group).toBe("O+");
  });

  it("rejects signup with a non-existent specialization", async () => {
    const { getLastToken } = mockInvitationEmails();
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    await adminAgent
      .post("/admin/invite")
      .send({ email: "doctor2@test.com", role: "DOCTOR" });
    const token = getLastToken();

    const res = await request(app).post("/auth/accept-invitation").send({
      token,
      firstName: "Bad",
      lastName: "Spec",
      password: "SecurePass123!",
      specializationId: 9999,
      experienceYears: 5,
    });

    expect(res.status).toBe(400);

    const users = await getConnection().query(
      `SELECT * FROM users WHERE email = $1`,
      ["doctor2@test.com"],
    );
    expect(users).toHaveLength(0);
  });

  it("rejects signup missing required role-specific fields", async () => {
    const { getLastToken } = mockInvitationEmails();
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    await adminAgent
      .post("/admin/invite")
      .send({ email: "patient2@test.com", role: "PATIENT" });
    const token = getLastToken();

    const res = await request(app).post("/auth/accept-invitation").send({
      token,
      firstName: "No",
      lastName: "Profile",
      password: "SecurePass123!",
      // missing dob/heightCm/weightKg/bloodGroup
    });

    expect(res.status).toBe(400);
  });

  it("ignores a client-supplied role and always uses the invitation's role", async () => {
    const { getLastToken } = mockInvitationEmails();
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    await adminAgent
      .post("/admin/invite")
      .send({ email: "patient3@test.com", role: "PATIENT" });
    const token = getLastToken();

    // Attempt to smuggle a role override into the request body.
    const tamperRes = await request(app)
      .post("/auth/accept-invitation")
      .send({
        token,
        firstName: "Sneaky",
        lastName: "User",
        password: "SecurePass123!",
        role: "ADMIN",
        dob: "1990-01-01",
        heightCm: 170,
        weightKg: 70,
        bloodGroup: "A+",
      });
    // Either rejected outright by request validation (unknown field), or
    // silently ignored — either way, no admin must ever be created here.
    const adminLeaked = await getConnection().query(
      `SELECT * FROM users WHERE email = $1 AND role = 'ADMIN'`,
      ["patient3@test.com"],
    );
    expect(adminLeaked).toHaveLength(0);

    if (tamperRes.status === 201) {
      expect(tamperRes.body.data.role).toBe("PATIENT");
    }

    const [userRow] = await getConnection().query(
      `SELECT role FROM users WHERE email = $1`,
      ["patient3@test.com"],
    );
    if (userRow) {
      expect(userRow.role).toBe("PATIENT");
    }
  });

  it("rolls back the entire signup transaction if a step fails", async () => {
    const { getLastToken } = mockInvitationEmails();
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    await adminAgent
      .post("/admin/invite")
      .send({ email: "rollback@test.com", role: "DOCTOR" });
    const token = getLastToken();

    // Invalid specialization forces a failure after the invitation has been
    // located but before the transaction commits.
    const res = await request(app).post("/auth/accept-invitation").send({
      token,
      firstName: "Roll",
      lastName: "Back",
      password: "SecurePass123!",
      specializationId: 9999,
      experienceYears: 5,
    });
    expect(res.status).toBe(400);

    const users = await getConnection().query(
      `SELECT * FROM users WHERE email = $1`,
      ["rollback@test.com"],
    );
    expect(users).toHaveLength(0);

    const [invitationRow] = await getConnection().query(
      `SELECT used_at FROM user_invitations WHERE email = $1`,
      ["rollback@test.com"],
    );
    expect(invitationRow.used_at).toBeNull();

    // The invitation must still be usable after the rollback.
    const retryRes = await request(app).post("/auth/accept-invitation").send({
      token,
      firstName: "Roll",
      lastName: "Back",
      password: "SecurePass123!",
      specializationId: SPECIALIZATION_IDS.GENERAL_PRACTITIONER,
      experienceYears: 5,
    });
    expect(retryRes.status).toBe(201);
  });

  it("only lets one of two concurrent accept-invitation calls succeed", async () => {
    const { getLastToken } = mockInvitationEmails();
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    await adminAgent
      .post("/admin/invite")
      .send({ email: "concurrent@test.com", role: "PATIENT" });
    const token = getLastToken();

    const payload = {
      token,
      firstName: "Race",
      lastName: "Condition",
      password: "SecurePass123!",
      dob: "1990-01-01",
      heightCm: 170,
      weightKg: 70,
      bloodGroup: "A+",
    };

    const [res1, res2] = await Promise.all([
      request(app).post("/auth/accept-invitation").send(payload),
      request(app).post("/auth/accept-invitation").send(payload),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 400]);

    const users = await getConnection().query(
      `SELECT * FROM users WHERE email = $1`,
      ["concurrent@test.com"],
    );
    expect(users).toHaveLength(1);
  });
});

describe("Accept invitation: invalid invitation states", () => {
  const validPatientPayload = {
    firstName: "Val",
    lastName: "Id",
    password: "SecurePass123!",
    dob: "1990-01-01",
    heightCm: 170,
    weightKg: 70,
    bloodGroup: "A+",
  };

  it("rejects an expired invitation token", async () => {
    const admin = await createAdminUser();
    const { token, hashedToken } = rawTokenAndHash();
    await createInvitationRow("expired-accept@test.com", UserRole.PATIENT, hashedToken, admin.id, {
      expiresAt: new Date(Date.now() - 60 * 60 * 1000),
    });

    const res = await request(app)
      .post("/auth/accept-invitation")
      .send({ token, ...validPatientPayload });

    expect(res.status).toBe(400);

    const users = await getConnection().query(`SELECT * FROM users WHERE email = $1`, [
      "expired-accept@test.com",
    ]);
    expect(users).toHaveLength(0);
  });

  it("rejects an already-used invitation token", async () => {
    const admin = await createAdminUser();
    const { token, hashedToken } = rawTokenAndHash();
    await createInvitationRow("used-accept@test.com", UserRole.PATIENT, hashedToken, admin.id, {
      usedAt: new Date(),
    });

    const res = await request(app)
      .post("/auth/accept-invitation")
      .send({ token, ...validPatientPayload });

    expect(res.status).toBe(400);
  });

  it("rejects a revoked invitation token", async () => {
    const admin = await createAdminUser();
    const { token, hashedToken } = rawTokenAndHash();
    await createInvitationRow("revoked-accept@test.com", UserRole.PATIENT, hashedToken, admin.id, {
      revokedAt: new Date(),
    });

    const res = await request(app)
      .post("/auth/accept-invitation")
      .send({ token, ...validPatientPayload });

    expect(res.status).toBe(400);
  });

  it("rejects a garbage/non-existent invitation token", async () => {
    const res = await request(app)
      .post("/auth/accept-invitation")
      .send({ token: "this-token-was-never-issued", ...validPatientPayload });

    expect(res.status).toBe(400);
  });
});

describe("Accept invitation: patient profile validation", () => {
  async function issuePatientInvitation(email: string): Promise<string> {
    const { getLastToken } = mockInvitationEmails();
    const admin = await createAdminUser(`admin-${email}`);
    const adminAgent = await loginAgent(app, admin.email, admin.password);
    await adminAgent.post("/admin/invite").send({ email, role: "PATIENT" });
    return getLastToken();
  }

  it("rejects a future date of birth", async () => {
    const token = await issuePatientInvitation("patient-future-dob@test.com");

    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const res = await request(app).post("/auth/accept-invitation").send({
      token,
      firstName: "Future",
      lastName: "Dob",
      password: "SecurePass123!",
      dob: futureDate,
      heightCm: 170,
      weightKg: 70,
      bloodGroup: "A+",
    });

    expect(res.status).toBe(400);
  });

  it("rejects a pre-1900 date of birth", async () => {
    const token = await issuePatientInvitation("patient-old-dob@test.com");

    const res = await request(app).post("/auth/accept-invitation").send({
      token,
      firstName: "Old",
      lastName: "Dob",
      password: "SecurePass123!",
      dob: "1899-12-31",
      heightCm: 170,
      weightKg: 70,
      bloodGroup: "A+",
    });

    expect(res.status).toBe(400);
  });

  it("rejects an invalid blood group", async () => {
    const token = await issuePatientInvitation("patient-bad-bloodgroup@test.com");

    const res = await request(app).post("/auth/accept-invitation").send({
      token,
      firstName: "Bad",
      lastName: "Blood",
      password: "SecurePass123!",
      dob: "1990-01-01",
      heightCm: 170,
      weightKg: 70,
      bloodGroup: "Z-",
    });

    expect(res.status).toBe(400);
  });

  it("rejects a password missing the required complexity (no special character)", async () => {
    const token = await issuePatientInvitation("patient-weak-password@test.com");

    const res = await request(app).post("/auth/accept-invitation").send({
      token,
      firstName: "Weak",
      lastName: "Password",
      password: "NoSpecialChar123",
      dob: "1990-01-01",
      heightCm: 170,
      weightKg: 70,
      bloodGroup: "A+",
    });

    expect(res.status).toBe(400);
  });
});

describe("Accept invitation: individual doctor-field-missing cases", () => {
  async function issueDoctorInvitation(email: string): Promise<string> {
    const { getLastToken } = mockInvitationEmails();
    const admin = await createAdminUser(`admin-${email}`);
    const adminAgent = await loginAgent(app, admin.email, admin.password);
    await adminAgent.post("/admin/invite").send({ email, role: "DOCTOR" });
    return getLastToken();
  }

  it("rejects a doctor signup missing specializationId only", async () => {
    const token = await issueDoctorInvitation("doctor-missing-spec@test.com");

    const res = await request(app).post("/auth/accept-invitation").send({
      token,
      firstName: "Missing",
      lastName: "Spec",
      password: "SecurePass123!",
      experienceYears: SPECIALIZATION_IDS.GENERAL_PRACTITIONER,
    });

    expect(res.status).toBe(400);
  });

  it("rejects a doctor signup missing experienceYears only", async () => {
    const token = await issueDoctorInvitation("doctor-missing-exp@test.com");

    const res = await request(app).post("/auth/accept-invitation").send({
      token,
      firstName: "Missing",
      lastName: "Exp",
      password: "SecurePass123!",
      specializationId: SPECIALIZATION_IDS.GENERAL_PRACTITIONER,
    });

    expect(res.status).toBe(400);
  });
});
