import express from "express";
import { AuthController } from "@api/controller/auth.controller";
import { loginSchema } from "@api/validator/auth.validator";
import { HttpRequestValidator } from "@middleware/http-request-validator";
import { acceptInvitationSchema } from "@api/validator/acceptInvitation.validation";
import { requestPatientSelfRegistrationSchema } from "@api/validator/patientSelfRegister.validation";
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

    // Public, unauthenticated: a prospective patient requests their own
    // registration link. Always responds with the same generic message
    // (see AuthController.requestPatientSelfRegistration) and sits behind a
    // stricter, dedicated rate limiter since it requires no prior
    // credential or possessed token.
    this.router.post(
      "/patient/self-register",
      this.rateLimitMiddleware.patientSelfRegistration,
      this.requestValidator.validate(
        "body",
        requestPatientSelfRegistrationSchema,
      ),
      this.authController.requestPatientSelfRegistration,
    );

    // Public, read-only invitation preview — lets the signup page learn the
    // invited role before rendering role-specific fields, without
    // consuming the invitation.
    this.router.get(
      "/invitation/:token",
      this.rateLimitMiddleware.auth,
      this.authController.getInvitationDetails,
    );

    // Logout clears HttpOnly cookies server-side
    this.router.post(
      "/logout",
      this.rateLimitMiddleware.auth,
      this.authController.logout,
    );
  }
}

export default new AuthRoute().router;

