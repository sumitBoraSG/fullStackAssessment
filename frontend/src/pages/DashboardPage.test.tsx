import { afterEach, describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/render";
import { USER_KEY } from "../api/apiClient";
import { defaultAdminUser, defaultDoctorUser, defaultPatientUser } from "../test/msw/handlers";
import { DashboardPage } from "./DashboardPage";
import type { User } from "../types/auth";

function renderDashboardAs(user: User) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return renderWithProviders(<DashboardPage />);
}

afterEach(() => {
  localStorage.clear();
});

describe("DashboardPage", () => {
  it("greets a PATIENT user and defaults to the doctor-discovery tab", async () => {
    renderDashboardAs(defaultPatientUser);
    expect(screen.getByText(`Welcome, ${defaultPatientUser.firstName} ${defaultPatientUser.lastName}!`)).toBeInTheDocument();
    expect(await screen.findByText("No Doctors Found")).toBeInTheDocument();
  });

  it("switches a PATIENT user to the My Appointments tab", async () => {
    const user = userEvent.setup();
    renderDashboardAs(defaultPatientUser);
    await screen.findByText("No Doctors Found");

    await user.click(screen.getByRole("button", { name: /my appointments/i }));

    expect(await screen.findByText("No Appointments Found")).toBeInTheDocument();
  });

  it("greets a DOCTOR user and defaults to the patient-appointments tab", async () => {
    renderDashboardAs(defaultDoctorUser);
    expect(screen.getByText(`Welcome, ${defaultDoctorUser.firstName} ${defaultDoctorUser.lastName}!`)).toBeInTheDocument();
    expect(await screen.findByText("No Appointments Found")).toBeInTheDocument();
  });

  it("switches a DOCTOR user to the My Availability tab", async () => {
    const user = userEvent.setup();
    renderDashboardAs(defaultDoctorUser);
    await screen.findByText("No Appointments Found");

    await user.click(screen.getByRole("button", { name: /my availability/i }));

    expect(await screen.findByText("No Availability Slots Set")).toBeInTheDocument();
  });

  it("shows the Administrative Tools card for an ADMIN user and navigates to the admin panel on click", async () => {
    const user = userEvent.setup();
    renderDashboardAs(defaultAdminUser);

    expect(screen.getByText("Administrative Tools")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /go to admin panel/i }));

    expect(window.location.pathname).toBe("/admin/invitations");
  });
});
