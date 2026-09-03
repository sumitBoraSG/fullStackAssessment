import request from "supertest";
import { app, setupIntegrationTest } from "../util/testApp";
import {
  createPatientUser,
  createDoctorUser,
  loginAgent,
} from "../util/factories";

setupIntegrationTest();

describe("Patient profile: GET /patient/profile", () => {
  it("returns the authenticated patient's own profile", async () => {
    const patient = await createPatientUser("patient-profile@test.com", "Pass123456");
    const agent = await loginAgent(app, patient.email, patient.password);

    const res = await agent.get("/patient/profile");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      email: patient.email,
      firstName: "Test",
      lastName: "Patient",
      heightCm: 170,
      weightKg: 70,
      bloodGroup: "O+",
    });
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app).get("/patient/profile");
    expect(res.status).toBe(401);
  });

  it("rejects a doctor from accessing the patient profile endpoint", async () => {
    const doctor = await createDoctorUser("doc-profile-gate@test.com", "Pass123456");
    const agent = await loginAgent(app, doctor.email, doctor.password);

    const res = await agent.get("/patient/profile");
    expect(res.status).toBe(403);
  });
});

describe("Patient profile: PATCH /patient/profile", () => {
  it("updates both height and weight in one request", async () => {
    const patient = await createPatientUser("patient-update@test.com", "Pass123456");
    const agent = await loginAgent(app, patient.email, patient.password);

    const res = await agent
      .patch("/patient/profile")
      .send({ heightCm: 180, weightKg: 85 });

    expect(res.status).toBe(200);
    expect(res.body.data.heightCm).toBe(180);
    expect(res.body.data.weightKg).toBe(85);
  });

  it("a partial update of only heightCm does not null out weightKg", async () => {
    const patient = await createPatientUser("patient-partial@test.com", "Pass123456");
    const agent = await loginAgent(app, patient.email, patient.password);

    const res = await agent.patch("/patient/profile").send({ heightCm: 175 });

    expect(res.status).toBe(200);
    expect(res.body.data.heightCm).toBe(175);
    expect(res.body.data.weightKg).toBe(70); // untouched original value

    const followUp = await agent.get("/patient/profile");
    expect(followUp.body.data.weightKg).toBe(70);
  });

  it("a partial update of only weightKg does not null out heightCm", async () => {
    const patient = await createPatientUser("patient-partial-2@test.com", "Pass123456");
    const agent = await loginAgent(app, patient.email, patient.password);

    const res = await agent.patch("/patient/profile").send({ weightKg: 65 });

    expect(res.status).toBe(200);
    expect(res.body.data.weightKg).toBe(65);
    expect(res.body.data.heightCm).toBe(170); // untouched original value
  });

  it("rejects an out-of-range height", async () => {
    const patient = await createPatientUser("patient-badheight@test.com", "Pass123456");
    const agent = await loginAgent(app, patient.email, patient.password);

    const res = await agent.patch("/patient/profile").send({ heightCm: 301 });
    expect(res.status).toBe(400);
  });

  it("rejects an out-of-range weight", async () => {
    const patient = await createPatientUser("patient-badweight@test.com", "Pass123456");
    const agent = await loginAgent(app, patient.email, patient.password);

    const res = await agent.patch("/patient/profile").send({ weightKg: 501 });
    expect(res.status).toBe(400);
  });

  it("rejects an empty body", async () => {
    const patient = await createPatientUser("patient-empty@test.com", "Pass123456");
    const agent = await loginAgent(app, patient.email, patient.password);

    const res = await agent.patch("/patient/profile").send({});
    expect(res.status).toBe(400);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app).patch("/patient/profile").send({ heightCm: 180 });
    expect(res.status).toBe(401);
  });

  it("rejects a doctor from updating the patient profile endpoint", async () => {
    const doctor = await createDoctorUser("doc-profile-gate-2@test.com", "Pass123456");
    const agent = await loginAgent(app, doctor.email, doctor.password);

    const res = await agent.patch("/patient/profile").send({ heightCm: 180 });
    expect(res.status).toBe(403);
  });
});
