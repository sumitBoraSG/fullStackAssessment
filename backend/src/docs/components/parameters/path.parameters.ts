import { OpenAPIV3 } from "openapi-types";

export const InvitationIdParam: OpenAPIV3.ParameterObject = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "integer" },
  description: "Invitation ID.",
};

export const DoctorIdParam: OpenAPIV3.ParameterObject = {
  name: "doctorId",
  in: "path",
  required: true,
  schema: { type: "integer" },
  description: "Doctor ID.",
};

export const AppointmentIdParam: OpenAPIV3.ParameterObject = {
  name: "appointmentId",
  in: "path",
  required: true,
  schema: { type: "integer" },
  description: "Appointment ID.",
};

export const InvitationTokenParam: OpenAPIV3.ParameterObject = {
  name: "token",
  in: "path",
  required: true,
  schema: { type: "string" },
  description: "Raw (unhashed) invitation token from the invitation email link.",
};

export const pathParameters: Record<string, OpenAPIV3.ParameterObject> = {
  InvitationId: InvitationIdParam,
  DoctorId: DoctorIdParam,
  AppointmentId: AppointmentIdParam,
  InvitationToken: InvitationTokenParam,
};
