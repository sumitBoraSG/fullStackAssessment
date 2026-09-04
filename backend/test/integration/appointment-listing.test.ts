import { getConnection } from "typeorm";
import { app, setupIntegrationTest } from "../util/testApp";
import {
  createDoctorUser,
  createPatientUser,
  createAppointmentRow,
  loginAgent,
  spyOnAppointmentEmails,
} from "../util/factories";
import { formatDateIST } from "@util/dateTimeRange";

setupIntegrationTest();

function isoRange(startOffsetMs: number, endOffsetMs: number): string {
  const start = new Date(Date.now() + startOffsetMs).toISOString();
  const end = new Date(Date.now() + endOffsetMs).toISOString();
  return `[${start},${end})`;
}

const HOUR = 60 * 60 * 1000;

describe("GET /appointments (patient listing)", () => {
  it("paginates results", async () => {
    const doctor = await createDoctorUser("doc-list-page@test.com", "Pass123456");
    const patient = await createPatientUser("pat-list-page@test.com", "Pass123456");

    for (let i = 1; i <= 5; i++) {
      await createAppointmentRow(
        doctor.id,
        patient.id,
        "PENDING",
        isoRange(i * HOUR, i * HOUR + 30 * 60 * 1000),
      );
    }

    const agent = await loginAgent(app, patient.email, patient.password);

    const page1 = await agent.get("/appointments").query({ page: 1, limit: 2 });
    expect(page1.status).toBe(200);
    expect(page1.body.data.appointments).toHaveLength(2);
    expect(page1.body.data.pagination).toMatchObject({ page: 1, limit: 2, total: 5, totalPages: 3 });

    const page3 = await agent.get("/appointments").query({ page: 3, limit: 2 });
    expect(page3.status).toBe(200);
    expect(page3.body.data.appointments).toHaveLength(1);
  });

  it("filters by status", async () => {
    const doctor = await createDoctorUser("doc-list-status@test.com", "Pass123456");
    const patient = await createPatientUser("pat-list-status@test.com", "Pass123456");

    await createAppointmentRow(doctor.id, patient.id, "PENDING", isoRange(HOUR, HOUR + 30 * 60 * 1000));
    await createAppointmentRow(
      doctor.id,
      patient.id,
      "CONFIRMED",
      isoRange(2 * HOUR, 2 * HOUR + 30 * 60 * 1000),
    );

    const agent = await loginAgent(app, patient.email, patient.password);
    const res = await agent.get("/appointments").query({ status: "CONFIRMED" });

    expect(res.status).toBe(200);
    expect(res.body.data.appointments).toHaveLength(1);
    expect(res.body.data.appointments[0].status).toBe("CONFIRMED");
  });

  it("filters by an exact date", async () => {
    const doctor = await createDoctorUser("doc-list-date@test.com", "Pass123456");
    const patient = await createPatientUser("pat-list-date@test.com", "Pass123456");

    await createAppointmentRow(doctor.id, patient.id, "PENDING", isoRange(HOUR, HOUR + 30 * 60 * 1000));
    // Three days out — should be excluded when filtering to today.
    await createAppointmentRow(
      doctor.id,
      patient.id,
      "PENDING",
      isoRange(72 * HOUR, 72 * HOUR + 30 * 60 * 1000),
    );

    const agent = await loginAgent(app, patient.email, patient.password);
    const today = formatDateIST(new Date());
    const res = await agent.get("/appointments").query({ date: today });

    expect(res.status).toBe(200);
    expect(res.body.data.appointments).toHaveLength(1);
  });

  it("filters by dateFrom/dateTo range", async () => {
    const doctor = await createDoctorUser("doc-list-range@test.com", "Pass123456");
    const patient = await createPatientUser("pat-list-range@test.com", "Pass123456");

    await createAppointmentRow(doctor.id, patient.id, "PENDING", isoRange(HOUR, HOUR + 30 * 60 * 1000));
    await createAppointmentRow(
      doctor.id,
      patient.id,
      "PENDING",
      isoRange(72 * HOUR, 72 * HOUR + 30 * 60 * 1000),
    );

    const agent = await loginAgent(app, patient.email, patient.password);
    const today = formatDateIST(new Date());
    const tomorrow = formatDateIST(new Date(Date.now() + 24 * HOUR));

    const res = await agent
      .get("/appointments")
      .query({ dateFrom: today, dateTo: tomorrow });

    expect(res.status).toBe(200);
    expect(res.body.data.appointments).toHaveLength(1);
  });

  it("sorts by appointmentTime ascending vs descending", async () => {
    const doctor = await createDoctorUser("doc-list-sort@test.com", "Pass123456");
    const patient = await createPatientUser("pat-list-sort@test.com", "Pass123456");

    const earlyId = await createAppointmentRow(
      doctor.id,
      patient.id,
      "PENDING",
      isoRange(HOUR, HOUR + 30 * 60 * 1000),
    );
    const lateId = await createAppointmentRow(
      doctor.id,
      patient.id,
      "PENDING",
      isoRange(5 * HOUR, 5 * HOUR + 30 * 60 * 1000),
    );

    const agent = await loginAgent(app, patient.email, patient.password);

    const asc = await agent
      .get("/appointments")
      .query({ sortBy: "appointmentTime", order: "ASC" });
    expect(asc.status).toBe(200);
    expect(asc.body.data.appointments.map((a: { id: number }) => a.id)).toEqual([
      earlyId,
      lateId,
    ]);

    const desc = await agent
      .get("/appointments")
      .query({ sortBy: "appointmentTime", order: "DESC" });
    expect(desc.status).toBe(200);
    expect(desc.body.data.appointments.map((a: { id: number }) => a.id)).toEqual([
      lateId,
      earlyId,
    ]);
  });

  it("sorts by createdAt", async () => {
    const doctor = await createDoctorUser("doc-list-sort-created@test.com", "Pass123456");
    const patient = await createPatientUser("pat-list-sort-created@test.com", "Pass123456");

    // Insert in an order where createdAt order differs from appointmentTime order.
    const firstCreatedId = await createAppointmentRow(
      doctor.id,
      patient.id,
      "PENDING",
      isoRange(5 * HOUR, 5 * HOUR + 30 * 60 * 1000),
    );
    const secondCreatedId = await createAppointmentRow(
      doctor.id,
      patient.id,
      "PENDING",
      isoRange(HOUR, HOUR + 30 * 60 * 1000),
    );

    const agent = await loginAgent(app, patient.email, patient.password);
    const res = await agent
      .get("/appointments")
      .query({ sortBy: "createdAt", order: "ASC" });

    expect(res.status).toBe(200);
    expect(res.body.data.appointments.map((a: { id: number }) => a.id)).toEqual([
      firstCreatedId,
      secondCreatedId,
    ]);
  });

  it("rejects combining date with dateFrom/dateTo (INVALID_DATE_FILTER)", async () => {
    const patient = await createPatientUser("pat-list-invalidfilter@test.com", "Pass123456");
    const agent = await loginAgent(app, patient.email, patient.password);
    const today = formatDateIST(new Date());

    const res = await agent
      .get("/appointments")
      .query({ date: today, dateFrom: today });

    expect(res.status).toBe(400);
  });

  it("rejects dateFrom after dateTo (INVALID_DATE_RANGE)", async () => {
    const patient = await createPatientUser("pat-list-invalidrange@test.com", "Pass123456");
    const agent = await loginAgent(app, patient.email, patient.password);

    const tomorrow = formatDateIST(new Date(Date.now() + 24 * HOUR));
    const today = formatDateIST(new Date());

    const res = await agent
      .get("/appointments")
      .query({ dateFrom: tomorrow, dateTo: today });

    expect(res.status).toBe(400);
  });
});

describe("GET /doctor/appointments (doctor listing)", () => {
  it("paginates and filters by status for the doctor's own appointments", async () => {
    const doctor = await createDoctorUser("doc-list-doc-page@test.com", "Pass123456");
    const patient = await createPatientUser("pat-list-doc-page@test.com", "Pass123456");

    await createAppointmentRow(doctor.id, patient.id, "PENDING", isoRange(HOUR, HOUR + 30 * 60 * 1000));
    await createAppointmentRow(
      doctor.id,
      patient.id,
      "CONFIRMED",
      isoRange(2 * HOUR, 2 * HOUR + 30 * 60 * 1000),
    );
    await createAppointmentRow(
      doctor.id,
      patient.id,
      "CONFIRMED",
      isoRange(3 * HOUR, 3 * HOUR + 30 * 60 * 1000),
    );

    const agent = await loginAgent(app, doctor.email, doctor.password);

    const res = await agent
      .get("/doctor/appointments")
      .query({ status: "CONFIRMED", page: 1, limit: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data.appointments).toHaveLength(1);
    expect(res.body.data.pagination).toMatchObject({ page: 1, limit: 1, total: 2, totalPages: 2 });
  });

  it("only returns the authenticated doctor's own appointments, never another doctor's", async () => {
    const doctorA = await createDoctorUser("doc-list-scope-a@test.com", "Pass123456");
    const doctorB = await createDoctorUser("doc-list-scope-b@test.com", "Pass123456");
    const patient = await createPatientUser("pat-list-scope@test.com", "Pass123456");

    await createAppointmentRow(doctorA.id, patient.id, "PENDING", isoRange(HOUR, HOUR + 30 * 60 * 1000));
    await createAppointmentRow(
      doctorB.id,
      patient.id,
      "PENDING",
      isoRange(2 * HOUR, 2 * HOUR + 30 * 60 * 1000),
    );

    const agentB = await loginAgent(app, doctorB.email, doctorB.password);
    const res = await agentB.get("/doctor/appointments");

    expect(res.status).toBe(200);
    expect(res.body.data.appointments).toHaveLength(1);
    expect(res.body.data.appointments[0].patient.patientId).toBe(patient.id);
  });

  it("rejects an invalid status value at the validation layer", async () => {
    const doctor = await createDoctorUser("doc-list-badstatus@test.com", "Pass123456");
    const agent = await loginAgent(app, doctor.email, doctor.password);

    const res = await agent.get("/doctor/appointments").query({ status: "NOT_A_STATUS" });
    expect(res.status).toBe(400);
  });
});

describe("Stale-PENDING expiry on listing", () => {
  it("expires the patient's own stale PENDING appointments when they list their appointments", async () => {
    const doctor = await createDoctorUser("doc-list-expire-patient@test.com", "Pass123456");
    const patient = await createPatientUser("pat-list-expire@test.com", "Pass123456");

    const staleId = await createAppointmentRow(
      doctor.id,
      patient.id,
      "PENDING",
      isoRange(HOUR, HOUR + 30 * 60 * 1000),
      { createdAt: new Date(Date.now() - 49 * HOUR) },
    );

    const emails = spyOnAppointmentEmails();

    const agent = await loginAgent(app, patient.email, patient.password);
    const res = await agent.get("/appointments");
    expect(res.status).toBe(200);

    const [row] = await getConnection().query(`SELECT status FROM appointments WHERE id = $1`, [staleId]);
    expect(row.status).toBe("REJECTED");
    expect(emails.declined).toHaveBeenCalledWith(patient.email, staleId, expect.any(Object));
  });

  it("expires a doctor's own stale PENDING appointments when they list their appointments", async () => {
    const doctor = await createDoctorUser("doc-list-expire-doctor@test.com", "Pass123456");
    const patient = await createPatientUser("pat-list-expire-doctor@test.com", "Pass123456");

    const staleId = await createAppointmentRow(
      doctor.id,
      patient.id,
      "PENDING",
      isoRange(HOUR, HOUR + 30 * 60 * 1000),
      { createdAt: new Date(Date.now() - 49 * HOUR) },
    );

    const emails = spyOnAppointmentEmails();

    const agent = await loginAgent(app, doctor.email, doctor.password);
    const res = await agent.get("/doctor/appointments");
    expect(res.status).toBe(200);

    const [row] = await getConnection().query(`SELECT status FROM appointments WHERE id = $1`, [staleId]);
    expect(row.status).toBe("REJECTED");
    expect(emails.declined).toHaveBeenCalledWith(patient.email, staleId, expect.any(Object));
  });
});
