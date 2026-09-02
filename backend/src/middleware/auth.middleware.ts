import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "../database/enum/userRole";
import logger from "@core/logger";
import constant from "@config/constant";
import { JWT_SECRET } from "@config/secret";

interface JwtPayload {
  id: number;
  role: UserRole;
}

export class AuthMiddleware {
  public authenticate = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      const token = req.cookies?.accessToken as string | undefined;

      if (!token) {
        logger.error("Authentication failed: missing accessToken cookie", {
          data: { path: req.path, method: req.method },
        });
        res.status(constant.HTTP_STATUS_UNAUTHORIZED).json({
          success: false,
          message: constant.AUTH_TOKEN_REQUIRED,
        });
        return;
      }

      const decoded = jwt.verify(
        token,
        JWT_SECRET as string
      ) as JwtPayload;

      req.user = {
        id: decoded.id,
        role: decoded.role,
      };

      next();
    } catch (error) {
      logger.error("Authentication failed: invalid or expired token", {
        data: { path: req.path, method: req.method, error: (error as Error).message },
      });
      res.status(constant.HTTP_STATUS_UNAUTHORIZED).json({
        success: false,
        message: constant.AUTH_TOKEN_INVALID,
      });
    }
  };
}

