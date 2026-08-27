import express from "express";

import { AdminController } from "@api/controller/admin.controller";

import { inviteUserSchema } from "@api/validator/inviteUser.validator";
import { getInvitationsQuerySchema } from "@api/validator/getInvitations.validator";
import { revokeInvitationParamsSchema } from "@api/validator/revokeInvitation.validator";
import { uploadCsv } from "@middleware/upload.middleware";

import { HttpRequestValidator } from "@middleware/http-request-validator";
import {AuthMiddleware} from "@middleware/auth.middleware";
import {AuthorizationMiddleware} from "@middleware/authorization.middleware";
import { RateLimitMiddleware } from "@middleware/rateLimiter.middleware";
import { UserRole } from "@database/enum/userRole";

class AdminRoute {
  public router: express.Router = express.Router();

  private adminController: AdminController = new AdminController();

  private requestValidator: HttpRequestValidator =
    new HttpRequestValidator();

  private rateLimitMiddleware: RateLimitMiddleware =
  new RateLimitMiddleware();

  private authMiddleware: AuthMiddleware =
    new AuthMiddleware();

  private authorizationMiddleware: AuthorizationMiddleware =
    new AuthorizationMiddleware();

  
  constructor() {
    this.router.post(
      "/invite",
      this.rateLimitMiddleware.invitation,
      this.requestValidator.validate("body", inviteUserSchema),
      this.authMiddleware.authenticate,
      this.authorizationMiddleware.authorize(UserRole.ADMIN),
      this.adminController.inviteUser,
    );

    this.router.get(
      "/invitations",
      this.requestValidator.validate("query", getInvitationsQuerySchema),
      this.authMiddleware.authenticate,
      this.authorizationMiddleware.authorize(
        UserRole.ADMIN,
      ),
      this.adminController.getAllInvitations,
    );

    this.router.post(
      "/invitations/:id/revoke",
      this.requestValidator.validate("params", revokeInvitationParamsSchema),
      this.authMiddleware.authenticate,
      this.authorizationMiddleware.authorize(
        UserRole.ADMIN,
      ),
      this.adminController.revokeInvitation,
    );

    this.router.post(
      "/invitations/bulk",
      
      
      this.rateLimitMiddleware.invitation,
      uploadCsv,

      this.authMiddleware.authenticate,

      this.authorizationMiddleware.authorize(
        UserRole.ADMIN,
      ),

      this.adminController.bulkInviteUsers,
    );
  }
}

export default new AdminRoute().router;