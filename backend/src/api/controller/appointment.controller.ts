import {
    Request,
    Response,
    NextFunction,
} from "express";

import { AppointmentService } from "@service/appointment.service";
import constant from "@config/constant";

export class AppointmentController {
    private appointmentService = new AppointmentService();

    public createAppointment = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const {
                doctorId,
                date,
                startTime,
                endTime,
            } = req.body;

            const patientId = req.user.id;

            const appointment =
                await this.appointmentService.createAppointment(
                    patientId,
                    doctorId,
                    date,
                    startTime,
                    endTime,
                );

            res
                .status(constant.HTTP_STATUS_CREATED)
                .json({
                    success: true,
                    data: appointment,
                });
        } catch (error) {
            next(error);
        }
    };

    public getPatientAppointments = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const patientId = req.user.id;

            const result =
                await this.appointmentService.getPatientAppointments(
                    patientId,
                    {
                        page: req.query.page
                            ? Number(req.query.page)
                            : undefined,
                        limit: req.query.limit
                            ? Number(req.query.limit)
                            : undefined,
                        status: req.query.status as
                            | import("@database/enum/AppointmentStatus").AppointmentStatus
                            | undefined,
                        date: req.query.date
                            ? String(req.query.date)
                            : undefined,
                        dateFrom: req.query.dateFrom
                            ? String(req.query.dateFrom)
                            : undefined,
                        dateTo: req.query.dateTo
                            ? String(req.query.dateTo)
                            : undefined,
                        doctorId: req.query.doctorId
                            ? Number(req.query.doctorId)
                            : undefined,
                        sortBy: req.query.sortBy as
                            | "appointmentTime"
                            | "createdAt"
                            | "updatedAt"
                            | undefined,
                        order: req.query.order as
                            | "ASC"
                            | "DESC"
                            | undefined,
                    },
                );

            res.status(constant.HTTP_STATUS_OK).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    public getDoctorAppointments = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const doctorId = req.user.id;

            const result =
                await this.appointmentService.getDoctorAppointments(
                    doctorId,
                    {
                        page: req.query.page
                            ? Number(req.query.page)
                            : undefined,
                        limit: req.query.limit
                            ? Number(req.query.limit)
                            : undefined,
                        status: req.query.status as
                            | import("@database/enum/AppointmentStatus").AppointmentStatus
                            | undefined,
                        date: req.query.date
                            ? String(req.query.date)
                            : undefined,
                        dateFrom: req.query.dateFrom
                            ? String(req.query.dateFrom)
                            : undefined,
                        dateTo: req.query.dateTo
                            ? String(req.query.dateTo)
                            : undefined,
                        patientId: req.query.patientId
                            ? Number(req.query.patientId)
                            : undefined,
                        sortBy: req.query.sortBy as
                            | "appointmentTime"
                            | "createdAt"
                            | "updatedAt"
                            | undefined,
                        order: req.query.order as
                            | "ASC"
                            | "DESC"
                            | undefined,
                    },
                );

            res.status(constant.HTTP_STATUS_OK).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    public updateAppointmentStatus = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const appointmentId = Number(req.params.appointmentId);
            const doctorId = req.user.id;
            const { status } = req.body;

            const appointment =
                await this.appointmentService.updateAppointmentStatus(
                    appointmentId,
                    doctorId,
                    status,
                );

            res.status(constant.HTTP_STATUS_OK).json({
                success: true,
                data: appointment,
            });
        } catch (error) {
            next(error);
        }
    };

    public cancelAppointment = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const appointmentId = Number(req.params.appointmentId);
            const patientId = req.user.id;
            const { status } = req.body;

            const appointment =
                await this.appointmentService.cancelAppointment(
                    appointmentId,
                    patientId,
                    status,
                );

            res.status(constant.HTTP_STATUS_OK).json({
                success: true,
                data: appointment,
            });
        } catch (error) {
            next(error);
        }
    };
}
