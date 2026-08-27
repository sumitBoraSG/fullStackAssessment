import { Request, Response, NextFunction } from "express";
import { AuthService } from "@service/auth.service";
import constant from "@config/constant";
import { ENVIRONMENT } from "@config/secret";

const IS_PRODUCTION = ENVIRONMENT === "production";

const ACCESS_COOKIE_NAME = "accessToken";
const REFRESH_COOKIE_NAME = "refreshToken";

export class AuthController {
  private authService: AuthService = new AuthService();

  public login = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { email, password } = req.body;

      const {
        accessToken,
        refreshToken,
        accessTokenMaxAge,
        refreshTokenMaxAge,
        user,
      } = await this.authService.login(email, password);

      // Set access token as HttpOnly cookie
      res.cookie(ACCESS_COOKIE_NAME, accessToken, {
        httpOnly: true,
        secure: IS_PRODUCTION,
        sameSite: "lax",
        maxAge: accessTokenMaxAge,
        path: "/",
      });

      // Set refresh token as HttpOnly cookie
      res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
        httpOnly: true,
        secure: IS_PRODUCTION,
        sameSite: "lax",
        maxAge: refreshTokenMaxAge,
        path: "/",
      });

      res.status(constant.HTTP_STATUS_OK).json({
        success: true,
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  };

  public acceptInvitation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const {
        token,
        firstName,
        lastName,
        password,
      } = req.body;

      const result =
        await this.authService.acceptInvitation(
          token,
          firstName,
          lastName,
          password,
        );

      const response = {
        success: true,
        message:
          constant.ACCOUNT_CREATED_SUCCESSFULLY,
        data: result,
      };

      res
        .status(constant.HTTP_STATUS_CREATED)
        .json(response);
    } catch (error) {
      next(error);
    }
  };

  public refresh = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;

      if (!refreshToken) {
        res.status(constant.HTTP_STATUS_UNAUTHORIZED).json({
          success: false,
          message: constant.INVALID_REFRESH_TOKEN,
        });
        return;
      }

      const { accessToken, maxAge } = await this.authService.refresh(refreshToken);

      // Set new access token cookie
      res.cookie(ACCESS_COOKIE_NAME, accessToken, {
        httpOnly: true,
        secure: IS_PRODUCTION,
        sameSite: "lax",
        maxAge,
        path: "/",
      });

      res.status(constant.HTTP_STATUS_OK).json({ success: true });
    } catch (error) {
      next(error);
    }
  };

  public logout = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // Clear both cookies — same options as when they were set
      res.clearCookie(ACCESS_COOKIE_NAME, {
        httpOnly: true,
        secure: IS_PRODUCTION,
        sameSite: "lax",
        path: "/",
      });

      res.clearCookie(REFRESH_COOKIE_NAME, {
        httpOnly: true,
        secure: IS_PRODUCTION,
        sameSite: "lax",
        path: "/",
      });

      res.status(constant.HTTP_STATUS_OK).json({ success: true });
    } catch (error) {
      next(error);
    }
  };
}
