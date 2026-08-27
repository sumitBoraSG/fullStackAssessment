import crypto from "crypto";
import createError from "http-errors";
import constant from "@config/constant";
import logger from "@core/logger";
import { UserRole } from "@database/enum/userRole";
import { EmailService } from "@service/email.service";
import { bulkInviteRowSchema } from "@api/validator/bulkInvite.validation";
import { InvitationStatus } from "../types/invitationStatus";
import { AuthRepository } from "@database/repository/auth.repository";
import { InvitationRepository } from "@database/repository/invitation.repository";

export class AdminService {
  private authRepository: AuthRepository =
    new AuthRepository();

  private invitationRepository: InvitationRepository =
    new InvitationRepository();

  private emailService: EmailService =
    new EmailService();

  public async inviteUser(
    email: string,
    role: UserRole,
    adminId: number,
  ) {
    const trimmedEmail = email ? email.trim().toLowerCase() : "";

    // 1. Check whether the user already exists
    const existingUser =
      await this.authRepository.findUserForLogin(trimmedEmail);

    if (existingUser) {
      logger.error("Invite user failed: user already exists", {
        data: { email: trimmedEmail, adminId },
      });
      throw new createError.Conflict(
        constant.USER_ALREADY_EXISTS,
      );
    }

    // 2. Check whether there is already a pending invitation
    const existingInvitation =
      await this.invitationRepository.findPendingInvitation(
        trimmedEmail,
      );

    if (existingInvitation) {
      logger.error("Invite user failed: invitation already sent", {
        data: { email: trimmedEmail, adminId, existingInvitationId: existingInvitation.id },
      });
      throw new createError.Conflict(
        constant.INVITATION_ALREADY_SENT,
      );
    }

    // 3. Generate raw invitation token
    const invitationToken =
      crypto.randomBytes(32).toString("hex");

    // 4. Hash token before storing it
    const hashedToken = crypto
      .createHash("sha256")
      .update(invitationToken)
      .digest("hex");

    // 5. Set invitation expiration
    const expiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    );

    // 6. Store invitation
    const invitation =
      await this.invitationRepository.createInvitation(
        trimmedEmail,
        role,
        hashedToken,
        expiresAt,
        adminId,
      );

    // 7. Send invitation email
    try {
      await this.emailService.sendInvitationEmail(
        trimmedEmail,
        role,
        invitationToken,
      );
    } catch (emailError) {
      logger.error("Invite user: failed to send invitation email", {
        data: {
          invitationId: invitation.id,
          email: trimmedEmail,
          role,
          adminId,
          error: (emailError as Error).message,
        },
      });
      throw emailError;
    }

    logger.info("Invitation created and email sent", {
      data: {
        invitationId: invitation.id,
        email: invitation.email,
        role: invitation.role,
        adminId,
        expiresAt: invitation.expiresAt,
      },
    });

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    };
  }

  public async getAllInvitations(
    filter: {
      page?: number;
      limit?: number;
      search?: string;
      status?: InvitationStatus;
      role?: UserRole;
    } = {},
  ) {
    const page = filter.page && filter.page > 0 ? filter.page : 1;
    const limit = filter.limit && filter.limit > 0 ? filter.limit : 10;

    const { invitations, total } =
      await this.invitationRepository.findAllInvitations({
        page,
        limit,
        search: filter.search,
        status: filter.status,
        role: filter.role,
      });

    const now = new Date();

    const data = invitations.map((invitation) => {
      let status: InvitationStatus;

      if (invitation.revokedAt) {
        status = InvitationStatus.REVOKED;
      } else if (invitation.usedAt) {
        status = InvitationStatus.USED;
      } else if (invitation.expiresAt < now) {
        status = InvitationStatus.EXPIRED;
      } else {
        status = InvitationStatus.PENDING;
      }

      return {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status,
        expiresAt: invitation.expiresAt,
        usedAt: invitation.usedAt,
        revokedAt: invitation.revokedAt,
        createdAt: invitation.createdAt,
      };
    });

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public async revokeInvitation(
    invitationId: number,
    adminId: number,
  ) {
    const invitation =
      await this.invitationRepository.findById(invitationId);

    if (!invitation) {
      logger.error("Revoke invitation failed: invitation not found", {
        data: { invitationId, adminId },
      });
      throw new createError.NotFound(
        constant.INVITATION_NOT_FOUND,
      );
    }

    if (invitation.revokedAt) {
      logger.error("Revoke invitation failed: invitation already revoked", {
        data: {
          invitationId,
          email: invitation.email,
          adminId,
          revokedAt: invitation.revokedAt,
        },
      });
      throw new createError.Conflict(
        constant.INVITATION_ALREADY_REVOKED,
      );
    }

    if (invitation.usedAt) {
      logger.error("Revoke invitation failed: invitation already used", {
        data: {
          invitationId,
          email: invitation.email,
          adminId,
          usedAt: invitation.usedAt,
        },
      });
      throw new createError.BadRequest(
        constant.CANNOT_REVOKE_USED_INVITATION,
      );
    }

    const updated = await this.invitationRepository.revokeInvitation(
      invitationId,
      adminId,
    );

    logger.info("Invitation revoked successfully", {
      data: {
        invitationId: updated?.id || invitationId,
        email: updated?.email || invitation.email,
        role: updated?.role || invitation.role,
        adminId,
        revokedAt: updated?.revokedAt,
      },
    });

    return {
      id: updated!.id,
      email: updated!.email,
      role: updated!.role,
      status: InvitationStatus.REVOKED,
      expiresAt: updated!.expiresAt,
      usedAt: updated!.usedAt,
      revokedAt: updated!.revokedAt,
      createdAt: updated!.createdAt,
    };
  }

  public async bulkInviteUsers(
    rows: Array<{
      email: string;
      role: UserRole;
    }>,
    adminId: number,
  ) {
    const results = [];

    for (const row of rows) {
      const email = typeof row.email === "string" ? row.email.trim().toLowerCase() : "";
      const rawRole = typeof row.role === "string" ? (row.role.trim().toUpperCase() as UserRole) : row.role;

      const validation = bulkInviteRowSchema.validate({ email, role: rawRole });
      if (validation.error) {
        logger.error("Bulk invite: invalid row data", {
          data: {
            email: row.email || "",
            role: row.role || "",
            reason: validation.error.details[0]?.message,
            adminId,
          },
        });
        results.push({
          email: row.email || "",
          role: row.role || "",
          status: "FAILED",
          reason: validation.error.details[0]?.message?.replace(/"/g, "") || constant.INVALID_ROW_DATA,
        });
      } else {
        try {
          const invitation = await this.inviteUser(
            email,
            rawRole,
            adminId,
          );

          results.push({
            email,
            role: rawRole,
            status: "INVITED",
            invitation,
          });
        } catch (err) {
          logger.error("Bulk invite: failed to invite user", {
            data: {
              email,
              role: rawRole,
              adminId,
              error: err instanceof Error ? err.message : constant.FAILED_TO_SEND_INVITATION,
            },
          });
          results.push({
            email,
            role: rawRole,
            status: "FAILED",
            reason:
              err instanceof Error
                ? err.message
                : constant.FAILED_TO_SEND_INVITATION,
          });
        }
      }
    }

    const successful = results.filter(
      (result) => result.status === "INVITED",
    ).length;

    const failed = results.filter(
      (result) => result.status === "FAILED",
    ).length;

    logger.info("Bulk invitation process completed", {
      data: {
        adminId,
        total: results.length,
        successful,
        failed,
      },
    });

    return {
      total: results.length,
      successful,
      failed,
      results,
    };
  }
}