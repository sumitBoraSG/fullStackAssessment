import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../test/msw/server";
import {
  cancelPatientAppointmentApi,
  createAppointmentApi,
  getDoctorAppointmentsApi,
  getPatientAppointmentsApi,
  updateDoctorAppointmentStatusApi,
} from "./appointmentApi";

const BASE = "http://localhost:3000";

describe("appointmentApi", () => {
  it("createAppointmentApi returns the booked appointment on success", async () => {
    const result = await createAppointmentApi({ doctorId: 2, date: "2099-01-01", startTime: "09:00", endTime: "09:30" });
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe("PENDING");
  });

  it("createAppointmentApi surfaces a DOCTOR_NOT_AVAILABLE error envelope", async () => {
    server.use(
      http.post(`${BASE}/appointments`, () =>
        HttpResponse.json(
          { success: false, code: "DOCTOR_NOT_AVAILABLE", message: "The doctor is not available at this time." },
          { status: 409 },
        ),
      ),
    );

    const result = await createAppointmentApi({ doctorId: 2, date: "2099-01-01", startTime: "09:00", endTime: "09:30" });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("DOCTOR_NOT_AVAILABLE");
  });

  it("getPatientAppointmentsApi returns appointments + pagination on success", async () => {
    const result = await getPatientAppointmentsApi({ status: "PENDING" });
    expect(result.success).toBe(true);
    expect(result.data?.pagination).toEqual({ page: 1, limit: 8, total: 0, totalPages: 1 });
  });

  it("getPatientAppointmentsApi surfaces an error message on failure", async () => {
    server.use(http.get(`${BASE}/appointments`, () => HttpResponse.json({ success: false, message: "Failed to fetch patient appointments." }, { status: 500 })));

    const result = await getPatientAppointmentsApi();
    expect(result.success).toBe(false);
    expect(result.message).toBe("Failed to fetch patient appointments.");
  });

  it("cancelPatientAppointmentApi returns the cancelled appointment on success", async () => {
    const result = await cancelPatientAppointmentApi(100);
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe("CANCELLED");
  });

  it("cancelPatientAppointmentApi surfaces an INVALID_STATUS_TRANSITION error envelope", async () => {
    server.use(
      http.patch(`${BASE}/appointments/:id/status`, () =>
        HttpResponse.json(
          { success: false, code: "INVALID_STATUS_TRANSITION", message: "This appointment cannot be cancelled." },
          { status: 409 },
        ),
      ),
    );

    const result = await cancelPatientAppointmentApi(100);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("getDoctorAppointmentsApi returns appointments + pagination on success", async () => {
    const result = await getDoctorAppointmentsApi({ status: "CONFIRMED" });
    expect(result.success).toBe(true);
    expect(result.data?.pagination).toEqual({ page: 1, limit: 8, total: 0, totalPages: 1 });
  });

  it("getDoctorAppointmentsApi surfaces an error message on failure", async () => {
    server.use(http.get(`${BASE}/doctor/appointments`, () => HttpResponse.json({ success: false, message: "Failed to fetch doctor appointments." }, { status: 500 })));

    const result = await getDoctorAppointmentsApi();
    expect(result.success).toBe(false);
    expect(result.message).toBe("Failed to fetch doctor appointments.");
  });

  it("updateDoctorAppointmentStatusApi returns the updated appointment on success", async () => {
    const result = await updateDoctorAppointmentStatusApi(100, "CONFIRMED");
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe("CONFIRMED");
  });

  it("updateDoctorAppointmentStatusApi surfaces an APPOINTMENT_TIME_ALREADY_PASSED error envelope", async () => {
    server.use(
      http.patch(`${BASE}/doctor/appointments/:id/status`, () =>
        HttpResponse.json(
          { success: false, code: "APPOINTMENT_TIME_ALREADY_PASSED", message: "This appointment's time has already passed." },
          { status: 409 },
        ),
      ),
    );

    const result = await updateDoctorAppointmentStatusApi(100, "COMPLETED");
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("APPOINTMENT_TIME_ALREADY_PASSED");
  });
});
