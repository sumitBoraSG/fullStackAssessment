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
}