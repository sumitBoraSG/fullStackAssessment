import Joi from "@hapi/joi";
import { UserRole } from "@database/enum/userRole";
import { InvitationStatus } from "../../types/invitationStatus";

export const getInvitationsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  search: Joi.string().trim().allow("").optional(),
  status: Joi.string()
    .valid(...Object.values(InvitationStatus))
    .optional(),
  role: Joi.string()
    .valid(...Object.values(UserRole))
    .optional(),
});
