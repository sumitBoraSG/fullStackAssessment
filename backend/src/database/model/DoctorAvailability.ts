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

import { Doctor } from "./Doctor";

@Entity("doctor_availabilities")
@Exclusion(
  "doctor_availability_no_overlap",
  "USING GIST (doctor_id WITH =, availability_time WITH &&)",
)
export class DoctorAvailability {
  @PrimaryGeneratedColumn({ type: "smallint" })
  id: number;

  @Column({
    name: "doctor_id",
    type: "smallint",
  })
  doctorId: number;

  @Column({
    name: "availability_time",
    type: "tstzrange",
  })
  availabilityTime: string;

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
    () => Doctor,
    (doctor) => doctor.availabilities
  )
  @JoinColumn({ name: "doctor_id" })
  doctor: Doctor;
}
