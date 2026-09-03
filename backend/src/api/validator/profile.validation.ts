import Joi from "@hapi/joi";

export const updatePatientProfileSchema = Joi.object({
    heightCm: Joi.number().integer().min(30).max(300).messages({
        "number.base": "Height must be a number",
        "number.min": "Height must be between 30 and 300 cm",
        "number.max": "Height must be between 30 and 300 cm",
    }),
    weightKg: Joi.number().integer().min(2).max(500).messages({
        "number.base": "Weight must be a number",
        "number.min": "Weight must be between 2 and 500 kg",
        "number.max": "Weight must be between 2 and 500 kg",
    }),
})
    .min(1)
    .messages({
        "object.min": "At least one of heightCm or weightKg must be provided",
    });

export const updateDoctorProfileSchema = Joi.object({
    experienceYears: Joi.number().integer().min(0).max(80).required().messages({
        "number.base": "Years of experience must be a number",
        "number.min": "Years of experience must be between 0 and 80",
        "number.max": "Years of experience must be between 0 and 80",
        "any.required": "Years of experience is required",
    }),
});
