import { OpenAPIV3 } from "openapi-types";
import { wrapSuccessData } from "./helpers";

const setsAuthCookiesDescription =
  "Sets `accessToken` and `refreshToken` as HttpOnly cookies on success " +
  "(not represented in the JSON body — see the Set-Cookie response headers).";

export const authPaths: Record<string, OpenAPIV3.PathItemObject> = {
  "/auth/login": {
    post: {
      tags: ["Auth"],
      summary: "Log in with email and password",
      description: setsAuthCookiesDescription,
      security: [],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } },
      },
      responses: {
        "200": {
          description: "Login successful.",
          content: {
            "application/json": {
              schema: wrapSuccessData({
                type: "object",
                properties: { user: { $ref: "#/components/schemas/PublicUser" } },
                required: ["user"],
              }),
            },
          },
        },
        "400": { $ref: "#/components/responses/BadRequest400" },
        "401": {
          description: "Invalid email or password.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
        },
        "429": { $ref: "#/components/responses/TooManyRequests429" },
      },
    },
  },
  "/auth/refresh": {
    post: {
      tags: ["Auth"],
      summary: "Issue a new access token from the refresh cookie",
      description: `Reads the refreshToken HttpOnly cookie (no request body). ${setsAuthCookiesDescription}`,
      security: [],
      responses: {
        "200": {
          description: "New accessToken cookie issued.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { success: { type: "boolean", example: true } },
                required: ["success"],
              },
            },
          },
        },
        "401": {
          description: "Missing, invalid, or expired refreshToken cookie.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/AuthFailureResponse" } } },
        },
        "429": { $ref: "#/components/responses/TooManyRequests429" },
      },
    },
  },
  "/auth/accept-invitation": {
    post: {
      tags: ["Auth"],
      summary: "Complete signup from an invitation",
      description:
        "Creates the account for a pending ADMIN/DOCTOR/PATIENT invitation. " +
        "Role never comes from the client — it is read from the validated " +
        "invitation record. Which optional profile fields are required " +
        "depends on that role (see AcceptInvitationRequest).",
      security: [],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/AcceptInvitationRequest" } } },
      },
      responses: {
        "201": {
          description: "Account created.",
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/SuccessResponse" },
                  {
                    type: "object",
                    properties: { data: { $ref: "#/components/schemas/PublicUser" } },
                  },
                ],
              },
            },
          },
        },
        "400": { $ref: "#/components/responses/BadRequest400" },
        "429": { $ref: "#/components/responses/TooManyRequests429" },
      },
    },
  },
  "/auth/patient/self-register": {
    post: {
      tags: ["Auth"],
      summary: "Request a patient self-registration link",
      description:
        "Public, unauthenticated. Always responds with the same generic " +
        "message regardless of whether the email exists, already has an " +
        "account, or already has a pending invitation — this is what keeps " +
        "the endpoint enumeration-safe. Sits behind a stricter rate limit " +
        "than other /auth routes.",
      security: [],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/PatientSelfRegisterRequest" } } },
      },
      responses: {
        "200": {
          description: "Generic acknowledgement (see description — does not confirm anything about the email).",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string" },
                },
                required: ["success", "message"],
              },
            },
          },
        },
        "400": { $ref: "#/components/responses/BadRequest400" },
        "429": { $ref: "#/components/responses/TooManyRequests429" },
      },
    },
  },
  "/auth/invitation/{token}": {
    get: {
      tags: ["Auth"],
      summary: "Preview an invitation's role before signup",
      description:
        "Read-only — lets the signup page learn the invited role before " +
        "rendering role-specific fields, without consuming the invitation.",
      security: [],
      parameters: [{ $ref: "#/components/parameters/InvitationToken" }],
      responses: {
        "200": {
          description: "Invitation is valid.",
          content: {
            "application/json": { schema: wrapSuccessData({ $ref: "#/components/schemas/InvitationDetails" }) },
          },
        },
        "400": {
          description: "Invitation token is invalid, used, revoked, or expired.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
        },
        "429": { $ref: "#/components/responses/TooManyRequests429" },
      },
    },
  },
  "/auth/logout": {
    post: {
      tags: ["Auth"],
      summary: "Log out",
      description: "Clears the accessToken and refreshToken HttpOnly cookies server-side.",
      security: [],
      responses: {
        "200": {
          description: "Logged out.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { success: { type: "boolean", example: true } },
                required: ["success"],
              },
            },
          },
        },
        "429": { $ref: "#/components/responses/TooManyRequests429" },
      },
    },
  },
};
