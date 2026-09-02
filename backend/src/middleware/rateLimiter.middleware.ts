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
    max: 100,

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
    max: 15,

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
    max: 30,

    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTestEnv,

    message: {
      success: false,
      message: constant.RATE_LIMIT_INVITATION,
    },
  });
}