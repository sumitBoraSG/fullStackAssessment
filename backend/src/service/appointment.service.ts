import createError from "http-errors";
import { getManager } from "typeorm";

import { AppointmentStatus } from "@database/enum/AppointmentStatus";
import {
    AppointmentRepository,
    FindAppointmentsOptions,
} from "@database/repository/appointment.repository";
import { DoctorRepository } from "@database/repository/doctor.repository";
import { Appointment } from "@database/model/Appointment";

export class AppointmentService {
    private static readonly DEFAULT_PAGE = 1;
    private static readonly DEFAULT_LIMIT = 10;
    private static readonly MAX_LIMIT = 100;

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
        // Validate time
        if (startTime >= endTime) {
            throw new createError.BadRequest(
                "Start time must be before end time",
            );
        }

        // Check doctor exists
        const doctor =
            await this.doctorRepository.findDoctorById(doctorId);

        if (!doctor) {
            throw new createError.NotFound(
                "Doctor not found",
            );
        }

        // Check patient exists
        const patient =
            await this.appointmentRepository.findPatientById(
                patientId,
            );

        if (!patient) {
            throw new createError.NotFound(
                "Patient not found",
            );
        }

        // Build appointment time range
        const startDateTime =
            `${date}T${startTime}:00+05:30`;

        const endDateTime =
            `${date}T${endTime}:00+05:30`;

        const appointmentTime =
            `[${startDateTime},${endDateTime})`;

        // Check doctor's availability
        const availability =
            await this.appointmentRepository
                .findDoctorAvailabilityForAppointment(
                    doctorId,
                    appointmentTime,
                );

        if (!availability) {
            throw new createError.Conflict(
                "Doctor is not available at this time",
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

            return {
                id: appointment.id,
                patientId: appointment.patientId,
                doctorId: appointment.doctorId,
                status: appointment.status,
                date,
                startTime,
                endTime,
                createdAt: appointment.createdAt,
            };
        } catch (error: any) {
            if (error?.code === "23P01") {
                throw new createError.Conflict(
                    "Appointment time is no longer available",
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
            throw new createError.NotFound(
                "Appointment not found",
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

        if (!allowedTransitions[appointment.status].includes(status)) {
            throw new createError.BadRequest(
                `Invalid appointment status transition from ${appointment.status} to ${status}`,
            );
        }

        const result =
            await this.appointmentRepository.updateAppointmentStatusByDoctor(
                appointmentId,
                doctorId,
                status,
            );

        if (!result.affected) {
            throw new createError.NotFound(
                "Appointment not found",
            );
        }

        const updatedAppointment =
            await this.appointmentRepository.findDoctorAppointmentById(
                appointmentId,
                doctorId,
            );

        if (!updatedAppointment) {
            throw new createError.NotFound(
                "Appointment not found",
            );
        }

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
            throw new createError.NotFound(
                "Appointment not found",
            );
        }

        if (status !== AppointmentStatus.CANCELLED) {
            throw new createError.BadRequest(
                "Patients can only update appointment status to CANCELLED",
            );
        }

        if (
            ![
                AppointmentStatus.PENDING,
                AppointmentStatus.CONFIRMED,
            ].includes(appointment.status)
        ) {
            throw new createError.BadRequest(
                `Invalid appointment status transition from ${appointment.status} to ${status}`,
            );
        }

        const result =
            await this.appointmentRepository.updateAppointmentStatusByPatient(
                appointmentId,
                patientId,
                status,
            );

        if (!result.affected) {
            throw new createError.NotFound(
                "Appointment not found",
            );
        }

        const updatedAppointment =
            await this.appointmentRepository.findPatientAppointmentById(
                appointmentId,
                patientId,
            );

        if (!updatedAppointment) {
            throw new createError.NotFound(
                "Appointment not found",
            );
        }

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
            throw new createError.BadRequest(
                "Use either date or dateFrom/dateTo filters",
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
            return {
                startsAt: this.getDayStart(date),
                endsAt: this.getDayEndExclusive(date),
            };
        }

        if (dateFrom && dateTo && dateFrom > dateTo) {
            throw new createError.BadRequest(
                "dateFrom cannot be after dateTo",
            );
        }

        return {
            startsAt: dateFrom
                ? this.getDayStart(dateFrom)
                : undefined,
            endsAt: dateTo
                ? this.getDayEndExclusive(dateTo)
                : undefined,
        };
    }

    private getDayStart(date: string) {
        return `${date}T00:00:00+05:30`;
    }

    private getDayEndExclusive(date: string) {
        const nextDay = new Date(
            `${date}T00:00:00+05:30`,
        );
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);

        const nextDate =
            new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Kolkata",
            }).format(nextDay);

        return `${nextDate}T00:00:00+05:30`;
    }

    private formatPatientAppointment(appointment: Appointment) {
        const appointmentTime = this.parseAppointmentTime(
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
        const appointmentTime = this.parseAppointmentTime(
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

    private parseAppointmentTime(rangeStr: string) {
        const matches = rangeStr.match(
            /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[+-]\d{2}(?::\d{2})?/g,
        );

        if (!matches || matches.length < 2) {
            return { date: "", startTime: "", endTime: "" };
        }

        const normalizeIso = (value: string) => {
            let normalized = value.replace(" ", "T");

            if (/[+-]\d{2}$/.test(normalized)) {
                normalized = `${normalized}:00`;
            }

            return normalized;
        };

        const startDate = new Date(normalizeIso(matches[0]));
        const endDate = new Date(normalizeIso(matches[1]));

        const date = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kolkata",
        }).format(startDate);

        const formatTime = (value: Date) => {
            const parts = new Intl.DateTimeFormat("en-GB", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23",
            }).formatToParts(value);

            const hour =
                parts.find((part) => part.type === "hour")
                    ?.value || "00";
            const minute =
                parts.find((part) => part.type === "minute")
                    ?.value || "00";

            return `${hour}:${minute}`;
        };

        return {
            date,
            startTime: formatTime(startDate),
            endTime: formatTime(endDate),
        };
    }
}
