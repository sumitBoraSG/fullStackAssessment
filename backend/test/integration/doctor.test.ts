import request from "supertest";
import { getConnection } from "typeorm";
import { app, setupIntegrationTest } from "../util/testApp";
import { createAdminUser, loginAgent, mockInvitationEmails } from "../util/factories";

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
      password: "SecurePass123",
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
