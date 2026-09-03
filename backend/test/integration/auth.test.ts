import request from "supertest";
import { app, setupIntegrationTest } from "../util/testApp";
import {
  createDoctorUser,
  createPatientUser,
  createAppointmentRow,
  loginAgent,
  signExpiredRefreshToken,
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

  it("distinguishes an expired refresh token from a malformed/invalid one", async () => {
    const patient = await createPatientUser("refresh-expired@test.com", "Pass123456");

    const expiredRes = await request(app)
      .post("/auth/refresh")
      .set("Cookie", `refreshToken=${signExpiredRefreshToken(patient.id)}`);
    expect(expiredRes.status).toBe(401);
    expect(expiredRes.body.message).toBe("Refresh token has expired");

    const invalidRes = await request(app)
      .post("/auth/refresh")
      .set("Cookie", "refreshToken=garbage.not-a.jwt");
    expect(invalidRes.status).toBe(401);
    expect(invalidRes.body.message).toBe("Invalid refresh token");
  });

  it("sets HttpOnly/SameSite cookies without Secure under NODE_ENV=test", async () => {
    const patient = await createPatientUser("cookie-flags@test.com", "Pass123456");

    const res = await request(app)
      .post("/auth/login")
      .send({ email: patient.email, password: patient.password });

    expect(res.status).toBe(200);
    const setCookie = res.headers["set-cookie"] as unknown as string[];
    expect(setCookie).toBeDefined();

    const accessCookie = setCookie.find((c) => c.startsWith("accessToken="));
    const refreshCookie = setCookie.find((c) => c.startsWith("refreshToken="));
    expect(accessCookie).toBeDefined();
    expect(refreshCookie).toBeDefined();

    for (const cookie of [accessCookie, refreshCookie]) {
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).not.toMatch(/Secure/i);
    }
  });
});

describe("Auth: login failure modes", () => {
  it("rejects a wrong password with a generic 401 (no enumeration leak)", async () => {
    const patient = await createPatientUser("wrongpass@test.com", "Pass123456");

    const res = await request(app)
      .post("/auth/login")
      .send({ email: patient.email, password: "TotallyWrongPass1" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });

  it("rejects a non-existent email with the same generic 401 message", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "does-not-exist@test.com", password: "AnyPassword1" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
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
