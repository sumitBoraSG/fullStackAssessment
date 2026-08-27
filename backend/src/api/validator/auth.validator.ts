import Joi from "@hapi/joi";

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.base": "Email must be a string",
    "string.email": "Email is invalid",
    "any.required": "Email is required",
  }),
  password: Joi.string().required().messages({
    "string.base": "Password must be a string",
    "any.required": "Password is required",
  }),
});

