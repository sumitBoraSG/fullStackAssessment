import { OpenAPIV3 } from "openapi-types";
import { wrapSuccessData } from "./helpers";

const patientOnlyResponses: OpenAPIV3.ResponsesObject = {
  "401": { $ref: "#/components/responses/Unauthorized401" },
  "403": { $ref: "#/components/responses/Forbidden403" },
  "429": { $ref: "#/components/responses/TooManyRequests429" },
};

const dateSchema: OpenAPIV3.SchemaObject = { type: "string", format: "date" };

const listQueryParameters: (OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject)[] = [
  { $ref: "#/components/parameters/Page" },
  { $ref: "#/components/parameters/Limit" },
  { name: "status", in: "query", required: false, schema: { $ref: "#/components/schemas/AppointmentStatus" } },
  { name: "date", in: "query", required: false, schema: dateSchema },
  {
    name: "dateFrom",
    in: "query",
    required: false,
    schema: dateSchema,
    description: "Mutually exclusive with `date`.",
  },
  {
    name: "dateTo",
    in: "query",
    required: false,
    schema: dateSchema,
    description: "Mutually exclusive with `date`.",
  },
  { name: "doctorId", in: "query", required: false, schema: { type: "integer" } },
  {
    name: "sortBy",
    in: "query",
    required: false,
    schema: { type: "string", enum: ["appointmentTime", "createdAt", "updatedAt"], default: "appointmentTime" },
  },
  { name: "order", in: "query", required: false, schema: { type: "string", enum: ["ASC", "DESC"], default: "ASC" } },
];

export const appointmentPaths: Record<string, OpenAPIV3.PathItemObject> = {
  "/appointments": {
    get: {
      tags: ["Appointments"],
      summary: "List own appointments",
      security: [{ cookieAuth: [] }],
      parameters: listQueryParameters,
      responses: {
        "200": {
          description: "Appointments fetched.",
          content: {
            "application/json": {
              schema: wrapSuccessData({ $ref: "#/components/schemas/PatientAppointmentsResponseData" }),
            },
          },
        },
        "400": { $ref: "#/components/responses/BadRequest400" },
        ...patientOnlyResponses,
      },
    },
    post: {
      tags: ["Appointments"],
      summary: "Book an appointment",
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/CreateAppointmentRequest" } } },
      },
      responses: {
        "201": {
          description: "Appointment booked (status PENDING).",
          content: {
            "application/json": { schema: wrapSuccessData({ $ref: "#/components/schemas/PatientAppointment" }) },
          },
        },
        "400": { $ref: "#/components/responses/BadRequest400" },
        "404": { $ref: "#/components/responses/NotFound404" },
        "409": { $ref: "#/components/responses/Conflict409" },
        ...patientOnlyResponses,
      },
    },
  },
  "/appointments/{appointmentId}/status": {
    patch: {
      tags: ["Appointments"],
      summary: "Cancel an appointment",
      description: "Patient-only transition — CANCELLED is the only accepted status value.",
      security: [{ cookieAuth: [] }],
      parameters: [{ $ref: "#/components/parameters/AppointmentId" }],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/CancelAppointmentRequest" } } },
      },
      responses: {
        "200": {
          description: "Appointment cancelled.",
          content: {
            "application/json": { schema: wrapSuccessData({ $ref: "#/components/schemas/PatientAppointment" }) },
          },
        },
        "400": { $ref: "#/components/responses/BadRequest400" },
        "404": { $ref: "#/components/responses/NotFound404" },
        "409": { $ref: "#/components/responses/Conflict409" },
        ...patientOnlyResponses,
      },
    },
  },
};
