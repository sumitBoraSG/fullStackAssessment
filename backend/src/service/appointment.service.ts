import createError from "http-errors";
import { getManager } from "typeorm";

import { AppointmentStatus } from "@database/enum/AppointmentStatus";
import {
    AppointmentRepository,
    FindAppointmentsOptions,
} from "@database/repository/appointment.repository";
import { DoctorRepository } from "@database/repository/doctor.repository";
import { Appointment } from "@database/model/Appointment";
import { Doctor } from "@database/model/Doctor";
import { User } from "@database/model/User";
import constant from "@config/constant";
import logger from "@core/logger";
import { EmailService } from "@service/email/email.service";
import { AppointmentEmailDetails } from "@service/email/types";
import {
    buildISTRangeLiteral,
    getISTCurrentTimeString,
    getISTDayBounds,
    getISTTodayString,
    isISTDateTimeInPast,
    parseRangeToIST,
} from "@util/dateTimeRange";

// A doctor must not confirm an appointment whose scheduled time has already
// passed, and must not complete one that hasn't started yet.
function assertAppointmentTimeAllowsTransition(
    status: AppointmentStatus,
    appointmentTime: string,
    context: { appointmentId: number; doctorId: number },
): void {
    if (status !== AppointmentStatus.CONFIRMED && status !== AppointmentStatus.COMPLETED) {
        return;
    }

    const scheduled = parseRangeToIST(appointmentTime);
    const hasStarted = isISTDateTimeInPast(scheduled.date, scheduled.startTime);

    if (status === AppointmentStatus.CONFIRMED && hasStarted) {
        logger.error(
            "Update appointment status failed: scheduled time already passed",
            {
                data: {
                    ...context,
                    scheduledDate: scheduled.date,
                    scheduledStartTime: scheduled.startTime,
                },
            },
        );
        throw new createError.Conflict(constant.APPOINTMENT_TIME_ALREADY_PASSED);
    }

    if (status === AppointmentStatus.COMPLETED && !hasStarted) {
        logger.error(
            "Update appointment status failed: appointment has not started yet",
            {
                data: {
                    ...context,
                    scheduledDate: scheduled.date,
                    scheduledStartTime: scheduled.startTime,
                },
            },
        );
        throw new createError.Conflict(constant.APPOINTMENT_NOT_YET_STARTED);
    }
}

export class AppointmentService {
    private static readonly DEFAULT_PAGE = 1;
    private static readonly DEFAULT_LIMIT = 10;
    private static readonly MAX_LIMIT = 100;

    private emailService = new EmailService();

    private get appointmentRepository() {
        return getManager().getCustomRepository(
            AppointmentRepository,
        );
    }

    private get doctorRepository() {
        return getManager().getCustomRepository(
            DoctorRepository,
        );
    }

    public async getPatientAppointments(
        patientId: number,
        filters: {
            page?: number;
            limit?: number;
            status?: AppointmentStatus;
            date?: string;
            dateFrom?: string;
            dateTo?: string;
            doctorId?: number;
            sortBy?: "appointmentTime" | "createdAt" | "updatedAt";
            order?: "ASC" | "DESC";
        },
    ) {
        const options = this.buildAppointmentQueryOptions(filters, {
            doctorId: filters.doctorId,
        });

        const result = await this.appointmentRepository.findPatientAppointments(
            patientId,
            options,
        );

        logger.info("Patient appointments fetched successfully", {
            data: {
                patientId,
                count: result.appointments.length,
                total: result.total,
                page: result.page,
                limit: result.limit,
                filters: {
                    status: filters.status,
                    date: filters.date,
                    dateFrom: filters.dateFrom,
                    dateTo: filters.dateTo,
                    doctorId: filters.doctorId,
                    sortBy: options.sortBy,
                    order: options.order,
                },
            },
        });

        return {
            appointments: result.appointments.map((appointment) =>
                this.formatPatientAppointment(appointment),
            ),
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: result.totalPages,
            },
        };
    }

    public async getDoctorAppointments(
        doctorId: number,
        filters: {
            page?: number;
            limit?: number;
            status?: AppointmentStatus;
            date?: string;
            dateFrom?: string;
            dateTo?: string;
            patientId?: number;
            sortBy?: "appointmentTime" | "createdAt" | "updatedAt";
            order?: "ASC" | "DESC";
        },
    ) {
        const options = this.buildAppointmentQueryOptions(filters, {
            patientId: filters.patientId,
        });

        const result = await this.appointmentRepository.findDoctorAppointments(
            doctorId,
            options,
        );

        logger.info("Doctor appointments fetched successfully", {
            data: {
                doctorId,
                count: result.appointments.length,
                total: result.total,
                page: result.page,
                limit: result.limit,
                filters: {
                    status: filters.status,
                    date: filters.date,
                    dateFrom: filters.dateFrom,
                    dateTo: filters.dateTo,
                    patientId: filters.patientId,
                    sortBy: options.sortBy,
                    order: options.order,
                },
            },
        });

        return {
            appointments: result.appointments.map((appointment) =>
                this.formatDoctorAppointment(appointment),
            ),
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: result.totalPages,
            },
        };
    }

    public async createAppointment(
        patientId: number,
        doctorId: number,
        date: string,
        startTime: string,
        endTime: string,
    ) {
        const today = new Date();
        const todayString = getISTTodayString(today);

        if (date < todayString) {
            logger.error("Create appointment failed: date in past", {
                data: { patientId, doctorId, date, startTime, endTime },
            });
            throw new createError.BadRequest(
                constant.APPOINTMENT_DATE_IN_PAST,
            );
        }

        if (startTime >= endTime) {
            logger.error("Create appointment failed: invalid time range", {
                data: { patientId, doctorId, date, startTime, endTime },
            });
            throw new createError.BadRequest(
                constant.INVALID_APPOINTMENT_TIME,
            );
        }

        if (date === todayString) {
            const currentTime = getISTCurrentTimeString(today);

            if (startTime <= currentTime) {
                logger.error("Create appointment failed: time in past", {
                    data: { patientId, doctorId, date, startTime, endTime },
                });
                throw new createError.BadRequest(
                    constant.APPOINTMENT_TIME_IN_PAST,
                );
            }
        }

        // Check doctor exists
        const doctor =
            await this.doctorRepository.findDoctorById(doctorId);

        if (!doctor) {
            logger.error("Create appointment failed: doctor not found", {
                data: { patientId, doctorId },
            });
            throw new createError.NotFound(
                constant.DOCTOR_NOT_FOUND,
            );
        }

        // Check patient exists
        const patient =
            await this.appointmentRepository.findPatientById(
                patientId,
            );

        if (!patient) {
            logger.error("Create appointment failed: patient not found", {
                data: { patientId, doctorId },
            });
            throw new createError.NotFound(
                constant.PATIENT_NOT_FOUND,
            );
        }

        // Build appointment time range
        const appointmentTime = buildISTRangeLiteral(date, startTime, endTime);

        // Check doctor's availability
        const availability =
            await this.appointmentRepository
                .findDoctorAvailabilityForAppointment(
                    doctorId,
                    appointmentTime,
                );

        if (!availability) {
            logger.error("Create appointment failed: doctor not available at requested time", {
                data: {
                    patientId,
                    doctorId,
                    date,
                    startTime,
                    endTime,
                    appointmentTime,
                },
            });
            throw new createError.Conflict(
                constant.DOCTOR_NOT_AVAILABLE,
            );
        }

        try {
            const appointment =
                await this.appointmentRepository.createAppointment({
                    patientId,
                    doctorId,
                    appointmentTime,
                    status: AppointmentStatus.PENDING,
                });

            logger.info("Appointment created successfully", {
                data: {
                    appointmentId: appointment.id,
                    patientId,
                    doctorId,
                    date,
                    startTime,
                    endTime,
                    status: appointment.status,
                },
            });

            await this.notifyAppointmentRequested(
                appointment.id,
                patient.user,
                doctor,
                { date, startTime, endTime },
            );

            return {
                id: appointment.id,
                status: appointment.status,
                date,
                startTime,
                endTime,
                createdAt: appointment.createdAt,
                updatedAt: appointment.updatedAt,
                doctor: {
                    doctorId: doctor.doctorId,
                    firstName: doctor.user?.firstName || "",
                    lastName: doctor.user?.lastName || "",
                    specialization:
                        doctor.specialization?.name || "General Practitioner",
                    experienceYears: doctor.experienceYears || 0,
                },
            };
        } catch (error: any) {
            if (error?.code === "23P01") {
                logger.error("Create appointment failed: appointment time conflict", {
                    data: {
                        patientId,
                        doctorId,
                        date,
                        startTime,
                        endTime,
                    },
                });
                throw new createError.Conflict(
                    constant.APPOINTMENT_TIME_UNAVAILABLE,
                );
            }

            throw error;
        }
    }

    public async updateAppointmentStatus(
        appointmentId: number,
        doctorId: number,
        status: AppointmentStatus,
    ) {
        const appointment =
            await this.appointmentRepository.findDoctorAppointmentById(
                appointmentId,
                doctorId,
            );

        if (!appointment) {
            logger.error("Update appointment status failed: appointment not found", {
                data: { appointmentId, doctorId, requestedStatus: status },
            });
            throw new createError.NotFound(
                constant.APPOINTMENT_NOT_FOUND,
            );
        }

        const allowedTransitions: Record<
            AppointmentStatus,
            AppointmentStatus[]
        > = {
            [AppointmentStatus.PENDING]: [
                AppointmentStatus.CONFIRMED,
                AppointmentStatus.REJECTED,
            ],
            [AppointmentStatus.CONFIRMED]: [
                AppointmentStatus.COMPLETED,
            ],
            [AppointmentStatus.REJECTED]: [],
            [AppointmentStatus.COMPLETED]: [],
            [AppointmentStatus.CANCELLED]: [],
        };

        if (!allowedTransitions[appointment.status]?.includes(status)) {
            logger.error("Update appointment status failed: invalid transition", {
                data: {
                    appointmentId,
                    doctorId,
                    currentStatus: appointment.status,
                    requestedStatus: status,
                },
            });
            throw new createError.BadRequest(
                constant.INVALID_STATUS_TRANSITION,
            );
        }

        assertAppointmentTimeAllowsTransition(
            status,
            appointment.appointmentTime,
            { appointmentId, doctorId },
        );

        const result =
            await this.appointmentRepository.updateAppointmentStatusByDoctor(
                appointmentId,
                doctorId,
                appointment.status,
                status,
            );

        if (!result.affected) {
            const current =
                await this.appointmentRepository.findDoctorAppointmentById(
                    appointmentId,
                    doctorId,
                );

            if (!current) {
                logger.error("Update appointment status failed: appointment not found", {
                    data: { appointmentId, doctorId, requestedStatus: status },
                });
                throw new createError.NotFound(
                    constant.APPOINTMENT_NOT_FOUND,
                );
            }

            logger.error("Update appointment status failed: concurrent status change", {
                data: {
                    appointmentId,
                    doctorId,
                    expectedStatus: appointment.status,
                    currentStatus: current.status,
                    requestedStatus: status,
                },
            });
            throw new createError.Conflict(
                constant.APPOINTMENT_STATUS_CONFLICT,
            );
        }

        const updatedAppointment =
            await this.appointmentRepository.findDoctorAppointmentById(
                appointmentId,
                doctorId,
            );

        if (!updatedAppointment) {
            logger.error("Update appointment status failed: updated appointment not found", {
                data: { appointmentId, doctorId, status },
            });
            throw new createError.NotFound(
                constant.APPOINTMENT_NOT_FOUND,
            );
        }

        logger.info("Appointment status updated successfully", {
            data: {
                appointmentId,
                doctorId,
                patientId: appointment.patientId,
                oldStatus: appointment.status,
                newStatus: status,
            },
        });

        await this.notifyAppointmentStatusTransition(
            appointment.status,
            status,
            updatedAppointment,
            doctorId,
        );

        return this.formatDoctorAppointment(updatedAppointment);
    }

    public async cancelAppointment(
        appointmentId: number,
        patientId: number,
        status: AppointmentStatus,
    ) {
        const appointment =
            await this.appointmentRepository.findPatientAppointmentById(
                appointmentId,
                patientId,
            );

        if (!appointment) {
            logger.error("Cancel appointment failed: appointment not found", {
                data: { appointmentId, patientId },
            });
            throw new createError.NotFound(
                constant.APPOINTMENT_NOT_FOUND,
            );
        }

        if (status !== AppointmentStatus.CANCELLED) {
            logger.error("Cancel appointment failed: patient can only cancel", {
                data: { appointmentId, patientId, requestedStatus: status },
            });
            throw new createError.BadRequest(
                constant.PATIENT_CAN_ONLY_CANCEL,
            );
        }

        if (
            ![
                AppointmentStatus.PENDING,
                AppointmentStatus.CONFIRMED,
            ].includes(appointment.status)
        ) {
            logger.error("Cancel appointment failed: invalid current status", {
                data: {
                    appointmentId,
                    patientId,
                    currentStatus: appointment.status,
                    requestedStatus: status,
                },
            });
            throw new createError.BadRequest(
                constant.INVALID_STATUS_TRANSITION,
            );
        }

        const scheduled = parseRangeToIST(appointment.appointmentTime);

        if (isISTDateTimeInPast(scheduled.date, scheduled.startTime)) {
            logger.error("Cancel appointment failed: scheduled time already passed", {
                data: {
                    appointmentId,
                    patientId,
                    scheduledDate: scheduled.date,
                    scheduledStartTime: scheduled.startTime,
                },
            });
            throw new createError.Conflict(
                constant.CANNOT_CANCEL_PAST_APPOINTMENT,
            );
        }

        const result =
            await this.appointmentRepository.updateAppointmentStatusByPatient(
                appointmentId,
                patientId,
                appointment.status,
                status,
            );

        if (!result.affected) {
            const current =
                await this.appointmentRepository.findPatientAppointmentById(
                    appointmentId,
                    patientId,
                );

            if (!current) {
                logger.error("Cancel appointment failed: appointment not found", {
                    data: { appointmentId, patientId },
                });
                throw new createError.NotFound(
                    constant.APPOINTMENT_NOT_FOUND,
                );
            }

            logger.error("Cancel appointment failed: concurrent status change", {
                data: {
                    appointmentId,
                    patientId,
                    expectedStatus: appointment.status,
                    currentStatus: current.status,
                },
            });
            throw new createError.Conflict(
                constant.APPOINTMENT_STATUS_CONFLICT,
            );
        }

        const updatedAppointment =
            await this.appointmentRepository.findPatientAppointmentById(
                appointmentId,
                patientId,
            );

        if (!updatedAppointment) {
            logger.error("Cancel appointment failed: updated appointment not found", {
                data: { appointmentId, patientId },
            });
            throw new createError.NotFound(
                constant.APPOINTMENT_NOT_FOUND,
            );
        }

        logger.info("Appointment cancelled successfully", {
            data: {
                appointmentId,
                patientId,
                doctorId: appointment.doctorId,
                oldStatus: appointment.status,
                newStatus: status,
            },
        });

        await this.notifyAppointmentCancelledByPatient(
            patientId,
            updatedAppointment,
        );

        return this.formatPatientAppointment(updatedAppointment);
    }

    private buildAppointmentQueryOptions(
        filters: {
            page?: number;
            limit?: number;
            status?: AppointmentStatus;
            date?: string;
            dateFrom?: string;
            dateTo?: string;
            sortBy?: "appointmentTime" | "createdAt" | "updatedAt";
            order?: "ASC" | "DESC";
        },
        ownerFilters: {
            doctorId?: number;
            patientId?: number;
        } = {},
    ): FindAppointmentsOptions {
        const page =
            filters.page && filters.page > 0
                ? filters.page
                : AppointmentService.DEFAULT_PAGE;

        const limit =
            filters.limit && filters.limit > 0
                ? Math.min(filters.limit, AppointmentService.MAX_LIMIT)
                : AppointmentService.DEFAULT_LIMIT;

        if (filters.date && (filters.dateFrom || filters.dateTo)) {
            logger.error("Appointment query failed: conflicting date filters", {
                data: { date: filters.date, dateFrom: filters.dateFrom, dateTo: filters.dateTo },
            });
            throw new createError.BadRequest(
                constant.INVALID_DATE_FILTER,
            );
        }

        const timeRange = this.buildTimeRangeFilters(
            filters.date,
            filters.dateFrom,
            filters.dateTo,
        );

        return {
            page,
            limit,
            status: filters.status,
            sortBy: filters.sortBy || "appointmentTime",
            order: filters.order || "ASC",
            startsAt: timeRange.startsAt,
            endsAt: timeRange.endsAt,
            doctorId: ownerFilters.doctorId,
            patientId: ownerFilters.patientId,
        };
    }

    private buildTimeRangeFilters(
        date?: string,
        dateFrom?: string,
        dateTo?: string,
    ) {
        if (date) {
            const { startOfDay, endOfDayExclusive } = getISTDayBounds(date);
            return {
                startsAt: startOfDay,
                endsAt: endOfDayExclusive,
            };
        }

        if (dateFrom && dateTo && dateFrom > dateTo) {
            logger.error("Appointment query failed: dateFrom after dateTo", {
                data: { dateFrom, dateTo },
            });
            throw new createError.BadRequest(
                constant.INVALID_DATE_RANGE,
            );
        }

        return {
            startsAt: dateFrom
                ? getISTDayBounds(dateFrom).startOfDay
                : undefined,
            endsAt: dateTo
                ? getISTDayBounds(dateTo).endOfDayExclusive
                : undefined,
        };
    }

    private formatPatientAppointment(appointment: Appointment) {
        const appointmentTime = parseRangeToIST(
            appointment.appointmentTime,
        );

        return {
            id: appointment.id,
            status: appointment.status,
            date: appointmentTime.date,
            startTime: appointmentTime.startTime,
            endTime: appointmentTime.endTime,
            createdAt: appointment.createdAt,
            updatedAt: appointment.updatedAt,
            doctor: {
                doctorId: appointment.doctorId,
                firstName: appointment.doctor?.user?.firstName || "",
                lastName: appointment.doctor?.user?.lastName || "",
                specialization:
                    appointment.doctor?.specialization?.name ||
                    "General Practitioner",
                experienceYears:
                    appointment.doctor?.experienceYears || 0,
            },
        };
    }

    private formatDoctorAppointment(appointment: Appointment) {
        const appointmentTime = parseRangeToIST(
            appointment.appointmentTime,
        );

        return {
            id: appointment.id,
            status: appointment.status,
            date: appointmentTime.date,
            startTime: appointmentTime.startTime,
            endTime: appointmentTime.endTime,
            createdAt: appointment.createdAt,
            updatedAt: appointment.updatedAt,
            patient: {
                patientId: appointment.patientId,
                firstName: appointment.patient?.user?.firstName || "",
                lastName: appointment.patient?.user?.lastName || "",
                email: appointment.patient?.user?.email || "",
            },
        };
    }

    // ---------------------------------------------------------------------
    // Email notifications
    //
    // Every call site below only fires after the corresponding database
    // transition has already succeeded, so a failed/invalid transition never
    // reaches this code, and a successful one only ever reaches it once (the
    // repository's compare-and-swap update guarantees a given transition is
    // observed exactly once). Email delivery failures are caught and logged
    // here so they never turn an already-successful appointment operation
    // into an error response.
    // ---------------------------------------------------------------------

    private formatUserDisplayName(user?: Pick<User, "firstName" | "lastName">): string {
        return `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
    }

    private formatDoctorDisplayName(doctor?: Pick<Doctor, "user">): string {
        const name = this.formatUserDisplayName(doctor?.user);
        return name ? `Dr. ${name}` : "your doctor";
    }

    private async notifyAppointmentRequested(
        appointmentId: number,
        patientUser: Pick<User, "firstName" | "lastName" | "email">,
        doctor: Doctor,
        time: { date: string; startTime: string; endTime: string },
    ): Promise<void> {
        const details: AppointmentEmailDetails = {
            patientName: this.formatUserDisplayName(patientUser),
            doctorName: this.formatDoctorDisplayName(doctor),
            ...time,
        };

        await Promise.all([
            this.emailService
                .sendAppointmentRequestedPatientEmail(
                    patientUser.email,
                    appointmentId,
                    details,
                )
                .catch((error) =>
                    this.logEmailFailure(
                        appointmentId,
                        "APPOINTMENT_REQUESTED_PATIENT",
                        patientUser.email,
                        error,
                    ),
                ),
            doctor.user?.email
                ? this.emailService
                    .sendAppointmentRequestedDoctorEmail(
                        doctor.user.email,
                        appointmentId,
                        details,
                    )
                    .catch((error) =>
                        this.logEmailFailure(
                            appointmentId,
                            "APPOINTMENT_REQUESTED_DOCTOR",
                            doctor.user.email,
                            error,
                        ),
                    )
                : Promise.resolve(),
        ]);
    }

    // Maps a status transition to the email it should trigger. Returns
    // undefined for any transition that has no associated email (e.g. no
    // recognized transition occurred, or the doctor's own status-update
    // vocabulary doesn't map to a patient-facing notification).
    private getStatusTransitionEmailType(
        previousStatus: AppointmentStatus,
        newStatus: AppointmentStatus,
    ): "APPOINTMENT_CONFIRMED" | "APPOINTMENT_DECLINED" | "APPOINTMENT_COMPLETED" | undefined {
        if (previousStatus === AppointmentStatus.PENDING && newStatus === AppointmentStatus.CONFIRMED) {
            return "APPOINTMENT_CONFIRMED";
        }
        if (previousStatus === AppointmentStatus.PENDING && newStatus === AppointmentStatus.REJECTED) {
            return "APPOINTMENT_DECLINED";
        }
        if (previousStatus === AppointmentStatus.CONFIRMED && newStatus === AppointmentStatus.COMPLETED) {
            return "APPOINTMENT_COMPLETED";
        }
        return undefined;
    }

    private buildStatusTransitionEmailDetails(
        appointment: Appointment,
        doctor?: Doctor,
    ): AppointmentEmailDetails {
        const { date, startTime, endTime } = parseRangeToIST(
            appointment.appointmentTime,
        );

        return {
            patientName: this.formatUserDisplayName(appointment.patient?.user),
            doctorName: this.formatDoctorDisplayName(doctor),
            date,
            startTime,
            endTime,
        };
    }

    private async deliverStatusTransitionEmail(
        emailType: "APPOINTMENT_CONFIRMED" | "APPOINTMENT_DECLINED" | "APPOINTMENT_COMPLETED",
        patientEmail: string,
        appointmentId: number,
        details: AppointmentEmailDetails,
    ): Promise<void> {
        if (emailType === "APPOINTMENT_CONFIRMED") {
            await this.emailService.sendAppointmentConfirmedEmail(patientEmail, appointmentId, details);
        } else if (emailType === "APPOINTMENT_DECLINED") {
            await this.emailService.sendAppointmentDeclinedEmail(patientEmail, appointmentId, details);
        } else {
            await this.emailService.sendAppointmentCompletedEmail(patientEmail, appointmentId, details);
        }
    }

    private async notifyAppointmentStatusTransition(
        previousStatus: AppointmentStatus,
        newStatus: AppointmentStatus,
        appointment: Appointment,
        doctorId: number,
    ): Promise<void> {
        const patientEmail = appointment.patient?.user?.email;
        const emailType = this.getStatusTransitionEmailType(previousStatus, newStatus);

        if (!patientEmail || !emailType) {
            return;
        }

        try {
            const doctor = await this.doctorRepository.findDoctorById(doctorId);
            const details = this.buildStatusTransitionEmailDetails(appointment, doctor);
            await this.deliverStatusTransitionEmail(
                emailType,
                patientEmail,
                appointment.id,
                details,
            );
        } catch (error) {
            this.logEmailFailure(appointment.id, emailType, patientEmail, error);
        }
    }

    private async notifyAppointmentCancelledByPatient(
        patientId: number,
        appointment: Appointment,
    ): Promise<void> {
        const doctorEmail = appointment.doctor?.user?.email;
        if (!doctorEmail) {
            return;
        }

        try {
            const patient = await this.appointmentRepository.findPatientById(
                patientId,
            );
            const { date, startTime, endTime } = parseRangeToIST(
                appointment.appointmentTime,
            );
            const details: AppointmentEmailDetails = {
                patientName: patient
                    ? this.formatUserDisplayName(patient.user)
                    : "The patient",
                doctorName: this.formatDoctorDisplayName(appointment.doctor),
                date,
                startTime,
                endTime,
            };

            await this.emailService.sendAppointmentCancelledEmail(
                doctorEmail,
                appointment.id,
                details,
            );
        } catch (error) {
            this.logEmailFailure(
                appointment.id,
                "APPOINTMENT_CANCELLED",
                doctorEmail,
                error,
            );
        }
    }

    private logEmailFailure(
        appointmentId: number,
        emailType: string,
        recipient: string,
        error: unknown,
    ): void {
        logger.error("Failed to send appointment email", {
            data: {
                appointmentId,
                recipient,
                emailType,
                error: error instanceof Error ? error.message : String(error),
            },
        });
    }

}
