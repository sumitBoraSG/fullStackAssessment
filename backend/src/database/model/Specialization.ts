import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

import { Doctor } from "./Doctor";

@Entity("specializations")
export class Specialization {
  @PrimaryGeneratedColumn({ type: "smallint" })
  id: number;

  @Column({
    type: "varchar",
    length: 100,
  })
  name: string;

  @Column({
    type: "varchar",
    length: 500,
    nullable: true,
  })
  description: string | null;

  @Column({
    name: "is_active",
    type: "boolean",
    default: true,
  })
  isActive: boolean;

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

  @OneToMany(
    () => Doctor,
    (doctor) => doctor.specialization
  )
  doctors: Doctor[];
}
