import { afterEach, describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/render";
import { USER_KEY } from "../api/apiClient";
import { defaultAdminUser, defaultDoctorUser, defaultPatientUser } from "../test/msw/handlers";
import { Navbar } from "./Navbar";
import type { User } from "../types/auth";

function renderNavbarAs(user?: User, route = "/dashboard") {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  return renderWithProviders(<Navbar />, { route });
}

afterEach(() => {
  localStorage.clear();
});

describe("Navbar", () => {
  it("shows only the brand when the user is not authenticated", () => {
    renderNavbarAs(undefined, "/login");
    expect(screen.getByText("DocPulse")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /logout/i })).not.toBeInTheDocument();
  });

  it("shows the user's name, role badge, profile and logout actions when authenticated", () => {
    renderNavbarAs(defaultPatientUser);
    expect(screen.getByText(`${defaultPatientUser.firstName} ${defaultPatientUser.lastName}`)).toBeInTheDocument();
    expect(screen.getByText("PATIENT")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
  });

  it("shows the Admin Panel / User Dashboard shortcuts only for an ADMIN user", () => {
    renderNavbarAs(defaultAdminUser);
    expect(screen.getByRole("button", { name: /admin panel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /user dashboard/i })).toBeInTheDocument();
  });

  it("does not show the admin shortcuts for a DOCTOR user", () => {
    renderNavbarAs(defaultDoctorUser);
    expect(screen.queryByRole("button", { name: /admin panel/i })).not.toBeInTheDocument();
  });

  it("navigates to /profile when the Profile button is clicked", async () => {
    const user = userEvent.setup();
    renderNavbarAs(defaultPatientUser);

    await user.click(screen.getByRole("button", { name: /profile/i }));

    expect(window.location.pathname).toBe("/profile");
  });

  it("clicking the brand navigates to /login when unauthenticated", async () => {
    const user = userEvent.setup();
    renderNavbarAs(undefined, "/dashboard");

    await user.click(screen.getByText("DocPulse"));

    expect(window.location.pathname).toBe("/login");
  });

  it("clicking the brand navigates admins to /admin and non-admins to /dashboard", async () => {
    const user = userEvent.setup();
    renderNavbarAs(defaultAdminUser, "/profile");

    await user.click(screen.getByText("DocPulse"));

    expect(window.location.pathname).toBe("/admin");
  });
});
