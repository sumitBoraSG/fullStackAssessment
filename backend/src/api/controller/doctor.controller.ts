import {
    Request,
    Response,
    NextFunction,
} from "express";

import { DoctorService } from "@service/doctor.service";
import constant from "@config/constant";

export class DoctorController {
    private doctorService = new DoctorService();

    public createAvailability = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const {
                date,
                startTime,
                endTime,
            } = req.body;

            const doctorId = req.user.id;

            const availability =
                await this.doctorService.createAvailability(
                    doctorId,
                    date,
                    startTime,
                    endTime,
                );

            res
                .status(constant.HTTP_STATUS_CREATED)
                .json({
                    success: true,
                    data: availability,
                });
        } catch (error) {
            next(error);
        }
    };

    public getOwnAvailability = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const doctorId = req.user.id;
            const date = req.query.date as string | undefined;

            const availability = await this.doctorService.getOwnAvailability(
                doctorId,
                date,
            );

            res.status(constant.HTTP_STATUS_OK).json({
                success: true,
                data: availability,
            });
        } catch (error) {
            next(error);
        }
    };

    public getDoctors = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const search = req.query.search as string | undefined;
            const specialization = req.query.specialization as string | undefined;
            const date = req.query.date as string | undefined;
            const page = req.query.page ? Number(req.query.page) : 1;
            const limit = req.query.limit ? Number(req.query.limit) : 10;

            const result = await this.doctorService.getDoctors({
                search,
                specialization,
                date,
                page,
                limit,
            });

            res.status(constant.HTTP_STATUS_OK).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    public getDoctorAvailability = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const doctorId = Number(req.params.doctorId);
            const date = req.query.date as string | undefined;

            const result = await this.doctorService.getDoctorAvailability(
                doctorId,
                date,
            );

            res.status(constant.HTTP_STATUS_OK).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    public getSpecializations = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const specializations = await this.doctorService.getSpecializations();
            res.status(constant.HTTP_STATUS_OK).json({
                success: true,
                data: specializations,
            });
        } catch (error) {
            next(error);
        }
    };
}