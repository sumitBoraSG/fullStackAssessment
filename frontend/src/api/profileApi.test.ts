import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../test/msw/server";
import { defaultDoctorProfile, defaultPatientProfile } from "../test/msw/handlers";
import {
  getDoctorProfileApi,
  getPatientProfileApi,
  updateDoctorProfileApi,
  updatePatientProfileApi,
} from "./profileApi";

const BASE = "http://localhost:3000";

describe("profileApi - patient", () => {
  it("getPatientProfileApi returns the profile on success", async () => {
    const result = await getPatientProfileApi();
    expect(result.success).toBe(true);
    expect(result.data).toEqual(defaultPatientProfile);
  });

  it("updatePatientProfileApi merges the payload into the returned profile", async () => {
    const result = await updatePatientProfileApi({ heightCm: 180, weightKg: 75 });
    expect(result.success).toBe(true);
    expect(result.data?.heightCm).toBe(180);
    expect(result.data?.weightKg).toBe(75);
  });

  it("extracts the first message from a Joi validation-error envelope (array `data`)", async () => {
    server.use(
      http.patch(`${BASE}/patient/profile`, () =>
        HttpResponse.json(
          {
            status: false,
            message: "Validation Error",
            code: "validation_error",
            data: [{ message: '"heightCm" must be less than or equal to 300', label: "heightCm" }],
          },
          { status: 400 },
        ),
      ),
    );

    const result = await updatePatientProfileApi({ heightCm: 999, weightKg: 75 });
    expect(result.success).toBe(false);
    expect(result.message).toBe('"heightCm" must be less than or equal to 300');
  });

  it("falls back to a generic message when the standard envelope has no message", async () => {
    server.use(http.get(`${BASE}/patient/profile`, () => HttpResponse.json({ success: false }, { status: 500 })));

    const result = await getPatientProfileApi();
    expect(result.success).toBe(false);
    expect(result.message).toBe("Failed to load your profile.");
  });

  it("returns a network-error message when the fetch itself throws", async () => {
    server.use(http.get(`${BASE}/patient/profile`, () => HttpResponse.error()));

    const result = await getPatientProfileApi();
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/network|failed to fetch/i);
  });
});

describe("profileApi - doctor", () => {
  it("getDoctorProfileApi returns the profile on success", async () => {
    const result = await getDoctorProfileApi();
    expect(result.success).toBe(true);
    expect(result.data).toEqual(defaultDoctorProfile);
  });

  it("updateDoctorProfileApi merges the payload into the returned profile", async () => {
    const result = await updateDoctorProfileApi({ experienceYears: 12 });
    expect(result.success).toBe(true);
    expect(result.data?.experienceYears).toBe(12);
  });

  it("surfaces the Joi validation-error envelope for the doctor update path too", async () => {
    server.use(
      http.patch(`${BASE}/doctor/profile`, () =>
        HttpResponse.json(
          {
            status: false,
            message: "Validation Error",
            code: "validation_error",
            data: [{ message: '"experienceYears" must be a positive number', label: "experienceYears" }],
          },
          { status: 400 },
        ),
      ),
    );

    const result = await updateDoctorProfileApi({ experienceYears: -1 });
    expect(result.success).toBe(false);
    expect(result.message).toBe('"experienceYears" must be a positive number');
  });
});
