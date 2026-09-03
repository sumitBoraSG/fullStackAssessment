import request from "supertest";
import { getConnection } from "typeorm";
import { app, setupIntegrationTest } from "../util/testApp";
import {
  createAdminUser,
  createDoctorUser,
  createPatientUser,
  loginAgent,
  mockInvitationEmails,
  SPECIALIZATION_IDS,
} from "../util/factories";

setupIntegrationTest();

describe("Specialization list / signup consistency", () => {
  it("never lists an inactive specialization as selectable for signup", async () => {
    await getConnection().query(
      `UPDATE specializations SET is_active = false WHERE name = 'Cardiology'`,
    );

    // Deliberately unauthenticated — the not-yet-registered signup page
    // must be able to reach this list.
    const res = await request(app).get("/doctors/specializations");
    expect(res.status).toBe(200);
    expect(
      res.body.data.some((s: { name: string }) => s.name === "Cardiology"),
    ).toBe(false);
  });

  it("rejects doctor signup with a specialization that exists but is inactive", async () => {
    const [{ id: inactiveId }] = await getConnection().query(
      `UPDATE specializations SET is_active = false WHERE name = 'Cardiology' RETURNING id`,
    );

    const { getLastToken } = mockInvitationEmails();
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    await adminAgent
      .post("/admin/invite")
      .send({ email: "doctor-inactive-spec@test.com", role: "DOCTOR" });
    const token = getLastToken();

    const res = await request(app).post("/auth/accept-invitation").send({
      token,
      firstName: "In",
      lastName: "Active",
      password: "SecurePass123!",
      specializationId: inactiveId,
      experienceYears: 5,
    });

    expect(res.status).toBe(400);

    const users = await getConnection().query(
      `SELECT * FROM users WHERE email = $1`,
      ["doctor-inactive-spec@test.com"],
    );
    expect(users).toHaveLength(0);
  });
});

describe("Doctor profile: GET /doctor/profile", () => {
  it("returns the authenticated doctor's own profile", async () => {
    const doctor = await createDoctorUser(
      "doctor-profile-get@test.com",
      "Pass123456",
      SPECIALIZATION_IDS.CARDIOLOGY,
      8,
    );
    const agent = await loginAgent(app, doctor.email, doctor.password);

    const res = await agent.get("/doctor/profile");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: doctor.id,
      email: doctor.email,
      firstName: "Test",
      lastName: "Doctor",
      specialization: "Cardiology",
      experienceYears: 8,
    });
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app).get("/doctor/profile");
    expect(res.status).toBe(401);
  });

  it("rejects a patient from accessing the doctor profile endpoint", async () => {
    const patient = await createPatientUser("patient-doc-gate@test.com", "Pass123456");
    const agent = await loginAgent(app, patient.email, patient.password);

    const res = await agent.get("/doctor/profile");
    expect(res.status).toBe(403);
  });
});

describe("Doctor profile: PATCH /doctor/profile", () => {
  it("updates experienceYears on the happy path", async () => {
    const doctor = await createDoctorUser("doctor-profile-patch@test.com", "Pass123456");
    const agent = await loginAgent(app, doctor.email, doctor.password);

    const res = await agent.patch("/doctor/profile").send({ experienceYears: 15 });

    expect(res.status).toBe(200);
    expect(res.body.data.experienceYears).toBe(15);
  });

  it("rejects an out-of-range experienceYears", async () => {
    const doctor = await createDoctorUser("doctor-profile-badexp@test.com", "Pass123456");
    const agent = await loginAgent(app, doctor.email, doctor.password);

    const res = await agent.patch("/doctor/profile").send({ experienceYears: 81 });
    expect(res.status).toBe(400);
  });

  it("rejects a missing experienceYears (required field)", async () => {
    const doctor = await createDoctorUser("doctor-profile-empty@test.com", "Pass123456");
    const agent = await loginAgent(app, doctor.email, doctor.password);

    const res = await agent.patch("/doctor/profile").send({});
    expect(res.status).toBe(400);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app).patch("/doctor/profile").send({ experienceYears: 10 });
    expect(res.status).toBe(401);
  });

  it("rejects a patient from updating the doctor profile endpoint", async () => {
    const patient = await createPatientUser("patient-doc-gate-2@test.com", "Pass123456");
    const agent = await loginAgent(app, patient.email, patient.password);

    const res = await agent.patch("/doctor/profile").send({ experienceYears: 10 });
    expect(res.status).toBe(403);
  });
});
