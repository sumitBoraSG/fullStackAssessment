import request from "supertest";
import { app, setupIntegrationTest } from "../util/testApp";
import {
  createDoctorUser,
  createPatientUser,
  createAppointmentRow,
  loginAgent,
} from "../util/factories";

setupIntegrationTest();

function isoRange(startOffsetMs: number, endOffsetMs: number): string {
  const start = new Date(Date.now() + startOffsetMs).toISOString();
  const end = new Date(Date.now() + endOffsetMs).toISOString();
  return `[${start},${end})`;
}

describe("Auth: login/refresh flow", () => {
  it("issues a new access token from a valid refresh cookie", async () => {
    const patient = await createPatientUser("refresh@test.com", "Pass123456");
    const agent = await loginAgent(app, patient.email, patient.password);

    const refreshRes = await agent.post("/auth/refresh");
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);
    const setCookie = refreshRes.headers["set-cookie"] as unknown as string[];
    expect(setCookie).toBeDefined();
    expect(setCookie.some((c) => c.startsWith("accessToken="))).toBe(true);
  });

  it("rejects refresh with no refresh cookie present", async () => {
    const res = await request(app).post("/auth/refresh");
    expect(res.status).toBe(401);
  });

  it("rejects refresh with an invalid refresh token", async () => {
    const res = await request(app)
      .post("/auth/refresh")
      .set("Cookie", "refreshToken=not-a-real-token");
    expect(res.status).toBe(401);
  });
});

describe("Auth: authorization / IDOR protection", () => {
  it("prevents a patient from viewing or cancelling another patient's appointment", async () => {
    const doctor = await createDoctorUser("doc-idor@test.com", "Pass123456");
    const patientA = await createPatientUser("pat-idor-a@test.com", "Pass123456");
    const patientB = await createPatientUser("pat-idor-b@test.com", "Pass123456");

    const appointmentId = await createAppointmentRow(
      doctor.id,
      patientA.id,
      "PENDING",
      isoRange(60 * 60 * 1000, 90 * 60 * 1000),
    );

    const agentB = await loginAgent(app, patientB.email, patientB.password);

    const cancelRes = await agentB
      .patch(`/appointments/${appointmentId}/status`)
      .send({ status: "CANCELLED" });
    expect(cancelRes.status).toBe(404);

    const listRes = await agentB.get("/appointments");
    expect(listRes.status).toBe(200);
    expect(
      listRes.body.data.appointments.some((a: { id: number }) => a.id === appointmentId),
    ).toBe(false);
  });

  it("prevents a doctor from acting on another doctor's appointment", async () => {
    const doctorA = await createDoctorUser("doc-idor-a@test.com", "Pass123456");
    const doctorB = await createDoctorUser("doc-idor-b@test.com", "Pass123456");
    const patient = await createPatientUser("pat-idor-c@test.com", "Pass123456");

    const appointmentId = await createAppointmentRow(
      doctorA.id,
      patient.id,
      "PENDING",
      isoRange(60 * 60 * 1000, 90 * 60 * 1000),
    );

    const agentB = await loginAgent(app, doctorB.email, doctorB.password);

    const res = await agentB
      .patch(`/doctor/appointments/${appointmentId}/status`)
      .send({ status: "CONFIRMED" });
    expect(res.status).toBe(404);
  });
});
