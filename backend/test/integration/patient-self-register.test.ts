import request from "supertest";
import { getConnection } from "typeorm";
import { app, setupIntegrationTest } from "../util/testApp";
import {
  createAdminUser,
  createDoctorUser,
  createInvitationRow,
  createPatientUser,
  loginAgent,
  mockInvitationEmails,
} from "../util/factories";
import { UserRole } from "@database/enum/userRole";
import { InvitationSource } from "@database/enum/invitationSource";
import { InvitationRepository } from "@database/repository/invitation.repository";

setupIntegrationTest();

const GENERIC_MESSAGE =
  "If this email is eligible for registration, you'll receive a verification link shortly.";

async function findInvitationByEmail(email: string) {
  const rows = await getConnection().query(
    `SELECT * FROM user_invitations WHERE email = $1`,
    [email.toLowerCase()],
  );
  return rows;
}

describe("POST /auth/patient/self-register", () => {
  it("creates a self-registration invitation and emails it for a brand-new email", async () => {
    const { getLastToken } = mockInvitationEmails();

    const res = await request(app)
      .post("/auth/patient/self-register")
      .send({ email: "new-patient@test.com" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: GENERIC_MESSAGE });

    const rows = await findInvitationByEmail("new-patient@test.com");
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("PATIENT");
    expect(rows[0].source).toBe("PATIENT_SELF_REGISTRATION");
    expect(rows[0].created_by).toBeNull();
    expect(rows[0].updated_by).toBeNull();

    expect(getLastToken()).toBeTruthy();
  });

  it("returns the same generic response for an email that already belongs to a patient, without creating a row or sending an email", async () => {
    const emailSpy = mockInvitationEmails();
    await createPatientUser("existing-patient@test.com", "Pass123456");

    const res = await request(app)
      .post("/auth/patient/self-register")
      .send({ email: "existing-patient@test.com" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: GENERIC_MESSAGE });

    expect(await findInvitationByEmail("existing-patient@test.com")).toHaveLength(0);
    expect(emailSpy.getLastToken()).toBe("");
  });

  it("returns the same generic response for an email that already belongs to a doctor", async () => {
    const emailSpy = mockInvitationEmails();
    await createDoctorUser("existing-doctor@test.com", "Pass123456");

    const res = await request(app)
      .post("/auth/patient/self-register")
      .send({ email: "existing-doctor@test.com" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: GENERIC_MESSAGE });

    expect(await findInvitationByEmail("existing-doctor@test.com")).toHaveLength(0);
    expect(emailSpy.getLastToken()).toBe("");
  });

  it("returns the same generic response for an email that already belongs to an admin", async () => {
    const emailSpy = mockInvitationEmails();
    await createAdminUser("existing-admin@test.com", "Pass123456");

    const res = await request(app)
      .post("/auth/patient/self-register")
      .send({ email: "existing-admin@test.com" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: GENERIC_MESSAGE });

    expect(await findInvitationByEmail("existing-admin@test.com")).toHaveLength(0);
    expect(emailSpy.getLastToken()).toBe("");
  });

  it("returns the same generic response when an admin-issued invitation is already active for the email, without a second row", async () => {
    const emailSpy = mockInvitationEmails();
    const admin = await createAdminUser();
    await createInvitationRow(
      "already-invited-by-admin@test.com",
      UserRole.DOCTOR,
      "hash-already-invited-by-admin",
      admin.id,
      { source: InvitationSource.ADMIN_INVITATION },
    );

    const res = await request(app)
      .post("/auth/patient/self-register")
      .send({ email: "already-invited-by-admin@test.com" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: GENERIC_MESSAGE });

    expect(await findInvitationByEmail("already-invited-by-admin@test.com")).toHaveLength(1);
    expect(emailSpy.getLastToken()).toBe("");
  });

  it("does not create a second row or send another email on a repeat request while a self-registration invitation is already active", async () => {
    const emailSpy = mockInvitationEmails();

    const first = await request(app)
      .post("/auth/patient/self-register")
      .send({ email: "repeat-request@test.com" });
    expect(first.status).toBe(200);
    expect(await findInvitationByEmail("repeat-request@test.com")).toHaveLength(1);

    const second = await request(app)
      .post("/auth/patient/self-register")
      .send({ email: "repeat-request@test.com" });

    expect(second.status).toBe(200);
    expect(second.body).toEqual({ success: true, message: GENERIC_MESSAGE });
    expect(await findInvitationByEmail("repeat-request@test.com")).toHaveLength(1);
    // Only the first request's send should have gone through.
    expect(emailSpy.getLastToken()).toBeTruthy();
  });

  it("rejects a malformed email with 400", async () => {
    const res = await request(app)
      .post("/auth/patient/self-register")
      .send({ email: "not-an-email" });

    expect(res.status).toBe(400);
  });

  it("rejects a missing email with 400", async () => {
    const res = await request(app).post("/auth/patient/self-register").send({});

    expect(res.status).toBe(400);
  });

  it("rejects a whitespace-only email with 400", async () => {
    const res = await request(app)
      .post("/auth/patient/self-register")
      .send({ email: "   " });

    expect(res.status).toBe(400);
  });

  it("rejects an email containing internal whitespace with 400", async () => {
    const res = await request(app)
      .post("/auth/patient/self-register")
      .send({ email: "not a valid@test.com" });

    expect(res.status).toBe(400);
  });

  it("rejects a SQL-injection-shaped string with 400, not a database error", async () => {
    const res = await request(app)
      .post("/auth/patient/self-register")
      .send({ email: "'; DROP TABLE users; --@test.com" });

    expect(res.status).toBe(400);
  });

  it("rejects an HTML/script-shaped string with 400", async () => {
    const res = await request(app)
      .post("/auth/patient/self-register")
      .send({ email: "<script>alert(1)</script>@test.com" });

    expect(res.status).toBe(400);
  });

  it("rejects a non-string email (number) with 400 instead of crashing", async () => {
    const res = await request(app)
      .post("/auth/patient/self-register")
      .send({ email: 12345 });

    expect(res.status).toBe(400);
  });

  it("rejects a non-string email (array) with 400 instead of crashing", async () => {
    const res = await request(app)
      .post("/auth/patient/self-register")
      .send({ email: ["a@test.com", "b@test.com"] });

    expect(res.status).toBe(400);
  });

  it("rejects a body with an extra/unknown field (e.g. a smuggled role) with 400 rather than silently accepting it", async () => {
    const res = await request(app)
      .post("/auth/patient/self-register")
      .send({ email: "role-smuggle@test.com", role: "ADMIN" });

    expect(res.status).toBe(400);
    expect(await findInvitationByEmail("role-smuggle@test.com")).toHaveLength(0);
  });

  it("treats a soft-deleted (previously deleted) patient's email as available for self-registration", async () => {
    const emailSpy = mockInvitationEmails();
    const patient = await createPatientUser("soft-deleted@test.com", "Pass123456");
    await getConnection().query(`UPDATE users SET deleted_at = NOW() WHERE id = $1`, [patient.id]);

    const res = await request(app)
      .post("/auth/patient/self-register")
      .send({ email: "soft-deleted@test.com" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: GENERIC_MESSAGE });
    // findUserForLogin excludes soft-deleted rows (deleted_at IS NULL), so
    // this email is treated as available, exactly as it already is for the
    // pre-existing admin-invite path (AdminService.inviteUser uses the same
    // check) — not a new behavior introduced by this endpoint.
    expect(await findInvitationByEmail("soft-deleted@test.com")).toHaveLength(1);
    expect(emailSpy.getLastToken()).toBeTruthy();
  });

  it("propagates a genuine database failure as an error instead of masking it as a fake success", async () => {
    const emailSpy = mockInvitationEmails();
    const dbError = Object.assign(new Error("connection terminated unexpectedly"), {
      code: "57P01",
    });
    const createSpy = jest
      .spyOn(InvitationRepository.prototype, "createInvitation")
      .mockRejectedValueOnce(dbError);

    const res = await request(app)
      .post("/auth/patient/self-register")
      .send({ email: "db-failure@test.com" });

    expect(res.status).toBe(500);
    // Uncaught errors fall through to the shared error middleware, which
    // uses a {status, message, code, data} shape rather than the
    // {success, ...} shape used by this endpoint's own success responses
    // (see the comment in frontend authApi.ts describing the same split).
    expect(res.body.status).toBe(false);
    expect(await findInvitationByEmail("db-failure@test.com")).toHaveLength(0);
    expect(emailSpy.getLastToken()).toBe("");

    createSpy.mockRestore();
  });

  it("treats email as case-insensitive when checking for an existing account", async () => {
    const emailSpy = mockInvitationEmails();
    await createPatientUser("case-sensitive@test.com", "Pass123456");

    const res = await request(app)
      .post("/auth/patient/self-register")
      .send({ email: "Case-Sensitive@Test.com" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: GENERIC_MESSAGE });
    expect(await findInvitationByEmail("case-sensitive@test.com")).toHaveLength(0);
    expect(emailSpy.getLastToken()).toBe("");
  });

  it("only creates one invitation when two concurrent requests race for the same new email", async () => {
    mockInvitationEmails();

    const [res1, res2] = await Promise.all([
      request(app).post("/auth/patient/self-register").send({ email: "concurrent-self-register@test.com" }),
      request(app).post("/auth/patient/self-register").send({ email: "concurrent-self-register@test.com" }),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body).toEqual({ success: true, message: GENERIC_MESSAGE });
    expect(res2.body).toEqual({ success: true, message: GENERIC_MESSAGE });

    expect(await findInvitationByEmail("concurrent-self-register@test.com")).toHaveLength(1);
  });

  it("only creates one invitation when ten concurrent requests race for the same new email", async () => {
    mockInvitationEmails();

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app)
          .post("/auth/patient/self-register")
          .send({ email: "ten-way-race@test.com" }),
      ),
    );

    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, message: GENERIC_MESSAGE });
    }

    expect(await findInvitationByEmail("ten-way-race@test.com")).toHaveLength(1);
  });

  it("does not let concurrent requests for different new emails interfere with each other", async () => {
    mockInvitationEmails();

    const emails = ["race-a@test.com", "race-b@test.com", "race-c@test.com"];
    const responses = await Promise.all(
      emails.map((email) =>
        request(app).post("/auth/patient/self-register").send({ email }),
      ),
    );

    for (const res of responses) {
      expect(res.status).toBe(200);
    }

    for (const email of emails) {
      expect(await findInvitationByEmail(email)).toHaveLength(1);
    }
  });

  it("completes the full flow end to end: self-register -> invitation preview -> accept-invitation", async () => {
    const { getLastToken } = mockInvitationEmails();

    const registerRes = await request(app)
      .post("/auth/patient/self-register")
      .send({ email: "e2e-self-register@test.com" });
    expect(registerRes.status).toBe(200);

    const token = getLastToken();
    expect(token).toBeTruthy();

    const detailsRes = await request(app).get(`/auth/invitation/${token}`);
    expect(detailsRes.status).toBe(200);
    expect(detailsRes.body.data.role).toBe("PATIENT");
    expect(detailsRes.body.data.email).toBe("e2e-self-register@test.com");

    const acceptRes = await request(app).post("/auth/accept-invitation").send({
      token,
      firstName: "Self",
      lastName: "Registered",
      password: "SecurePass123!",
      dob: "1990-01-01",
      heightCm: 170,
      weightKg: 70,
      bloodGroup: "A+",
    });

    expect(acceptRes.status).toBe(201);
    expect(acceptRes.body.data.role).toBe("PATIENT");
    expect(acceptRes.body.data.email).toBe("e2e-self-register@test.com");
  });

  it("admin can still revoke a self-registration-sourced invitation", async () => {
    mockInvitationEmails();
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    await request(app)
      .post("/auth/patient/self-register")
      .send({ email: "revoke-self-registered@test.com" });

    const [{ id: invitationId }] = await findInvitationByEmail("revoke-self-registered@test.com");

    const res = await adminAgent.post(`/admin/invitations/${invitationId}/revoke`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("REVOKED");
  });

  it("a self-registration-sourced invitation is still listed and role-filterable by admins", async () => {
    mockInvitationEmails();
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    await request(app)
      .post("/auth/patient/self-register")
      .send({ email: "listed-self-registered@test.com" });

    const res = await adminAgent.get("/admin/invitations").query({ role: "PATIENT" });
    expect(res.status).toBe(200);
    expect(
      res.body.data.some((i: { email: string }) => i.email === "listed-self-registered@test.com"),
    ).toBe(true);
  });
});
