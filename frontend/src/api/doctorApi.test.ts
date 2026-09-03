import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../test/msw/server";
import { defaultSpecializations } from "../test/msw/handlers";
import {
  createDoctorAvailabilityApi,
  getDoctorAvailabilityApi,
  getDoctorsApi,
  getOwnDoctorAvailabilityApi,
  getSpecializationsApi,
} from "./doctorApi";

const BASE = "http://localhost:3000";

describe("doctorApi", () => {
  it("createDoctorAvailabilityApi returns the created slot on success", async () => {
    const result = await createDoctorAvailabilityApi({ date: "2099-01-01", startTime: "09:00", endTime: "17:00" });
    expect(result.success).toBe(true);
    expect(result.data?.startTime).toBe("09:00");
  });

  it("createDoctorAvailabilityApi surfaces an AVAILABILITY_OVERLAP error envelope", async () => {
    server.use(
      http.post(`${BASE}/doctor/availability`, () =>
        HttpResponse.json(
          { success: false, code: "AVAILABILITY_OVERLAP", message: "This slot overlaps with an existing availability window." },
          { status: 409 },
        ),
      ),
    );

    const result = await createDoctorAvailabilityApi({ date: "2099-01-01", startTime: "09:00", endTime: "17:00" });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("AVAILABILITY_OVERLAP");
  });

  it("getOwnDoctorAvailabilityApi returns the slot list on success", async () => {
    server.use(
      http.get(`${BASE}/doctor/availability`, () =>
        HttpResponse.json({ success: true, data: [{ id: 1, date: "2099-01-01", startTime: "09:00", endTime: "17:00" }] }),
      ),
    );

    const result = await getOwnDoctorAvailabilityApi("2099-01-01");
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  it("getOwnDoctorAvailabilityApi surfaces an error message on failure", async () => {
    server.use(http.get(`${BASE}/doctor/availability`, () => HttpResponse.json({ success: false, message: "Failed to fetch availability." }, { status: 500 })));

    const result = await getOwnDoctorAvailabilityApi();
    expect(result.success).toBe(false);
    expect(result.message).toBe("Failed to fetch availability.");
  });

  it("getDoctorsApi returns the doctor list + pagination on success", async () => {
    const result = await getDoctorsApi({ search: "doc" });
    expect(result.success).toBe(true);
    expect(result.data?.pagination).toEqual({ page: 1, limit: 8, total: 0, totalPages: 1 });
  });

  it("getDoctorAvailabilityApi returns doctor + availability on success", async () => {
    const result = await getDoctorAvailabilityApi(2, "2099-01-01");
    expect(result.success).toBe(true);
    expect(result.data?.doctor.id).toBe(2);
  });

  it("getDoctorAvailabilityApi surfaces an error message on failure", async () => {
    server.use(http.get(`${BASE}/doctors/:doctorId/availability`, () => HttpResponse.json({ success: false, message: "Doctor not found." }, { status: 404 })));

    const result = await getDoctorAvailabilityApi(999);
    expect(result.success).toBe(false);
    expect(result.message).toBe("Doctor not found.");
  });

  it("getSpecializationsApi returns the specialization list on success", async () => {
    const result = await getSpecializationsApi();
    expect(result.success).toBe(true);
    expect(result.data).toEqual(defaultSpecializations);
  });

  it("getSpecializationsApi surfaces an error message on failure", async () => {
    server.use(http.get(`${BASE}/doctors/specializations`, () => HttpResponse.json({ success: false, message: "Failed to fetch specializations." }, { status: 500 })));

    const result = await getSpecializationsApi();
    expect(result.success).toBe(false);
    expect(result.message).toBe("Failed to fetch specializations.");
  });
});
