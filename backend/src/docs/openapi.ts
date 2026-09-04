import { OpenAPIV3 } from "openapi-types";
import { info, servers, tags, securitySchemes } from "./meta";
import { commonSchemas } from "./components/schemas/common.schema";
import { enumSchemas } from "./components/schemas/enums.schema";
import { userSchemas } from "./components/schemas/user.schema";
import { authSchemas } from "./components/schemas/auth.schema";
import { adminSchemas } from "./components/schemas/admin.schema";
import { doctorSchemas } from "./components/schemas/doctor.schema";
import { appointmentSchemas } from "./components/schemas/appointment.schema";
import { patientSchemas } from "./components/schemas/patient.schema";
import { paginationParameters } from "./components/parameters/pagination.parameters";
import { pathParameters } from "./components/parameters/path.parameters";
import { commonResponses } from "./components/responses/common.responses";
import { authPaths } from "./paths/auth.paths";
import { adminPaths } from "./paths/admin.paths";
import { doctorPaths } from "./paths/doctor.paths";
import { appointmentPaths } from "./paths/appointment.paths";
import { patientPaths } from "./paths/patient.paths";
import { healthPaths } from "./paths/health.paths";

const pathGroups: Record<string, OpenAPIV3.PathItemObject>[] = [
  authPaths,
  adminPaths,
  doctorPaths,
  appointmentPaths,
  patientPaths,
  healthPaths,
];

// Fails fast at module load (i.e. at server startup) if two paths/*.paths.ts
// files ever define the same path key — Object.assign would otherwise let
// one silently win and the other's endpoints would vanish from the spec.
function mergePathsOrThrow(): OpenAPIV3.PathsObject {
  const allKeys: string[] = [];
  pathGroups.forEach((group) => {
    allKeys.push(...Object.keys(group));
  });
  const uniqueKeys = new Set(allKeys);

  if (uniqueKeys.size !== allKeys.length) {
    const duplicates = allKeys.filter((key, index) => allKeys.indexOf(key) !== index);
    throw new Error(
      `openapi.ts: duplicate path key(s) across paths/*.paths.ts files: ${duplicates.join(", ")}`,
    );
  }

  return Object.assign({}, ...pathGroups);
}

export const openApiSpec: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info,
  servers,
  tags,
  paths: mergePathsOrThrow(),
  components: {
    securitySchemes,
    parameters: { ...paginationParameters, ...pathParameters },
    responses: commonResponses,
    schemas: {
      ...commonSchemas,
      ...enumSchemas,
      ...userSchemas,
      ...authSchemas,
      ...adminSchemas,
      ...doctorSchemas,
      ...appointmentSchemas,
      ...patientSchemas,
    },
  },
};
