import { test, expect, type Page } from "@playwright/test";
import { E2E_ADMIN, TEST_DATABASE_URL } from "../env";
import { resetE2eDatabase } from "../utils/db";
import {
  getUserIdByEmail,
  seedPendingInvitation,
  createDoctorUser,
  createAvailabilityRow,
  buildISTRangeLiteral,
  istDateString,
} from "../utils/fixtures";

// Journey: invite -> accept -> login -> discover doctor -> book slot.
//
// The patient side of this journey (invite/accept/login) is driven through
// the real UI, using a directly-seeded invitation (see
// doctor-onboarding.spec.ts / fixtures.seedPendingInvitation for why). The
// doctor being booked is seeded directly with fixtures rather than being
// onboarded through its own invite/accept flow — that flow is the subject of
// doctor-onboarding.spec.ts, not this one, and re-driving it here would only
// add runtime without adding coverage.
const PATIENT_EMAIL = "e2e-booking-patient@test.com";
const PATIENT_PASSWORD = "PatientPass123!";
const DOCTOR_EMAIL = "e2e-booking-doctor@test.com";
const DOCTOR_PASSWORD = "DoctorSeedPass123!";

let invitationToken: string;
let bookingDate: string;

// Status-badge labels (e.g. "Pending Approval") are duplicated verbatim as
// <option> text in the status-filter <select> rendered on the very same
// page, which would otherwise make a plain getByText(...) match ambiguous.
// Status badges are always rendered as a (doubly-nested) <span>, which a
// plain <option> never is, so scoping to "span" disambiguates against the
// filter dropdown; .last() picks the innermost of the two nested spans that
// both carry the exact label text.
function statusBadge(page: Page, label: string) {
  return page
    .locator("span")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .last();
}

test.beforeAll(async () => {
  await resetE2eDatabase(TEST_DATABASE_URL!);

  const adminId = await getUserIdByEmail(TEST_DATABASE_URL!, E2E_ADMIN.email);
  const { rawToken } = await seedPendingInvitation(TEST_DATABASE_URL!, PATIENT_EMAIL, "PATIENT", adminId);
  invitationToken = rawToken;

  const doctor = await createDoctorUser(TEST_DATABASE_URL!, DOCTOR_EMAIL, DOCTOR_PASSWORD, 1, 6);
  bookingDate = istDateString(1);
  await createAvailabilityRow(
    TEST_DATABASE_URL!,
    doctor.id,
    buildISTRangeLiteral(bookingDate, "09:00", "12:00"),
  );
});

test("patient accepts an invitation, logs in, discovers a doctor, and books a slot", async ({ page }) => {
  // --- Accept invitation ---
  await page.goto(`/accept-invitation?token=${invitationToken}`);
  await expect(page.getByRole("heading", { name: "Complete Your Registration" })).toBeVisible();

  await page.getByPlaceholder("John").fill("Patty");
  await page.getByPlaceholder("Doe").fill("Patientson");
  await page.getByPlaceholder("••••••••").first().fill(PATIENT_PASSWORD);
  await page.getByPlaceholder("••••••••").nth(1).fill(PATIENT_PASSWORD);

  await page.locator('input[type="date"]').fill("1995-06-15");
  await page.getByRole("combobox").selectOption({ label: "O+" });
  await page.getByPlaceholder("e.g. 170").fill("165");
  await page.getByPlaceholder("e.g. 65").fill("60");

  await page.getByRole("button", { name: "Create & Activate Account" }).click();
  await expect(page.getByRole("heading", { name: "Welcome to DocPulse" })).toBeVisible({ timeout: 10_000 });

  // --- Log in as the newly-created patient ---
  await page.getByPlaceholder("name@example.com").fill(PATIENT_EMAIL);
  await page.getByPlaceholder("••••••••").fill(PATIENT_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page.getByRole("heading", { name: /Welcome, Patty Patientson/ })).toBeVisible();

  // --- Discover the seeded doctor and open the booking modal ---
  await expect(page.getByText("Dr. E2E Doctor")).toBeVisible();
  await page.getByRole("button", { name: "Book Appointment" }).click();

  // Both the doctor card and the modal header render an "Dr. E2E Doctor"
  // heading, so assert on the modal's unique "Book Consultation" pill
  // instead of the (now ambiguous) doctor name to confirm it opened.
  await expect(page.getByText("Book Consultation")).toBeVisible();

  // Exactly one available date pill exists (the single seeded slot). Its
  // accessible name includes the 3-letter month abbreviation for the
  // booking date (e.g. "Sep 4") — click it to reveal the slot picker.
  const monthAbbrev = new Intl.DateTimeFormat("en-US", { month: "short" }).format(
    new Date(bookingDate + "T00:00:00"),
  );
  await page.getByRole("button", { name: new RegExp(monthAbbrev) }).click();

  // Pick the first suggested 30-minute slot.
  await page.getByRole("button", { name: /^9:00 AM - 9:30 AM$/ }).click();

  await page.getByRole("button", { name: "Confirm Appointment Request" }).click();

  // NOTE ON A REAL APP BUG (not asserted on directly — see this spec's
  // coverage in the final report): the modal's own "Appointment requested
  // successfully!" message is essentially never visible to a real user in
  // practice. Its submit handler calls `setSuccessMsg(...)` immediately
  // followed, in the same continuation, by `onSuccess(res.data)` — which
  // flips DashboardPage's `patientTab` to "appointments" and conditionally
  // unmounts PatientDoctorDiscovery (and this modal with it). So instead of
  // asserting on that unreliable message, this test waits for the modal to
  // actually finish closing (its unique "Book Consultation" pill going
  // away), then asserts the real, correct, externally-observable outcome:
  // the booked appointment appearing under "My Appointments" as Pending
  // Approval. Booking also triggers two real, awaited outbound SMTP sends
  // (patient + doctor notification emails) via the live Gmail credential
  // in backend/.env before the API responds — allow generous time
  // (observed several seconds combined in this environment).
  await expect(page.getByText("Book Consultation")).toBeHidden({ timeout: 30_000 });

  await expect(statusBadge(page, "Pending Approval")).toBeVisible();
  await expect(page.getByText("Dr. E2E Doctor")).toBeVisible();
});
