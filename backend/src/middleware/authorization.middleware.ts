import { Request, Response, NextFunction } from "express";
import { UserRole } from "../database/enum/userRole";
import logger from "@core/logger";
import constant from "@config/constant";

export class AuthorizationMiddleware {
  public authorize = (...allowedRoles: UserRole[]) => {
    return (
      req: Request,
      res: Response,
      next: NextFunction
    ): void => {
      if (!req.user) {
        logger.error("Authorization failed: user not authenticated", {
          data: { path: req.path, method: req.method },
        });
        res.status(constant.HTTP_STATUS_UNAUTHORIZED).json({
          success: false,
          message: constant.USER_NOT_AUTHENTICATED,
        });
        return;
      }

      if (!allowedRoles.includes(req.user.role)) {
        logger.error("Authorization failed: insufficient permissions", {
          data: {
            userId: req.user.id,
            role: req.user.role,
            requiredRoles: allowedRoles,
            path: req.path,
            method: req.method,
          },
        });
        res.status(constant.HTTP_STATUS_FORBIDDEN).json({
          success: false,
          message: constant.ACCESS_FORBIDDEN,
        });
        return;
      }

      next();
    };
  };
}

