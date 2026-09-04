import { app, setupIntegrationTest } from "../util/testApp";
import {
  createDoctorUser,
  createPatientUser,
  createAvailabilityRow,
  createAppointmentRow,
  loginAgent,
} from "../util/factories";
import { formatDateIST, formatTimeIST } from "@util/dateTimeRange";

setupIntegrationTest();

function isoRange(startOffsetMs: number, endOffsetMs: number): string {
  const start = new Date(Date.now() + startOffsetMs).toISOString();
  const end = new Date(Date.now() + endOffsetMs).toISOString();
  return `[${start},${end})`;
}

describe("GET /doctor/availability (own)", () => {
  it("returns the doctor's own availability windows, raw (not busy-adjusted)", async () => {
    const doctor = await createDoctorUser("doc-own-avail@test.com", "Pass123456");
    await createAvailabilityRow(doctor.id, isoRange(60 * 60 * 1000, 3 * 60 * 60 * 1000));

    const agent = await loginAgent(app, doctor.email, doctor.password);
    const res = await agent.get("/doctor/availability");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it("filters own availability by date", async () => {
    const doctor = await createDoctorUser("doc-own-avail-date@test.com", "Pass123456");
    await createAvailabilityRow(doctor.id, isoRange(60 * 60 * 1000, 3 * 60 * 60 * 1000));
    // A slot 3 days out — shouldn't show up when filtering for today.
    await createAvailabilityRow(
      doctor.id,
      isoRange(72 * 60 * 60 * 1000, 75 * 60 * 60 * 1000),
    );

    const agent = await loginAgent(app, doctor.email, doctor.password);
    const today = formatDateIST(new Date());
    const res = await agent.get("/doctor/availability").query({ date: today });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await (await import("supertest")).default(app).get("/doctor/availability");
    expect(res.status).toBe(401);
  });
});

describe("GET /doctors/:doctorId/availability (public, busy-adjusted)", () => {
  it("bisects a single availability window around one appointment in the middle, yielding exactly two free segments", async () => {
    const doctor = await createDoctorUser("doc-bisect@test.com", "Pass123456");
    const patient = await createPatientUser("pat-bisect@test.com", "Pass123456");

    // One window spanning 1h -> 5h from now.
    const busyStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const busyEnd = new Date(Date.now() + 3 * 60 * 60 * 1000);

    await createAvailabilityRow(doctor.id, isoRange(60 * 60 * 1000, 5 * 60 * 60 * 1000));

    // A booked appointment carved out of the middle: 2h -> 3h from now.
    await createAppointmentRow(
      doctor.id,
      patient.id,
      "CONFIRMED",
      `[${busyStart.toISOString()},${busyEnd.toISOString()})`,
    );

    const agent = await loginAgent(app, patient.email, patient.password);
    const res = await agent.get(`/doctors/${doctor.id}/availability`);

    expect(res.status).toBe(200);
    expect(res.body.data.availability).toHaveLength(2);

    const [first, second] = res.body.data.availability;
    // Both free segments come from the same underlying availability row.
    expect(first.id).toBe(second.id);
    // First free segment ends exactly where the busy range begins, second
    // free segment starts exactly where the busy range ends.
    expect(first.endTime).toBe(formatTimeIST(busyStart));
    expect(second.startTime).toBe(formatTimeIST(busyEnd));
  });

  it("excludes a slot that's fully consumed by a PENDING/CONFIRMED appointment", async () => {
    const doctor = await createDoctorUser("doc-fully-busy@test.com", "Pass123456");
    const patient = await createPatientUser("pat-fully-busy@test.com", "Pass123456");

    // Same exact range for both rows (captured once) — the appointment
    // must exactly cover the availability window, with no sub-minute gap
    // left over at either edge.
    const range = isoRange(60 * 60 * 1000, 2 * 60 * 60 * 1000);
    await createAvailabilityRow(doctor.id, range);
    await createAppointmentRow(doctor.id, patient.id, "PENDING", range);

    const agent = await loginAgent(app, patient.email, patient.password);
    const res = await agent.get(`/doctors/${doctor.id}/availability`);

    expect(res.status).toBe(200);
    expect(res.body.data.availability).toHaveLength(0);
  });

  it("re-includes a slot whose appointment was cancelled", async () => {
    const doctor = await createDoctorUser("doc-cancelled-free@test.com", "Pass123456");
    const patient = await createPatientUser("pat-cancelled-free@test.com", "Pass123456");

    await createAvailabilityRow(doctor.id, isoRange(60 * 60 * 1000, 2 * 60 * 60 * 1000));
    await createAppointmentRow(
      doctor.id,
      patient.id,
      "CANCELLED",
      isoRange(60 * 60 * 1000, 2 * 60 * 60 * 1000),
    );

    const agent = await loginAgent(app, patient.email, patient.password);
    const res = await agent.get(`/doctors/${doctor.id}/availability`);

    expect(res.status).toBe(200);
    expect(res.body.data.availability).toHaveLength(1);
  });

  it("splits one window into three free segments around two separate busy appointments", async () => {
    const doctor = await createDoctorUser("doc-multi-busy@test.com", "Pass123456");
    const patientA = await createPatientUser("pat-multi-busy-a@test.com", "Pass123456");
    const patientB = await createPatientUser("pat-multi-busy-b@test.com", "Pass123456");

    // One window spanning 1h -> 7h from now, with two non-adjacent busy
    // ranges carved out of it: 2h-3h and 4h-5h.
    await createAvailabilityRow(doctor.id, isoRange(60 * 60 * 1000, 7 * 60 * 60 * 1000));

    const busy1Start = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const busy1End = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const busy2Start = new Date(Date.now() + 4 * 60 * 60 * 1000);
    const busy2End = new Date(Date.now() + 5 * 60 * 60 * 1000);

    await createAppointmentRow(
      doctor.id,
      patientA.id,
      "CONFIRMED",
      `[${busy1Start.toISOString()},${busy1End.toISOString()})`,
    );
    await createAppointmentRow(
      doctor.id,
      patientB.id,
      "PENDING",
      `[${busy2Start.toISOString()},${busy2End.toISOString()})`,
    );

    const agent = await loginAgent(app, patientA.email, patientA.password);
    const res = await agent.get(`/doctors/${doctor.id}/availability`);

    expect(res.status).toBe(200);
    expect(res.body.data.availability).toHaveLength(3);

    const [first, second, third] = res.body.data.availability;
    expect([first.id, second.id, third.id]).toEqual([first.id, first.id, first.id]);
    expect(first.endTime).toBe(formatTimeIST(busy1Start));
    expect(second.startTime).toBe(formatTimeIST(busy1End));
    expect(second.endTime).toBe(formatTimeIST(busy2Start));
    expect(third.startTime).toBe(formatTimeIST(busy2End));
  });

  it("returns 404 for a non-existent doctor id", async () => {
    const patient = await createPatientUser("pat-noexist-doc@test.com", "Pass123456");
    const agent = await loginAgent(app, patient.email, patient.password);

    // A syntactically valid (in-range for the smallint doctor id column)
    // but non-existent id — this is what actually reaches DoctorService's
    // findDoctorById -> not-found branch, as opposed to an out-of-range
    // value which fails at the DB layer before that check ever runs.
    const res = await agent.get("/doctors/32000/availability");
    expect(res.status).toBe(404);
  });
});
