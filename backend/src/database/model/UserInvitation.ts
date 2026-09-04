import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

import { UserRole } from "../enum/userRole";
import { InvitationSource } from "../enum/invitationSource";
import { User } from "./User";

@Entity("user_invitations")
export class UserInvitation {
  @PrimaryGeneratedColumn({ type: "smallint" })
  id: number;

  @Column({
    type: "varchar",
    length: 255,
  })
  email: string;

  @Column({
    type: "enum",
    enum: UserRole,
    enumName: "user_role",
  })
  role: UserRole;

  @Column({
    name: "hashed_token",
    type: "varchar",
    length: 255,
    unique: true,
  })
  hashedToken: string;

  @Column({
    name: "expires_at",
    type: "timestamptz",
  })
  expiresAt: Date;

  @Column({
    name: "used_at",
    type: "timestamptz",
    nullable: true,
  })
  usedAt: Date | null;

  @Column({
    name: "created_by",
    type: "smallint",
    nullable: true,
  })
  createdBy: number | null;

  @Column({
    name: "updated_by",
    type: "smallint",
    nullable: true,
  })
  updatedBy: number | null;

  @Column({
    name: "revoked_at",
    type: "timestamptz",
    nullable: true,
  })
  revokedAt: Date | null;

  @Column({
    type: "enum",
    enum: InvitationSource,
    enumName: "invitation_source",
    default: InvitationSource.ADMIN_INVITATION,
  })
  source: InvitationSource;

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

  @ManyToOne(() => User, (user) => user.createdInvitations)
  @JoinColumn({ name: "created_by" })
  createdByUser: User;

  @ManyToOne(() => User, (user) => user.updatedInvitations)
  @JoinColumn({ name: "updated_by" })
  updatedByUser: User;
}
