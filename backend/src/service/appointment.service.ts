import createError from "http-errors";
import { getManager } from "typeorm";

import { AppointmentStatus } from "@database/enum/AppointmentStatus";
import { AppointmentRepository } from "@database/repository/doctor-appointment.repository";
import { DoctorRepository } from "@database/repository/doctor.repository";

export class AppointmentService {

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
}