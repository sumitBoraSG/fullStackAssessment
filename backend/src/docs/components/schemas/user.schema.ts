import { OpenAPIV3 } from "openapi-types";

// Shared "public user" shape returned by both POST /auth/login (nested under
// `user`) and POST /auth/accept-invitation (flattened into `data`) — see
// AuthService.login / AuthService.acceptInvitation.
export const PublicUserSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    id: { type: "integer", example: 1 },
    firstName: { type: "string", example: "Jane" },
    lastName: { type: "string", example: "Doe" },
    email: { type: "string", format: "email", example: "jane.doe@example.com" },
    role: { $ref: "#/components/schemas/UserRole" },
  },
  required: ["id", "firstName", "lastName", "email", "role"],
};

export const userSchemas: Record<string, OpenAPIV3.SchemaObject> = {
  PublicUser: PublicUserSchema,
};
