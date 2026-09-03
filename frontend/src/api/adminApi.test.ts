import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../test/msw/server";
import {
  bulkInviteUsersApi,
  getAllInvitationsApi,
  inviteUserApi,
  revokeInvitationApi,
} from "./adminApi";

const BASE = "http://localhost:3000";

describe("adminApi", () => {
  it("inviteUserApi returns the created invitation on success", async () => {
    const result = await inviteUserApi("new@test.com", "PATIENT");
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("new@test.com");
  });

  it("inviteUserApi surfaces an error envelope (e.g. duplicate invite)", async () => {
    server.use(
      http.post(`${BASE}/admin/invite`, () =>
        HttpResponse.json(
          { success: false, code: "INVITE_CONFLICT", message: "An active invitation already exists for this email." },
          { status: 409 },
        ),
      ),
    );

    const result = await inviteUserApi("existing@test.com", "PATIENT");
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("INVITE_CONFLICT");
  });

  it("getAllInvitationsApi returns data + pagination on success", async () => {
    server.use(
      http.get(`${BASE}/admin/invitations`, () =>
        HttpResponse.json({
          success: true,
          data: [{ id: 1, email: "a@test.com", role: "PATIENT", status: "PENDING", expiresAt: "2099-01-01", usedAt: null, revokedAt: null, createdAt: "2026-01-01" }],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }),
      ),
    );

    const result = await getAllInvitationsApi({ search: "a" });
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.pagination?.total).toBe(1);
  });

  it("getAllInvitationsApi returns an empty-but-well-formed result on server error", async () => {
    server.use(
      http.get(`${BASE}/admin/invitations`, () =>
        HttpResponse.json({ success: false, message: "Failed to load invitations. Please try again." }, { status: 500 }),
      ),
    );

    const result = await getAllInvitationsApi();
    expect(result.success).toBe(false);
    expect(result.data).toEqual([]);
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 0, totalPages: 1 });
  });

  it("bulkInviteUsersApi returns the results summary on success", async () => {
    server.use(
      http.post(`${BASE}/admin/invitations/bulk`, () =>
        HttpResponse.json({
          success: true,
          message: "Bulk invitation process completed",
          data: { total: 2, successful: 1, failed: 1, results: [] },
        }),
      ),
    );

    const file = new File(["email,role\na@test.com,PATIENT"], "invites.csv", { type: "text/csv" });
    const result = await bulkInviteUsersApi(file);
    expect(result.success).toBe(true);
    expect(result.data?.total).toBe(2);
  });

  it("bulkInviteUsersApi surfaces a file-rejection error envelope", async () => {
    server.use(
      http.post(`${BASE}/admin/invitations/bulk`, () =>
        HttpResponse.json(
          { success: false, code: "INVALID_FILE_TYPE", message: "Only CSV files are accepted." },
          { status: 400 },
        ),
      ),
    );

    const file = new File(["not a csv"], "invites.txt", { type: "text/plain" });
    const result = await bulkInviteUsersApi(file);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("INVALID_FILE_TYPE");
  });

  it("revokeInvitationApi returns the revoked invitation on success", async () => {
    const result = await revokeInvitationApi(5);
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe("REVOKED");
  });

  it("revokeInvitationApi surfaces a 404/409-style error envelope", async () => {
    server.use(
      http.post(`${BASE}/admin/invitations/:id/revoke`, () =>
        HttpResponse.json(
          { success: false, code: "ALREADY_USED", message: "This invitation has already been used." },
          { status: 409 },
        ),
      ),
    );

    const result = await revokeInvitationApi(5);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("ALREADY_USED");
  });
});
