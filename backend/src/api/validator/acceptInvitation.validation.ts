import Joi from "@hapi/joi";

export const acceptInvitationSchema = Joi.object({
  token: Joi.string().required(),

  firstName: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required(),

  lastName: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required(),

  password: Joi.string()
    .min(8)
    .max(128)
    .required(),
});