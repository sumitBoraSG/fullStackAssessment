import { OpenAPIV3 } from "openapi-types";

export const BadRequest400: OpenAPIV3.ResponseObject = {
  description: "Malformed request (business-rule violation) or a Joi validation failure.",
  content: {
    "application/json": {
      schema: {
        oneOf: [
          { $ref: "#/components/schemas/ErrorResponse" },
          { $ref: "#/components/schemas/ValidationErrorResponse" },
        ],
      },
    },
  },
};

export const Unauthorized401: OpenAPIV3.ResponseObject = {
  description: "Missing/invalid accessToken cookie, or (for /auth/refresh) missing/invalid refreshToken cookie.",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/AuthFailureResponse" },
    },
  },
};

export const Forbidden403: OpenAPIV3.ResponseObject = {
  description: "Authenticated, but the user's role is not permitted for this endpoint.",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/AuthFailureResponse" },
    },
  },
};

export const NotFound404: OpenAPIV3.ResponseObject = {
  description: "The requested resource does not exist (or does not belong to the caller).",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorResponse" },
    },
  },
};

export const Conflict409: OpenAPIV3.ResponseObject = {
  description:
    "The request conflicts with the resource's current state " +
    "(e.g. a double-booking, a race with another request).",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorResponse" },
    },
  },
};

export const TooManyRequests429: OpenAPIV3.ResponseObject = {
  description:
    "Rate limit exceeded for this route group. See express-rate-limit's " +
    "standard RateLimit-* response headers for the reset window.",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/AuthFailureResponse" },
    },
  },
};

export const InternalServerError500: OpenAPIV3.ResponseObject = {
  description: "Unhandled server error.",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorResponse" },
    },
  },
};

export const commonResponses: Record<string, OpenAPIV3.ResponseObject> = {
  BadRequest400,
  Unauthorized401,
  Forbidden403,
  NotFound404,
  Conflict409,
  TooManyRequests429,
  InternalServerError500,
};
