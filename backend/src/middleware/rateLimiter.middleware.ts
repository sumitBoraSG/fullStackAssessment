import rateLimit from "express-rate-limit";
import constant from "@config/constant";
import { ENVIRONMENT } from "@config/secret";

// The automated test suite fires far more auth/invitation requests in a
// short window than any real user would — bypass rate limiting there so
// tests exercise business logic (400/409/etc.) instead of incidentally
// tripping the limiter (429). Production/dev behavior is unaffected.
const skipInTestEnv = (): boolean => ENVIRONMENT === "test";

export class RateLimitMiddleware {
  public general = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,

    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTestEnv,

    message: {
      success: false,
      message: constant.RATE_LIMIT_GENERAL,
    },
  });

  public auth = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,

    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTestEnv,

    message: {
      success: false,
      message: constant.RATE_LIMIT_AUTH,
    },
  });

  public invitation = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,

    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTestEnv,

    message: {
      success: false,
      message: constant.RATE_LIMIT_INVITATION,
    },
  });

  // Stricter than `auth`: this backs the platform's first fully public,
  // unauthenticated write endpoint (patient self-registration requests),
  // so it needs a tighter ceiling than routes that already require a
  // credential or a possessed token.
  public patientSelfRegistration = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,

    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTestEnv,

    message: {
      success: false,
      message: constant.RATE_LIMIT_PATIENT_SELF_REGISTRATION,
    },
  });
}