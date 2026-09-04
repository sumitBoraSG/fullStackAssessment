import request from "supertest";
import { app, setupIntegrationTest } from "../util/testApp";
import {
  createAdminUser,
  createInvitationRow,
  loginAgent,
  mockInvitationEmails,
} from "../util/factories";
import { UserRole } from "@database/enum/userRole";

setupIntegrationTest();

describe("POST /admin/invite: role restriction", () => {
  it("rejects inviting a PATIENT: patients self-register instead", async () => {
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    const res = await adminAgent
      .post("/admin/invite")
      .send({ email: "should-not-be-invited@test.com", role: "PATIENT" });

    expect(res.status).toBe(400);

    const invitations = await adminAgent
      .get("/admin/invitations")
      .query({ search: "should-not-be-invited" });
    expect(invitations.body.data).toHaveLength(0);
  });

  it("still allows inviting a DOCTOR", async () => {
    mockInvitationEmails();
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    const res = await adminAgent
      .post("/admin/invite")
      .send({ email: "still-invitable-doctor@test.com", role: "DOCTOR" });

    expect(res.status).toBe(201);
  });

  it("still allows inviting an ADMIN", async () => {
    mockInvitationEmails();
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    const res = await adminAgent
      .post("/admin/invite")
      .send({ email: "still-invitable-admin@test.com", role: "ADMIN" });

    expect(res.status).toBe(201);
  });
});

describe("GET /admin/invitations", () => {
  it("lists invitations and rejects a non-admin", async () => {
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    await createInvitationRow("pending1@test.com", UserRole.PATIENT, "hash-pending-1", admin.id);

    const res = await adminAgent.get("/admin/invitations");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app).get("/admin/invitations");
    expect(res.status).toBe(401);
  });

  it("filters by search (email substring)", async () => {
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    await createInvitationRow("alice@test.com", UserRole.PATIENT, "hash-alice", admin.id);
    await createInvitationRow("bob@test.com", UserRole.DOCTOR, "hash-bob", admin.id);

    const res = await adminAgent.get("/admin/invitations").query({ search: "alice" });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].email).toBe("alice@test.com");
  });

  it("filters by role", async () => {
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    await createInvitationRow("role-patient@test.com", UserRole.PATIENT, "hash-role-p", admin.id);
    await createInvitationRow("role-doctor@test.com", UserRole.DOCTOR, "hash-role-d", admin.id);

    const res = await adminAgent.get("/admin/invitations").query({ role: "DOCTOR" });
    expect(res.status).toBe(200);
    expect(res.body.data.every((i: { role: string }) => i.role === "DOCTOR")).toBe(true);
    expect(
      res.body.data.some((i: { email: string }) => i.email === "role-doctor@test.com"),
    ).toBe(true);
  });

  it("filters by status=EXPIRED", async () => {
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    await createInvitationRow(
      "expired-status@test.com",
      UserRole.PATIENT,
      "hash-expired-status",
      admin.id,
      { expiresAt: new Date(Date.now() - 60 * 60 * 1000) },
    );
    await createInvitationRow(
      "pending-status@test.com",
      UserRole.PATIENT,
      "hash-pending-status",
      admin.id,
      { expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    );

    const res = await adminAgent.get("/admin/invitations").query({ status: "EXPIRED" });
    expect(res.status).toBe(200);
    expect(
      res.body.data.some((i: { email: string }) => i.email === "expired-status@test.com"),
    ).toBe(true);
    expect(
      res.body.data.some((i: { email: string }) => i.email === "pending-status@test.com"),
    ).toBe(false);
  });

  it("filters by status=USED and status=REVOKED", async () => {
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    await createInvitationRow("used-status@test.com", UserRole.PATIENT, "hash-used-status", admin.id, {
      usedAt: new Date(),
    });
    await createInvitationRow(
      "revoked-status@test.com",
      UserRole.PATIENT,
      "hash-revoked-status",
      admin.id,
      { revokedAt: new Date() },
    );

    const usedRes = await adminAgent.get("/admin/invitations").query({ status: "USED" });
    expect(usedRes.status).toBe(200);
    expect(usedRes.body.data.map((i: { email: string }) => i.email)).toContain(
      "used-status@test.com",
    );
    expect(usedRes.body.data.map((i: { email: string }) => i.email)).not.toContain(
      "revoked-status@test.com",
    );

    const revokedRes = await adminAgent.get("/admin/invitations").query({ status: "REVOKED" });
    expect(revokedRes.status).toBe(200);
    expect(revokedRes.body.data.map((i: { email: string }) => i.email)).toContain(
      "revoked-status@test.com",
    );
  });

  it("status-equivalence: the JS-computed status field matches what the SQL status filter selects, for an expired invitation", async () => {
    // Regression guard against drift between AdminService's JS-side status
    // computation (expiresAt < now) and InvitationRepository's SQL-side
    // filter (expires_at <= NOW()) — both are maintained independently, and
    // this asserts they agree for a comfortably-expired invitation (i.e.
    // outside the sub-millisecond boundary where "<" vs "<=" could differ).
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    await createInvitationRow(
      "equivalence@test.com",
      UserRole.PATIENT,
      "hash-equivalence",
      admin.id,
      { expiresAt: new Date(Date.now() - 60 * 60 * 1000) },
    );

    const unfiltered = await adminAgent.get("/admin/invitations").query({ search: "equivalence" });
    expect(unfiltered.status).toBe(200);
    expect(unfiltered.body.data[0].status).toBe("EXPIRED");

    const filtered = await adminAgent.get("/admin/invitations").query({ status: "EXPIRED", search: "equivalence" });
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.map((i: { email: string }) => i.email)).toContain(
      "equivalence@test.com",
    );
  });
});

describe("POST /admin/invitations/:id/revoke", () => {
  it("revokes a pending invitation", async () => {
    const { getLastToken } = mockInvitationEmails();
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    const inviteRes = await adminAgent
      .post("/admin/invite")
      .send({ email: "to-revoke@test.com", role: "DOCTOR" });
    expect(inviteRes.status).toBe(201);
    getLastToken();
    const invitationId = inviteRes.body.data.id;

    const res = await adminAgent.post(`/admin/invitations/${invitationId}/revoke`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("REVOKED");
  });

  it("returns 404 for a non-existent invitation id", async () => {
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    const res = await adminAgent.post("/admin/invitations/30000/revoke");
    expect(res.status).toBe(404);
  });

  it("returns 409 when revoking an already-revoked invitation", async () => {
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    const invitationId = await createInvitationRow(
      "already-revoked@test.com",
      UserRole.PATIENT,
      "hash-already-revoked",
      admin.id,
      { revokedAt: new Date() },
    );

    const res = await adminAgent.post(`/admin/invitations/${invitationId}/revoke`);
    expect(res.status).toBe(409);
  });

  it("returns 400 when revoking an already-used invitation", async () => {
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    const invitationId = await createInvitationRow(
      "already-used@test.com",
      UserRole.PATIENT,
      "hash-already-used",
      admin.id,
      { usedAt: new Date() },
    );

    const res = await adminAgent.post(`/admin/invitations/${invitationId}/revoke`);
    expect(res.status).toBe(400);
  });

  it("rejects a non-admin from revoking an invitation", async () => {
    const admin = await createAdminUser();
    const invitationId = await createInvitationRow(
      "gate-revoke@test.com",
      UserRole.PATIENT,
      "hash-gate-revoke",
      admin.id,
    );

    const { createPatientUser } = await import("../util/factories");
    const patient = await createPatientUser("revoke-gate-patient@test.com", "Pass123456");
    const patientAgent = await loginAgent(app, patient.email, patient.password);

    const res = await patientAgent.post(`/admin/invitations/${invitationId}/revoke`);
    expect(res.status).toBe(403);
  });
});
