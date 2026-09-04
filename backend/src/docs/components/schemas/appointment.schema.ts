import { OpenAPIV3 } from "openapi-types";

export const CreateAppointmentRequestSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    doctorId: { type: "integer", minimum: 1 },
    date: { type: "string", format: "date", example: "2026-09-10" },
    startTime: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$", example: "09:00" },
    endTime: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$", example: "09:30" },
  },
  required: ["doctorId", "date", "startTime", "endTime"],
};

export const AppointmentDoctorSummarySchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    doctorId: { type: "integer" },
    firstName: { type: "string" },
    lastName: { type: "string" },
    specialization: { type: "string", example: "General Practitioner" },
    experienceYears: { type: "integer" },
  },
  required: ["doctorId", "firstName", "lastName", "specialization", "experienceYears"],
};

export const AppointmentPatientSummarySchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    patientId: { type: "integer" },
    firstName: { type: "string" },
    lastName: { type: "string" },
    email: { type: "string", format: "email" },
  },
  required: ["patientId", "firstName", "lastName", "email"],
};

// Returned by POST /appointments/, GET /appointments/ (list items), and
// PATCH /appointments/:appointmentId/status (patient cancel).
export const PatientAppointmentSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    id: { type: "integer" },
    status: { $ref: "#/components/schemas/AppointmentStatus" },
    date: { type: "string", format: "date" },
    startTime: { type: "string" },
    endTime: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    doctor: { $ref: "#/components/schemas/AppointmentDoctorSummary" },
  },
  required: ["id", "status", "date", "startTime", "endTime", "createdAt", "updatedAt", "doctor"],
};

// Returned by GET /doctor/appointments (list items) and
// PATCH /doctor/appointments/:appointmentId/status.
export const DoctorAppointmentSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    id: { type: "integer" },
    status: { $ref: "#/components/schemas/AppointmentStatus" },
    date: { type: "string", format: "date" },
    startTime: { type: "string" },
    endTime: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    patient: { $ref: "#/components/schemas/AppointmentPatientSummary" },
  },
  required: ["id", "status", "date", "startTime", "endTime", "createdAt", "updatedAt", "patient"],
};

export const PatientAppointmentsResponseDataSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    appointments: { type: "array", items: { $ref: "#/components/schemas/PatientAppointment" } },
    pagination: { $ref: "#/components/schemas/PaginationMeta" },
  },
  required: ["appointments", "pagination"],
};

export const DoctorAppointmentsResponseDataSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    appointments: { type: "array", items: { $ref: "#/components/schemas/DoctorAppointment" } },
    pagination: { $ref: "#/components/schemas/PaginationMeta" },
  },
  required: ["appointments", "pagination"],
};

export const UpdateAppointmentStatusRequestSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  description:
    "Doctor-only transition (see PATCH /doctor/appointments/:appointmentId/status). " +
    "Allowed transitions: PENDING → CONFIRMED/REJECTED, CONFIRMED → COMPLETED.",
  properties: {
    status: { type: "string", enum: ["CONFIRMED", "REJECTED", "COMPLETED"] },
  },
  required: ["status"],
};

export const CancelAppointmentRequestSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  description:
    "Patient-only transition (see PATCH /appointments/:appointmentId/status). " +
    "CANCELLED is the only accepted value.",
  properties: {
    status: { type: "string", enum: ["CANCELLED"] },
  },
  required: ["status"],
};

export const appointmentSchemas: Record<string, OpenAPIV3.SchemaObject> = {
  CreateAppointmentRequest: CreateAppointmentRequestSchema,
  AppointmentDoctorSummary: AppointmentDoctorSummarySchema,
  AppointmentPatientSummary: AppointmentPatientSummarySchema,
  PatientAppointment: PatientAppointmentSchema,
  DoctorAppointment: DoctorAppointmentSchema,
  PatientAppointmentsResponseData: PatientAppointmentsResponseDataSchema,
  DoctorAppointmentsResponseData: DoctorAppointmentsResponseDataSchema,
  UpdateAppointmentStatusRequest: UpdateAppointmentStatusRequestSchema,
  CancelAppointmentRequest: CancelAppointmentRequestSchema,
};
