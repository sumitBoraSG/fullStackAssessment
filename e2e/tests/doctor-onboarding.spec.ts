import { test, expect } from "@playwright/test";
import { E2E_ADMIN, TEST_DATABASE_URL } from "../env";
import { resetE2eDatabase } from "../utils/db";
import { getUserIdByEmail, seedPendingInvitation, istDateString } from "../utils/fixtures";

// Journey: invite -> accept -> login -> add availability.
//
// The admin-invite half of this journey (the real POST /admin/invite call +
// its outgoing email) is exercised for real, end-to-end, in
// admin-bulk-invite.spec.ts. Here the invitation is instead seeded directly
// via a raw-token-plus-hash pair generated the exact same way the backend
// generates one (see e2e/utils/fixtures.ts's seedPendingInvitation for the
// full rationale) — there is no test-mode email stub or SMTP catcher wired
// into this repo, so the raw token used to drive the real accept-invitation
// UI/API can't otherwise be recovered without modifying backend source or
// config, which is out of scope here. Everything from this point on
// (accept-invitation form, validation, login, availability creation) is
// driven through the real UI against the real backend.
const DOCTOR_EMAIL = "e2e-onboarding-doctor@test.com";
const DOCTOR_PASSWORD = "DoctorPass123!";

let invitationToken: string;

test.beforeAll(async () => {
  await resetE2eDatabase(TEST_DATABASE_URL!);
  const adminId = await getUserIdByEmail(TEST_DATABASE_URL!, E2E_ADMIN.email);
  const { rawToken } = await seedPendingInvitation(TEST_DATABASE_URL!, DOCTOR_EMAIL, "DOCTOR", adminId);
  invitationToken = rawToken;
});

test("doctor accepts an invitation, logs in, and publishes an availability slot", async ({ page }) => {
  // --- Accept invitation ---
  await page.goto(`/accept-invitation?token=${invitationToken}`);
  await expect(page.getByRole("heading", { name: "Complete Your Registration" })).toBeVisible();
  await expect(page.getByText(DOCTOR_EMAIL)).toBeVisible();

  await page.getByPlaceholder("John").fill("Ada");
  await page.getByPlaceholder("Doe").fill("Doctorson");
  await page.getByPlaceholder("••••••••").first().fill(DOCTOR_PASSWORD);
  await page.getByPlaceholder("••••••••").nth(1).fill(DOCTOR_PASSWORD);

  await page.getByRole("combobox").selectOption({ label: "General Practitioner" });
  await page.getByPlaceholder("e.g. 5").fill("8");

  await page.getByRole("button", { name: "Create & Activate Account" }).click();

  // Success redirects to /login after a short delay.
  await expect(page.getByRole("heading", { name: "Welcome to DocPulse" })).toBeVisible({ timeout: 10_000 });

  // --- Log in as the newly-created doctor ---
  await page.getByPlaceholder("name@example.com").fill(DOCTOR_EMAIL);
  await page.getByPlaceholder("••••••••").fill(DOCTOR_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page.getByRole("heading", { name: /Welcome, Ada Doctorson/ })).toBeVisible();

  // --- Add an availability slot for tomorrow (IST) ---
  await page.getByRole("button", { name: "My Availability" }).click();

  const tomorrow = istDateString(1);
  await page.locator('input[type="date"]').fill(tomorrow);
  await page.getByRole("button", { name: "Add Availability Slot" }).click();

  await expect(page.getByText("Availability slot added successfully!")).toBeVisible();
  // The form's own "slot duration" preview pill also renders "9:00 AM –
  // 12:00 PM" live, so two matches exist once the slot is saved — the
  // saved-slot list entry is the one rendered later in the DOM.
  await expect(page.getByText("9:00 AM – 12:00 PM").last()).toBeVisible();
});
