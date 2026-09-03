import { app, setupIntegrationTest } from "../util/testApp";
import { createDoctorUser, createAvailabilityRow, loginAgent } from "../util/factories";
import { formatDateIST, formatTimeIST } from "@util/dateTimeRange";

setupIntegrationTest();

function dateTimeAt(offsetMs: number): { date: string; time: string } {
  const d = new Date(Date.now() + offsetMs);
  return { date: formatDateIST(d), time: formatTimeIST(d) };
}

describe("POST /doctor/availability", () => {
  it("creates an availability slot on the happy path", async () => {
    const doctor = await createDoctorUser("doc-avail-happy@test.com", "Pass123456");
    const agent = await loginAgent(app, doctor.email, doctor.password);

    const start = dateTimeAt(60 * 60 * 1000);
    const end = dateTimeAt(2 * 60 * 60 * 1000);

    const res = await agent.post("/doctor/availability").send({
      date: start.date,
      startTime: start.time,
      endTime: end.time,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.doctorId).toBe(doctor.id);
    expect(res.body.data.date).toBe(start.date);
    expect(res.body.data.startTime).toBe(start.time);
    expect(res.body.data.endTime).toBe(end.time);
  });

  it("rejects a past date", async () => {
    const doctor = await createDoctorUser("doc-avail-pastdate@test.com", "Pass123456");
    const agent = await loginAgent(app, doctor.email, doctor.password);

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const res = await agent.post("/doctor/availability").send({
      date: formatDateIST(yesterday),
      startTime: "10:00",
      endTime: "11:00",
    });

    expect(res.status).toBe(400);
  });

  it("rejects a start time already past on today's date", async () => {
    const doctor = await createDoctorUser("doc-avail-pasttime@test.com", "Pass123456");
    const agent = await loginAgent(app, doctor.email, doctor.password);

    const past = dateTimeAt(-60 * 60 * 1000); // 1h ago, still today (assuming test doesn't run at midnight)
    const today = formatDateIST(new Date());

    const res = await agent.post("/doctor/availability").send({
      date: today,
      startTime: past.time,
      endTime: "23:59",
    });

    expect(res.status).toBe(400);
  });

  it("rejects startTime >= endTime", async () => {
    const doctor = await createDoctorUser("doc-avail-badrange@test.com", "Pass123456");
    const agent = await loginAgent(app, doctor.email, doctor.password);

    const start = dateTimeAt(60 * 60 * 1000);

    const res = await agent.post("/doctor/availability").send({
      date: start.date,
      startTime: "14:00",
      endTime: "14:00",
    });

    expect(res.status).toBe(400);
  });

  it("returns AVAILABILITY_OVERLAP 409 when a new slot overlaps an existing one via the real exclusion constraint", async () => {
    const doctor = await createDoctorUser("doc-avail-overlap@test.com", "Pass123456");
    const start = dateTimeAt(60 * 60 * 1000);
    const end = dateTimeAt(3 * 60 * 60 * 1000);

    await createAvailabilityRow(
      doctor.id,
      `[${new Date(Date.now() + 60 * 60 * 1000).toISOString()},${new Date(
        Date.now() + 3 * 60 * 60 * 1000,
      ).toISOString()})`,
    );

    const agent = await loginAgent(app, doctor.email, doctor.password);

    // Overlapping window: starts inside the existing [1h, 3h) slot.
    const overlapStart = dateTimeAt(2 * 60 * 60 * 1000);
    const overlapEnd = dateTimeAt(4 * 60 * 60 * 1000);

    const res = await agent.post("/doctor/availability").send({
      date: start.date,
      startTime: overlapStart.time,
      endTime: overlapEnd.time,
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("overlap");
  });
});
