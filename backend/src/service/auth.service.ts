import bcrypt from "bcrypt";
import createError from "http-errors";
import * as jwt from "jsonwebtoken";
import { EntityManager, getManager } from "typeorm";
import logger from "@core/logger";
import crypto from "crypto";
import { JWT_SECRET, REFRESH_TOKEN_SECRET, ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN } from "@config/secret";
import { UserRole } from "@database/enum/userRole";
import { BloodGroup } from "@database/enum/BloodGroup";
import { AuthRepository } from "@database/repository/auth.repository";
import { InvitationRepository } from "@database/repository/invitation.repository";
import { DoctorRepository } from "@database/repository/doctor.repository";
import { UserInvitation } from "@database/model/UserInvitation";
import constant from "@config/constant";

export interface AcceptInvitationProfileData {
  specializationId?: number;
  experienceYears?: number;
  dob?: string;
  heightCm?: number;
  weightKg?: number;
  bloodGroup?: BloodGroup;
}

/**
 * Converts a JWT duration string (e.g. "7d", "15m", "3600") to milliseconds.
 * Used to derive cookie maxAge from the same env vars as the JWT expiry.
 */
function parseDurationToMs(duration: string | undefined): number {
  if (!duration) return 15 * 60 * 1000; // fallback: 15 minutes
  const str = String(duration).trim();
  const num = parseFloat(str);
  if (str.endsWith("d")) return num * 24 * 60 * 60 * 1000;
  if (str.endsWith("h")) return num * 60 * 60 * 1000;
  if (str.endsWith("m")) return num * 60 * 1000;
  if (str.endsWith("s")) return num * 1000;
  // Plain number: treat as seconds (JWT default)
  return num * 1000;
}

interface LoginServiceResult {
  accessToken: string;
  refreshToken: string;
  accessTokenMaxAge: number;
  refreshTokenMaxAge: number;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
  };
}

export class AuthService {
  private authRepository = new AuthRepository();
  private invitationRepository = new InvitationRepository();

  public async login(
    email: string,
    password: string,
  ): Promise<LoginServiceResult> {
    const user = await this.authRepository.findUserForLogin(email);

    const credentialsAreValid =
      user !== undefined &&
      (await bcrypt.compare(password, user.hashedPassword));

    if (!credentialsAreValid || !user) {
      logger.error("Login failed: invalid credentials", {
        data: { email },
      });
      throw new createError.Unauthorized(constant.INVALID_CREDENTIALS);
    }

    const accessToken = jwt.sign(
      {
        id: user.id,
        role: user.role,
      },
      JWT_SECRET,
      {
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      },
    );
    const refreshToken = jwt.sign(
      {
        id: user.id,
        type: "refresh",
      },
      REFRESH_TOKEN_SECRET,
      {
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      },
    );

    logger.info("Login successful", {
      data: {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
    });

    return {
      accessToken,
      refreshToken,
      accessTokenMaxAge: parseDurationToMs(ACCESS_TOKEN_EXPIRES_IN),
      refreshTokenMaxAge: parseDurationToMs(REFRESH_TOKEN_EXPIRES_IN),
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Read-only lookup used by the frontend to learn an invitation's role
   * before rendering role-specific signup fields. Same validity checks as
   * acceptInvitation, but never consumes the invitation.
   */
  public async getInvitationDetails(token: string) {
    const invitation = await this.loadAndValidateInvitation(token);

    return {
      email: invitation.email,
      role: invitation.role,
    };
  }

  public async acceptInvitation(
    token: string,
    firstName: string,
    lastName: string,
    password: string,
    profile: AcceptInvitationProfileData,
  ) {
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const hashedPassword = await bcrypt.hash(password, 12);

    const doctorRepository = new DoctorRepository();

    return getManager().transaction(async (manager) => {
      // Lock the invitation row so a concurrent accept-invitation call on
      // the same token waits for this transaction to finish, then observes
      // usedAt already set instead of racing to create a second user.
      const invitation =
        await this.invitationRepository.findByHashedTokenForUpdate(
          hashedToken,
          manager,
        );

      this.assertInvitationIsValid(invitation);

      // TypeScript narrowing: assertInvitationIsValid throws if invalid.
      const validInvitation = invitation as UserInvitation;

      // Role never comes from the client — always from the validated
      // invitation record looked up server-side.
      if (validInvitation.role === UserRole.DOCTOR) {
        await this.validateDoctorProfileData(profile, doctorRepository, manager);
      } else if (validInvitation.role === UserRole.PATIENT) {
        this.validatePatientProfileData(profile);
      }

      const user = await this.authRepository.createUser(
        {
          firstName,
          lastName,
          email: validInvitation.email,
          hashedPassword,
          role: validInvitation.role,
        },
        manager,
      );

      if (validInvitation.role === UserRole.PATIENT) {
        await this.authRepository.createPatientProfile(
          user.id,
          {
            dob: profile.dob as string,
            heightCm: profile.heightCm as number,
            weightKg: profile.weightKg as number,
            bloodGroup: profile.bloodGroup as BloodGroup,
          },
          manager,
        );
      }

      if (validInvitation.role === UserRole.DOCTOR) {
        await this.authRepository.createDoctorProfile(
          user.id,
          profile.specializationId as number,
          profile.experienceYears as number,
          manager,
        );
      }

      await this.invitationRepository.markAsUsed(
        validInvitation.id,
        user.id,
        manager,
      );

      logger.info("Invitation accepted: account created successfully", {
        data: {
          userId: user.id,
          email: user.email,
          role: user.role,
          invitationId: validInvitation.id,
        },
      });

      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      };
    });
  }

  private async loadAndValidateInvitation(token: string): Promise<UserInvitation> {
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const invitation = await this.invitationRepository.findByHashedToken(
      hashedToken,
    );

    this.assertInvitationIsValid(invitation);

    return invitation as UserInvitation;
  }

  private assertInvitationIsValid(
    invitation: UserInvitation | undefined,
  ): void {
    if (!invitation) {
      logger.error("Accept invitation failed: invalid invitation token", {
        data: { operation: "acceptInvitation" },
      });
      throw new createError.BadRequest(constant.INVALID_INVITATION);
    }

    if (invitation.usedAt) {
      logger.error("Accept invitation failed: invitation already used", {
        data: { invitationId: invitation.id, email: invitation.email },
      });
      throw new createError.BadRequest(constant.INVITATION_ALREADY_USED);
    }

    if (invitation.revokedAt) {
      logger.error("Accept invitation failed: invitation revoked", {
        data: { invitationId: invitation.id, email: invitation.email },
      });
      throw new createError.BadRequest(constant.INVITATION_REVOKED);
    }

    if (invitation.expiresAt <= new Date()) {
      logger.error("Accept invitation failed: invitation expired", {
        data: {
          invitationId: invitation.id,
          email: invitation.email,
          expiresAt: invitation.expiresAt,
        },
      });
      throw new createError.BadRequest(constant.INVITATION_EXPIRED);
    }
  }

  private async validateDoctorProfileData(
    profile: AcceptInvitationProfileData,
    doctorRepository: DoctorRepository,
    manager: EntityManager,
  ): Promise<void> {
    if (profile.specializationId === undefined) {
      throw new createError.BadRequest(constant.SPECIALIZATION_ID_REQUIRED);
    }

    if (profile.experienceYears === undefined) {
      throw new createError.BadRequest(constant.EXPERIENCE_YEARS_REQUIRED);
    }

    const specialization = await doctorRepository.findSpecializationById(
      profile.specializationId,
      manager,
    );

    if (!specialization) {
      throw new createError.BadRequest(constant.INVALID_SPECIALIZATION);
    }
  }

  private validatePatientProfileData(profile: AcceptInvitationProfileData): void {
    if (!profile.dob) {
      throw new createError.BadRequest(constant.DOB_REQUIRED);
    }

    const todayString = new Date().toISOString().slice(0, 10);
    if (profile.dob >= todayString || profile.dob < "1900-01-01") {
      throw new createError.BadRequest(constant.INVALID_DOB);
    }

    if (profile.heightCm === undefined) {
      throw new createError.BadRequest(constant.HEIGHT_REQUIRED);
    }

    if (profile.weightKg === undefined) {
      throw new createError.BadRequest(constant.WEIGHT_REQUIRED);
    }

    if (!profile.bloodGroup) {
      throw new createError.BadRequest(constant.BLOOD_GROUP_REQUIRED);
    }

    if (!Object.values(BloodGroup).includes(profile.bloodGroup)) {
      throw new createError.BadRequest(constant.INVALID_BLOOD_GROUP);
    }
  }
  public async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; maxAge: number }> {
    try {
      const decoded = jwt.verify(
        refreshToken,
        REFRESH_TOKEN_SECRET,
      ) as jwt.JwtPayload & {
        id: number;
        type: string;
      };

      if (!decoded.id || decoded.type !== "refresh") {
        throw new createError.Unauthorized(
          constant.INVALID_REFRESH_TOKEN,
        );
      }

      const user =
        await this.authRepository.findUserForRefresh(
          decoded.id,
        );

      if (!user) {
        throw new createError.Unauthorized(
          constant.INVALID_REFRESH_TOKEN,
        );
      }

      const accessToken = jwt.sign(
        {
          id: user.id,
          role: user.role,
        },
        JWT_SECRET,
        {
          expiresIn: ACCESS_TOKEN_EXPIRES_IN,
        },
      );

      logger.info("Access token refreshed", {
        data: {
          userId: user.id,
        },
      });

      return {
        accessToken,
        maxAge: parseDurationToMs(ACCESS_TOKEN_EXPIRES_IN),
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new createError.Unauthorized(
          constant.REFRESH_TOKEN_EXPIRED,
        );
      }

      if (error instanceof jwt.JsonWebTokenError) {
        throw new createError.Unauthorized(
          constant.INVALID_REFRESH_TOKEN,
        );
      }

      throw error;
    }
  }
}