import express from "express";

import { DoctorController } from "@api/controller/doctor.controller";
import { AppointmentController } from "@api/controller/appointment.controller";
import {
    createAvailabilitySchema,
    getAvailabilityQuerySchema,
    getDoctorsQuerySchema,
} from "@api/validator/doctor.validation";
import {
    appointmentStatusParamsSchema,
    doctorAppointmentStatusBodySchema,
    getDoctorAppointmentsQuerySchema,
} from "@api/validator/appointment.validation";

import { HttpRequestValidator } from "@middleware/http-request-validator";
import { AuthMiddleware } from "@middleware/auth.middleware";
import { AuthorizationMiddleware } from "@middleware/authorization.middleware";
import { RateLimitMiddleware } from "@middleware/rateLimiter.middleware";

import { UserRole } from "@database/enum/userRole";

class DoctorRoute {
    public router: express.Router = express.Router();
    private doctorController = new DoctorController();
    private appointmentController = new AppointmentController();
    private requestValidator = new HttpRequestValidator();
    private authMiddleware = new AuthMiddleware();
    private authorizationMiddleware = new AuthorizationMiddleware();
    private rateLimitMiddleware = new RateLimitMiddleware();

    constructor() {
        // Doctor availability endpoints under /doctor
        this.router.post(
            "/availability",
            this.rateLimitMiddleware.general,
            this.authMiddleware.authenticate,
            this.authorizationMiddleware.authorize(UserRole.DOCTOR),
            this.requestValidator.validate("body", createAvailabilitySchema),
            this.doctorController.createAvailability,
        );

        this.router.get(
            "/availability",
            this.rateLimitMiddleware.general,
            this.authMiddleware.authenticate,
            this.authorizationMiddleware.authorize(UserRole.DOCTOR),
            this.requestValidator.validate("query", getAvailabilityQuerySchema),
            this.doctorController.getOwnAvailability,
        );

        this.router.get(
            "/appointments",
            this.rateLimitMiddleware.general,
            this.authMiddleware.authenticate,
            this.authorizationMiddleware.authorize(UserRole.DOCTOR),
            this.requestValidator.validate(
                "query",
                getDoctorAppointmentsQuerySchema,
            ),
            this.appointmentController.getDoctorAppointments,
        );

        this.router.patch(
            "/appointments/:appointmentId/status",
            this.rateLimitMiddleware.general,
            this.authMiddleware.authenticate,
            this.authorizationMiddleware.authorize(UserRole.DOCTOR),
            this.requestValidator.validate(
                "params",
                appointmentStatusParamsSchema,
            ),
            this.requestValidator.validate(
                "body",
                doctorAppointmentStatusBodySchema,
            ),
            this.appointmentController.updateAppointmentStatus,
        );
    }
}

class DoctorsDiscoveryRoute {
    public router: express.Router = express.Router();
    private doctorController = new DoctorController();
    private requestValidator = new HttpRequestValidator();
    private authMiddleware = new AuthMiddleware();
    private authorizationMiddleware = new AuthorizationMiddleware();
    private rateLimitMiddleware = new RateLimitMiddleware();

    constructor() {
        // Patient & Doctor discovery endpoints under /doctors
        // Non-sensitive static reference data — deliberately public (no
        // auth) so the not-yet-registered accept-invitation signup page can
        // populate the specialization dropdown for doctor invitations.
        this.router.get(
            "/specializations",
            this.rateLimitMiddleware.general,
            this.doctorController.getSpecializations,
        );

        this.router.get(
            "/:doctorId/availability",
            this.rateLimitMiddleware.general,
            this.authMiddleware.authenticate,
            this.authorizationMiddleware.authorize(
                UserRole.PATIENT,
                UserRole.DOCTOR,
                UserRole.ADMIN,
            ),
            this.requestValidator.validate("query", getAvailabilityQuerySchema),
            this.doctorController.getDoctorAvailability,
        );

        this.router.get(
            "/",
            this.rateLimitMiddleware.general,
            this.authMiddleware.authenticate,
            this.authorizationMiddleware.authorize(
                UserRole.PATIENT,
                UserRole.DOCTOR,
                UserRole.ADMIN,
            ),
            this.requestValidator.validate("query", getDoctorsQuerySchema),
            this.doctorController.getDoctors,
        );
    }
}

export const doctorRoutes = new DoctorRoute().router;
export const doctorsDiscoveryRoutes = new DoctorsDiscoveryRoute().router;
export default doctorRoutes;
