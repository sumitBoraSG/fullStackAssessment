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

// Journey: patient cancels a booked (CONFIRMED) appointment; a second
// browser context (the doctor) observes the status change to CANCELLED.
// Doctor/patient accounts and the appointment itself are seeded directly —
// the booking flow is covered by patient-booking.spec.ts, so this spec
// starts from an already-confirmed appointment to focus on the cancel
// transition + cross-session visibility it's named for.
const DOCTOR_EMAIL = "e2e-cancel-doctor@test.com";
const DOCTOR_PASSWORD = "DoctorPass123!";
const PATIENT_EMAIL = "e2e-cancel-patient@test.com";
const PATIENT_PASSWORD = "PatientPass123!";

// Status-badge labels (e.g. "Confirmed", "Cancelled") are duplicated
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

test.beforeAll(async () => {
  await resetE2eDatabase(TEST_DATABASE_URL!);

  const doctor = await createDoctorUser(TEST_DATABASE_URL!, DOCTOR_EMAIL, DOCTOR_PASSWORD);
  const patient = await createPatientUser(TEST_DATABASE_URL!, PATIENT_EMAIL, PATIENT_PASSWORD);

  const futureDate = istDateString(2);
  await createAppointmentRow(
    TEST_DATABASE_URL!,
    doctor.id,
    patient.id,
    "CONFIRMED",
    buildISTRangeLiteral(futureDate, "11:00", "11:30"),
  );
});

test("patient cancels a confirmed appointment and the doctor sees it become cancelled", async ({ browser }) => {
  const patientContext = await browser.newContext();
  const doctorContext = await browser.newContext();

  try {
    const patientPage = await patientContext.newPage();
    const doctorPage = await doctorContext.newPage();

    // --- Patient logs in and cancels the confirmed appointment ---
    await patientPage.goto("/");
    await patientPage.getByPlaceholder("name@example.com").fill(PATIENT_EMAIL);
    await patientPage.getByPlaceholder("••••••••").fill(PATIENT_PASSWORD);
    await patientPage.getByRole("button", { name: "Sign In" }).click();

    await expect(patientPage.getByRole("heading", { name: /Welcome, E2E Patient/ })).toBeVisible();
    await patientPage.getByRole("button", { name: "My Appointments" }).click();

    await expect(statusBadge(patientPage, "Confirmed")).toBeVisible();
    await patientPage.getByRole("button", { name: "Cancel Appointment" }).click();

    await expect(patientPage.getByRole("heading", { name: "Cancel Appointment?" })).toBeVisible();
    await patientPage.getByRole("button", { name: "Yes, Cancel" }).click();

    // Cancelling triggers a real, awaited outbound SMTP send (doctor
    // notification email) via the live Gmail credential in backend/.env
    // before the API responds — allow generous time.
    await expect(patientPage.getByText("Appointment cancelled successfully.")).toBeVisible({ timeout: 20_000 });
    await expect(statusBadge(patientPage, "Cancelled")).toBeVisible();

    // --- Doctor logs in (separate browser context) and sees CANCELLED ---
    await doctorPage.goto("/");
    await doctorPage.getByPlaceholder("name@example.com").fill(DOCTOR_EMAIL);
    await doctorPage.getByPlaceholder("••••••••").fill(DOCTOR_PASSWORD);
    await doctorPage.getByRole("button", { name: "Sign In" }).click();

    await expect(doctorPage.getByRole("heading", { name: /Welcome, E2E Doctor/ })).toBeVisible();
    await expect(doctorPage.getByText("Cancelled by Patient")).toBeVisible();
    await expect(doctorPage.getByText("E2E Patient")).toBeVisible();
  } finally {
    await patientContext.close();
    await doctorContext.close();
  }
});
