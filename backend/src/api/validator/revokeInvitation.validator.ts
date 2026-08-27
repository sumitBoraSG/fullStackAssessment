import Joi from "@hapi/joi";

export const revokeInvitationParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});
