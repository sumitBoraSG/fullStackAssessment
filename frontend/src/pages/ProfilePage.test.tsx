import { afterEach, describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../test/render";
import { server } from "../test/msw/server";
import { USER_KEY } from "../api/apiClient";
import { defaultAdminUser, defaultDoctorUser, defaultPatientUser } from "../test/msw/handlers";
import { ProfilePage } from "./ProfilePage";
import { Toast } from "../components/Toast";

const BASE = "http://localhost:3000";

function renderProfileAs(user: typeof defaultPatientUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return renderWithProviders(
    <>
      <ProfilePage />
      <Toast />
    </>,
  );
}

afterEach(() => {
  localStorage.clear();
});

describe("ProfilePage", () => {
  it("shows a loading skeleton before the profile resolves", async () => {
    server.use(
      http.get(`${BASE}/patient/profile`, async () => {
        await new Promise((r) => setTimeout(r, 20));
        return HttpResponse.json({ success: true, data: null });
      }),
    );
    renderProfileAs(defaultPatientUser);
    // Header renders immediately with user info regardless of load state.
    expect(screen.getByText(defaultPatientUser.email)).toBeInTheDocument();
  });

  it("renders the PatientProfileForm for a PATIENT user with the fetched profile data", async () => {
    renderProfileAs(defaultPatientUser);
    expect(await screen.findByText("Vitals")).toBeInTheDocument();
    expect(screen.getByDisplayValue("170")).toBeInTheDocument();
    expect(screen.getByDisplayValue("70")).toBeInTheDocument();
  });

  it("renders the DoctorProfileForm for a DOCTOR user with the fetched profile data", async () => {
    renderProfileAs(defaultDoctorUser);
    expect(await screen.findByText("Practice Details")).toBeInTheDocument();
    expect(screen.getByDisplayValue("5")).toBeInTheDocument();
  });

  it("shows the admin-specific message for an ADMIN user and skips the profile fetch entirely", async () => {
    let profileFetchCount = 0;
    server.use(
      http.get(`${BASE}/patient/profile`, () => {
        profileFetchCount += 1;
        return HttpResponse.json({ success: true, data: null });
      }),
      http.get(`${BASE}/doctor/profile`, () => {
        profileFetchCount += 1;
        return HttpResponse.json({ success: true, data: null });
      }),
    );

    renderProfileAs(defaultAdminUser);
    expect(await screen.findByText("Profile editing is not applicable to admin accounts.")).toBeInTheDocument();
    expect(profileFetchCount).toBe(0);
  });

  it("shows a retry-able error state when loading the profile fails, and recovers on retry", async () => {
    let callCount = 0;
    server.use(
      http.get(`${BASE}/patient/profile`, () => {
        callCount += 1;
        if (callCount === 1) {
          return HttpResponse.json({ success: false, message: "Failed to load your profile." }, { status: 500 });
        }
        return HttpResponse.json({
          success: true,
          data: { id: 1, firstName: "Pat", lastName: "Ient", email: "patient@test.com", dob: "1990-01-01", bloodGroup: "O+", heightCm: 170, weightKg: 70 },
        });
      }),
    );

    const user = userEvent.setup();
    renderProfileAs(defaultPatientUser);

    expect(await screen.findByText("Failed to load your profile.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(screen.getByText("Vitals")).toBeInTheDocument());
    expect(callCount).toBe(2);
  });

  it("shows a success toast and reflects the saved values after updating the patient profile", async () => {
    const user = userEvent.setup();
    renderProfileAs(defaultPatientUser);
    await screen.findByText("Vitals");

    const heightInput = screen.getByDisplayValue("170");
    await user.clear(heightInput);
    await user.type(heightInput, "180");

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Profile updated successfully")).toBeInTheDocument();
    expect(screen.getByDisplayValue("180")).toBeInTheDocument();
  });

  it("shows a validation error and does not submit when height is out of range", async () => {
    const user = userEvent.setup();
    renderProfileAs(defaultPatientUser);
    await screen.findByText("Vitals");

    const heightInput = screen.getByDisplayValue("170");
    await user.clear(heightInput);
    await user.type(heightInput, "999");

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Must be between 30 and 300 cm")).toBeInTheDocument();
  });

  it("shows a server error and does not clear the form when the patient profile save fails", async () => {
    server.use(
      http.patch(`${BASE}/patient/profile`, () =>
        HttpResponse.json({ success: false, message: "Failed to update your profile." }, { status: 500 }),
      ),
    );

    const user = userEvent.setup();
    renderProfileAs(defaultPatientUser);
    await screen.findByText("Vitals");

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Failed to update your profile.")).toBeInTheDocument();
  });

  it("shows a validation error and does not submit when doctor experienceYears is out of range", async () => {
    const user = userEvent.setup();
    renderProfileAs(defaultDoctorUser);
    await screen.findByText("Practice Details");

    const experienceInput = screen.getByDisplayValue("5");
    await user.clear(experienceInput);
    await user.type(experienceInput, "999");

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Must be between 0 and 80 years")).toBeInTheDocument();
  });

  it("shows a success toast and reflects the saved value after updating the doctor profile", async () => {
    const user = userEvent.setup();
    renderProfileAs(defaultDoctorUser);
    await screen.findByText("Practice Details");

    const experienceInput = screen.getByDisplayValue("5");
    await user.clear(experienceInput);
    await user.type(experienceInput, "12");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Profile updated successfully")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12")).toBeInTheDocument();
  });

  it("shows a server error when the doctor profile save fails", async () => {
    server.use(
      http.patch(`${BASE}/doctor/profile`, () =>
        HttpResponse.json({ success: false, message: "Failed to update your profile." }, { status: 500 }),
      ),
    );

    const user = userEvent.setup();
    renderProfileAs(defaultDoctorUser);
    await screen.findByText("Practice Details");

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Failed to update your profile.")).toBeInTheDocument();
  });
});
