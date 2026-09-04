import { OpenAPIV3 } from "openapi-types";

export const PageParam: OpenAPIV3.ParameterObject = {
  name: "page",
  in: "query",
  required: false,
  schema: { type: "integer", minimum: 1, default: 1 },
  description: "1-indexed page number.",
};

export const LimitParam: OpenAPIV3.ParameterObject = {
  name: "limit",
  in: "query",
  required: false,
  schema: { type: "integer", minimum: 1, maximum: 100, default: 10 },
  description: "Page size (max 100).",
};

export const paginationParameters: Record<string, OpenAPIV3.ParameterObject> = {
  Page: PageParam,
  Limit: LimitParam,
};
