import {
    EntityRepository,
    getManager,
    Repository,
} from "typeorm";

import { Appointment } from "@database/model/Appointment";
import { DoctorAvailability } from "@database/model/DoctorAvailability";
import { Patient } from "@database/model/Patient";
import { AppointmentStatus } from "@database/enum/AppointmentStatus";

@EntityRepository(Appointment)
export class AppointmentRepository extends Repository<Appointment> {

    public async findDoctorAvailabilityForAppointment(
        doctorId: number,
        appointmentTime: string,
    ) {
        return getManager()
            .getRepository(DoctorAvailability)
            .createQueryBuilder("availability")
            .where("availability.doctorId = :doctorId", {
                doctorId,
            })
            .andWhere(
                "availability.availabilityTime @> :appointmentTime",
                {
                    appointmentTime,
                },
            )
            .getOne();
    }

    public async createAppointment(data: {
        patientId: number;
        doctorId: number;
        appointmentTime: string;
        status: AppointmentStatus;
    }) {
        const appointment = this.create({
            patientId: data.patientId,
            doctorId: data.doctorId,
            appointmentTime: data.appointmentTime,
            status: data.status,
        });

        return this.save(appointment);
    }

    public async findPatientById(patientId: number) {
        return getManager()
            .getRepository(Patient)
            .findOne({
                where: {
                    patientId: patientId,
                },
            });
    }
}