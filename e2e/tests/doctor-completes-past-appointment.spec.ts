import { test, expect, type Page } from "@playwright/test";
import { TEST_DATABASE_URL } from "../env";
import { resetE2eDatabase } from "../utils/db";
import { createDoctorUser, createPatientUser, createAppointmentRow, buildISTRangeLiteral } from "../utils/fixtures";

// Status-badge labels (e.g. "Confirmed", "Completed") are duplicated
// verbatim as <option> text in the status-filter <select> rendered on the
// very same page, which would otherwise make a plain getByText(...) match
// ambiguous. Status badges are always rendered as an inner <span>, which a
// plain <option> never is, so scoping to "span" disambiguates reliably.
function statusBadge(page: Page, label: string) {
  return page
    .locator("span")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .last();
}

// Journey: doctor completes a past CONFIRMED appointment.
//
// The real UI has no way to reach this precondition itself: the "Confirm"
// action is disabled once an appointment's scheduled time has passed (by
// design — see DoctorAppointmentsSection.tsx), so a CONFIRMED appointment
// whose time is already in the past can only be produced by seeding it
// directly, exactly as the plan calls for. Everything downstream of that
// seed (finding the appointment, the "Complete Visit" action, the
// confirmation modal, the resulting COMPLETED status) is driven for real
// through the UI against the real backend.
const DOCTOR_EMAIL = "e2e-complete-doctor@test.com";
const DOCTOR_PASSWORD = "DoctorPass123!";
const PATIENT_EMAIL = "e2e-complete-patient@test.com";
const PATIENT_PASSWORD = "PatientPass123!";

// Safely in the past regardless of the test runner's timezone.
const PAST_DATE = "2024-01-15";

test.beforeAll(async () => {
  await resetE2eDatabase(TEST_DATABASE_URL!);

  const doctor = await createDoctorUser(TEST_DATABASE_URL!, DOCTOR_EMAIL, DOCTOR_PASSWORD);
  const patient = await createPatientUser(TEST_DATABASE_URL!, PATIENT_EMAIL, PATIENT_PASSWORD);

  await createAppointmentRow(
    TEST_DATABASE_URL!,
    doctor.id,
    patient.id,
    "CONFIRMED",
    buildISTRangeLiteral(PAST_DATE, "10:00", "10:30"),
  );
});

test("doctor marks a past confirmed appointment as completed", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("name@example.com").fill(DOCTOR_EMAIL);
  await page.getByPlaceholder("••••••••").fill(DOCTOR_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page.getByRole("heading", { name: /Welcome, E2E Doctor/ })).toBeVisible();

  // The seeded appointment is already CONFIRMED and in the past, so
  // "Confirm" is not offered — only "Complete Visit" is.
  await expect(statusBadge(page, "Confirmed")).toBeVisible();
  await page.getByRole("button", { name: "Complete Visit" }).click();

  await expect(page.getByRole("heading", { name: "Mark as Completed?" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm Status Change" }).click();

  // Completing triggers a real, awaited outbound SMTP send (patient
  // notification email) via the live Gmail credential in backend/.env
  // before the API responds — allow generous time.
  await expect(page.getByText("Appointment marked as completed successfully.")).toBeVisible({ timeout: 20_000 });
  await expect(statusBadge(page, "Completed")).toBeVisible();
});
