import { OpenAPIV3 } from "openapi-types";

export const PatientProfileSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  description: "Returned by GET /patient/profile and PATCH /patient/profile.",
  properties: {
    id: { type: "integer" },
    firstName: { type: "string" },
    lastName: { type: "string" },
    email: { type: "string", format: "email" },
    heightCm: { type: "integer", nullable: true },
    weightKg: { type: "integer", nullable: true },
    bloodGroup: { allOf: [{ $ref: "#/components/schemas/BloodGroup" }], nullable: true },
    dob: { type: "string", format: "date", nullable: true },
  },
  required: ["id", "firstName", "lastName", "email", "heightCm", "weightKg", "bloodGroup", "dob"],
};

// Joi's `.min(1)` on this schema requires at least one field, which OpenAPI
// 3.0 has no native "at least one of" construct for — documented in prose
// via `description` instead of enforced in the schema.
export const UpdatePatientProfileRequestSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  description: "At least one of heightCm or weightKg must be provided.",
  properties: {
    heightCm: { type: "integer", minimum: 30, maximum: 300 },
    weightKg: { type: "integer", minimum: 2, maximum: 500 },
  },
};

export const patientSchemas: Record<string, OpenAPIV3.SchemaObject> = {
  PatientProfile: PatientProfileSchema,
  UpdatePatientProfileRequest: UpdatePatientProfileRequestSchema,
};
