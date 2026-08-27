import createError from "http-errors";
import logger from "@core/logger";

import { DoctorRepository, FindAllDoctorsOptions } from "@database/repository/doctor.repository";
import constant from "@config/constant";

export function parseAvailabilityRange(id: number, rangeStr: string) {
    if (!rangeStr) {
        return { id, date: "", startTime: "", endTime: "" };
    }

    // PostgreSQL returns tstzrange as e.g. ["2026-08-28 04:30:00+00","2026-08-28 08:30:00+00")
    // The regex must capture the timezone offset (+00) so Date() can parse UTC correctly.
    const matches = rangeStr.match(
        /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[+-]\d{2}(?::\d{2})?/g,
    );
    if (!matches || matches.length < 2) {
        return { id, date: "", startTime: "", endTime: "" };
    }

    // Normalize to valid ISO 8601: "2026-08-28 04:30:00+00" → "2026-08-28T04:30:00+00:00"
    const toISO = (s: string) => {
        let str = s.replace(" ", "T");
        if (/[+-]\d{2}$/.test(str)) str = str + ":00";
        return str;
    };

    const startDate = new Date(toISO(matches[0]));
    const endDate = new Date(toISO(matches[1]));

    const TZ = "Asia/Kolkata";

    // Date in IST (en-CA gives YYYY-MM-DD format)
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(startDate);

    const getTimeStr = (d: Date) => {
        const parts = new Intl.DateTimeFormat("en-GB", {
            timeZone: TZ,
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
        }).formatToParts(d);
        const h = parts.find((p) => p.type === "hour")?.value ?? "00";
        const m = parts.find((p) => p.type === "minute")?.value ?? "00";
        return `${h}:${m}`;
    };

    return {
        id,
        date,
        startTime: getTimeStr(startDate),
        endTime: getTimeStr(endDate),
    };
}


export class DoctorService {
    private doctorRepository = new DoctorRepository();

    public async createAvailability(
        doctorId: number,
        date: string,
        startTime: string,
        endTime: string,
    ) {
        const today = new Date();

        const todayString =
            new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Kolkata",
            }).format(today);

        if (date < todayString) {
            throw new createError.BadRequest(
                constant.AVAILABILITY_DATE_IN_PAST,
            );
        }

        if (startTime >= endTime) {
            throw new createError.BadRequest(
                constant.INVALID_AVAILABILITY_TIME,
            );
        }

        // Ensure doctor record exists in doctors table (foreign key constraint)
        const doctor = await this.doctorRepository.findDoctorById(doctorId);

        if(!doctor) {
            throw new createError.NotFound();
        }

        const startDateTime = `${date}T${startTime}:00+05:30`;
        const endDateTime = `${date}T${endTime}:00+05:30`;
        const availabilityTime = `[${startDateTime},${endDateTime})`;

        try {
            const availability =
                await this.doctorRepository.createAvailability({
                    doctorId,
                    availabilityTime,
                });

            logger.info(
                "Doctor availability created successfully",
                {
                    data: {
                        doctorId,
                        availabilityId: availability.id,
                        date,
                        startTime,
                        endTime,
                    },
                },
            );

            return {
                id: availability.id,
                doctorId: availability.doctorId,
                date,
                startTime,
                endTime,
                createdAt: availability.createdAt,
            };
        } catch (error: any) {
            if (error?.code === "23P01") {
                logger.error(
                    "Doctor availability overlaps existing availability",
                    {
                        data: {
                            doctorId,
                            date,
                            startTime,
                            endTime,
                        },
                    },
                );

                throw new createError.Conflict(
                    constant.AVAILABILITY_OVERLAP,
                );
            }

            throw error;
        }
    }

    public async getOwnAvailability(doctorId: number, date?: string) {
        const doctor = await this.doctorRepository.findDoctorById(doctorId);
        if (!doctor) {
            throw new createError.NotFound(constant.DOCTOR_NOT_FOUND);
        }
        const availabilities = await this.doctorRepository.findDoctorAvailability(
            doctorId,
            date,
        );

        return availabilities.map((a) =>
            parseAvailabilityRange(a.id, a.availabilityTime),
        );
    }

    public async getDoctors(options: FindAllDoctorsOptions) {
        const result = await this.doctorRepository.findAllDoctors(options);

        const formattedDoctors = result.doctors.map((d) => ({
            id: d.doctorId,
            firstName: d.user?.firstName || "",
            lastName: d.user?.lastName || "",
            email: d.user?.email || "",
            specialization: d.specialization?.name || "General Practitioner",
            experienceYears: d.experienceYears || 0,
        }));

        return {
            doctors: formattedDoctors,
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: result.totalPages,
            },
        };
    }

    public async getDoctorAvailability(doctorId: number, date?: string) {
        const doctor = await this.doctorRepository.findDoctorById(doctorId);

        if (!doctor) {
            throw new createError.NotFound(constant.DOCTOR_NOT_FOUND);
        }

        const rawAvailabilities = await this.doctorRepository.findDoctorAvailability(
            doctorId,
            date,
        );

        const parsed = rawAvailabilities.map((a) =>
            parseAvailabilityRange(a.id, a.availabilityTime),
        );

        // Filter for valid slots (future or today)
        const todayString = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kolkata",
        }).format(new Date());

        const validAvailability = parsed.filter((a) => a.date >= todayString);

        return {
            doctor: {
                id: doctor.doctorId,
                firstName: doctor.user?.firstName || "",
                lastName: doctor.user?.lastName || "",
                specialization: doctor.specialization?.name || "General Practitioner",
                experienceYears: doctor.experienceYears || 0,
            },
            availability: validAvailability,
        };
    }

    public async deleteAvailability(availabilityId: number, doctorId: number) {
        const result = await this.doctorRepository.deleteAvailability(
            availabilityId,
            doctorId,
        );

        if (!result.affected || result.affected === 0) {
            throw new createError.NotFound(
                "Availability slot not found or does not belong to you",
            );
        }

        logger.info("Doctor availability deleted", {
            data: { availabilityId, doctorId },
        });
    }

    public async getSpecializations() {
        const list = await this.doctorRepository.getSpecializations();
        return list.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
        }));
    }
}