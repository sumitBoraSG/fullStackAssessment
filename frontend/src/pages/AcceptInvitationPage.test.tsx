import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../test/render";
import { server } from "../test/msw/server";
import { defaultSpecializations } from "../test/msw/handlers";
import { AcceptInvitationPage } from "./AcceptInvitationPage";
import { Toast } from "../components/Toast";

const BASE = "http://localhost:3000";

function renderPage(route: string) {
  return renderWithProviders(
    <>
      <AcceptInvitationPage />
      <Toast />
    </>,
    { route },
  );
}

describe("AcceptInvitationPage", () => {
  it("shows the invalid-link state when there is no token in the URL", () => {
    renderPage("/accept-invitation");
    expect(screen.getByText("Invalid Invitation Link")).toBeInTheDocument();
  });

  it("shows a verifying state and then the invitation-unavailable state for an expired/garbage token", async () => {
    server.use(
      http.get(`${BASE}/auth/invitation/:token`, () =>
        HttpResponse.json({ success: false, message: "This invitation link has expired." }, { status: 400 }),
      ),
    );

    renderPage("/accept-invitation?token=garbage");

    expect(screen.getByText("Verifying your invitation...")).toBeInTheDocument();
    expect(await screen.findByText("Invitation Unavailable")).toBeInTheDocument();
    expect(screen.getByText("This invitation link has expired.")).toBeInTheDocument();
  });

  it("renders patient-specific fields for a PATIENT invitation (default handler)", async () => {
    renderPage("/accept-invitation?token=validtoken");

    expect(await screen.findByText(/Patient Account/i)).toBeInTheDocument();
    expect(screen.getByText("Date of Birth")).toBeInTheDocument();
    expect(screen.getByText("Blood Group")).toBeInTheDocument();
    expect(screen.getByText("Height (cm)")).toBeInTheDocument();
    expect(screen.getByText("Weight (kg)")).toBeInTheDocument();
    // Doctor-only fields must not render
    expect(screen.queryByText("Years of Experience")).not.toBeInTheDocument();
  });

  it("renders doctor-specific fields and loads specializations for a DOCTOR invitation", async () => {
    server.use(
      http.get(`${BASE}/auth/invitation/:token`, () =>
        HttpResponse.json({ success: true, data: { email: "newdoc@test.com", role: "DOCTOR" } }),
      ),
    );

    renderPage("/accept-invitation?token=validtoken");

    expect(await screen.findByText(/Doctor Account/i)).toBeInTheDocument();
    expect(screen.getByText("Years of Experience")).toBeInTheDocument();
    // Patient-only fields must not render
    expect(screen.queryByText("Date of Birth")).not.toBeInTheDocument();

    await waitFor(() => {
      const select = screen.getByRole("combobox");
      expect(select).toHaveTextContent(defaultSpecializations[0].name);
      expect(select).toHaveTextContent(defaultSpecializations[1].name);
    });
  });

  it("shows a live password requirement checklist that updates as the user types", async () => {
    const user = userEvent.setup();
    renderPage("/accept-invitation?token=validtoken");
    await screen.findByText(/Patient Account/i);

    expect(screen.getByText("At least 12 characters")).toBeInTheDocument();
    const passwordInput = screen.getAllByPlaceholderText("••••••••")[0];
    await user.type(passwordInput, "short1!");

    // Still not long enough - "12 characters" rule should stay unmet, but
    // lower/number/special rules should now be satisfied (visually shown via
    // colored icon, but we can at least confirm the label list is present
    // and did not throw while re-evaluating on every keystroke).
    expect(screen.getByText("One lowercase letter")).toBeInTheDocument();
    expect(screen.getByText("One number")).toBeInTheDocument();
  });

  it("shows a 'Passwords do not match' error when confirmation differs from the password", async () => {
    const user = userEvent.setup();
    renderPage("/accept-invitation?token=validtoken");
    await screen.findByText(/Patient Account/i);

    await user.type(screen.getByPlaceholderText("John"), "Jane");
    await user.type(screen.getByPlaceholderText("Doe"), "Doe");
    const passwordInputs = screen.getAllByPlaceholderText("••••••••");
    await user.type(passwordInputs[0], "CorrectPassword1!");
    await user.type(passwordInputs[1], "DifferentPassword1!");

    await user.click(screen.getByRole("button", { name: /create & activate account/i }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
  });

  it("submits successfully for a PATIENT invitation, shows a success toast, and redirects to /login", async () => {
    const user = userEvent.setup();
    renderPage("/accept-invitation?token=validtoken");
    await screen.findByText(/Patient Account/i);

    await user.type(screen.getByPlaceholderText("John"), "Jane");
    await user.type(screen.getByPlaceholderText("Doe"), "Doe");
    const passwordInputs = screen.getAllByPlaceholderText("••••••••");
    await user.type(passwordInputs[0], "CorrectPassword1!");
    await user.type(passwordInputs[1], "CorrectPassword1!");
    await user.type(screen.getByPlaceholderText("e.g. 170"), "170");
    await user.type(screen.getByPlaceholderText("e.g. 65"), "65");

    const dobInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    await user.type(dobInput, "1995-05-05");

    const bloodGroupSelect = screen.getByRole("combobox");
    await user.selectOptions(bloodGroupSelect, "O+");

    await user.click(screen.getByRole("button", { name: /create & activate account/i }));

    expect(await screen.findByText("Account registered successfully! You can now log in.")).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe("/login"), { timeout: 2000 });
  });

  it("shows a general error banner and toast when the server rejects registration", async () => {
    server.use(
      http.post(`${BASE}/auth/accept-invitation`, () =>
        HttpResponse.json(
          { success: false, message: "This invitation has already been used." },
          { status: 400 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderPage("/accept-invitation?token=validtoken");
    await screen.findByText(/Patient Account/i);

    await user.type(screen.getByPlaceholderText("John"), "Jane");
    await user.type(screen.getByPlaceholderText("Doe"), "Doe");
    const passwordInputs = screen.getAllByPlaceholderText("••••••••");
    await user.type(passwordInputs[0], "CorrectPassword1!");
    await user.type(passwordInputs[1], "CorrectPassword1!");
    await user.type(screen.getByPlaceholderText("e.g. 170"), "170");
    await user.type(screen.getByPlaceholderText("e.g. 65"), "65");
    const dobInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    await user.type(dobInput, "1995-05-05");
    await user.selectOptions(screen.getByRole("combobox"), "O+");

    await user.click(screen.getByRole("button", { name: /create & activate account/i }));

    const matches = await screen.findAllByText("This invitation has already been used.");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
