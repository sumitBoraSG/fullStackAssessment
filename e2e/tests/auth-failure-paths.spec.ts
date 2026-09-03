import { test, expect } from "@playwright/test";
import { E2E_ADMIN, TEST_DATABASE_URL } from "../env";
import { resetE2eDatabase } from "../utils/db";
import { getUserIdByEmail, createPatientUser, seedPendingInvitation } from "../utils/fixtures";

// Journey: invalid login, expired/garbage invitation links, and a forced
// logout when the session becomes invalid.
const PATIENT_EMAIL = "e2e-authfail-patient@test.com";
const PATIENT_PASSWORD = "PatientPass123!";

let expiredToken: string;

test.beforeAll(async () => {
  await resetE2eDatabase(TEST_DATABASE_URL!);

  await createPatientUser(TEST_DATABASE_URL!, PATIENT_EMAIL, PATIENT_PASSWORD);

  const adminId = await getUserIdByEmail(TEST_DATABASE_URL!, E2E_ADMIN.email);
  const { rawToken } = await seedPendingInvitation(
    TEST_DATABASE_URL!,
    "e2e-authfail-expired@test.com",
    "PATIENT",
    adminId,
    { expiresAt: new Date(Date.now() - 60 * 60 * 1000) }, // expired 1h ago
  );
  expiredToken = rawToken;
});

test("shows an error toast for invalid login credentials", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("name@example.com").fill(PATIENT_EMAIL);
  await page.getByPlaceholder("••••••••").fill("TotallyWrongPassword123!");
  await page.getByRole("button", { name: "Sign In" }).click();

  // Previously a real bug here: loginApi() returned the raw backend error
  // body without normalizing {status,message} into {success,error}, so
  // AuthContext.login() always fell back to its generic "Invalid
  // credentials..." text regardless of the real reason. Fixed in
  // frontend/src/api/authApi.ts — the backend's actual message now reaches
  // the user.
  await expect(page.getByText("Invalid email or password")).toBeVisible();
  // Login page must still be showing — no session was established.
  await expect(page.getByRole("heading", { name: "Welcome to DocPulse" })).toBeVisible();
});

test("rejects an expired invitation link", async ({ page }) => {
  await page.goto(`/accept-invitation?token=${expiredToken}`);

  await expect(page.getByRole("heading", { name: "Invitation Unavailable" })).toBeVisible();
  await expect(page.getByText("This invitation has expired")).toBeVisible();
});

test("rejects a garbage/nonexistent invitation link", async ({ page }) => {
  await page.goto(`/accept-invitation?token=${"f".repeat(64)}`);

  await expect(page.getByRole("heading", { name: "Invitation Unavailable" })).toBeVisible();
});

test("forces a logout back to the login page when the session becomes invalid", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("name@example.com").fill(PATIENT_EMAIL);
  await page.getByPlaceholder("••••••••").fill(PATIENT_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page.getByRole("heading", { name: /Welcome, E2E Patient/ })).toBeVisible();

  // Simulate an invalid/expired session by dropping the auth cookies
  // directly, then trigger an authenticated request. apiClient's 401
  // handling tries a refresh (which also fails, since the refresh cookie is
  // gone too) and ends the session client-side, dropping back to the login
  // screen — a faithful stand-in for real access+refresh token expiry
  // without waiting out their real (15m / 7d) lifetimes.
  await page.context().clearCookies();
  await page.getByRole("button", { name: "My Appointments" }).click();

  await expect(page.getByRole("heading", { name: "Welcome to DocPulse" })).toBeVisible({ timeout: 10_000 });
});
