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

  it("accepts the boundary values (heightCm 30 and 300, weightKg 2 and 500)", async () => {
    const low = await createPatientUser("patient-boundary-low@test.com", "Pass123456");
    const lowAgent = await loginAgent(app, low.email, low.password);
    const lowRes = await lowAgent.patch("/patient/profile").send({ heightCm: 30, weightKg: 2 });
    expect(lowRes.status).toBe(200);
    expect(lowRes.body.data.heightCm).toBe(30);
    expect(lowRes.body.data.weightKg).toBe(2);

    const high = await createPatientUser("patient-boundary-high@test.com", "Pass123456");
    const highAgent = await loginAgent(app, high.email, high.password);
    const highRes = await highAgent.patch("/patient/profile").send({ heightCm: 300, weightKg: 500 });
    expect(highRes.status).toBe(200);
    expect(highRes.body.data.heightCm).toBe(300);
    expect(highRes.body.data.weightKg).toBe(500);
  });

  it("rejects a below-minimum height (29) and weight (1)", async () => {
    const patient = await createPatientUser("patient-belowmin@test.com", "Pass123456");
    const agent = await loginAgent(app, patient.email, patient.password);

    const heightRes = await agent.patch("/patient/profile").send({ heightCm: 29 });
    expect(heightRes.status).toBe(400);

    const weightRes = await agent.patch("/patient/profile").send({ weightKg: 1 });
    expect(weightRes.status).toBe(400);
  });

  it("rejects an attempt to change bloodGroup or dob through this endpoint — both are permanent once set at signup", async () => {
    // createPatientUser seeds dob='1990-01-01'/bloodGroup='O+' by default.
    const patient = await createPatientUser("patient-immutable@test.com", "Pass123456");
    const agent = await loginAgent(app, patient.email, patient.password);

    // Neither field is in updatePatientProfileSchema, and Joi rejects
    // unknown keys by default, so each request is a 400 — never a silent
    // no-op partial update of just the recognized fields.
    const bloodGroupRes = await agent
      .patch("/patient/profile")
      .send({ heightCm: 175, bloodGroup: "AB+" });
    expect(bloodGroupRes.status).toBe(400);

    const dobRes = await agent.patch("/patient/profile").send({ heightCm: 175, dob: "2000-01-01" });
    expect(dobRes.status).toBe(400);

    const followUp = await agent.get("/patient/profile");
    expect(followUp.body.data.bloodGroup).toBe("O+");
    expect(followUp.body.data.dob).toBe("1990-01-01");
    // Neither rejected request's heightCm should have leaked through either.
    expect(followUp.body.data.heightCm).toBe(170);
  });
});
