import { OpenAPIV3 } from "openapi-types";

// Wraps a `data` schema inside the SuccessResponse envelope
// ({success, data, message?}) — used by nearly every 2xx response across
// paths/*.paths.ts, since SuccessResponse alone leaves `data` untyped.
export function wrapSuccessData(
  dataSchema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
): OpenAPIV3.SchemaObject {
  return {
    allOf: [
      { $ref: "#/components/schemas/SuccessResponse" },
      { type: "object", properties: { data: dataSchema } },
    ],
  };
}
