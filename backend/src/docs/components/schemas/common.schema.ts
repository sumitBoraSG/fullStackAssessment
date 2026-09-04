import { OpenAPIV3 } from "openapi-types";

// This API has four distinct JSON response shapes in practice (verified
// against the controllers/middleware, not assumed) — they are modeled as
// four separate schemas rather than unified into one, since unifying them
// would misdescribe real responses.

export const PaginationMetaSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    page: { type: "integer", example: 1 },
    limit: { type: "integer", example: 10 },
    total: { type: "integer", example: 42 },
    totalPages: { type: "integer", example: 5 },
  },
  required: ["page", "limit", "total", "totalPages"],
};

export const SuccessResponseSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  description:
    "Generic success envelope returned by every controller on the happy " +
    "path. `message` is present on some endpoints only. Pagination, where " +
    "present, is placed inconsistently across endpoints: some nest it " +
    "inside `data`, one (GET /admin/invitations) puts it as a top-level " +
    "sibling of `data` — see each endpoint's own response schema for the " +
    "exact shape.",
  properties: {
    success: { type: "boolean", example: true },
    message: { type: "string" },
    data: {},
  },
  required: ["success"],
};

export const ErrorResponseSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  description:
    "Standard error envelope produced by the central error middleware for " +
    "any thrown HttpException/http-errors error.",
  properties: {
    status: { type: "boolean", example: false },
    message: { type: "string" },
    code: { type: "string" },
    data: { type: "object" },
  },
  required: ["status", "message", "code", "data"],
};

export const ValidationErrorResponseSchema: OpenAPIV3.SchemaObject = {
  allOf: [
    { $ref: "#/components/schemas/ErrorResponse" },
    {
      type: "object",
      properties: {
        code: { type: "string", example: "validation_error" },
        data: {
          type: "array",
          description: "One entry per failing field, from Joi's validation error details.",
          items: {
            type: "object",
            properties: {
              message: { type: "string" },
              label: { type: "string" },
            },
          },
        },
      },
    },
  ],
};

export const AuthFailureResponseSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  description:
    "Used by handlers that bypass the central error middleware and hand-roll " +
    "their own JSON: missing/invalid accessToken (401), insufficient role " +
    "(403), missing/invalid refreshToken on POST /auth/refresh (401), and " +
    "the rate limiter (429). Unlike ErrorResponse, it has no `code`/`data` " +
    "field and reuses the `success` key name (with `false`) instead of `status`.",
  properties: {
    success: { type: "boolean", example: false },
    message: { type: "string" },
  },
  required: ["success", "message"],
};

export const commonSchemas: Record<string, OpenAPIV3.SchemaObject> = {
  PaginationMeta: PaginationMetaSchema,
  SuccessResponse: SuccessResponseSchema,
  ErrorResponse: ErrorResponseSchema,
  ValidationErrorResponse: ValidationErrorResponseSchema,
  AuthFailureResponse: AuthFailureResponseSchema,
};
