import fs from "fs";
import os from "os";
import path from "path";
import { test, expect } from "@playwright/test";
import { E2E_ADMIN, TEST_DATABASE_URL } from "../env";
import { resetE2eDatabase } from "../utils/db";

// Journey: admin sends a single invite, then a bulk CSV invite with a
// partial failure — the one journey in this suite that exercises the real
// admin-invite API end-to-end, including its outgoing email send (see
// e2e/utils/fixtures.ts's seedPendingInvitation doc comment for why every
// other spec seeds invitations directly instead of going through this UI).
//
// KNOWN ENVIRONMENT CAVEAT (flagged, not worked around): backend/.env has a
// real, working Gmail SMTP credential. There is no test-mode email stub or
// SMTP catcher (Mailhog/Ethereal/etc.) wired into this repo, so every invite
// created here triggers one real outbound SMTP attempt against Gmail using
// that live credential. It very likely succeeds (Gmail's outbound relay
// accepts a message for a remote domain like the "@test.com" addresses used
// below without verifying the mailbox exists at SMTP time; any bounce
// happens asynchronously afterwards, out of band from this test). This is
// an environment/ops concern to flag to the team, not something fixable
// from e2e/ alone: rotate that credential and point SMTP_* at a disposable
// test account or a local SMTP catcher for CI.
const CSV_SUCCESS_EMAIL = "e2e-bulk-success@test.com";

let csvPath: string;

test.beforeAll(async () => {
  await resetE2eDatabase(TEST_DATABASE_URL!);

  // PATIENT is deliberately not a valid bulk-invite role (see
  // backend/src/api/validator/bulkInvite.validation.ts — patients
  // self-register via POST /auth/patient/self-register instead of being
  // admin-invited), so the "successful" row here must be ADMIN or DOCTOR,
  // not PATIENT, or both rows fail validation instead of exercising the
  // intended partial-success path.
  const csvContent = ["email,role", `${CSV_SUCCESS_EMAIL},DOCTOR`, "not-an-email,DOCTOR"].join("\n");

  csvPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "e2e-bulk-invite-")), "invites.csv");
  fs.writeFileSync(csvPath, csvContent, "utf-8");
});

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("name@example.com").fill(E2E_ADMIN.email);
  await page.getByPlaceholder("••••••••").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  // "No invitations found" (empty-state heading) contains "invitations" as
  // a case-insensitive substring, so an unqualified match is ambiguous
  // whenever the table is empty — require an exact match on the page title.
  await expect(page.getByRole("heading", { name: "Invitations", exact: true })).toBeVisible();
});

test("admin sends a single invitation", async ({ page }) => {
  await page.getByRole("button", { name: "Invite User" }).click();
  await expect(page.getByRole("heading", { name: "Invite New User" })).toBeVisible();

  await page.getByPlaceholder("e.g. practitioner@docpulse.com").fill("e2e-single-invite@test.com");
  // "Doctor" role is pre-selected by default; leave it as-is.
  await page.getByRole("button", { name: "Send Invitation" }).click();

  // A real outbound SMTP attempt happens here — allow generous time.
  await expect(page.getByText(/Invitation sent successfully/)).toBeVisible({ timeout: 20_000 });

  const invitedRow = page.getByRole("row").filter({ hasText: "e2e-single-invite@test.com" });
  await expect(invitedRow).toBeVisible();
  await expect(invitedRow.getByText("Pending")).toBeVisible();
});

test("admin bulk-invites via CSV with a partial failure", async ({ page }) => {
  await page.getByRole("button", { name: "Bulk Invite" }).click();
  await expect(page.getByRole("heading", { name: "Bulk Invitations" })).toBeVisible();

  await page.locator("#bulk-csv-upload-input").setInputFiles(csvPath);
  await expect(page.getByText("invites.csv")).toBeVisible();

  await page.getByRole("button", { name: "Upload & Invite" }).click();

  // One real outbound SMTP attempt happens here, for the valid row only —
  // the invalid row fails Joi validation before ever reaching email
  // delivery. Allow generous time for the batch to process sequentially.
  await expect(page.getByText("Bulk Invitation Process Completed with Partial Failures")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Successful (1)")).toBeVisible();
  await expect(page.getByText("Failed (1)")).toBeVisible();
  await expect(page.getByText(CSV_SUCCESS_EMAIL)).toBeVisible();
  await expect(page.getByText("not-an-email")).toBeVisible();

  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText(CSV_SUCCESS_EMAIL)).toBeVisible();
});
