import express from "express";

import { PatientController } from "@api/controller/patient.controller";
import { updatePatientProfileSchema } from "@api/validator/profile.validation";

import { HttpRequestValidator } from "@middleware/http-request-validator";
import { AuthMiddleware } from "@middleware/auth.middleware";
import { AuthorizationMiddleware } from "@middleware/authorization.middleware";
import { RateLimitMiddleware } from "@middleware/rateLimiter.middleware";

import { UserRole } from "@database/enum/userRole";

class PatientRoute {
    public router: express.Router = express.Router();
    private patientController = new PatientController();
    private requestValidator = new HttpRequestValidator();
    private authMiddleware = new AuthMiddleware();
    private authorizationMiddleware = new AuthorizationMiddleware();
    private rateLimitMiddleware = new RateLimitMiddleware();

    constructor() {
        this.router.get(
            "/profile",
            this.rateLimitMiddleware.general,
            this.authMiddleware.authenticate,
            this.authorizationMiddleware.authorize(UserRole.PATIENT),
            this.patientController.getProfile,
        );

        this.router.patch(
            "/profile",
            this.rateLimitMiddleware.general,
            this.authMiddleware.authenticate,
            this.authorizationMiddleware.authorize(UserRole.PATIENT),
            this.requestValidator.validate("body", updatePatientProfileSchema),
            this.patientController.updateProfile,
        );
    }
}

export const patientRoutes = new PatientRoute().router;
export default patientRoutes;
