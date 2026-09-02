import createError from "http-errors";
import { getManager } from "typeorm";
import logger from "@core/logger";

import { DoctorRepository, FindAllDoctorsOptions } from "@database/repository/doctor.repository";
import { AppointmentRepository } from "@database/repository/appointment.repository";
import constant from "@config/constant";
import {
    buildISTRangeLiteral,
    ceilToNextMinute,
    DateRangeBounds,
    formatDateIST,
    formatTimeIST,
    getISTCurrentTimeString,
    getISTTodayString,
    parseRangeBounds,
    parseRangeToIST,
} from "@util/dateTimeRange";

// Subtracts a set of busy (already-booked) ranges from a single availability
// window, returning the remaining free sub-ranges (zero, one, or many).
function subtractBusyRanges(
    window: DateRangeBounds,
    busyRanges: DateRangeBounds[],
): DateRangeBounds[] {
    let free = [window];

    for (const busy of busyRanges) {
        const next: DateRangeBounds[] = [];

        for (const seg of free) {
            const noOverlap = busy.end <= seg.start || busy.start >= seg.end;

            if (noOverlap) {
                next.push(seg);
            } else {
                if (busy.start > seg.start) {
                    next.push({ start: seg.start, end: busy.start });
                }
                if (busy.end < seg.end) {
                    next.push({ start: busy.end, end: seg.end });
                }
            }
        }

        free = next;
    }

    return free;
}

// Trims a free segment down to what's still bookable relative to "now":
// drops it entirely if it has already fully elapsed, clamps its start
// forward to "now" if it's only partially elapsed (e.g. a 09:00-17:00
// window at 14:00 becomes 14:00-17:00), and leaves it untouched if it's
// entirely in the future.
function clampSegmentToNow(
    segment: DateRangeBounds,
    now: Date,
): DateRangeBounds | null {
    if (segment.end <= now) {
        return null;
    }
    if (segment.start < now) {
        const clampedStart = ceilToNextMinute(now);
        if (clampedStart >= segment.end) {
            return null;
        }
        return { start: clampedStart, end: segment.end };
    }
    return segment;
}

// Computes the bookable free sub-ranges of a single availability window
// (after removing anything overlapping a busy/booked range), formatted for
// the API, with fully-elapsed portions dropped and partially-elapsed
// portions clamped to "now".
function computeFreeSlotsForAvailability(
    availabilityId: number,
    availabilityTime: string,
    busyRanges: DateRangeBounds[],
    now: Date,
): { id: number; date: string; startTime: string; endTime: string }[] {
    const bounds = parseRangeBounds(availabilityTime);
    if (!bounds) {
        return [];
    }

    const overlappingBusy = busyRanges.filter(
        (busy) => busy.start < bounds.end && busy.end > bounds.start,
    );

    const freeSegments = subtractBusyRanges(bounds, overlappingBusy);

    return freeSegments
        .map((segment) => clampSegmentToNow(segment, now))
        .filter((segment): segment is DateRangeBounds => segment !== null)
        .map((segment) => ({
            id: availabilityId,
            date: formatDateIST(segment.start),
            startTime: formatTimeIST(segment.start),
            endTime: formatTimeIST(segment.end),
        }));
}

export function parseAvailabilityRange(id: number, rangeStr: string) {
    return { id, ...parseRangeToIST(rangeStr) };
}


export class DoctorService {
    private doctorRepository = new DoctorRepository();

    private get appointmentRepository() {
        return getManager().getCustomRepository(
            AppointmentRepository,
        );
    }

    public async createAvailability(
        doctorId: number,
        date: string,
        startTime: string,
        endTime: string,
    ) {
        const today = new Date();
        const todayString = getISTTodayString(today);

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

        if (date === todayString) {
            const currentTime = getISTCurrentTimeString(today);

            if (startTime <= currentTime) {
                throw new createError.BadRequest(
                    constant.AVAILABILITY_TIME_IN_PAST,
                );
            }
        }


        // Ensure doctor record exists in doctors table (foreign key constraint)
        const doctor = await this.doctorRepository.findDoctorById(doctorId);

        if(!doctor) {
            throw new createError.NotFound();
        }

        const availabilityTime = buildISTRangeLiteral(date, startTime, endTime);

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

        const result = availabilities.map((a) =>
            parseAvailabilityRange(a.id, a.availabilityTime),
        );

        logger.info("Doctor own availability fetched successfully", {
            data: {
                doctorId,
                count: result.length,
                date,
            },
        });

        return result;
    }

    public async getDoctors(options: FindAllDoctorsOptions) {
        const result = await this.doctorRepository.findAllDoctors(options);

        const formattedDoctors = result.doctors.map((d) => ({
            id: d.doctorId,
            firstName: d.user?.firstName || "",
            lastName: d.user?.lastName || "",
            specialization: d.specialization?.name || "General Practitioner",
            experienceYears: d.experienceYears || 0,
        }));

        logger.info("Doctors fetched successfully", {
            data: {
                count: formattedDoctors.length,
                total: result.total,
                page: result.page,
                limit: result.limit,
                filters: {
                    search: options.search,
                    specialization: options.specialization,
                    date: options.date,
                },
            },
        });

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

        // Slots already tied to a PENDING/CONFIRMED appointment are unavailable;
        // slots whose appointment was CANCELLED/REJECTED are excluded here since
        // findActiveAppointmentsForDoctor only returns PENDING/CONFIRMED rows,
        // so they naturally become bookable again.
        const activeAppointments =
            await this.appointmentRepository.findActiveAppointmentsForDoctor(
                doctorId,
                date,
            );

        const busyRanges = activeAppointments
            .map((a) => parseRangeBounds(a.appointmentTime))
            .filter((r): r is DateRangeBounds => r !== null);

        const now = new Date();

        const validAvailability = rawAvailabilities.reduce<
            { id: number; date: string; startTime: string; endTime: string }[]
        >(
            (acc, raw) =>
                acc.concat(
                    computeFreeSlotsForAvailability(
                        raw.id,
                        raw.availabilityTime,
                        busyRanges,
                        now,
                    ),
                ),
            [],
        );

        logger.info("Doctor availability fetched successfully", {
            data: {
                doctorId,
                count: validAvailability.length,
                date,
            },
        });

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
            logger.error("Delete availability failed: slot not found or does not belong to doctor", {
                data: { availabilityId, doctorId },
            });
            throw new createError.NotFound(
                constant.AVAILABILITY_NOT_FOUND,
            );
        }

        logger.info("Doctor availability deleted", {
            data: { availabilityId, doctorId },
        });
    }

    public async getSpecializations() {
        const list = await this.doctorRepository.getSpecializations();

        const result = list.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
        }));

        logger.info("Specializations fetched successfully", {
            data: { count: result.length },
        });

        return result;
    }
}