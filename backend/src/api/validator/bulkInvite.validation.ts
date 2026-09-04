import Joi from "@hapi/joi";

import { UserRole } from "@database/enum/userRole";

// PATIENT is deliberately excluded: patients self-register via
// POST /auth/patient/self-register instead of being admin-invited.
export const bulkInviteRowSchema = Joi.object({
  email: Joi.string()
    .email()
    .required(),

  role: Joi.string()
    .valid(UserRole.ADMIN, UserRole.DOCTOR)
    .required(),
});