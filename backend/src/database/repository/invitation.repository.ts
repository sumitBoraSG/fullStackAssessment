import { EntityManager, getManager } from "typeorm";

import { UserInvitationRepo } from "@database/repository/user-invitation.repository";

import { UserRole } from "@database/enum/userRole";
import { InvitationStatus } from "../../types/invitationStatus";

export interface FindAllInvitationsOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: InvitationStatus;
  role?: UserRole;
}

export class InvitationRepository {

  private get invitationRepo() {

    return getManager().getCustomRepository(UserInvitationRepo);

  }

  public async findPendingInvitation(email: string) {

    return this.invitationRepo

      .createQueryBuilder("invitation")

      .where("invitation.email = :email", {
        email: email.toLowerCase(),
      })

      .andWhere("invitation.used_at IS NULL")

      .andWhere("invitation.revoked_at IS NULL")

      .andWhere("invitation.expires_at > NOW()")

      .getOne();

  }

  /**
   * Same "active" definition as the partial unique index
   * (idx_user_invitations_active_email): not used, not revoked — regardless
   * of expiry. Used to distinguish a genuinely-pending invitation from a
   * merely-expired one when a unique-constraint conflict is hit on insert.
   */
  public async findActiveInvitation(email: string) {
    return this.invitationRepo
      .createQueryBuilder("invitation")
      .where("invitation.email = :email", {
        email: email.toLowerCase(),
      })
      .andWhere("invitation.used_at IS NULL")
      .andWhere("invitation.revoked_at IS NULL")
      .getOne();
  }

  public async deleteInvitation(invitationId: number) {
    return this.invitationRepo.delete({ id: invitationId });
  }

  public async createInvitation(
    email: string,
    role: UserRole,
    hashedToken: string,
    expiresAt: Date,
    createdBy: number,
  ) {

    const invitation = this.invitationRepo.create({
      email: email.toLowerCase(),
      role,
      hashedToken,
      expiresAt,
      usedAt: null,
      revokedAt: null,
      createdBy,
      updatedBy: createdBy,
    });

    return this.invitationRepo.save(invitation);

  }

  public async findByHashedToken(hashedToken: string) {
    return this.invitationRepo.findOne({
      where: {
        hashedToken,
      },
    });
  }

  /**
   * Locks the invitation row (SELECT ... FOR UPDATE) so that two concurrent
   * accept-invitation requests for the same token are serialized: the
   * second waits for the first's transaction to commit, then observes
   * usedAt already set and fails cleanly instead of racing to create two
   * users. Must be called within an active transaction via `manager`.
   */
  public async findByHashedTokenForUpdate(
    hashedToken: string,
    manager: EntityManager,
  ) {
    return manager
      .getCustomRepository(UserInvitationRepo)
      .createQueryBuilder("invitation")
      .where("invitation.hashedToken = :hashedToken", { hashedToken })
      .setLock("pessimistic_write")
      .getOne();
  }

  public async markAsUsed(
    invitationId: number,
    updatedBy: number,
    manager: EntityManager = getManager(),
  ) {

    return manager

      .getCustomRepository(UserInvitationRepo)

      .createQueryBuilder()

      .update()

      .set({
        usedAt: new Date(),
        updatedBy,
      })

      .where("id = :invitationId", {
        invitationId,
      })

      .execute();

  }

  public async findById(id: number) {
    return this.invitationRepo
      .createQueryBuilder("invitation")
      .where("invitation.id = :id", { id })
      .getOne();
  }

  public async revokeInvitation(
    invitationId: number,
    updatedBy: number,
  ) {
    const revokedAt = new Date();
    await this.invitationRepo
      .createQueryBuilder()
      .update()
      .set({
        revokedAt,
        updatedBy,
      })
      .where("id = :invitationId", {
        invitationId,
      })
      .execute();

    return this.findById(invitationId);
  }

  public async findAllInvitations(options: FindAllInvitationsOptions = {}) {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? options.limit : 10;
    const skip = (page - 1) * limit;

    const query = this.invitationRepo.createQueryBuilder("invitation");

    if (options.search && options.search.trim()) {
      query.andWhere("LOWER(invitation.email) LIKE :search", {
        search: `%${options.search.trim().toLowerCase()}%`,
      });
    }

    if (options.role) {
      query.andWhere("invitation.role = :role", { role: options.role });
    }

    if (options.status) {
      switch (options.status) {
        case InvitationStatus.REVOKED:
          query.andWhere("invitation.revoked_at IS NOT NULL");
          break;
        case InvitationStatus.USED:
          query.andWhere(
            "invitation.revoked_at IS NULL AND invitation.used_at IS NOT NULL",
          );
          break;
        case InvitationStatus.EXPIRED:
          query.andWhere(
            "invitation.revoked_at IS NULL AND invitation.used_at IS NULL AND invitation.expires_at <= NOW()",
          );
          break;
        case InvitationStatus.PENDING:
          query.andWhere(
            "invitation.revoked_at IS NULL AND invitation.used_at IS NULL AND invitation.expires_at > NOW()",
          );
          break;
      }
    }

    const [invitations, total] = await query
      .orderBy("invitation.created_at", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      invitations,
      total,
    };
  }

}

