import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryColumn,
} from "typeorm";

import { User } from "./User";
import { Specialization } from "./Specialization";
import { Appointment } from "./Appointment";
import { DoctorAvailability } from "./DoctorAvailability";

@Entity("doctors")
export class Doctor {
  @PrimaryColumn({ name: "doctor_id", type: "smallint" })
  doctorId: number;

  @Column({
    name: "specialization_id",
    type: "smallint",
  })
  specializationId: number;

  @Column({
    name: "experience_years",
    type: "smallint",
  })
  experienceYears: number;

  @OneToOne(() => User, (user) => user.doctor)
  @JoinColumn({ name: "doctor_id" })
  user: User;

  @ManyToOne(
    () => Specialization,
    (specialization) => specialization.doctors
  )
  @JoinColumn({ name: "specialization_id" })
  specialization: Specialization;

  @OneToMany(
    () => Appointment,
    (appointment) => appointment.doctor
  )
  appointments: Appointment[];

  @OneToMany(
    () => DoctorAvailability,
    (availability) => availability.doctor
  )
  availabilities: DoctorAvailability[];
}