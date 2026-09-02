import {
  EntityRepository,
  getManager,
  Repository,
  SelectQueryBuilder,
  UpdateResult,
} from "typeorm";
import { Appointment } from "@database/model/Appointment";
import { DoctorAvailability } from "@database/model/DoctorAvailability";
import { Patient } from "@database/model/Patient";
import { AppointmentStatus } from "@database/enum/AppointmentStatus";
import { getISTDayBounds } from "@util/dateTimeRange";

export interface FindAppointmentsOptions {
  page: number;
  limit: number;
  status?: AppointmentStatus;
  doctorId?: number;
  patientId?: number;
  startsAt?: string;
  endsAt?: string;
  sortBy?: "appointmentTime" | "createdAt" | "updatedAt";
  order?: "ASC" | "DESC";
}

interface PaginatedAppointmentsResult {
  appointments: Appointment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@EntityRepository(Appointment)
export class AppointmentRepository extends Repository<Appointment> {
  public async findActiveAppointmentsForDoctor(
    doctorId: number,
    date?: string,
  ) {
    const query = this.createQueryBuilder("appointment")
      .where("appointment.doctorId = :doctorId", { doctorId })
      .andWhere("appointment.status IN (:...statuses)", {
        statuses: [
          AppointmentStatus.PENDING,
          AppointmentStatus.CONFIRMED,
        ],
      });

    if (date && date.trim()) {
      const { startOfDay, endOfDayExclusive } = getISTDayBounds(date.trim());
      query.andWhere(
        "appointment.appointment_time && tstzrange(:startOfDay, :endOfDay, '[)')",
        { startOfDay, endOfDay: endOfDayExclusive },
      );
    }

    return query.getMany();
  }

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
        "availability.availability_time @> :appointmentTime::tstzrange",
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
      .createQueryBuilder("patient")
      .innerJoinAndSelect("patient.user", "user")
      .where("patient.patientId = :patientId", {
        patientId,
      })
      .andWhere("user.deletedAt IS NULL")
      .getOne();
  }

  public async findPatientAppointments(
    patientId: number,
    options: FindAppointmentsOptions,
  ): Promise<PaginatedAppointmentsResult> {
    const query = this.createQueryBuilder("appointment")
      .innerJoinAndSelect("appointment.doctor", "doctor")
      .innerJoinAndSelect("doctor.user", "doctorUser")
      .leftJoinAndSelect(
        "doctor.specialization",
        "specialization",
      )
      .where("appointment.patientId = :patientId", {
        patientId,
      });

    this.applyCommonFilters(query, options);

    const order = options.order || "ASC";

    if (options.sortBy === "createdAt") {
      query.orderBy("appointment.createdAt", order);
    } else if (options.sortBy === "updatedAt") {
      query.orderBy("appointment.updatedAt", order);
    } else {
      query.orderBy("appointment.appointmentTime", order);
    }

    const [appointments, total] = await query
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getManyAndCount();

    return {
      appointments,
      total,
      page: options.page,
      limit: options.limit,
      totalPages:
        Math.ceil(total / options.limit) || 1,
    };
  }

  public async findDoctorAppointments(
    doctorId: number,
    options: FindAppointmentsOptions,
  ): Promise<PaginatedAppointmentsResult> {
    const query = this.createQueryBuilder("appointment")
      .innerJoinAndSelect("appointment.patient", "patient")
      .innerJoinAndSelect("patient.user", "patientUser")
      .where("appointment.doctorId = :doctorId", { doctorId });

    this.applyCommonFilters(query, options);

    const order = options.order || "ASC";

    if (options.sortBy === "createdAt") {
      query.orderBy("appointment.createdAt", order);
    } else if (options.sortBy === "updatedAt") {
      query.orderBy("appointment.updatedAt", order);
    } else {
      query.orderBy("appointment.appointmentTime", order);
    }

    const [appointments, total] = await query
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getManyAndCount();

    return {
      appointments,
      total,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil(total / options.limit) || 1,
    };
  }

  public async findDoctorAppointmentById(
    appointmentId: number,
    doctorId: number,
  ) {
    return this.createQueryBuilder("appointment")
      .innerJoinAndSelect("appointment.patient", "patient")
      .innerJoinAndSelect("patient.user", "patientUser")
      .where("appointment.id = :appointmentId", { appointmentId })
      .andWhere("appointment.doctorId = :doctorId", { doctorId })
      .getOne();
  }

  public async findPatientAppointmentById(
    appointmentId: number,
    patientId: number,
  ) {
    return this.createQueryBuilder("appointment")
      .innerJoinAndSelect("appointment.doctor", "doctor")
      .innerJoinAndSelect("doctor.user", "doctorUser")
      .leftJoinAndSelect("doctor.specialization", "specialization")
      .where("appointment.id = :appointmentId", { appointmentId })
      .andWhere("appointment.patientId = :patientId", { patientId })
      .getOne();
  }

  public async updateAppointmentStatusByDoctor(
    appointmentId: number,
    doctorId: number,
    expectedStatus: AppointmentStatus,
    status: AppointmentStatus,
  ): Promise<UpdateResult> {
    return this.createQueryBuilder()
      .update(Appointment)
      .set({ status })
      .where("id = :appointmentId", { appointmentId })
      .andWhere("doctor_id = :doctorId", { doctorId })
      .andWhere("status = :expectedStatus", { expectedStatus })
      .execute();
  }

  public async updateAppointmentStatusByPatient(
    appointmentId: number,
    patientId: number,
    expectedStatus: AppointmentStatus,
    status: AppointmentStatus,
  ): Promise<UpdateResult> {
    return this.createQueryBuilder()
      .update(Appointment)
      .set({ status })
      .where("id = :appointmentId", { appointmentId })
      .andWhere("patient_id = :patientId", { patientId })
      .andWhere("status = :expectedStatus", { expectedStatus })
      .execute();
  }

  private applyCommonFilters(
    query: SelectQueryBuilder<Appointment>,
    options: FindAppointmentsOptions,
  ) {
    if (options.status) {
      query.andWhere("appointment.status = :status", {
        status: options.status,
      });
    }

    if (options.doctorId) {
      query.andWhere("appointment.doctorId = :doctorId", {
        doctorId: options.doctorId,
      });
    }

    if (options.patientId) {
      query.andWhere("appointment.patientId = :patientId", {
        patientId: options.patientId,
      });
    }

    if (options.startsAt && options.endsAt) {
      query.andWhere(
        "appointment.appointment_time && tstzrange(:startsAt, :endsAt, '[)')",
        {
          startsAt: options.startsAt,
          endsAt: options.endsAt,
        },
      );
      return;
    }

    if (options.startsAt) {
      query.andWhere(
        "upper(appointment.appointment_time) > :startsAt::timestamptz",
        {
          startsAt: options.startsAt,
        },
      );
    }

    if (options.endsAt) {
      query.andWhere(
        "lower(appointment.appointment_time) < :endsAt::timestamptz",
        {
          endsAt: options.endsAt,
        },
      );
    }
  }
}
