import { test, expect, type Page } from "@playwright/test";
import { TEST_DATABASE_URL } from "../env";
import { resetE2eDatabase } from "../utils/db";
import {
  createDoctorUser,
  createPatientUser,
  createAppointmentRow,
  buildISTRangeLiteral,
  istDateString,
} from "../utils/fixtures";

// Journey: doctor confirms a PENDING appointment; a second browser context
// (the patient) observes the status change to CONFIRMED. Doctor and patient
// accounts are seeded directly (that onboarding flow is covered by
// doctor-onboarding.spec.ts / patient-booking.spec.ts) so this spec can
// focus purely on the confirm-status-transition + cross-session visibility
// behavior it's named for.
const DOCTOR_EMAIL = "e2e-confirm-doctor@test.com";
const DOCTOR_PASSWORD = "DoctorPass123!";
const PATIENT_EMAIL = "e2e-confirm-patient@test.com";
const PATIENT_PASSWORD = "PatientPass123!";

// Status-badge labels (e.g. "Confirmed") are duplicated verbatim as
// <option> text in the status-filter <select> rendered on the very same
// page, which would otherwise make a plain getByText(...) match ambiguous.
// Status badges are always rendered as an inner <span>, which a plain
// <option> never is, so scoping to "span" disambiguates reliably.
function statusBadge(page: Page, label: string) {
  return page
    .locator("span")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .last();
}

test.beforeAll(async () => {
  await resetE2eDatabase(TEST_DATABASE_URL!);

  const doctor = await createDoctorUser(TEST_DATABASE_URL!, DOCTOR_EMAIL, DOCTOR_PASSWORD);
  const patient = await createPatientUser(TEST_DATABASE_URL!, PATIENT_EMAIL, PATIENT_PASSWORD);

  const futureDate = istDateString(2);
  await createAppointmentRow(
    TEST_DATABASE_URL!,
    doctor.id,
    patient.id,
    "PENDING",
    buildISTRangeLiteral(futureDate, "10:00", "10:30"),
  );
});

test("doctor confirms a pending appointment and the patient sees it become confirmed", async ({ browser }) => {
  const doctorContext = await browser.newContext();
  const patientContext = await browser.newContext();

  try {
    const doctorPage = await doctorContext.newPage();
    const patientPage = await patientContext.newPage();

    // --- Doctor logs in and confirms the pending request ---
    await doctorPage.goto("/");
    await doctorPage.getByPlaceholder("name@example.com").fill(DOCTOR_EMAIL);
    await doctorPage.getByPlaceholder("••••••••").fill(DOCTOR_PASSWORD);
    await doctorPage.getByRole("button", { name: "Sign In" }).click();

    await expect(doctorPage.getByRole("heading", { name: /Welcome, E2E Doctor/ })).toBeVisible();
    await expect(statusBadge(doctorPage, "Pending Request")).toBeVisible();
    await expect(doctorPage.getByText("E2E Patient")).toBeVisible();

    await doctorPage.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(doctorPage.getByRole("heading", { name: "Confirm Appointment?" })).toBeVisible();
    await doctorPage.getByRole("button", { name: "Confirm Status Change" }).click();

    // Confirming triggers a real, awaited outbound SMTP send (patient
    // notification email) via the live Gmail credential in backend/.env
    // before the API responds — allow generous time.
    await expect(doctorPage.getByText("Appointment marked as confirmed successfully.")).toBeVisible({
      timeout: 20_000,
    });
    await expect(statusBadge(doctorPage, "Confirmed")).toBeVisible();

    // --- Patient logs in (separate browser context) and sees CONFIRMED ---
    await patientPage.goto("/");
    await patientPage.getByPlaceholder("name@example.com").fill(PATIENT_EMAIL);
    await patientPage.getByPlaceholder("••••••••").fill(PATIENT_PASSWORD);
    await patientPage.getByRole("button", { name: "Sign In" }).click();

    await expect(patientPage.getByRole("heading", { name: /Welcome, E2E Patient/ })).toBeVisible();
    await patientPage.getByRole("button", { name: "My Appointments" }).click();

    await expect(statusBadge(patientPage, "Confirmed")).toBeVisible();
    await expect(patientPage.getByText("Dr. E2E Doctor")).toBeVisible();
  } finally {
    await doctorContext.close();
    await patientContext.close();
  }
});
