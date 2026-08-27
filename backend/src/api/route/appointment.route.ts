import express from "express";

import { AppointmentController } from "@api/controller/appointment.controller";

import { HttpRequestValidator } from "@middleware/http-request-validator";
import { AuthMiddleware } from "@middleware/auth.middleware";
import { AuthorizationMiddleware } from "@middleware/authorization.middleware";
import { RateLimitMiddleware } from "@middleware/rateLimiter.middleware";
import { createAppointmentSchema } from "@api/validator/createAppointment.validation";
import { UserRole } from "@database/enum/userRole";

class AppointmentRoute {
  public router: express.Router = express.Router();

  private appointmentController: AppointmentController =
    new AppointmentController();

  private requestValidator: HttpRequestValidator =
    new HttpRequestValidator();

  private authMiddleware: AuthMiddleware =
    new AuthMiddleware();

  private authorizationMiddleware: AuthorizationMiddleware =
    new AuthorizationMiddleware();
  private rateLimitMiddleware = new RateLimitMiddleware();
  constructor() {
    this.router.post(
      "/",
      this.rateLimitMiddleware.general,
      this.requestValidator.validate(
        "body",
        createAppointmentSchema,
    ),
      this.authMiddleware.authenticate,
      this.authorizationMiddleware.authorize(
        UserRole.PATIENT,
      ),
      this.appointmentController.createAppointment,
    );
  }
}

export default new AppointmentRoute().router;