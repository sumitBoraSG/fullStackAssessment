import Joi from "@hapi/joi";

export const createAvailabilitySchema = Joi.object({
    date: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .required()
        .messages({
            "string.pattern.base": "Date must be in YYYY-MM-DD format",
            "any.required": "Date is required",
        }),

    startTime: Joi.string()
        .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .required()
        .messages({
            "string.pattern.base":
                "Start time must be in HH:mm format",
            "any.required": "Start time is required",
        }),

    endTime: Joi.string()
        .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .required()
        .messages({
            "string.pattern.base":
                "End time must be in HH:mm format",
            "any.required": "End time is required",
        }),
});

export const getAvailabilityQuerySchema = Joi.object({
    date: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .allow("")
        .messages({
            "string.pattern.base": "Date must be in YYYY-MM-DD format",
        }),
});

export const getDoctorsQuerySchema = Joi.object({
    search: Joi.string().trim().max(100).optional().allow(""),
    specialization: Joi.string().trim().max(100).optional().allow(""),
    date: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .allow("")
        .messages({
            "string.pattern.base": "Date must be in YYYY-MM-DD format",
        }),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
});