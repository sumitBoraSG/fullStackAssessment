import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { act, render, screen, waitFor } from "@testing-library/react";
import { server } from "../test/msw/server";
import { defaultPatientUser } from "../test/msw/handlers";
import { AuthProvider, useAuth } from "./AuthContext";
import { SESSION_EXPIRED_EVENT, USER_KEY } from "../api/apiClient";

const BASE = "http://localhost:3000";

function AuthProbe() {
  const { user, isAuthenticated, isLoading, notification, setNotification, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="authed">{String(isAuthenticated)}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="user">{user ? `${user.firstName} ${user.email}` : "none"}</span>
      <span data-testid="notification">{notification ? `${notification.type}:${notification.message}` : "none"}</span>
      <button onClick={() => login(defaultPatientUser.email, "CorrectPassword1!")}>login</button>
      <button onClick={() => login("wrong@test.com", "WrongPassword1!")}>login-wrong</button>
      <button onClick={() => logout()}>logout</button>
      <button onClick={() => setNotification({ type: "info", message: "Test notification" })}>notify</button>
    </div>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>,
  );
}

afterEach(() => {
  localStorage.clear();
});

describe("AuthContext", () => {
  it("starts unauthenticated with no user when localStorage is empty", () => {
    renderAuth();
    expect(screen.getByTestId("authed")).toHaveTextContent("false");
    expect(screen.getByTestId("user")).toHaveTextContent("none");
  });

  it("hydrates the user from localStorage on mount", () => {
    localStorage.setItem(USER_KEY, JSON.stringify(defaultPatientUser));
    renderAuth();
    expect(screen.getByTestId("authed")).toHaveTextContent("true");
    expect(screen.getByTestId("user")).toHaveTextContent(defaultPatientUser.email);
  });

  it("treats corrupt JSON in localStorage as no saved user, instead of throwing", () => {
    localStorage.setItem(USER_KEY, "{not-json");
    renderAuth();
    expect(screen.getByTestId("authed")).toHaveTextContent("false");
  });

  it("login() on success sets the user, persists to localStorage, and shows a success notification", async () => {
    const user = userEvent.setup();
    renderAuth();

    await user.click(screen.getByRole("button", { name: "login" }));

    await waitFor(() => expect(screen.getByTestId("authed")).toHaveTextContent("true"));
    expect(screen.getByTestId("notification")).toHaveTextContent(`success:Welcome back, ${defaultPatientUser.firstName}!`);
    expect(JSON.parse(localStorage.getItem(USER_KEY) || "null")).toEqual(defaultPatientUser);
  });

  it("login() on failure keeps the user unauthenticated and shows an error notification", async () => {
    server.use(
      http.post(`${BASE}/auth/login`, () =>
        HttpResponse.json(
          { success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials. Please try again." } },
          { status: 401 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderAuth();

    await user.click(screen.getByRole("button", { name: "login-wrong" }));

    await waitFor(() =>
      expect(screen.getByTestId("notification")).toHaveTextContent("error:Invalid credentials. Please try again."),
    );
    expect(screen.getByTestId("authed")).toHaveTextContent("false");
  });

  it("logout() clears the user, clears storage, and shows an info notification", async () => {
    localStorage.setItem(USER_KEY, JSON.stringify(defaultPatientUser));
    const user = userEvent.setup();
    renderAuth();
    expect(screen.getByTestId("authed")).toHaveTextContent("true");

    await user.click(screen.getByRole("button", { name: "logout" }));

    await waitFor(() => expect(screen.getByTestId("authed")).toHaveTextContent("false"));
    expect(screen.getByTestId("notification")).toHaveTextContent("info:You have been logged out successfully.");
    expect(localStorage.getItem(USER_KEY)).toBeNull();
  });

  it("logs the user out when a SESSION_EXPIRED_EVENT is dispatched (e.g. from a failed token refresh)", async () => {
    localStorage.setItem(USER_KEY, JSON.stringify(defaultPatientUser));
    renderAuth();
    expect(screen.getByTestId("authed")).toHaveTextContent("true");

    act(() => {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    });

    expect(screen.getByTestId("authed")).toHaveTextContent("false");
  });

  it("auto-dismisses a notification after 5 seconds using fake timers", () => {
    vi.useFakeTimers();
    renderAuth();

    act(() => {
      screen.getByRole("button", { name: "notify" }).click();
    });
    expect(screen.getByTestId("notification")).toHaveTextContent("info:Test notification");

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByTestId("notification")).toHaveTextContent("none");
    vi.useRealTimers();
  });
});
