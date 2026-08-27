import rateLimit from "express-rate-limit";
import constant from "@config/constant";

export class RateLimitMiddleware {
  public general = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,

    standardHeaders: true,
    legacyHeaders: false,

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

    message: {
      success: false,
      message: constant.RATE_LIMIT_INVITATION,
    },
  });
}