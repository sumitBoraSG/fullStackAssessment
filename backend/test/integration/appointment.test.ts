import request from "supertest";
import { getConnection } from "typeorm";
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

function dateTimeAt(offsetMs: number): { date: string; time: string } {
  const d = new Date(Date.now() + offsetMs);
  return { date: formatDateIST(d), time: formatTimeIST(d) };
}

describe("Appointment correctness & concurrency", () => {
  it("rejects booking a past date", async () => {
    const doctor = await createDoctorUser("doc-past@test.com", "Pass123456");
    const patient = await createPatientUser("pat-past@test.com", "Pass123456");
    const patientAgent = await loginAgent(app, patient.email, patient.password);

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const res = await patientAgent.post("/appointments").send({
      doctorId: doctor.id,
      date: formatDateIST(yesterday),
      startTime: "10:00",
      endTime: "10:30",
    });

    expect(res.status).toBe(400);
  });

  it("allows cancelling a future appointment", async () => {
    const doctor = await createDoctorUser("doc-cancel@test.com", "Pass123456");
    const patient = await createPatientUser("pat-cancel@test.com", "Pass123456");
    const appointmentId = await createAppointmentRow(
      doctor.id,
      patient.id,
      "CONFIRMED",
      isoRange(60 * 60 * 1000, 90 * 60 * 1000), // 1h to 1.5h from now
    );

    const patientAgent = await loginAgent(app, patient.email, patient.password);
    const res = await patientAgent
      .patch(`/appointments/${appointmentId}/status`)
      .send({ status: "CANCELLED" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("CANCELLED");
  });

  it("rejects cancelling an appointment whose time has already passed", async () => {
    const doctor = await createDoctorUser("doc-pastcancel@test.com", "Pass123456");
    const patient = await createPatientUser("pat-pastcancel@test.com", "Pass123456");
    const appointmentId = await createAppointmentRow(
      doctor.id,
      patient.id,
      "CONFIRMED",
      isoRange(-2 * 60 * 60 * 1000, -90 * 60 * 1000), // 2h ago to 1.5h ago
    );

    const patientAgent = await loginAgent(app, patient.email, patient.password);
    const res = await patientAgent
      .patch(`/appointments/${appointmentId}/status`)
      .send({ status: "CANCELLED" });

    expect(res.status).toBe(409);
  });

  it("excludes a fully-elapsed availability window from results", async () => {
    const doctor = await createDoctorUser("doc-elapsed@test.com", "Pass123456");
    await createAvailabilityRow(
      doctor.id,
      isoRange(-3 * 60 * 60 * 1000, -2 * 60 * 60 * 1000), // fully in the past
    );

    const patient = await createPatientUser("pat-elapsed@test.com", "Pass123456");
    const patientAgent = await loginAgent(app, patient.email, patient.password);

    const res = await patientAgent.get(`/doctors/${doctor.id}/availability`);
    expect(res.status).toBe(200);
    expect(res.body.data.availability).toHaveLength(0);
  });

  it("clamps a partially-elapsed availability window to a slot still bookable moments later", async () => {
    const doctor = await createDoctorUser("doc-partial@test.com", "Pass123456");
    await createAvailabilityRow(
      doctor.id,
      isoRange(-2 * 60 * 1000, 30 * 60 * 1000), // started 2 min ago, ends in 30 min
    );

    const patient = await createPatientUser("pat-partial@test.com", "Pass123456");
    const patientAgent = await loginAgent(app, patient.email, patient.password);

    const availRes = await patientAgent.get(`/doctors/${doctor.id}/availability`);
    expect(availRes.status).toBe(200);
    expect(availRes.body.data.availability).toHaveLength(1);

    const slot = availRes.body.data.availability[0];

    // Simulate a short delay before the patient actually submits the
    // booking — the returned slot must still be bookable, not rejected as
    // "already passed" (regression check for flooring vs. ceiling to the
    // next valid minute).
    await new Promise((r) => setTimeout(r, 1500));

    const bookRes = await patientAgent.post("/appointments").send({
      doctorId: doctor.id,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
    });

    expect(bookRes.status).toBe(201);
  });

  it("prevents double-booking two overlapping appointment requests for the same doctor", async () => {
    const doctor = await createDoctorUser("doc-double@test.com", "Pass123456");
    await createAvailabilityRow(
      doctor.id,
      isoRange(60 * 60 * 1000, 3 * 60 * 60 * 1000), // 1h to 3h from now
    );

    const patientA = await createPatientUser("pat-double-a@test.com", "Pass123456");
    const patientB = await createPatientUser("pat-double-b@test.com", "Pass123456");
    const agentA = await loginAgent(app, patientA.email, patientA.password);
    const agentB = await loginAgent(app, patientB.email, patientB.password);

    const start = dateTimeAt(90 * 60 * 1000);
    const end = dateTimeAt(120 * 60 * 1000);

    const payload = {
      doctorId: doctor.id,
      date: start.date,
      startTime: start.time,
      endTime: end.time,
    };

    const [resA, resB] = await Promise.all([
      agentA.post("/appointments").send(payload),
      agentB.post("/appointments").send(payload),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const [{ count }] = await getConnection().query(
      `SELECT count(*)::int FROM appointments WHERE doctor_id = $1 AND status IN ('PENDING','CONFIRMED')`,
      [doctor.id],
    );
    expect(count).toBe(1);
  });

  it("concurrent doctor status updates on the same appointment never both succeed", async () => {
    // Two real concurrent HTTP requests against the same appointment. Which
    // one "wins" the DB race is scheduling-dependent (the loser may see a
    // 409 Conflict from the compare-and-swap, or a 400 if its own read
    // already observed the winner's committed change) — but exactly one
    // must ever succeed, and the appointment must never end up corrupted.
    const doctor = await createDoctorUser("doc-race@test.com", "Pass123456");
    const patient = await createPatientUser("pat-race@test.com", "Pass123456");
    const appointmentId = await createAppointmentRow(
      doctor.id,
      patient.id,
      "PENDING",
      isoRange(60 * 60 * 1000, 90 * 60 * 1000),
    );

    const doctorAgent = await loginAgent(app, doctor.email, doctor.password);

    const [confirmRes, rejectRes] = await Promise.all([
      doctorAgent.patch(`/doctor/appointments/${appointmentId}/status`).send({ status: "CONFIRMED" }),
      doctorAgent.patch(`/doctor/appointments/${appointmentId}/status`).send({ status: "REJECTED" }),
    ]);

    const statuses = [confirmRes.status, rejectRes.status];
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.every((s) => s === 200 || s === 400 || s === 409)).toBe(true);

    const [row] = await getConnection().query(
      `SELECT status FROM appointments WHERE id = $1`,
      [appointmentId],
    );
    expect(["CONFIRMED", "REJECTED"]).toContain(row.status);
  });

  it("compare-and-swap: a status update whose expected-status is already stale is rejected, not silently applied", async () => {
    // Deterministic proof of the actual concurrency-safety mechanism,
    // independent of request-timing luck: the repository's UPDATE only
    // takes effect when the row's current status still matches what the
    // caller last read. This is exactly what makes the HTTP-level race
    // above safe regardless of which request's read happens to run first.
    const doctor = await createDoctorUser("doc-cas@test.com", "Pass123456");
    const patient = await createPatientUser("pat-cas@test.com", "Pass123456");
    const appointmentId = await createAppointmentRow(
      doctor.id,
      patient.id,
      "PENDING",
      isoRange(60 * 60 * 1000, 90 * 60 * 1000),
    );

    const { AppointmentRepository } = await import(
      "../../src/database/repository/appointment.repository"
    );
    const { AppointmentStatus } = await import("../../src/database/enum/AppointmentStatus");
    const repo = getConnection().getCustomRepository(AppointmentRepository);

    const first = await repo.updateAppointmentStatusByDoctor(
      appointmentId,
      doctor.id,
      AppointmentStatus.PENDING,
      AppointmentStatus.CONFIRMED,
    );
    expect(first.affected).toBe(1);

    // Simulates a second request that had also read "PENDING" before the
    // first one committed — its compare-and-swap must now be a no-op.
    const second = await repo.updateAppointmentStatusByDoctor(
      appointmentId,
      doctor.id,
      AppointmentStatus.PENDING,
      AppointmentStatus.REJECTED,
    );
    expect(second.affected).toBe(0);

    const [row] = await getConnection().query(
      `SELECT status FROM appointments WHERE id = $1`,
      [appointmentId],
    );
    expect(row.status).toBe("CONFIRMED");
  });

  it("createAppointment response includes a nested doctor object matching the frontend contract", async () => {
    const doctor = await createDoctorUser("doc-shape@test.com", "Pass123456");
    await createAvailabilityRow(doctor.id, isoRange(60 * 60 * 1000, 3 * 60 * 60 * 1000));

    const patient = await createPatientUser("pat-shape@test.com", "Pass123456");
    const patientAgent = await loginAgent(app, patient.email, patient.password);

    const start = dateTimeAt(90 * 60 * 1000);
    const end = dateTimeAt(120 * 60 * 1000);

    const res = await patientAgent.post("/appointments").send({
      doctorId: doctor.id,
      date: start.date,
      startTime: start.time,
      endTime: end.time,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.doctor).toBeDefined();
    expect(res.body.data.doctor.doctorId).toBe(doctor.id);
    expect(typeof res.body.data.updatedAt).toBe("string");
  });
});
