import { OpenAPIV3 } from "openapi-types";

const TIME_PATTERN_DESCRIPTION = "HH:mm, 24-hour";

export const CreateAvailabilityRequestSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    date: { type: "string", format: "date", example: "2026-09-10" },
    startTime: {
      type: "string",
      pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
      description: TIME_PATTERN_DESCRIPTION,
      example: "09:00",
    },
    endTime: {
      type: "string",
      pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
      description: TIME_PATTERN_DESCRIPTION,
      example: "17:00",
    },
  },
  required: ["date", "startTime", "endTime"],
};

export const AvailabilitySlotSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  description: "Returned by GET /doctor/availability and GET /doctors/:doctorId/availability.",
  properties: {
    id: { type: "integer" },
    date: { type: "string", format: "date" },
    startTime: { type: "string" },
    endTime: { type: "string" },
  },
  required: ["id", "date", "startTime", "endTime"],
};

export const CreatedAvailabilitySchema: OpenAPIV3.SchemaObject = {
  description: "Returned by POST /doctor/availability.",
  allOf: [
    { $ref: "#/components/schemas/AvailabilitySlot" },
    {
      type: "object",
      properties: {
        doctorId: { type: "integer" },
        createdAt: { type: "string", format: "date-time" },
      },
      required: ["doctorId", "createdAt"],
    },
  ],
};

export const DoctorProfileSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  description: "Returned by GET /doctor/profile and PATCH /doctor/profile.",
  properties: {
    id: { type: "integer" },
    firstName: { type: "string" },
    lastName: { type: "string" },
    email: { type: "string", format: "email" },
    specialization: { type: "string", example: "General Practitioner" },
    experienceYears: { type: "integer" },
  },
  required: ["id", "firstName", "lastName", "email", "specialization", "experienceYears"],
};

export const UpdateDoctorProfileRequestSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    experienceYears: { type: "integer", minimum: 0, maximum: 80 },
  },
  required: ["experienceYears"],
};

export const SpecializationItemSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    description: { type: "string" },
  },
  required: ["id", "name", "description"],
};

export const DoctorListItemSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  description:
    "Returned by GET /doctors/ and as the `doctor` field of " +
    "GET /doctors/:doctorId/availability. No email — this is public/discovery data.",
  properties: {
    id: { type: "integer" },
    firstName: { type: "string" },
    lastName: { type: "string" },
    specialization: { type: "string", example: "General Practitioner" },
    experienceYears: { type: "integer" },
  },
  required: ["id", "firstName", "lastName", "specialization", "experienceYears"],
};

export const DoctorsListResponseDataSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    doctors: { type: "array", items: { $ref: "#/components/schemas/DoctorListItem" } },
    pagination: { $ref: "#/components/schemas/PaginationMeta" },
  },
  required: ["doctors", "pagination"],
};

export const DoctorAvailabilityResponseDataSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    doctor: { $ref: "#/components/schemas/DoctorListItem" },
    availability: { type: "array", items: { $ref: "#/components/schemas/AvailabilitySlot" } },
  },
  required: ["doctor", "availability"],
};

export const doctorSchemas: Record<string, OpenAPIV3.SchemaObject> = {
  CreateAvailabilityRequest: CreateAvailabilityRequestSchema,
  AvailabilitySlot: AvailabilitySlotSchema,
  CreatedAvailability: CreatedAvailabilitySchema,
  DoctorProfile: DoctorProfileSchema,
  UpdateDoctorProfileRequest: UpdateDoctorProfileRequestSchema,
  SpecializationItem: SpecializationItemSchema,
  DoctorListItem: DoctorListItemSchema,
  DoctorsListResponseData: DoctorsListResponseDataSchema,
  DoctorAvailabilityResponseData: DoctorAvailabilityResponseDataSchema,
};
