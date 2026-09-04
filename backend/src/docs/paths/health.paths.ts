import { OpenAPIV3 } from "openapi-types";

export const healthPaths: Record<string, OpenAPIV3.PathItemObject> = {
  "/": {
    get: {
      tags: ["Health"],
      summary: "Health check",
      security: [],
      responses: {
        "200": {
          description: "Service is up.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: { status: { type: "string", example: "ok" } },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
