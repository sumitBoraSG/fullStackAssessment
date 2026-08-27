import express from "express";

import { DoctorController } from "@api/controller/doctor.controller";
import {
    createAvailabilitySchema,
    getAvailabilityQuerySchema,
    getDoctorsQuerySchema,
} from "@api/validator/doctor.validation";

import { HttpRequestValidator } from "@middleware/http-request-validator";
import { AuthMiddleware } from "@middleware/auth.middleware";
import { AuthorizationMiddleware } from "@middleware/authorization.middleware";
import { RateLimitMiddleware } from "@middleware/rateLimiter.middleware";

import { UserRole } from "@database/enum/userRole";

class DoctorRoute {
    public router: express.Router = express.Router();
    private doctorController = new DoctorController();
    private requestValidator = new HttpRequestValidator();
    private authMiddleware = new AuthMiddleware();
    private authorizationMiddleware = new AuthorizationMiddleware();
    private rateLimitMiddleware = new RateLimitMiddleware();

    constructor() {
        // Doctor availability endpoints under /doctor
        this.router.post(
            "/availability",
            this.rateLimitMiddleware.general,
            this.requestValidator.validate("body", createAvailabilitySchema),
            this.authMiddleware.authenticate,
            this.authorizationMiddleware.authorize(UserRole.DOCTOR),
            this.doctorController.createAvailability,
        );

        this.router.get(
            "/availability",
            this.requestValidator.validate("query", getAvailabilityQuerySchema),
            this.authMiddleware.authenticate,
            this.authorizationMiddleware.authorize(UserRole.DOCTOR),
            this.doctorController.getOwnAvailability,
        );
    }
}

class DoctorsDiscoveryRoute {
    public router: express.Router = express.Router();
    private doctorController = new DoctorController();
    private requestValidator = new HttpRequestValidator();
    private authMiddleware = new AuthMiddleware();
    private authorizationMiddleware = new AuthorizationMiddleware();

    constructor() {
        // Patient & Doctor discovery endpoints under /doctors
        this.router.get(
            "/specializations",
            this.authMiddleware.authenticate,
            this.doctorController.getSpecializations,
        );

        this.router.get(
            "/:doctorId/availability",
            this.requestValidator.validate("query", getAvailabilityQuerySchema),
            this.authMiddleware.authenticate,
            this.authorizationMiddleware.authorize(
                UserRole.PATIENT,
                UserRole.DOCTOR,
                UserRole.ADMIN,
            ),
            this.doctorController.getDoctorAvailability,
        );

        this.router.get(
            "/",
            this.requestValidator.validate("query", getDoctorsQuerySchema),
            this.authMiddleware.authenticate,
            this.authorizationMiddleware.authorize(
                UserRole.PATIENT,
                UserRole.DOCTOR,
                UserRole.ADMIN,
            ),
            this.doctorController.getDoctors,
        );
    }
}

export const doctorRoutes = new DoctorRoute().router;
export const doctorsDiscoveryRoutes = new DoctorsDiscoveryRoute().router;
export default doctorRoutes;