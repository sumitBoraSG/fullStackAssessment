import { test, expect } from "@playwright/test";
import { TEST_DATABASE_URL } from "../env";
import { resetE2eDatabase } from "../utils/db";
import {
  createDoctorUser,
  createPatientUser,
  createAvailabilityRow,
  createAppointmentRow,
  buildISTRangeLiteral,
  istDateString,
} from "../utils/fixtures";

// Journey: a patient's booking attempt loses a genuine race for the exact
// same slot and the resulting 409 is surfaced in the real UI, not just at
// the API layer (already covered deterministically by
// backend/test/integration/appointment.test.ts's exclusion-constraint race
// test). Rather than relying on two truly concurrent browser sessions (racy
// and non-deterministic to assert on), this reproduces the same underlying
// scenario deterministically: the patient's browser has already fetched a
// free slot (a realistic "stale view" — any real user takes a few seconds to
// pick a time and click confirm), another booking for that exact slot is
// then created directly, and only then does the patient submit — which must
// hit the database's real exclusion constraint and come back as a 409 that
// the modal displays, not a silent success.
const DOCTOR_EMAIL = "e2e-conflict-doctor@test.com";
const DOCTOR_PASSWORD = "DoctorPass123!";
const PATIENT_EMAIL = "e2e-conflict-patient@test.com";
const PATIENT_PASSWORD = "PatientPass123!";
const OTHER_PATIENT_EMAIL = "e2e-conflict-other-patient@test.com";
const OTHER_PATIENT_PASSWORD = "PatientPass123!";

let doctorId: number;
let otherPatientId: number;
let bookingDate: string;

test.beforeAll(async () => {
  await resetE2eDatabase(TEST_DATABASE_URL!);

  const doctor = await createDoctorUser(TEST_DATABASE_URL!, DOCTOR_EMAIL, DOCTOR_PASSWORD);
  doctorId = doctor.id;
  await createPatientUser(TEST_DATABASE_URL!, PATIENT_EMAIL, PATIENT_PASSWORD);
  const otherPatient = await createPatientUser(TEST_DATABASE_URL!, OTHER_PATIENT_EMAIL, OTHER_PATIENT_PASSWORD);
  otherPatientId = otherPatient.id;

  bookingDate = istDateString(1);
  // A single 30-minute window — exactly one bookable slot, so there's no
  // ambiguity about which slot the patient will pick.
  await createAvailabilityRow(TEST_DATABASE_URL!, doctorId, buildISTRangeLiteral(bookingDate, "09:00", "09:30"));
});

test("shows a real 409 conflict when the viewed slot is taken before the patient confirms", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("name@example.com").fill(PATIENT_EMAIL);
  await page.getByPlaceholder("••••••••").fill(PATIENT_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page.getByText("Dr. E2E Doctor")).toBeVisible();
  await page.getByRole("button", { name: "Book Appointment" }).click();
  await expect(page.getByText("Book Consultation")).toBeVisible();

  const monthAbbrev = new Intl.DateTimeFormat("en-US", { month: "short" }).format(
    new Date(bookingDate + "T00:00:00"),
  );
  await page.getByRole("button", { name: new RegExp(monthAbbrev) }).click();
  await page.getByRole("button", { name: /^9:00 AM - 9:30 AM$/ }).click();

  // The other patient's booking for the identical slot lands here, between
  // the current patient having fetched/selected it and clicking confirm.
  await createAppointmentRow(
    TEST_DATABASE_URL!,
    doctorId,
    otherPatientId,
    "CONFIRMED",
    buildISTRangeLiteral(bookingDate, "09:00", "09:30"),
  );

  await page.getByRole("button", { name: "Confirm Appointment Request" }).click();

  await expect(page.getByText("Appointment time is no longer available")).toBeVisible();
  // The modal must still be open and usable after the conflict, not stuck
  // or silently closed — the patient can see the error and pick another
  // slot without reloading the page.
  await expect(page.getByText("Book Consultation")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm Appointment Request" })).toBeEnabled();
});
