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

// Journey: doctor declines a PENDING appointment (PENDING -> REJECTED); a
// second browser context (the patient) observes the status change. Mirrors
// doctor-confirms-appointment.spec.ts's structure exactly, but exercises the
// other PENDING-state branch — REJECTED is otherwise untouched by any E2E
// spec, only by backend integration tests.
const DOCTOR_EMAIL = "e2e-reject-doctor@test.com";
const DOCTOR_PASSWORD = "DoctorPass123!";
const PATIENT_EMAIL = "e2e-reject-patient@test.com";
const PATIENT_PASSWORD = "PatientPass123!";

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

test("doctor declines a pending appointment and the patient sees it become declined", async ({ browser }) => {
  const doctorContext = await browser.newContext();
  const patientContext = await browser.newContext();

  try {
    const doctorPage = await doctorContext.newPage();
    const patientPage = await patientContext.newPage();

    // --- Doctor logs in and declines the pending request ---
    await doctorPage.goto("/");
    await doctorPage.getByPlaceholder("name@example.com").fill(DOCTOR_EMAIL);
    await doctorPage.getByPlaceholder("••••••••").fill(DOCTOR_PASSWORD);
    await doctorPage.getByRole("button", { name: "Sign In" }).click();

    await expect(doctorPage.getByRole("heading", { name: /Welcome, E2E Doctor/ })).toBeVisible();
    await expect(statusBadge(doctorPage, "Pending Request")).toBeVisible();

    await doctorPage.getByRole("button", { name: "Decline", exact: true }).click();
    await expect(doctorPage.getByRole("heading", { name: "Decline Request?" })).toBeVisible();
    await doctorPage.getByRole("button", { name: "Confirm Status Change" }).click();

    // Declining triggers a real, awaited outbound SMTP send (patient
    // notification email) before the API responds — allow generous time.
    await expect(doctorPage.getByText("Appointment marked as rejected successfully.")).toBeVisible({
      timeout: 20_000,
    });
    await expect(statusBadge(doctorPage, "Declined")).toBeVisible();

    // --- Patient logs in (separate browser context) and sees Declined ---
    await patientPage.goto("/");
    await patientPage.getByPlaceholder("name@example.com").fill(PATIENT_EMAIL);
    await patientPage.getByPlaceholder("••••••••").fill(PATIENT_PASSWORD);
    await patientPage.getByRole("button", { name: "Sign In" }).click();

    await expect(patientPage.getByRole("heading", { name: /Welcome, E2E Patient/ })).toBeVisible();
    await patientPage.getByRole("button", { name: "My Appointments" }).click();

    await expect(statusBadge(patientPage, "Declined")).toBeVisible();
    // A declined appointment is terminal — the patient must not be offered
    // a cancel action for it.
    await expect(patientPage.getByRole("button", { name: "Cancel Appointment" })).toHaveCount(0);
  } finally {
    await doctorContext.close();
    await patientContext.close();
  }
});
