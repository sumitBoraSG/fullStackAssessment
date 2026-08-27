import Joi from "@hapi/joi";

export const createAppointmentSchema = Joi.object({
    doctorId: Joi.number()
        .integer()
        .positive()
        .required(),

    date: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .required(),

    startTime: Joi.string()
        .pattern(/^([01]\d|2[0-3]):[0-5]\d$/)
        .required(),

    endTime: Joi.string()
        .pattern(/^([01]\d|2[0-3]):[0-5]\d$/)
        .required(),
});