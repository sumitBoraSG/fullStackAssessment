import { OpenAPIV3 } from "openapi-types";

export const LoginRequestSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    email: { type: "string", format: "email", example: "jane.doe@example.com" },
    password: { type: "string", format: "password" },
  },
  required: ["email", "password"],
};

// Role-specific fields are optional at the shape/range-validation layer —
// AuthService enforces which are actually required once the invitation's
// real role is looked up server-side (see acceptInvitationSchema).
export const AcceptInvitationRequestSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  description:
    "Doctor invitations require specializationId + experienceYears; " +
    "patient invitations require dob + heightCm + weightKg + bloodGroup. " +
    "Which set applies depends on the invitation's role, enforced server-side.",
  properties: {
    token: { type: "string", description: "Raw invitation token from the invitation email link." },
    firstName: { type: "string", minLength: 2, maxLength: 100 },
    lastName: { type: "string", minLength: 2, maxLength: 100 },
    password: {
      type: "string",
      format: "password",
      minLength: 12,
      maxLength: 128,
      description: "Must contain at least one lowercase letter, uppercase letter, number, and special character.",
    },
    specializationId: { type: "integer", minimum: 1, maximum: 32767, description: "Doctor invitations only." },
    experienceYears: { type: "integer", minimum: 0, maximum: 80, description: "Doctor invitations only." },
    dob: { type: "string", format: "date", example: "1990-01-31", description: "Patient invitations only." },
    heightCm: { type: "integer", minimum: 30, maximum: 300, description: "Patient invitations only." },
    weightKg: { type: "integer", minimum: 2, maximum: 500, description: "Patient invitations only." },
    bloodGroup: { allOf: [{ $ref: "#/components/schemas/BloodGroup" }], description: "Patient invitations only." },
  },
  required: ["token", "firstName", "lastName", "password"],
};

export const PatientSelfRegisterRequestSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    email: { type: "string", format: "email", example: "jane.doe@example.com" },
  },
  required: ["email"],
};

export const InvitationDetailsSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    email: { type: "string", format: "email" },
    role: { $ref: "#/components/schemas/UserRole" },
  },
  required: ["email", "role"],
};

export const authSchemas: Record<string, OpenAPIV3.SchemaObject> = {
  LoginRequest: LoginRequestSchema,
  AcceptInvitationRequest: AcceptInvitationRequestSchema,
  PatientSelfRegisterRequest: PatientSelfRegisterRequestSchema,
  InvitationDetails: InvitationDetailsSchema,
};
