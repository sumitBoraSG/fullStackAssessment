import { OpenAPIV3 } from "openapi-types";
import { wrapSuccessData } from "./helpers";

const adminOnlyResponses: OpenAPIV3.ResponsesObject = {
  "401": { $ref: "#/components/responses/Unauthorized401" },
  "403": { $ref: "#/components/responses/Forbidden403" },
  "429": { $ref: "#/components/responses/TooManyRequests429" },
};

export const adminPaths: Record<string, OpenAPIV3.PathItemObject> = {
  "/admin/invite": {
    post: {
      tags: ["Admin"],
      summary: "Invite a single user (ADMIN or DOCTOR)",
      description:
        "PATIENT is deliberately excluded — patients self-register via " +
        "POST /auth/patient/self-register instead.",
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/InviteUserRequest" } } },
      },
      responses: {
        "201": {
          description: "Invitation created and emailed.",
          content: {
            "application/json": { schema: wrapSuccessData({ $ref: "#/components/schemas/InvitationSummary" }) },
          },
        },
        "400": { $ref: "#/components/responses/BadRequest400" },
        "409": { $ref: "#/components/responses/Conflict409" },
        ...adminOnlyResponses,
      },
    },
  },
  "/admin/invitations": {
    get: {
      tags: ["Admin"],
      summary: "List invitations",
      security: [{ cookieAuth: [] }],
      parameters: [
        { $ref: "#/components/parameters/Page" },
        { $ref: "#/components/parameters/Limit" },
        {
          name: "search",
          in: "query",
          required: false,
          schema: { type: "string" },
          description: "Case-insensitive email search.",
        },
        { name: "status", in: "query", required: false, schema: { $ref: "#/components/schemas/InvitationStatus" } },
        { name: "role", in: "query", required: false, schema: { $ref: "#/components/schemas/UserRole" } },
      ],
      responses: {
        "200": {
          description: "Invitations fetched.",
          content: {
            "application/json": {
              // NOTE: unlike other paginated list endpoints in this API,
              // `pagination` is a top-level sibling of `data`, not nested
              // inside it (see AdminController.getAllInvitations).
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/SuccessResponse" },
                  {
                    type: "object",
                    properties: {
                      data: { type: "array", items: { $ref: "#/components/schemas/InvitationListItem" } },
                      pagination: { $ref: "#/components/schemas/PaginationMeta" },
                    },
                    required: ["data", "pagination"],
                  },
                ],
              },
            },
          },
        },
        "400": { $ref: "#/components/responses/BadRequest400" },
        ...adminOnlyResponses,
      },
    },
  },
  "/admin/invitations/{id}/revoke": {
    post: {
      tags: ["Admin"],
      summary: "Revoke a pending invitation",
      security: [{ cookieAuth: [] }],
      parameters: [{ $ref: "#/components/parameters/InvitationId" }],
      responses: {
        "200": {
          description: "Invitation revoked.",
          content: {
            "application/json": { schema: wrapSuccessData({ $ref: "#/components/schemas/InvitationListItem" }) },
          },
        },
        "400": { $ref: "#/components/responses/BadRequest400" },
        "404": { $ref: "#/components/responses/NotFound404" },
        "409": { $ref: "#/components/responses/Conflict409" },
        ...adminOnlyResponses,
      },
    },
  },
  "/admin/invitations/bulk": {
    post: {
      tags: ["Admin"],
      summary: "Bulk-invite users via a CSV upload",
      description:
        "CSV columns: email, role (ADMIN or DOCTOR). Max 500 rows, max file " +
        "size 5MB, .csv only. Always responds 200 even if some rows fail — " +
        "check `data.results[].status` per row.",
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              properties: {
                file: { type: "string", format: "binary", description: "CSV file, field name `file`." },
              },
              required: ["file"],
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Bulk invitation process completed (see per-row results).",
          content: {
            "application/json": {
              schema: wrapSuccessData({ $ref: "#/components/schemas/BulkInviteResponseData" }),
            },
          },
        },
        "400": { $ref: "#/components/responses/BadRequest400" },
        "413": {
          description: "Uploaded file exceeds the 5MB size limit.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
        },
        ...adminOnlyResponses,
      },
    },
  },
};
