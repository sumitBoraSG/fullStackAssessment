import { OpenAPIV3 } from "openapi-types";

export const info: OpenAPIV3.InfoObject = {
  title: "Doctor Appointment System API",
  version: "1.0.0",
  description:
    "REST API for patient/doctor/admin appointment scheduling. This " +
    "documentation is served only when NODE_ENV !== \"production\".",
};

export const servers: OpenAPIV3.ServerObject[] = [{ url: "/" }];

export const tags: OpenAPIV3.TagObject[] = [
  { name: "Auth", description: "Login, session refresh, invitation acceptance and patient self-registration." },
  { name: "Admin", description: "Admin-only user invitation management." },
  { name: "Doctor", description: "Doctor-only availability, appointments and profile management." },
  { name: "Doctors", description: "Doctor discovery/search (patients, doctors, and admins)." },
  { name: "Appointments", description: "Patient-only appointment booking and management." },
  { name: "Patient", description: "Patient-only profile management." },
  { name: "Health", description: "Service health check." },
];

export const securitySchemes: Record<string, OpenAPIV3.SecuritySchemeObject> = {
  cookieAuth: {
    type: "apiKey",
    in: "cookie",
    name: "accessToken",
    description:
      "HttpOnly JWT cookie set by POST /auth/login. Swagger UI's Authorize " +
      "button cannot set an HttpOnly cookie manually, so \"Try it out\" only " +
      "carries auth if this browser already holds a valid accessToken " +
      "cookie from having logged into the real app (cookies attach " +
      "automatically via CORS credentials).",
  },
};
