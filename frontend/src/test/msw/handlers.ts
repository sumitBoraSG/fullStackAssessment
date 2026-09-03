import { http, HttpResponse } from "msw";

const BASE = "http://localhost:3000";

// Default fixtures. Individual tests override specific handlers via
// `server.use(...)` for error/edge cases rather than mutating these.
export const defaultPatientUser = {
  id: 1,
  email: "patient@test.com",
  role: "PATIENT" as const,
  firstName: "Pat",
  lastName: "Ient",
};

export const defaultDoctorUser = {
  id: 2,
  email: "doctor@test.com",
  role: "DOCTOR" as const,
  firstName: "Doc",
  lastName: "Tor",
};

export const defaultAdminUser = {
  id: 3,
  email: "admin@test.com",
  role: "ADMIN" as const,
  firstName: "Ad",
  lastName: "Min",
};

export const defaultSpecializations = [
  { id: 1, name: "General Practitioner", description: "Primary care" },
  { id: 2, name: "Cardiology", description: "Heart and cardiovascular system" },
];

export const defaultPatientProfile = {
  id: 1,
  firstName: "Pat",
  lastName: "Ient",
  email: "patient@test.com",
  dob: "1990-01-01",
  bloodGroup: "O+",
  heightCm: 170,
  weightKg: 70,
};

export const defaultDoctorProfile = {
  id: 2,
  firstName: "Doc",
  lastName: "Tor",
  email: "doctor@test.com",
  specialization: "General Practitioner",
  experienceYears: 5,
};

export const authHandlers = [
  http.post(`${BASE}/auth/login`, () =>
    HttpResponse.json({ success: true, data: { user: defaultPatientUser } }),
  ),
  http.post(`${BASE}/auth/logout`, () =>
    HttpResponse.json({ success: true, message: "Logged out" }),
  ),
  http.post(`${BASE}/auth/refresh`, () => HttpResponse.json({ success: true })),
  http.get(`${BASE}/auth/invitation/:token`, () =>
    HttpResponse.json({ success: true, data: { email: "invitee@test.com", role: "PATIENT" } }),
  ),
  http.post(`${BASE}/auth/accept-invitation`, () =>
    HttpResponse.json({
      success: true,
      message: "Account created successfully",
      data: { id: 10, firstName: "New", lastName: "User", email: "invitee@test.com", role: "PATIENT" },
    }),
  ),
];

export const adminHandlers = [
  http.post(`${BASE}/admin/invite`, () =>
    HttpResponse.json({
      success: true,
      message: "Invitation sent successfully",
      data: { id: 1, email: "new@test.com", role: "PATIENT", expiresAt: new Date(Date.now() + 86400000).toISOString() },
    }),
  ),
  http.get(`${BASE}/admin/invitations`, () =>
    HttpResponse.json({
      success: true,
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    }),
  ),
  http.post(`${BASE}/admin/invitations/bulk`, () =>
    HttpResponse.json({
      success: true,
      message: "Bulk invitation process completed",
      data: { total: 0, successful: 0, failed: 0, results: [] },
    }),
  ),
  http.post(`${BASE}/admin/invitations/:id/revoke`, ({ params }) =>
    HttpResponse.json({
      success: true,
      message: "Invitation revoked successfully",
      data: { id: params.id, email: "revoked@test.com", role: "PATIENT", status: "REVOKED" },
    }),
  ),
];

export const doctorHandlers = [
  http.post(`${BASE}/doctor/availability`, () =>
    HttpResponse.json({
      success: true,
      data: { id: 1, date: "2099-01-01", startTime: "09:00", endTime: "17:00", createdAt: new Date().toISOString() },
    }),
  ),
  http.get(`${BASE}/doctor/availability`, () => HttpResponse.json({ success: true, data: [] })),
  http.get(`${BASE}/doctors/specializations`, () =>
    HttpResponse.json({ success: true, data: defaultSpecializations }),
  ),
  http.get(`${BASE}/doctors/:doctorId/availability`, ({ params }) =>
    HttpResponse.json({
      success: true,
      data: {
        doctor: {
          id: Number(params.doctorId),
          firstName: "Doc",
          lastName: "Tor",
          specialization: "General Practitioner",
          experienceYears: 5,
        },
        availability: [],
      },
    }),
  ),
  http.get(`${BASE}/doctors`, () =>
    HttpResponse.json({
      success: true,
      data: { doctors: [], pagination: { page: 1, limit: 8, total: 0, totalPages: 1 } },
    }),
  ),
  http.get(`${BASE}/doctor/profile`, () => HttpResponse.json({ success: true, data: defaultDoctorProfile })),
  http.patch(`${BASE}/doctor/profile`, async ({ request }) => {
    const body = (await request.json()) as { experienceYears?: number };
    return HttpResponse.json({
      success: true,
      message: "Profile updated successfully",
      data: { ...defaultDoctorProfile, ...body },
    });
  }),
];

export const appointmentHandlers = [
  http.post(`${BASE}/appointments`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      data: {
        id: 100,
        status: "PENDING",
        date: body.date,
        startTime: body.startTime,
        endTime: body.endTime,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        doctor: { doctorId: body.doctorId, firstName: "Doc", lastName: "Tor", specialization: "General Practitioner", experienceYears: 5 },
      },
    });
  }),
  http.get(`${BASE}/appointments`, () =>
    HttpResponse.json({
      success: true,
      data: { appointments: [], pagination: { page: 1, limit: 8, total: 0, totalPages: 1 } },
    }),
  ),
  http.patch(`${BASE}/appointments/:id/status`, ({ params }) =>
    HttpResponse.json({
      success: true,
      data: { id: Number(params.id), status: "CANCELLED" },
    }),
  ),
  http.get(`${BASE}/doctor/appointments`, () =>
    HttpResponse.json({
      success: true,
      data: { appointments: [], pagination: { page: 1, limit: 8, total: 0, totalPages: 1 } },
    }),
  ),
  http.patch(`${BASE}/doctor/appointments/:id/status`, async ({ params, request }) => {
    const body = (await request.json()) as { status?: string };
    return HttpResponse.json({
      success: true,
      data: { id: Number(params.id), status: body.status },
    });
  }),
];

export const profileHandlers = [
  http.get(`${BASE}/patient/profile`, () => HttpResponse.json({ success: true, data: defaultPatientProfile })),
  http.patch(`${BASE}/patient/profile`, async ({ request }) => {
    const body = (await request.json()) as { heightCm?: number; weightKg?: number };
    return HttpResponse.json({
      success: true,
      message: "Profile updated successfully",
      data: { ...defaultPatientProfile, ...body },
    });
  }),
];

export const handlers = [
  ...authHandlers,
  ...adminHandlers,
  ...doctorHandlers,
  ...appointmentHandlers,
  ...profileHandlers,
];
