import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryColumn,
} from "typeorm";

import { BloodGroup } from "../enum/BloodGroup";
import { User } from "./User";
import { Appointment } from "./Appointment";
@Entity("patients")
export class Patient {
  @PrimaryColumn({ name: "patient_id", type: "smallint" })
  patientId: number;

  @Column({
    name: "height_cm",
    type: "smallint",
    nullable: true,
  })
  heightCm: number | null;

  @Column({
    name: "weight_kg",
    type: "smallint",
    nullable: true,
  })
  weightKg: number | null;

  @Column({
    name: "blood_group",
    type: "enum",
    enum: BloodGroup,
    enumName: "blood_group",
    nullable: true,
  })
  bloodGroup: BloodGroup | null;

  @Column({
    name: "dob",
    type: "date",
    nullable: true,
  })
  dob: string | null;

  @OneToOne(() => User, (user) => user.patient)
  @JoinColumn({ name: "patient_id" })
  user: User;
  @OneToMany(
    () => Appointment,
    (appointment) => appointment.patient
  )
  appointments: Appointment[];
}
