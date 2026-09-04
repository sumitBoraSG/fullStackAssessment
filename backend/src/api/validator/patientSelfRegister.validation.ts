import Joi from "@hapi/joi";

export const requestPatientSelfRegistrationSchema = Joi.object({
  email: Joi.string().email().required(),
});
