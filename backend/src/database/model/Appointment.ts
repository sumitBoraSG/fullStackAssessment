import {
  Column,
  CreateDateColumn,
  Entity,
  Exclusion,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

import { AppointmentStatus } from "../enum/AppointmentStatus";
import { Patient } from "./Patient";
import { Doctor } from "./Doctor";

@Entity("appointments")
@Exclusion(
  "appointments_no_doctor_overlap",
  "USING GIST (doctor_id WITH =, appointment_time WITH &&) WHERE (status IN ('PENDING', 'CONFIRMED'))",
)
@Exclusion(
  "appointments_no_patient_overlap",
  "USING GIST (patient_id WITH =, appointment_time WITH &&) WHERE (status IN ('PENDING', 'CONFIRMED'))",
)
export class Appointment {
  @PrimaryGeneratedColumn({ type: "smallint" })
  id: number;

  @Column({
    name: "patient_id",
    type: "smallint",
  })
  patientId: number;

  @Column({
    name: "doctor_id",
    type: "smallint",
  })
  doctorId: number;

  @Column({
    type: "enum",
    enum: AppointmentStatus,
    enumName: "appointment_status",
  })
  status: AppointmentStatus;

  @Column({
    name: "appointment_time",
    type: "tstzrange",
  })
  appointmentTime: string;

  @CreateDateColumn({
    name: "created_at",
    type: "timestamptz",
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: "updated_at",
    type: "timestamptz",
  })
  updatedAt: Date;

  @ManyToOne(
    () => Patient,
    (patient) => patient.appointments
  )
  @JoinColumn({ name: "patient_id" })
  patient: Patient;

  @ManyToOne(
    () => Doctor,
    (doctor) => doctor.appointments
  )
  @JoinColumn({ name: "doctor_id" })
  doctor: Doctor;
}
