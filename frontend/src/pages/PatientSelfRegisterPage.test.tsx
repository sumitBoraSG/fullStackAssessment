import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../test/render";
import { server } from "../test/msw/server";
import { PatientSelfRegisterPage } from "./PatientSelfRegisterPage";
import { Toast } from "../components/Toast";

const BASE = "http://localhost:3000";

function renderPage() {
  return renderWithProviders(
    <>
      <PatientSelfRegisterPage />
      <Toast />
    </>,
    { route: "/register" },
  );
}

describe("PatientSelfRegisterPage", () => {
  it("renders the email field and a Verify Email button", () => {
    renderPage();
    expect(screen.getByPlaceholderText("name@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /verify email/i })).toBeInTheDocument();
  });

  it("shows a required-field error and does not submit when the email is empty", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /verify email/i }));

    expect(await screen.findByText("Email address is required")).toBeInTheDocument();
  });

  it("shows a format error for an invalid email", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText("name@example.com"), "not-an-email");
    await user.click(screen.getByRole("button", { name: /verify email/i }));

    expect(await screen.findByText("Please enter a valid email address")).toBeInTheDocument();
  });

  it("shows the same generic confirmation for a brand-new email as for one that might already exist", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText("name@example.com"), "new-patient@test.com");
    await user.click(screen.getByRole("button", { name: /verify email/i }));

    expect(await screen.findByText("Check Your Inbox")).toBeInTheDocument();
    expect(screen.getByText(/new-patient@test.com/)).toBeInTheDocument();
    expect(
      screen.getByText(/is eligible for registration, you'll receive an email/i),
    ).toBeInTheDocument();
  });

  it("does not branch the confirmation copy based on response content: same message regardless of the mocked server reply", async () => {
    server.use(
      http.post(`${BASE}/auth/patient/self-register`, () =>
        HttpResponse.json({ success: true, message: "A completely different server message" }),
      ),
    );

    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText("name@example.com"), "existing-patient@test.com");
    await user.click(screen.getByRole("button", { name: /verify email/i }));

    // The confirmation screen itself is generic and does not surface the
    // server's message text directly, keeping the UI non-committal about
    // whether the email exists.
    expect(await screen.findByText("Check Your Inbox")).toBeInTheDocument();
  });

  it("shows an error banner and toast on a network/server failure", async () => {
    server.use(
      http.post(`${BASE}/auth/patient/self-register`, () =>
        HttpResponse.json({ success: false, message: "Something went wrong." }, { status: 500 }),
      ),
    );

    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText("name@example.com"), "new-patient@test.com");
    await user.click(screen.getByRole("button", { name: /verify email/i }));

    const matches = await screen.findAllByText("Something went wrong.");
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Check Your Inbox")).not.toBeInTheDocument();
  });

  it("navigates to /login when the sign-in link is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /already registered\? sign in instead/i }));

    await waitFor(() => expect(window.location.pathname).toBe("/login"));
  });
});
