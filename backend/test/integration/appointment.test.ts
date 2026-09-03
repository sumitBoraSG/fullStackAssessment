import request from "supertest";
import { getConnection } from "typeorm";
import { app, setupIntegrationTest } from "../util/testApp";
import {
  createDoctorUser,
  createPatientUser,
  createAvailabilityRow,
  createAppointmentRow,
  loginAgent,
  spyOnAppointmentEmails,
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

  it("rejects booking with startTime >= endTime", async () => {
    const doctor = await createDoctorUser("doc-badrange@test.com", "Pass123456");
    await createAvailabilityRow(doctor.id, isoRange(60 * 60 * 1000, 3 * 60 * 60 * 1000));

    const patient = await createPatientUser("pat-badrange@test.com", "Pass123456");
    const patientAgent = await loginAgent(app, patient.email, patient.password);

    const start = dateTimeAt(90 * 60 * 1000);

    const res = await patientAgent.post("/appointments").send({
      doctorId: doctor.id,
      date: start.date,
      startTime: start.time,
      endTime: start.time,
    });

    expect(res.status).toBe(400);
  });

  it("returns DOCTOR_NOT_AVAILABLE 409 when no availability window covers the requested time", async () => {
    const doctor = await createDoctorUser("doc-notavailable@test.com", "Pass123456");
    // No availability created for this doctor at all.

    const patient = await createPatientUser("pat-notavailable@test.com", "Pass123456");
    const patientAgent = await loginAgent(app, patient.email, patient.password);

    const start = dateTimeAt(90 * 60 * 1000);
    const end = dateTimeAt(120 * 60 * 1000);

    const res = await patientAgent.post("/appointments").send({
      doctorId: doctor.id,
      date: start.date,
      startTime: start.time,
      endTime: end.time,
    });

    expect(res.status).toBe(409);
  });

  it("returns APPOINTMENT_TIME_ALREADY_PASSED 409 when a doctor tries to confirm a pending appointment whose scheduled time has already passed", async () => {
    const doctor = await createDoctorUser("doc-confirm-late@test.com", "Pass123456");
    const patient = await createPatientUser("pat-confirm-late@test.com", "Pass123456");
    const appointmentId = await createAppointmentRow(
      doctor.id,
      patient.id,
      "PENDING",
      isoRange(-2 * 60 * 60 * 1000, -90 * 60 * 1000), // 2h ago to 1.5h ago
    );

    const doctorAgent = await loginAgent(app, doctor.email, doctor.password);
    const res = await doctorAgent
      .patch(`/doctor/appointments/${appointmentId}/status`)
      .send({ status: "CONFIRMED" });

    expect(res.status).toBe(409);
  });

  it("returns APPOINTMENT_NOT_YET_STARTED 409 when a doctor tries to complete a confirmed appointment that hasn't started yet", async () => {
    const doctor = await createDoctorUser("doc-complete-early@test.com", "Pass123456");
    const patient = await createPatientUser("pat-complete-early@test.com", "Pass123456");
    const appointmentId = await createAppointmentRow(
      doctor.id,
      patient.id,
      "CONFIRMED",
      isoRange(60 * 60 * 1000, 90 * 60 * 1000), // still in the future
    );

    const doctorAgent = await loginAgent(app, doctor.email, doctor.password);
    const res = await doctorAgent
      .patch(`/doctor/appointments/${appointmentId}/status`)
      .send({ status: "COMPLETED" });

    expect(res.status).toBe(409);
  });

  it("rejects a patient cancelling an already-REJECTED appointment with INVALID_STATUS_TRANSITION", async () => {
    const doctor = await createDoctorUser("doc-cancel-rejected@test.com", "Pass123456");
    const patient = await createPatientUser("pat-cancel-rejected@test.com", "Pass123456");
    const appointmentId = await createAppointmentRow(
      doctor.id,
      patient.id,
      "REJECTED",
      isoRange(60 * 60 * 1000, 90 * 60 * 1000),
    );

    const patientAgent = await loginAgent(app, patient.email, patient.password);
    const res = await patientAgent
      .patch(`/appointments/${appointmentId}/status`)
      .send({ status: "CANCELLED" });

    expect(res.status).toBe(400);
  });

  it("rejects a patient cancelling an already-COMPLETED appointment with INVALID_STATUS_TRANSITION", async () => {
    const doctor = await createDoctorUser("doc-cancel-completed@test.com", "Pass123456");
    const patient = await createPatientUser("pat-cancel-completed@test.com", "Pass123456");
    const appointmentId = await createAppointmentRow(
      doctor.id,
      patient.id,
      "COMPLETED",
      isoRange(-3 * 60 * 60 * 1000, -2 * 60 * 60 * 1000),
    );

    const patientAgent = await loginAgent(app, patient.email, patient.password);
    const res = await patientAgent
      .patch(`/appointments/${appointmentId}/status`)
      .send({ status: "CANCELLED" });

    expect(res.status).toBe(400);
  });

  it("rejects a patient cancelling an already-CANCELLED appointment with INVALID_STATUS_TRANSITION", async () => {
    const doctor = await createDoctorUser("doc-cancel-cancelled@test.com", "Pass123456");
    const patient = await createPatientUser("pat-cancel-cancelled@test.com", "Pass123456");
    const appointmentId = await createAppointmentRow(
      doctor.id,
      patient.id,
      "CANCELLED",
      isoRange(60 * 60 * 1000, 90 * 60 * 1000),
    );

    const patientAgent = await loginAgent(app, patient.email, patient.password);
    const res = await patientAgent
      .patch(`/appointments/${appointmentId}/status`)
      .send({ status: "CANCELLED" });

    expect(res.status).toBe(400);
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

describe("Appointment email notifications", () => {
  it("sends a request-confirmation email to the patient and a new-request email to the doctor when an appointment is booked", async () => {
    const emails = spyOnAppointmentEmails();

    const doctor = await createDoctorUser("doc-email-req@test.com", "Pass123456");
    await createAvailabilityRow(doctor.id, isoRange(60 * 60 * 1000, 3 * 60 * 60 * 1000));

    const patient = await createPatientUser("pat-email-req@test.com", "Pass123456");
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

    expect(emails.requestedPatient).toHaveBeenCalledTimes(1);
    expect(emails.requestedPatient).toHaveBeenCalledWith(
      patient.email,
      res.body.data.id,
      expect.objectContaining({ date: start.date }),
    );

    expect(emails.requestedDoctor).toHaveBeenCalledTimes(1);
    expect(emails.requestedDoctor).toHaveBeenCalledWith(
      doctor.email,
      res.body.data.id,
      expect.objectContaining({ date: start.date }),
    );

    // No other lifecycle email should fire for a plain booking.
    expect(emails.confirmed).not.toHaveBeenCalled();
    expect(emails.declined).not.toHaveBeenCalled();
    expect(emails.cancelled).not.toHaveBeenCalled();
    expect(emails.completed).not.toHaveBeenCalled();
  });

  it("sends a confirmation email to the patient when a doctor confirms a pending appointment", async () => {
    const emails = spyOnAppointmentEmails();

    const doctor = await createDoctorUser("doc-email-confirm@test.com", "Pass123456");
    const patient = await createPatientUser("pat-email-confirm@test.com", "Pass123456");
    const appointmentId = await createAppointmentRow(
      doctor.id,
      patient.id,
      "PENDING",
      isoRange(60 * 60 * 1000, 90 * 60 * 1000),
    );

    const doctorAgent = await loginAgent(app, doctor.email, doctor.password);
    const res = await doctorAgent
      .patch(`/doctor/appointments/${appointmentId}/status`)
      .send({ status: "CONFIRMED" });

    expect(res.status).toBe(200);
    expect(emails.confirmed).toHaveBeenCalledTimes(1);
    expect(emails.confirmed).toHaveBeenCalledWith(
      patient.email,
      appointmentId,
      expect.objectContaining({ doctorName: expect.stringContaining("Dr.") }),
    );
    expect(emails.declined).not.toHaveBeenCalled();
  });

  it("sends a decline email to the patient when a doctor rejects a pending appointment", async () => {
    const emails = spyOnAppointmentEmails();

    const doctor = await createDoctorUser("doc-email-decline@test.com", "Pass123456");
    const patient = await createPatientUser("pat-email-decline@test.com", "Pass123456");
    const appointmentId = await createAppointmentRow(
      doctor.id,
      patient.id,
      "PENDING",
      isoRange(60 * 60 * 1000, 90 * 60 * 1000),
    );

    const doctorAgent = await loginAgent(app, doctor.email, doctor.password);
    const res = await doctorAgent
      .patch(`/doctor/appointments/${appointmentId}/status`)
      .send({ status: "REJECTED" });

    expect(res.status).toBe(200);
    expect(emails.declined).toHaveBeenCalledTimes(1);
    expect(emails.declined).toHaveBeenCalledWith(
      patient.email,
      appointmentId,
      expect.any(Object),
    );
    expect(emails.confirmed).not.toHaveBeenCalled();
  });

  it("sends a completion email to the patient when a doctor marks a started appointment as completed", async () => {
    const emails = spyOnAppointmentEmails();

    const doctor = await createDoctorUser("doc-email-complete@test.com", "Pass123456");
    const patient = await createPatientUser("pat-email-complete@test.com", "Pass123456");
    const appointmentId = await createAppointmentRow(
      doctor.id,
      patient.id,
      "CONFIRMED",
      isoRange(-90 * 60 * 1000, -60 * 60 * 1000),
    );

    const doctorAgent = await loginAgent(app, doctor.email, doctor.password);
    const res = await doctorAgent
      .patch(`/doctor/appointments/${appointmentId}/status`)
      .send({ status: "COMPLETED" });

    expect(res.status).toBe(200);
    expect(emails.completed).toHaveBeenCalledTimes(1);
    expect(emails.completed).toHaveBeenCalledWith(
      patient.email,
      appointmentId,
      expect.any(Object),
    );
  });

  it("sends a cancellation email to the doctor when the patient cancels", async () => {
    const emails = spyOnAppointmentEmails();

    const doctor = await createDoctorUser("doc-email-cancel@test.com", "Pass123456");
    const patient = await createPatientUser("pat-email-cancel@test.com", "Pass123456");
    const appointmentId = await createAppointmentRow(
      doctor.id,
      patient.id,
      "CONFIRMED",
      isoRange(60 * 60 * 1000, 90 * 60 * 1000),
    );

    const patientAgent = await loginAgent(app, patient.email, patient.password);
    const res = await patientAgent
      .patch(`/appointments/${appointmentId}/status`)
      .send({ status: "CANCELLED" });

    expect(res.status).toBe(200);
    expect(emails.cancelled).toHaveBeenCalledTimes(1);
    expect(emails.cancelled).toHaveBeenCalledWith(
      doctor.email,
      appointmentId,
      expect.objectContaining({ patientName: expect.any(String) }),
    );
  });

  it("does not send any email when a status transition is invalid", async () => {
    const emails = spyOnAppointmentEmails();

    const doctor = await createDoctorUser("doc-email-invalid@test.com", "Pass123456");
    const patient = await createPatientUser("pat-email-invalid@test.com", "Pass123456");
    // Already REJECTED — no further transition is allowed.
    const appointmentId = await createAppointmentRow(
      doctor.id,
      patient.id,
      "REJECTED",
      isoRange(60 * 60 * 1000, 90 * 60 * 1000),
    );

    const doctorAgent = await loginAgent(app, doctor.email, doctor.password);
    const res = await doctorAgent
      .patch(`/doctor/appointments/${appointmentId}/status`)
      .send({ status: "CONFIRMED" });

    expect(res.status).toBe(400);
    expect(emails.confirmed).not.toHaveBeenCalled();
    expect(emails.declined).not.toHaveBeenCalled();
  });

  it("sends the confirmation email only once when two concurrent confirm requests race (compare-and-swap)", async () => {
    const emails = spyOnAppointmentEmails();

    const doctor = await createDoctorUser("doc-email-race@test.com", "Pass123456");
    const patient = await createPatientUser("pat-email-race@test.com", "Pass123456");
    const appointmentId = await createAppointmentRow(
      doctor.id,
      patient.id,
      "PENDING",
      isoRange(60 * 60 * 1000, 90 * 60 * 1000),
    );

    const doctorAgent = await loginAgent(app, doctor.email, doctor.password);

    const [res1, res2] = await Promise.all([
      doctorAgent.patch(`/doctor/appointments/${appointmentId}/status`).send({ status: "CONFIRMED" }),
      doctorAgent.patch(`/doctor/appointments/${appointmentId}/status`).send({ status: "CONFIRMED" }),
    ]);

    const statuses = [res1.status, res2.status];
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.every((s) => s === 200 || s === 400 || s === 409)).toBe(true);
    expect(emails.confirmed).toHaveBeenCalledTimes(1);
  });

  it("does not fail the appointment operation when email delivery throws", async () => {
    const emails = spyOnAppointmentEmails();
    emails.confirmed.mockRejectedValueOnce(new Error("SMTP unavailable"));

    const doctor = await createDoctorUser("doc-email-fail@test.com", "Pass123456");
    const patient = await createPatientUser("pat-email-fail@test.com", "Pass123456");
    const appointmentId = await createAppointmentRow(
      doctor.id,
      patient.id,
      "PENDING",
      isoRange(60 * 60 * 1000, 90 * 60 * 1000),
    );

    const doctorAgent = await loginAgent(app, doctor.email, doctor.password);
    const res = await doctorAgent
      .patch(`/doctor/appointments/${appointmentId}/status`)
      .send({ status: "CONFIRMED" });

    // The appointment transition itself must still succeed even though the
    // email attempt rejected.
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("CONFIRMED");
    expect(emails.confirmed).toHaveBeenCalledTimes(1);
  });
});
