import { OpenAPIV3 } from "openapi-types";

// PATIENT is deliberately excluded — patients self-register via
// POST /auth/patient/self-register instead of being admin-invited.
export const InviteUserRequestSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    email: { type: "string", format: "email", example: "new.doctor@example.com" },
    role: { type: "string", enum: ["ADMIN", "DOCTOR"] },
  },
  required: ["email", "role"],
};

export const InvitationSummarySchema: OpenAPIV3.SchemaObject = {
  type: "object",
  description: "Returned by POST /admin/invite.",
  properties: {
    id: { type: "integer" },
    email: { type: "string", format: "email" },
    role: { $ref: "#/components/schemas/UserRole" },
    expiresAt: { type: "string", format: "date-time" },
  },
  required: ["id", "email", "role", "expiresAt"],
};

export const InvitationListItemSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  description: "Returned by GET /admin/invitations (list items) and POST /admin/invitations/:id/revoke.",
  properties: {
    id: { type: "integer" },
    email: { type: "string", format: "email" },
    role: { $ref: "#/components/schemas/UserRole" },
    status: { $ref: "#/components/schemas/InvitationStatus" },
    expiresAt: { type: "string", format: "date-time" },
    usedAt: { type: "string", format: "date-time", nullable: true },
    revokedAt: { type: "string", format: "date-time", nullable: true },
    createdAt: { type: "string", format: "date-time" },
  },
  required: ["id", "email", "role", "status", "expiresAt", "usedAt", "revokedAt", "createdAt"],
};

export const BulkInviteResultRowSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    email: { type: "string" },
    role: { type: "string" },
    status: { type: "string", enum: ["INVITED", "FAILED"] },
    invitation: {
      allOf: [{ $ref: "#/components/schemas/InvitationSummary" }],
      description: "Present only when status is INVITED.",
    },
    reason: { type: "string", description: "Present only when status is FAILED." },
  },
  required: ["email", "role", "status"],
};

export const BulkInviteResponseDataSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    total: { type: "integer" },
    successful: { type: "integer" },
    failed: { type: "integer" },
    results: {
      type: "array",
      items: { $ref: "#/components/schemas/BulkInviteResultRow" },
    },
  },
  required: ["total", "successful", "failed", "results"],
};

export const adminSchemas: Record<string, OpenAPIV3.SchemaObject> = {
  InviteUserRequest: InviteUserRequestSchema,
  InvitationSummary: InvitationSummarySchema,
  InvitationListItem: InvitationListItemSchema,
  BulkInviteResultRow: BulkInviteResultRowSchema,
  BulkInviteResponseData: BulkInviteResponseDataSchema,
};
