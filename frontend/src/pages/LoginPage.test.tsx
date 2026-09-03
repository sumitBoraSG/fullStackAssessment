import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../test/render";
import { server } from "../test/msw/server";
import { defaultPatientUser } from "../test/msw/handlers";
import { LoginPage } from "./LoginPage";
import { Toast } from "../components/Toast";

const BASE = "http://localhost:3000";

function renderLoginWithToast() {
  return renderWithProviders(
    <>
      <LoginPage />
      <Toast />
    </>,
  );
}

describe("LoginPage", () => {
  it("renders the email and password fields and a submit button", () => {
    renderLoginWithToast();
    expect(screen.getByPlaceholderText("name@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows required-field errors and does not submit when both fields are empty", async () => {
    const user = userEvent.setup();
    renderLoginWithToast();

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Email address is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
  });

  it("shows a format error for a non-empty but invalid email", async () => {
    const user = userEvent.setup();
    renderLoginWithToast();

    await user.type(screen.getByPlaceholderText("name@example.com"), "not-an-email");
    await user.type(screen.getByPlaceholderText("••••••••"), "somepassword");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Please enter a valid email address")).toBeInTheDocument();
  });

  it("logs in successfully with valid credentials and shows a welcome toast", async () => {
    const user = userEvent.setup();
    renderLoginWithToast();

    await user.type(screen.getByPlaceholderText("name@example.com"), defaultPatientUser.email);
    await user.type(screen.getByPlaceholderText("••••••••"), "CorrectPassword1!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(new RegExp(`Welcome back, ${defaultPatientUser.firstName}`))).toBeInTheDocument();
  });

  it("shows an error toast and does not log in when the server rejects the credentials", async () => {
    server.use(
      http.post(`${BASE}/auth/login`, () =>
        HttpResponse.json(
          { success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials. Please try again." } },
          { status: 401 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderLoginWithToast();

    await user.type(screen.getByPlaceholderText("name@example.com"), "wrong@test.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "WrongPassword1!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Invalid credentials. Please try again.")).toBeInTheDocument();
  });

  it("disables the submit button and shows loading text while the request is in flight", async () => {
    server.use(
      http.post(`${BASE}/auth/login`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json({ success: true, data: { user: defaultPatientUser } });
      }),
    );

    const user = userEvent.setup();
    renderLoginWithToast();

    await user.type(screen.getByPlaceholderText("name@example.com"), defaultPatientUser.email);
    await user.type(screen.getByPlaceholderText("••••••••"), "CorrectPassword1!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Authenticating...")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Authenticating...")).not.toBeInTheDocument());
  });
});
