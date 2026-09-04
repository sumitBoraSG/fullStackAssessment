import { test, expect } from "@playwright/test";
import { TEST_DATABASE_URL } from "../env";
import { resetE2eDatabase } from "../utils/db";
import { createDoctorUser, createPatientUser } from "../utils/fixtures";

// Journey: flow #5 in TECHNICAL_DOCUMENTATION.md's Section 16 — a doctor or
// patient opens /profile from the navbar and updates the one field their
// role is allowed to change. No E2E spec previously exercised
// PATCH /doctor/profile or PATCH /patient/profile through the real UI.
const DOCTOR_EMAIL = "e2e-profile-doctor@test.com";
const DOCTOR_PASSWORD = "DoctorPass123!";
const PATIENT_EMAIL = "e2e-profile-patient@test.com";
const PATIENT_PASSWORD = "PatientPass123!";

test.beforeAll(async () => {
  await resetE2eDatabase(TEST_DATABASE_URL!);
  await createDoctorUser(TEST_DATABASE_URL!, DOCTOR_EMAIL, DOCTOR_PASSWORD, 1, 5);
  await createPatientUser(TEST_DATABASE_URL!, PATIENT_EMAIL, PATIENT_PASSWORD, {
    heightCm: 170,
    weightKg: 70,
  });
});

test("doctor updates years of experience from the Profile page", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("name@example.com").fill(DOCTOR_EMAIL);
  await page.getByPlaceholder("••••••••").fill(DOCTOR_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: /Welcome, E2E Doctor/ })).toBeVisible();

  await page.getByRole("button", { name: "Profile" }).click();
  await expect(page.getByText("Practice Details")).toBeVisible();

  const experienceInput = page.getByPlaceholder("e.g. 5");
  await experienceInput.fill("12");
  await page.getByRole("button", { name: "Save Changes" }).click();

  await expect(page.getByText("Profile updated successfully")).toBeVisible();
  await expect(experienceInput).toHaveValue("12");

  // Persists across a reload, proving it was actually saved server-side.
  await page.reload();
  await expect(page.getByPlaceholder("e.g. 5")).toHaveValue("12");

  // The specialization itself is read-only — no input to change it exists.
  await expect(page.getByText("Read-only Information")).toBeVisible();
});

test("doctor's out-of-range experience is rejected client-side without a server round-trip", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("name@example.com").fill(DOCTOR_EMAIL);
  await page.getByPlaceholder("••••••••").fill(DOCTOR_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.getByRole("button", { name: "Profile" }).click();

  await page.getByPlaceholder("e.g. 5").fill("81");
  await page.getByRole("button", { name: "Save Changes" }).click();

  await expect(page.getByText("Must be between 0 and 80 years")).toBeVisible();
});

test("patient updates height and weight from the Profile page", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("name@example.com").fill(PATIENT_EMAIL);
  await page.getByPlaceholder("••••••••").fill(PATIENT_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: /Welcome, E2E Patient/ })).toBeVisible();

  await page.getByRole("button", { name: "Profile" }).click();
  await expect(page.getByText("Vitals")).toBeVisible();

  const heightInput = page.getByPlaceholder("e.g. 170");
  const weightInput = page.getByPlaceholder("e.g. 65");
  await heightInput.fill("182");
  await weightInput.fill("78");
  await page.getByRole("button", { name: "Save Changes" }).click();

  await expect(page.getByText("Profile updated successfully")).toBeVisible();
  await expect(heightInput).toHaveValue("182");
  await expect(weightInput).toHaveValue("78");

  // Blood group and DOB are permanent — rendered read-only, no inputs.
  await expect(page.getByText("Blood Group")).toBeVisible();
  await expect(page.getByText("Date of Birth")).toBeVisible();

  await page.reload();
  await expect(page.getByPlaceholder("e.g. 170")).toHaveValue("182");
  await expect(page.getByPlaceholder("e.g. 65")).toHaveValue("78");
});
