import {
    Request,
    Response,
    NextFunction,
} from "express";

import { PatientService } from "@service/patient.service";
import constant from "@config/constant";

export class PatientController {
    private patientService = new PatientService();

    public getProfile = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const patientId = req.user.id;
            const profile = await this.patientService.getOwnProfile(patientId);

            res.status(constant.HTTP_STATUS_OK).json({
                success: true,
                data: profile,
            });
        } catch (error) {
            next(error);
        }
    };

    public updateProfile = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const patientId = req.user.id;
            const { heightCm, weightKg } = req.body;

            const profile = await this.patientService.updateOwnProfile(
                patientId,
                { heightCm, weightKg },
            );

            res.status(constant.HTTP_STATUS_OK).json({
                success: true,
                data: profile,
            });
        } catch (error) {
            next(error);
        }
    };
}
