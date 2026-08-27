import Joi from "@hapi/joi";

import { AppointmentStatus } from "@database/enum/AppointmentStatus";

const dateSchema = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .messages({
    "string.pattern.base": "Date must be in YYYY-MM-DD format",
  });

const appointmentQuerySchema = {
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  status: Joi.string()
    .valid(...Object.values(AppointmentStatus))
    .optional(),
  date: dateSchema.optional(),
  dateFrom: dateSchema.optional(),
  dateTo: dateSchema.optional(),
  sortBy: Joi.string()
    .valid("appointmentTime", "createdAt", "updatedAt")
    .optional(),
  order: Joi.string()
    .valid("ASC", "DESC")
    .optional(),
};

export const getPatientAppointmentsQuerySchema = Joi.object({
  ...appointmentQuerySchema,
  doctorId: Joi.number().integer().positive().optional(),
});

export const getDoctorAppointmentsQuerySchema = Joi.object({
  ...appointmentQuerySchema,
  patientId: Joi.number().integer().positive().optional(),
});

export const appointmentStatusParamsSchema = Joi.object({
  appointmentId: Joi.number().integer().positive().required(),
});

export const doctorAppointmentStatusBodySchema = Joi.object({
  status: Joi.string()
    .valid(
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.REJECTED,
      AppointmentStatus.COMPLETED,
    )
    .required(),
});

export const patientAppointmentStatusBodySchema = Joi.object({
  status: Joi.string()
    .valid(AppointmentStatus.CANCELLED).required(),
});

