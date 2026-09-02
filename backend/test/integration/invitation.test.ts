import request from "supertest";
import { getConnection } from "typeorm";
import { app, setupIntegrationTest } from "../util/testApp";
import {
  createAdminUser,
  loginAgent,
  mockInvitationEmails,
  SPECIALIZATION_IDS,
} from "../util/factories";

setupIntegrationTest();

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
      password: "SecurePass123",
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
      password: "SecurePass123",
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
      password: "SecurePass123",
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
      password: "SecurePass123",
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
        password: "SecurePass123",
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
      password: "SecurePass123",
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
      password: "SecurePass123",
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
      password: "SecurePass123",
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
