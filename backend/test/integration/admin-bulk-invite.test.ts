import request from "supertest";
import { app, setupIntegrationTest } from "../util/testApp";
import {
  createAdminUser,
  createPatientUser,
  loginAgent,
  mockInvitationEmails,
} from "../util/factories";

setupIntegrationTest();

function csvBuffer(content: string): Buffer {
  return Buffer.from(content, "utf-8");
}

describe("POST /admin/invitations/bulk", () => {
  it("processes a valid CSV happy path, inviting every row", async () => {
    mockInvitationEmails();
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    const csv = "email,role\nbulk-a@test.com,ADMIN\nbulk-b@test.com,DOCTOR\n";

    const res = await adminAgent
      .post("/admin/invitations/bulk")
      .attach("file", csvBuffer(csv), { filename: "invites.csv", contentType: "text/csv" });

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.successful).toBe(2);
    expect(res.body.data.failed).toBe(0);
    expect(
      res.body.data.results.every((r: { status: string }) => r.status === "INVITED"),
    ).toBe(true);
  });

  it("marks a PATIENT row as FAILED: admins can no longer bulk-invite patients", async () => {
    mockInvitationEmails();
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    const csv = "email,role\nbulk-patient@test.com,PATIENT\n";

    const res = await adminAgent
      .post("/admin/invitations/bulk")
      .attach("file", csvBuffer(csv), { filename: "patient-row.csv", contentType: "text/csv" });

    expect(res.status).toBe(200);
    expect(res.body.data.successful).toBe(0);
    expect(res.body.data.failed).toBe(1);
    expect(res.body.data.results[0].status).toBe("FAILED");
  });

  it("rejects a non-CSV file upload", async () => {
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    const res = await adminAgent
      .post("/admin/invitations/bulk")
      .attach("file", Buffer.from("not a csv"), {
        filename: "invites.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(400);
  });

  it("rejects a file exceeding the configured size limit", async () => {
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    // Limit is 5MB (see upload.middleware.ts) — build a CSV comfortably over it.
    const header = "email,role\n";
    const row = "oversize@test.com,PATIENT\n";
    const targetSize = 6 * 1024 * 1024;
    const bigCsv = header + row.repeat(Math.ceil(targetSize / row.length));

    const res = await adminAgent
      .post("/admin/invitations/bulk")
      .attach("file", csvBuffer(bigCsv), { filename: "big.csv", contentType: "text/csv" });

    expect(res.status).toBe(413);
  });

  it("rejects a CSV exceeding the max row limit", async () => {
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    const header = "email,role\n";
    const rows = Array.from(
      { length: 501 },
      (_, i) => `row${i}@test.com,PATIENT`,
    ).join("\n");
    const csv = `${header}${rows}\n`;

    const res = await adminAgent
      .post("/admin/invitations/bulk")
      .attach("file", csvBuffer(csv), { filename: "toomany.csv", contentType: "text/csv" });

    expect(res.status).toBe(400);
  });

  it("marks a row with invalid data (bad email / bad role) as FAILED without failing the whole batch", async () => {
    mockInvitationEmails();
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    const csv =
      "email,role\n" +
      "good-row@test.com,DOCTOR\n" +
      "not-an-email,DOCTOR\n" +
      "bad-role@test.com,SUPERUSER\n";

    const res = await adminAgent
      .post("/admin/invitations/bulk")
      .attach("file", csvBuffer(csv), { filename: "invalid-rows.csv", contentType: "text/csv" });

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(3);
    expect(res.body.data.successful).toBe(1);
    expect(res.body.data.failed).toBe(2);

    const failedRows = res.body.data.results.filter(
      (r: { status: string }) => r.status === "FAILED",
    );
    expect(failedRows).toHaveLength(2);
  });

  it("detects an in-file duplicate email and marks the second occurrence as FAILED", async () => {
    mockInvitationEmails();
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    const csv =
      "email,role\n" +
      "dup@test.com,DOCTOR\n" +
      "dup@test.com,DOCTOR\n";

    const res = await adminAgent
      .post("/admin/invitations/bulk")
      .attach("file", csvBuffer(csv), { filename: "dupes.csv", contentType: "text/csv" });

    expect(res.status).toBe(200);
    expect(res.body.data.successful).toBe(1);
    expect(res.body.data.failed).toBe(1);
    expect(res.body.data.results[1].reason).toBe("Duplicate email within the uploaded file");
  });

  it("marks a row FAILED when the email already has a pending invitation or user account outside the file", async () => {
    mockInvitationEmails();
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    // Pre-existing user with this email (existingUser lookup is by email
    // only, independent of the role being invited).
    await createPatientUser("existing-cross-file@test.com", "Pass123456");

    const csv = "email,role\nexisting-cross-file@test.com,DOCTOR\n";

    const res = await adminAgent
      .post("/admin/invitations/bulk")
      .attach("file", csvBuffer(csv), { filename: "crossfile.csv", contentType: "text/csv" });

    expect(res.status).toBe(200);
    expect(res.body.data.successful).toBe(0);
    expect(res.body.data.failed).toBe(1);
    expect(res.body.data.results[0].status).toBe("FAILED");
  });

  it("rejects a non-admin from calling the bulk invite endpoint", async () => {
    const patient = await createPatientUser("bulk-gate-patient@test.com", "Pass123456");
    const agent = await loginAgent(app, patient.email, patient.password);

    const res = await agent
      .post("/admin/invitations/bulk")
      .attach("file", csvBuffer("email,role\na@test.com,PATIENT\n"), {
        filename: "gate.csv",
        contentType: "text/csv",
      });

    expect(res.status).toBe(403);
  });

  it("rejects a request with no file attached", async () => {
    const admin = await createAdminUser();
    const adminAgent = await loginAgent(app, admin.email, admin.password);

    const res = await adminAgent.post("/admin/invitations/bulk");
    expect(res.status).toBe(400);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app)
      .post("/admin/invitations/bulk")
      .attach("file", csvBuffer("email,role\na@test.com,PATIENT\n"), {
        filename: "unauth.csv",
        contentType: "text/csv",
      });
    expect(res.status).toBe(401);
  });
});
