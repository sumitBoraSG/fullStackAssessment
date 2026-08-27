import express from "express";
import { AuthController } from "@api/controller/auth.controller";
import { loginSchema } from "@api/validator/auth.validator";
import { HttpRequestValidator } from "@middleware/http-request-validator";
import { acceptInvitationSchema } from "@api/validator/acceptInvitation.validation";
import { RateLimitMiddleware } from "@middleware/rateLimiter.middleware";

class AuthRoute {
  public router: express.Router = express.Router();
  private authController: AuthController = new AuthController();
  private requestValidator: HttpRequestValidator = new HttpRequestValidator();
  private rateLimitMiddleware: RateLimitMiddleware =
    new RateLimitMiddleware();

  constructor() {
    this.router.post(
      "/login",
      this.rateLimitMiddleware.auth,
      this.requestValidator.validate("body", loginSchema),
      this.authController.login,
    );

    // Refresh token is read from HttpOnly cookie — no body validation needed
    this.router.post(
      "/refresh",
      this.rateLimitMiddleware.auth,
      this.authController.refresh,
    );

    this.router.post(
      "/accept-invitation",
      this.rateLimitMiddleware.auth,
      this.requestValidator.validate(
        "body",
        acceptInvitationSchema,
      ),
      this.authController.acceptInvitation,
    );

    // Logout clears HttpOnly cookies server-side
    this.router.post(
      "/logout",
      this.authController.logout,
    );
  }
}

export default new AuthRoute().router;

