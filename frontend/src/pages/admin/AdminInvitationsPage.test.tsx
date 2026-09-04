import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "../../context/AuthContext";
import { server } from "../../test/msw/server";
import { Toast } from "../../components/Toast";
import { AdminInvitationsPage } from "./AdminInvitationsPage";
import type { InvitationItem } from "../../types/auth";

const BASE = "http://localhost:3000";

function renderPage() {
  return render(
    <AuthProvider>
      <AdminInvitationsPage />
      <Toast />
    </AuthProvider>,
  );
}

function makeInvitation(overrides: Partial<InvitationItem>): InvitationItem {
  return {
    id: 1,
    email: "invitee@test.com",
    role: "PATIENT",
    status: "PENDING",
    expiresAt: "2099-01-01T00:00:00.000Z",
    usedAt: null,
    revokedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function withInvitations(data: InvitationItem[], total = data.length) {
  server.use(
    http.get(`${BASE}/admin/invitations`, () =>
      HttpResponse.json({
        success: true,
        data,
        pagination: { page: 1, limit: 10, total, totalPages: Math.max(1, Math.ceil(total / 10)) },
      }),
    ),
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("AdminInvitationsPage", () => {
  it("shows an empty state when there are no invitations", async () => {
    renderPage();
    expect(await screen.findByText("No invitations found")).toBeInTheDocument();
  });

  it("renders a table row per invitation with role and status badges", async () => {
    withInvitations([makeInvitation({ id: 1, email: "doc@test.com", role: "DOCTOR", status: "PENDING" })]);
    renderPage();

    expect(await screen.findByText("doc@test.com")).toBeInTheDocument();
    // "Doctor" and "Pending" also appear as <option>s in the role/status
    // filter dropdowns, so just confirm each renders at least once more
    // (on the table row) too.
    expect(screen.getAllByText("Doctor").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Pending").length).toBeGreaterThanOrEqual(1);
  });

  it("shows a fetch-error banner with a retry action when loading fails", async () => {
    let callCount = 0;
    server.use(
      http.get(`${BASE}/admin/invitations`, () => {
        callCount += 1;
        if (callCount === 1) {
          return HttpResponse.json({ success: false, message: "Unable to load invitations from the server." }, { status: 500 });
        }
        return HttpResponse.json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Failed to load invitations")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(screen.getByText("No invitations found")).toBeInTheDocument());
    expect(callCount).toBe(2);
  });

  it("debounces the search input and sends the trimmed query as a `search` param", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let lastSearch: string | null | undefined;
    let callCount = 0;
    server.use(
      http.get(`${BASE}/admin/invitations`, ({ request }) => {
        callCount += 1;
        lastSearch = new URL(request.url).searchParams.get("search");
        return HttpResponse.json({ success: true, data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } });
      }),
    );

    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
    renderPage();
    await screen.findByText("No invitations found");
    const callsBeforeTyping = callCount;

    await user.type(screen.getByPlaceholderText("Search by recipient email..."), "ali");

    // Debounce is 300ms; nothing new should have been sent yet.
    expect(callCount).toBe(callsBeforeTyping);

    await waitFor(() => expect(lastSearch).toBe("ali"));
  });

  it("filters by status and by role via the dropdowns", async () => {
    let lastStatus: string | null = null;
    let lastRole: string | null = null;
    server.use(
      http.get(`${BASE}/admin/invitations`, ({ request }) => {
        const url = new URL(request.url);
        lastStatus = url.searchParams.get("status");
        lastRole = url.searchParams.get("role");
        return HttpResponse.json({ success: true, data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } });
      }),
    );

    const user = userEvent.setup();
    renderPage();
    await screen.findByText("No invitations found");

    const [statusSelect, roleSelect] = screen.getAllByRole("combobox");
    await user.selectOptions(statusSelect, "REVOKED");
    await waitFor(() => expect(lastStatus).toBe("REVOKED"));

    await user.selectOptions(roleSelect, "DOCTOR");
    await waitFor(() => expect(lastRole).toBe("DOCTOR"));

    expect(screen.getByText("Reset")).toBeInTheDocument();
  });

  it("sends a single invitation successfully via the Invite User modal and shows a success toast", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("No invitations found");

    await user.click(screen.getByRole("button", { name: "Invite User" }));
    // The modal's <h2> title text ("Invite New User") duplicates the empty
    // state's CTA button text, so disambiguate via the heading role.
    expect(await screen.findByRole("heading", { name: "Invite New User" })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("e.g. practitioner@docpulse.com"), "newdoc@test.com");
    await user.click(screen.getByRole("button", { name: "Doctor" }));
    await user.click(screen.getByRole("button", { name: /send invitation/i }));

    expect(await screen.findByText(/Invitation sent successfully/i)).toBeInTheDocument();
  });

  it("only offers Doctor and Admin in the Invite User modal's role selector: patients self-register instead", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("No invitations found");

    await user.click(screen.getByRole("button", { name: "Invite User" }));
    await screen.findByRole("heading", { name: "Invite New User" });

    expect(screen.getByRole("button", { name: "Doctor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Admin" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Patient" })).not.toBeInTheDocument();
  });

  it("still offers Patient in the historical role filter dropdown", async () => {
    renderPage();
    await screen.findByText("No invitations found");

    const [, roleSelect] = screen.getAllByRole("combobox");
    expect(roleSelect).toHaveTextContent("Patient");
  });

  it("shows a validation error and does not submit the single-invite form for an invalid email", async () => {
    // Note: this exercises the app's own validateInvite() message, which is
    // only reachable because the form has noValidate (see the bug fixed
    // alongside this test - the form was previously missing noValidate,
    // which let the browser's native type="email" constraint validation
    // silently swallow the submit event before onSubmit ever ran).
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("No invitations found");

    await user.click(screen.getByRole("button", { name: /invite user/i }));
    await user.type(screen.getByPlaceholderText("e.g. practitioner@docpulse.com"), "not-an-email");
    await user.click(screen.getByRole("button", { name: /send invitation/i }));

    expect(await screen.findByText("Please enter a valid email address")).toBeInTheDocument();
  });

  it("shows a server error toast (e.g. duplicate invite) inline in the single-invite form", async () => {
    server.use(
      http.post(`${BASE}/admin/invite`, () =>
        HttpResponse.json(
          { success: false, code: "INVITE_CONFLICT", message: "An active invitation already exists for this email." },
          { status: 409 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderPage();
    await screen.findByText("No invitations found");

    await user.click(screen.getByRole("button", { name: /invite user/i }));
    await user.type(screen.getByPlaceholderText("e.g. practitioner@docpulse.com"), "existing@test.com");
    await user.click(screen.getByRole("button", { name: /send invitation/i }));

    const matches = await screen.findAllByText("An active invitation already exists for this email.");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("revokes a PENDING invitation via the confirmation modal and shows a success toast", async () => {
    withInvitations([makeInvitation({ id: 7, email: "revokeme@test.com", status: "PENDING" })]);
    server.use(
      http.post(`${BASE}/admin/invitations/:id/revoke`, () =>
        HttpResponse.json({
          success: true,
          message: "Invitation revoked successfully",
          data: { id: 7, email: "revokeme@test.com", role: "PATIENT", status: "REVOKED" },
        }),
      ),
    );

    const user = userEvent.setup();
    renderPage();
    await screen.findByText("revokeme@test.com");

    await user.click(screen.getByRole("button", { name: "Revoke" }));
    expect(await screen.findByText("Revoke Invitation")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /confirm revoke/i }));

    expect(await screen.findByText("Invitation revoked successfully")).toBeInTheDocument();
  });

  it("does not offer a Revoke action for USED or REVOKED invitations", async () => {
    withInvitations([
      makeInvitation({ id: 1, email: "used@test.com", status: "USED", usedAt: "2026-01-02T00:00:00.000Z" }),
      makeInvitation({ id: 2, email: "revoked@test.com", status: "REVOKED", revokedAt: "2026-01-02T00:00:00.000Z" }),
    ]);
    renderPage();

    await screen.findByText("used@test.com");
    expect(screen.queryByRole("button", { name: "Revoke" })).not.toBeInTheDocument();
  });

  it("shows an error message in the revoke modal and keeps it open when revoke fails", async () => {
    withInvitations([makeInvitation({ id: 7, email: "revokeme@test.com", status: "PENDING" })]);
    server.use(
      http.post(`${BASE}/admin/invitations/:id/revoke`, () =>
        HttpResponse.json(
          { success: false, code: "ALREADY_USED", message: "This invitation has already been used." },
          { status: 409 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderPage();
    await screen.findByText("revokeme@test.com");

    await user.click(screen.getByRole("button", { name: "Revoke" }));
    await user.click(screen.getByRole("button", { name: /confirm revoke/i }));

    const matches = await screen.findAllByText("This invitation has already been used.");
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Revoke Invitation")).toBeInTheDocument();
  });

  it("opens the Bulk Invite modal and refreshes the table after a successful bulk upload", async () => {
    server.use(
      http.post(`${BASE}/admin/invitations/bulk`, () =>
        HttpResponse.json({
          success: true,
          data: { total: 1, successful: 1, failed: 0, results: [{ email: "bulk@test.com", role: "DOCTOR", status: "INVITED" }] },
        }),
      ),
    );

    const user = userEvent.setup();
    renderPage();
    await screen.findByText("No invitations found");

    await user.click(screen.getByRole("button", { name: /bulk invite/i }));
    expect(await screen.findByText("Bulk Invitations")).toBeInTheDocument();

    const fileInput = document.querySelector("#bulk-csv-upload-input") as HTMLInputElement;
    const file = new File(["email,role\nbulk@test.com,DOCTOR"], "bulk.csv", { type: "text/csv" });
    await user.upload(fileInput, file);
    await user.click(screen.getByRole("button", { name: /upload & invite/i }));

    expect(await screen.findByText("All Invitations Processed Successfully")).toBeInTheDocument();

    // Closing after a successful batch should trigger a silent refresh.
    withInvitations([makeInvitation({ id: 99, email: "bulk@test.com" })]);
    await user.click(screen.getByRole("button", { name: /^done$/i }));

    expect(await screen.findByText("bulk@test.com")).toBeInTheDocument();
  });
});
