import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

import { UserRole } from "../enum/userRole";
import { UserInvitation } from "./UserInvitation";
import { Patient } from "./Patient";
import { Doctor } from "./Doctor";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn({ type: "smallint" })
  id: number;

  @Column({
    name: "first_name",
    type: "varchar",
    length: 50,
  })
  firstName: string;

  @Column({
    name: "last_name",
    type: "varchar",
    length: 50,
  })
  lastName: string;

  @Column({
    type: "varchar",
    length: 255,
    unique: true,
  })
  email: string;

  @Column({
    name: "hashed_password",
    type: "varchar",
    length: 255,
  })
  hashedPassword: string;

  @Column({
    type: "enum",
    enum: UserRole,
    enumName: "user_role",
  })
  role: UserRole;

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

  @DeleteDateColumn({
    name: "deleted_at",
    type: "timestamptz",
    nullable: true,
  })
  deletedAt: Date | null;

  @OneToMany(
    () => UserInvitation,
    (invitation) => invitation.createdByUser
  )
  createdInvitations: UserInvitation[];

  @OneToMany(
    () => UserInvitation,
    (invitation) => invitation.updatedByUser
  )
  updatedInvitations: UserInvitation[];

  @OneToOne(() => Patient, (patient) => patient.user)
  patient: Patient;

  @OneToOne(() => Doctor, (doctor) => doctor.user)
  doctor: Doctor;
}
