import { OpenAPIV3 } from "openapi-types";

// Values hand-copied from src/database/enum/*.ts and src/types/invitationStatus.ts.
// No runtime import of the enums themselves — these are pure literal
// declarations for the doc, and docs/ has no runtime dependency on database/.

export const UserRoleSchema: OpenAPIV3.SchemaObject = {
  type: "string",
  enum: ["ADMIN", "PATIENT", "DOCTOR"],
};

export const AppointmentStatusSchema: OpenAPIV3.SchemaObject = {
  type: "string",
  enum: ["CONFIRMED", "CANCELLED", "REJECTED", "COMPLETED", "PENDING"],
};

export const BloodGroupSchema: OpenAPIV3.SchemaObject = {
  type: "string",
  enum: ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"],
};

export const InvitationSourceSchema: OpenAPIV3.SchemaObject = {
  type: "string",
  enum: ["ADMIN_INVITATION", "PATIENT_SELF_REGISTRATION"],
};

export const InvitationStatusSchema: OpenAPIV3.SchemaObject = {
  type: "string",
  enum: ["REVOKED", "USED", "EXPIRED", "PENDING"],
};

export const enumSchemas: Record<string, OpenAPIV3.SchemaObject> = {
  UserRole: UserRoleSchema,
  AppointmentStatus: AppointmentStatusSchema,
  BloodGroup: BloodGroupSchema,
  InvitationSource: InvitationSourceSchema,
  InvitationStatus: InvitationStatusSchema,
};
