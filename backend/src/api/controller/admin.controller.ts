import { Request, Response, NextFunction } from "express";
import { parse } from "csv-parse/sync";
import { AdminService } from "@service/admin.service";
import createError from "http-errors";
import { UserRole } from "@database/enum/userRole";
import { InvitationStatus } from "../../types/invitationStatus";
import constant from "@config/constant";


export class AdminController {
  private adminService: AdminService = new AdminService();

  public inviteUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { email, role } = req.body;

      const result = await this.adminService.inviteUser(
        email,
        role,
        req.user!.id,
      );

      res.status(constant.HTTP_STATUS_CREATED).json({
        success: true,
        message: constant.INVITATION_SENT,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public getAllInvitations = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const search = req.query.search ? String(req.query.search).trim() : undefined;
      const status = req.query.status as InvitationStatus | undefined;
      const role = req.query.role as UserRole | undefined;

      const result =
        await this.adminService.getAllInvitations({
          page,
          limit,
          search,
          status,
          role,
        });

      res.status(constant.HTTP_STATUS_OK).json({
        success: true,
        message: constant.INVITATIONS_FETCHED,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  public bulkInviteUsers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const file = (req as Request & { file?: { buffer: Buffer } }).file;

      if (!file) {
        throw new createError.BadRequest(
          constant.CSV_FILE_REQUIRED,
        );
      }

      const csvContent =
        file.buffer.toString("utf-8");

      const rows = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as {
        email: string;
        role: UserRole;
      }[];

      if (rows.length > constant.MAX_BULK_INVITE_ROWS) {
        throw new createError.BadRequest(
          constant.CSV_ROW_LIMIT_EXCEEDED,
        );
      }

      const result =
        await this.adminService.bulkInviteUsers(
          rows,
          req.user!.id,
        );

      res.status(constant.HTTP_STATUS_OK).json({
        success: true,
        message: constant.BULK_INVITATION_COMPLETED,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public revokeInvitation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const invitationId = Number(req.params.id);

      const result = await this.adminService.revokeInvitation(
        invitationId,
        req.user!.id,
      );

      res.status(constant.HTTP_STATUS_OK).json({
        success: true,
        message: constant.INVITATION_REVOKED_SUCCESSFULLY,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}