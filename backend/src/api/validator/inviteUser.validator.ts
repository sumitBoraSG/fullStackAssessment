import Joi from "@hapi/joi";
import { UserRole } from "@database/enum/userRole";

export const inviteUserSchema = Joi.object({
  email: Joi.string().email().required(),
  role: Joi.string()
    .valid(
      UserRole.ADMIN,
      UserRole.DOCTOR,
      UserRole.PATIENT,
    )
    .required(),
});

