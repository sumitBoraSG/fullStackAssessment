import bcrypt from "bcrypt";
import createError from "http-errors";
import * as jwt from "jsonwebtoken";
import { EntityManager, getManager } from "typeorm";
import logger from "@core/logger";
import crypto from "crypto";
import { JWT_SECRET, REFRESH_TOKEN_SECRET, ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN } from "@config/secret";
import { UserRole } from "@database/enum/userRole";
import { BloodGroup } from "@database/enum/BloodGroup";
import { InvitationSource } from "@database/enum/invitationSource";
import { AuthRepository } from "@database/repository/auth.repository";
import { InvitationRepository } from "@database/repository/invitation.repository";
import { DoctorRepository } from "@database/repository/doctor.repository";
import { UserInvitation } from "@database/model/UserInvitation";
import { EmailService } from "@service/email/email.service";
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
  private emailService = new EmailService();

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

  /**
   * Public, unauthenticated entry point for a patient-initiated signup.
   * Deliberately never throws/returns a distinguishable result for "account
   * already exists" or "an invitation is already active": the controller
   * always sends back the same generic success response, so this method
   * must resolve identically (silently) for those cases as it does after
   * actually creating and emailing a new invitation. This is the
   * enumeration-safety property the whole endpoint depends on.
   */
  public async requestPatientSelfRegistration(email: string): Promise<void> {
    const trimmedEmail = email ? email.trim().toLowerCase() : "";

    const existingUser = await this.authRepository.findUserForLogin(trimmedEmail);

    if (existingUser) {
      logger.info("Patient self-registration ignored: account already exists", {
        data: { email: trimmedEmail },
      });
      return;
    }

    const existingInvitation = await this.invitationRepository.findActiveInvitation(trimmedEmail);

    if (existingInvitation) {
      logger.info("Patient self-registration ignored: an invitation is already active for this email", {
        data: { email: trimmedEmail, existingInvitationId: existingInvitation.id },
      });
      return;
    }

    const invitationToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(invitationToken)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const invitation = await this.createSelfRegistrationInvitation(
      trimmedEmail,
      hashedToken,
      expiresAt,
    );

    if (!invitation) {
      // Lost a concurrent race against another request for the same email
      // (or hit an unexpected DB error), no-op, same as the branches above.
      return;
    }

    try {
      await this.emailService.sendInvitationEmail(
        trimmedEmail,
        UserRole.PATIENT,
        invitationToken,
        InvitationSource.PATIENT_SELF_REGISTRATION,
      );
    } catch (emailError) {
      logger.error("Patient self-registration: failed to send verification email", {
        data: {
          invitationId: invitation.id,
          email: trimmedEmail,
          error: (emailError as Error).message,
        },
      });

      await this.invitationRepository.deleteInvitation(invitation.id);
      return;
    }

    logger.info("Patient self-registration invitation created and email sent", {
      data: {
        invitationId: invitation.id,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
      },
    });
  }

  /**
   * Race-safe insert mirroring AdminService's createInvitationRaceProof
   * (kept as a separate copy rather than a shared helper, so AdminService's
   * already-tested invite flow is left untouched). On an unresolvable
   * conflict, returns null rather than throwing, so the caller can treat it
   * as a silent no-op instead of surfacing a distinguishable failure.
   */
  private async createSelfRegistrationInvitation(
    email: string,
    hashedToken: string,
    expiresAt: Date,
    alreadyRetried = false,
  ): Promise<UserInvitation | null> {
    try {
      return await this.invitationRepository.createInvitation(
        email,
        UserRole.PATIENT,
        hashedToken,
        expiresAt,
        null,
        InvitationSource.PATIENT_SELF_REGISTRATION,
      );
    } catch (err: any) {
      // Only a unique-violation on the partial active-invitation index is
      // an expected "lost the race" outcome that should resolve to a
      // silent no-op. Anything else (a truncation error, a dropped
      // connection, ...) is a genuine failure and must propagate, not be
      // masked as if the request had quietly succeeded.
      if (err?.code !== "23505") {
        throw err;
      }

      if (alreadyRetried) {
        return null;
      }

      const conflicting = await this.invitationRepository.findActiveInvitation(email);

      if (conflicting && conflicting.expiresAt <= new Date()) {
        await this.invitationRepository.revokeInvitation(conflicting.id, null);

        return this.createSelfRegistrationInvitation(
          email,
          hashedToken,
          expiresAt,
          true,
        );
      }

      return null;
    }
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