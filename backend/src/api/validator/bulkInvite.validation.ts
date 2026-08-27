import Joi from "@hapi/joi";

import { UserRole } from "@database/enum/userRole";

export const bulkInviteRowSchema = Joi.object({
  email: Joi.string()
    .email()
    .required(),

  role: Joi.string()
    .valid(...Object.values(UserRole))
    .required(),
});