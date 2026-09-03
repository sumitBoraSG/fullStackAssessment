import Joi from "@hapi/joi";
import { BloodGroup } from "@database/enum/BloodGroup";

const PASSWORD_MIN_LENGTH = 12;

// Role-specific fields are optional at this pure shape/range-validation
// layer since the role itself is only known once the invitation is looked
// up server-side (never from the client). AuthService enforces which of
// these are actually required, based on the invitation's real role.
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
    .min(PASSWORD_MIN_LENGTH)
    .max(128)
    .pattern(/[a-z]/, { name: "lowercase letter" })
    .pattern(/[A-Z]/, { name: "uppercase letter" })
    .pattern(/[0-9]/, { name: "number" })
    .pattern(/[^A-Za-z0-9]/, { name: "special character" })
    .required()
    .messages({
      "string.min": `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`,
      "string.max": "Password must be at most 128 characters long",
      "string.pattern.name": "Password must contain at least one {#name}",
      "any.required": "Password is required",
    }),

  // Doctor-specific — max bound matches the smallint specialization_id column
  specializationId: Joi.number().integer().positive().max(32767).optional(),
  experienceYears: Joi.number().integer().min(0).max(80).optional(),

  // Patient-specific
  dob: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .messages({ "string.pattern.base": "Date of birth must be in YYYY-MM-DD format" })
    .optional(),
  heightCm: Joi.number().integer().min(30).max(300).optional(),
  weightKg: Joi.number().integer().min(2).max(500).optional(),
  bloodGroup: Joi.string()
    .valid(...Object.values(BloodGroup))
    .optional(),
});