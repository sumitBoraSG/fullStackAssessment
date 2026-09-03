import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { USER_KEY } from "./api/apiClient";
import { defaultDoctorUser, defaultPatientUser } from "./test/msw/handlers";
import App from "./App";

// Canary for a React-19 render-phase side effect described in the test plan:
// AppContent used to call `navigate()` and `setNotification()` directly in
// its render body (not inside useEffect) when a non-admin user hits
// /admin*. Empirically running the ORIGINAL code against this test revealed
// a real React console.error on every affected render:
//   "Cannot update a component (`RouterProvider`) while rendering a
//    different component (`AppContent`)."
// This is a genuine rules-of-React violation (state update during another
// component's render), not a StrictMode-only artifact - it reproduced with
// a single render pass, no StrictMode involved. It was fixed by moving the
// redirect + notification into a `useEffect` keyed on
// [isAuthenticated, user, path]. This test now guards both the observable
// behavior (redirect + toast still happen) and the absence of that
// console.error going forward.

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  localStorage.clear();
});

describe("App - React 19 render-phase side-effect canary (non-admin hitting /admin*)", () => {
  it("redirects a logged-in patient away from /admin* to /dashboard and shows the access-denied toast, with no React render-purity console.error", async () => {
    localStorage.setItem(USER_KEY, JSON.stringify(defaultPatientUser));
    window.history.pushState({}, "", "/admin/invitations");

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe("/dashboard"));
    expect(await screen.findByText(/Access denied\. Admin privileges are required/i)).toBeInTheDocument();

    const stateUpdateWarning = consoleErrorSpy.mock.calls.find((args: unknown[]) =>
      args.some((a: unknown) => typeof a === "string" && a.includes("while rendering a different component")),
    );
    expect(stateUpdateWarning).toBeUndefined();
  });

  it("does not redirect a doctor visiting /dashboard (sanity: redirect is admin-guard-specific)", async () => {
    localStorage.setItem(USER_KEY, JSON.stringify(defaultDoctorUser));
    window.history.pushState({}, "", "/dashboard");

    render(<App />);

    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
    expect(window.location.pathname).toBe("/dashboard");
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("does not re-trigger the redirect/toast on subsequent re-renders once already on /dashboard", async () => {
    localStorage.setItem(USER_KEY, JSON.stringify(defaultPatientUser));
    window.history.pushState({}, "", "/admin/invitations");

    const { rerender } = render(<App />);
    await waitFor(() => expect(window.location.pathname).toBe("/dashboard"));

    rerender(<App />);
    rerender(<App />);

    const stateUpdateWarning = consoleErrorSpy.mock.calls.find((args: unknown[]) =>
      args.some((a: unknown) => typeof a === "string" && a.includes("while rendering a different component")),
    );
    expect(stateUpdateWarning).toBeUndefined();
    expect(window.location.pathname).toBe("/dashboard");
  });
});
