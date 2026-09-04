import { OpenAPIV3 } from "openapi-types";
import { wrapSuccessData } from "./helpers";

const patientProfileRef: OpenAPIV3.ReferenceObject = { $ref: "#/components/schemas/PatientProfile" };

export const patientPaths: Record<string, OpenAPIV3.PathItemObject> = {
  "/patient/profile": {
    get: {
      tags: ["Patient"],
      summary: "Get own patient profile",
      security: [{ cookieAuth: [] }],
      responses: {
        "200": {
          description: "Profile fetched.",
          content: { "application/json": { schema: wrapSuccessData(patientProfileRef) } },
        },
        "401": { $ref: "#/components/responses/Unauthorized401" },
        "403": { $ref: "#/components/responses/Forbidden403" },
        "404": { $ref: "#/components/responses/NotFound404" },
        "429": { $ref: "#/components/responses/TooManyRequests429" },
      },
    },
    patch: {
      tags: ["Patient"],
      summary: "Update own patient profile",
      description: "Updates heightCm and/or weightKg — at least one must be provided.",
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/UpdatePatientProfileRequest" } },
        },
      },
      responses: {
        "200": {
          description: "Profile updated.",
          content: { "application/json": { schema: wrapSuccessData(patientProfileRef) } },
        },
        "400": { $ref: "#/components/responses/BadRequest400" },
        "401": { $ref: "#/components/responses/Unauthorized401" },
        "403": { $ref: "#/components/responses/Forbidden403" },
        "404": { $ref: "#/components/responses/NotFound404" },
        "429": { $ref: "#/components/responses/TooManyRequests429" },
      },
    },
  },
};
