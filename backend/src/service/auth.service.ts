import bcrypt from "bcrypt";
import createError from "http-errors";
import * as jwt from "jsonwebtoken";
import logger from "@core/logger";
import crypto from "crypto";
import { JWT_SECRET, REFRESH_TOKEN_SECRET, ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN } from "@config/secret";
import { UserRole } from "@database/enum/userRole";
import { AuthRepository } from "@database/repository/auth.repository";
import { InvitationRepository } from "@database/repository/invitation.repository";
import constant from "@config/constant";

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

  public async acceptInvitation(
    token: string,
    firstName: string,
    lastName: string,
    password: string,
  ) {
    // 1. Hash the token supplied by the user
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // 2. Find invitation
    const invitation =
      await this.invitationRepository.findByHashedToken(
        hashedToken,
      );

    if (!invitation) {
      logger.error("Accept invitation failed: invalid invitation token", {
        data: { operation: "acceptInvitation" },
      });
      throw new createError.BadRequest(
        constant.INVALID_INVITATION,
      );
    }

    // 3. Check whether invitation was already used
    if (invitation.usedAt) {
      logger.error("Accept invitation failed: invitation already used", {
        data: { invitationId: invitation.id, email: invitation.email },
      });
      throw new createError.BadRequest(
        constant.INVITATION_ALREADY_USED,
      );
    }

    // 4. Check whether invitation was revoked
    if (invitation.revokedAt) {
      logger.error("Accept invitation failed: invitation revoked", {
        data: { invitationId: invitation.id, email: invitation.email },
      });
      throw new createError.BadRequest(
        constant.INVITATION_REVOKED,
      );
    }

    // 5. Check expiration
    if (invitation.expiresAt <= new Date()) {
      logger.error("Accept invitation failed: invitation expired", {
        data: { invitationId: invitation.id, email: invitation.email, expiresAt: invitation.expiresAt },
      });
      throw new createError.BadRequest(
        constant.INVITATION_EXPIRED,
      );
    }

    // 6. Hash user's password
    const hashedPassword = await bcrypt.hash(
      password,
      12,
    );

    // 7. Create user using invitation's email + role
    const user = await this.authRepository.createUser({
      firstName,
      lastName,
      email: invitation.email,
      hashedPassword,
      role: invitation.role,
    });

    if (invitation.role === UserRole.PATIENT) {
      await this.authRepository.createPatientProfile(user.id);
    }

    if (invitation.role === UserRole.DOCTOR) {
      await this.authRepository.createDoctorProfile(user.id, 0, 0);
    }

    // 8. Mark invitation as used
    await this.invitationRepository.markAsUsed(
      invitation.id,
      user.id,
    );

    logger.info("Invitation accepted: account created successfully", {
      data: {
        userId: user.id,
        email: user.email,
        role: user.role,
        invitationId: invitation.id,
      },
    });

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    };
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