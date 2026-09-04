import { test, expect } from "@playwright/test";
import { TEST_DATABASE_URL } from "../env";
import { resetE2eDatabase } from "../utils/db";
import { createPatientUser } from "../utils/fixtures";

// Journey: the new patient self-registration entry point
// (POST /auth/patient/self-register), driven through the real UI against the
// real backend + test DB. This endpoint is deliberately generic-response-only
// (see backend/src/service/auth.service.ts and
// frontend/src/pages/PatientSelfRegisterPage.tsx) — it must not let the UI
// distinguish a brand-new email from one that already belongs to an account,
// so that's asserted here against the real backend, not a mock. The
// continuation (accept-invitation -> login) is intentionally NOT re-tested
// here: it's already covered end-to-end by patient-booking.spec.ts and by
// backend/test/integration/patient-self-register.test.ts's own full-flow
// case, and the raw invitation token used to continue that flow only ever
// exists inside the real outbound email (see fixtures.ts's
// seedPendingInvitation doc comment) — there's no way to drive it further
// from here without either a real SMTP catcher or bypassing this endpoint
// entirely, which would defeat the point of this spec.
const EXISTING_PATIENT_EMAIL = "e2e-selfreg-existing@test.com";
const EXISTING_PATIENT_PASSWORD = "PatientPass123!";

test.beforeAll(async () => {
  await resetE2eDatabase(TEST_DATABASE_URL!);
  await createPatientUser(TEST_DATABASE_URL!, EXISTING_PATIENT_EMAIL, EXISTING_PATIENT_PASSWORD);
});

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("navigates from the login page to self-registration and back", async ({ page }) => {
  await page.getByRole("button", { name: "New patient? Create an account" }).click();
  await expect(page.getByRole("heading", { name: "Create Your Patient Account" })).toBeVisible();

  await page.getByRole("button", { name: "Already registered? Sign in instead" }).click();
  await expect(page.getByRole("heading", { name: "Welcome to DocPulse" })).toBeVisible();
});

test("rejects an invalid email format client-side without contacting the backend", async ({ page }) => {
  await page.getByRole("button", { name: "New patient? Create an account" }).click();

  await page.getByPlaceholder("name@example.com").fill("not-an-email");
  await page.getByRole("button", { name: "Verify Email" }).click();

  await expect(page.getByText("Please enter a valid email address")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create Your Patient Account" })).toBeVisible();
});

test("shows the same generic confirmation for a brand-new email as for an already-registered one", async ({
  page,
}) => {
  await page.getByRole("button", { name: "New patient? Create an account" }).click();
  await page.getByPlaceholder("name@example.com").fill("e2e-selfreg-new@test.com");
  await page.getByRole("button", { name: "Verify Email" }).click();

  await expect(page.getByRole("heading", { name: "Check Your Inbox" })).toBeVisible();
  await expect(page.getByText("e2e-selfreg-new@test.com")).toBeVisible();

  await page.getByRole("button", { name: "Back to Login" }).click();
  await expect(page.getByRole("heading", { name: "Welcome to DocPulse" })).toBeVisible();

  // Same request against a real, already-registered patient's email — the
  // real backend must return the identical generic response (no account
  // enumeration), and the frontend must render the identical confirmation.
  await page.getByRole("button", { name: "New patient? Create an account" }).click();
  await page.getByPlaceholder("name@example.com").fill(EXISTING_PATIENT_EMAIL);
  await page.getByRole("button", { name: "Verify Email" }).click();

  await expect(page.getByRole("heading", { name: "Check Your Inbox" })).toBeVisible();
  await expect(page.getByText(EXISTING_PATIENT_EMAIL)).toBeVisible();
});
