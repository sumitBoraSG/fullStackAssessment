import { OpenAPIV3 } from "openapi-types";
import { wrapSuccessData } from "./helpers";

// Shared 401/403/429 trio for every authenticated route below, regardless
// of which role(s) are actually allowed (DOCTOR-only vs PATIENT/DOCTOR/ADMIN
// discovery routes) — the response shapes themselves don't differ by role.
const authRoleResponses: OpenAPIV3.ResponsesObject = {
  "401": { $ref: "#/components/responses/Unauthorized401" },
  "403": { $ref: "#/components/responses/Forbidden403" },
  "429": { $ref: "#/components/responses/TooManyRequests429" },
};

const dateQueryParam: OpenAPIV3.ParameterObject = {
  name: "date",
  in: "query",
  required: false,
  schema: { type: "string", format: "date" },
  description: "Filter to a single date (YYYY-MM-DD).",
};

const appointmentSortParams: (OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject)[] = [
  { name: "status", in: "query", required: false, schema: { $ref: "#/components/schemas/AppointmentStatus" } },
  { ...dateQueryParam },
  {
    name: "dateFrom",
    in: "query",
    required: false,
    schema: { type: "string", format: "date" },
    description: "Mutually exclusive with `date`.",
  },
  {
    name: "dateTo",
    in: "query",
    required: false,
    schema: { type: "string", format: "date" },
    description: "Mutually exclusive with `date`.",
  },
  {
    name: "sortBy",
    in: "query",
    required: false,
    schema: { type: "string", enum: ["appointmentTime", "createdAt", "updatedAt"], default: "appointmentTime" },
  },
  { name: "order", in: "query", required: false, schema: { type: "string", enum: ["ASC", "DESC"], default: "ASC" } },
];

export const doctorPaths: Record<string, OpenAPIV3.PathItemObject> = {
  "/doctor/availability": {
    post: {
      tags: ["Doctor"],
      summary: "Create an availability slot",
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/CreateAvailabilityRequest" } } },
      },
      responses: {
        "201": {
          description: "Availability slot created.",
          content: {
            "application/json": { schema: wrapSuccessData({ $ref: "#/components/schemas/CreatedAvailability" }) },
          },
        },
        "400": { $ref: "#/components/responses/BadRequest400" },
        "404": { $ref: "#/components/responses/NotFound404" },
        "409": { $ref: "#/components/responses/Conflict409" },
        ...authRoleResponses,
      },
    },
    get: {
      tags: ["Doctor"],
      summary: "List own availability slots",
      security: [{ cookieAuth: [] }],
      parameters: [dateQueryParam],
      responses: {
        "200": {
          description: "Availability slots fetched.",
          content: {
            "application/json": {
              schema: wrapSuccessData({ type: "array", items: { $ref: "#/components/schemas/AvailabilitySlot" } }),
            },
          },
        },
        "404": { $ref: "#/components/responses/NotFound404" },
        ...authRoleResponses,
      },
    },
  },
  "/doctor/appointments": {
    get: {
      tags: ["Doctor"],
      summary: "List own appointments",
      security: [{ cookieAuth: [] }],
      parameters: [
        { $ref: "#/components/parameters/Page" },
        { $ref: "#/components/parameters/Limit" },
        ...appointmentSortParams,
        { name: "patientId", in: "query", required: false, schema: { type: "integer" } },
      ],
      responses: {
        "200": {
          description: "Appointments fetched.",
          content: {
            "application/json": {
              schema: wrapSuccessData({ $ref: "#/components/schemas/DoctorAppointmentsResponseData" }),
            },
          },
        },
        "400": { $ref: "#/components/responses/BadRequest400" },
        ...authRoleResponses,
      },
    },
  },
  "/doctor/appointments/{appointmentId}/status": {
    patch: {
      tags: ["Doctor"],
      summary: "Confirm, reject, or complete an appointment",
      security: [{ cookieAuth: [] }],
      parameters: [{ $ref: "#/components/parameters/AppointmentId" }],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateAppointmentStatusRequest" } } },
      },
      responses: {
        "200": {
          description: "Appointment status updated.",
          content: {
            "application/json": { schema: wrapSuccessData({ $ref: "#/components/schemas/DoctorAppointment" }) },
          },
        },
        "400": { $ref: "#/components/responses/BadRequest400" },
        "404": { $ref: "#/components/responses/NotFound404" },
        "409": { $ref: "#/components/responses/Conflict409" },
        ...authRoleResponses,
      },
    },
  },
  "/doctor/profile": {
    get: {
      tags: ["Doctor"],
      summary: "Get own doctor profile",
      security: [{ cookieAuth: [] }],
      responses: {
        "200": {
          description: "Profile fetched.",
          content: { "application/json": { schema: wrapSuccessData({ $ref: "#/components/schemas/DoctorProfile" }) } },
        },
        "404": { $ref: "#/components/responses/NotFound404" },
        ...authRoleResponses,
      },
    },
    patch: {
      tags: ["Doctor"],
      summary: "Update own doctor profile",
      description: "Only experienceYears is updatable.",
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateDoctorProfileRequest" } } },
      },
      responses: {
        "200": {
          description: "Profile updated.",
          content: { "application/json": { schema: wrapSuccessData({ $ref: "#/components/schemas/DoctorProfile" }) } },
        },
        "400": { $ref: "#/components/responses/BadRequest400" },
        "404": { $ref: "#/components/responses/NotFound404" },
        ...authRoleResponses,
      },
    },
  },
  "/doctors/specializations": {
    get: {
      tags: ["Doctors"],
      summary: "List active specializations",
      description:
        "Public, unauthenticated — populates the specialization dropdown " +
        "on the not-yet-registered accept-invitation signup page.",
      security: [],
      responses: {
        "200": {
          description: "Specializations fetched.",
          content: {
            "application/json": {
              schema: wrapSuccessData({ type: "array", items: { $ref: "#/components/schemas/SpecializationItem" } }),
            },
          },
        },
        "429": { $ref: "#/components/responses/TooManyRequests429" },
      },
    },
  },
  "/doctors/{doctorId}/availability": {
    get: {
      tags: ["Doctors"],
      summary: "Get a doctor's bookable availability",
      description: "Excludes slots already tied to a PENDING/CONFIRMED appointment.",
      security: [{ cookieAuth: [] }],
      parameters: [{ $ref: "#/components/parameters/DoctorId" }, dateQueryParam],
      responses: {
        "200": {
          description: "Availability fetched.",
          content: {
            "application/json": {
              schema: wrapSuccessData({ $ref: "#/components/schemas/DoctorAvailabilityResponseData" }),
            },
          },
        },
        "404": { $ref: "#/components/responses/NotFound404" },
        ...authRoleResponses,
      },
    },
  },
  "/doctors": {
    get: {
      tags: ["Doctors"],
      summary: "Search/list doctors",
      security: [{ cookieAuth: [] }],
      parameters: [
        { name: "search", in: "query", required: false, schema: { type: "string", maxLength: 100 } },
        { name: "specialization", in: "query", required: false, schema: { type: "string", maxLength: 100 } },
        {
          name: "date",
          in: "query",
          required: false,
          schema: { type: "string", format: "date" },
          description: "Only return doctors with availability on this date.",
        },
        { $ref: "#/components/parameters/Page" },
        { $ref: "#/components/parameters/Limit" },
      ],
      responses: {
        "200": {
          description: "Doctors fetched.",
          content: {
            "application/json": { schema: wrapSuccessData({ $ref: "#/components/schemas/DoctorsListResponseData" }) },
          },
        },
        ...authRoleResponses,
      },
    },
  },
};
