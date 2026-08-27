import { getManager,EntityRepository, Repository } from "typeorm";
import { DoctorAvailabilityRepo } from "@database/repository/doctor-availability.repository";
import { Doctor } from "@database/model/Doctor";
import { Specialization } from "@database/model/Specialization";

export interface FindAllDoctorsOptions {
    search?: string;
    specialization?: string;
    date?: string;
    page?: number;
    limit?: number;
}
@EntityRepository(Doctor)
export class DoctorRepository extends Repository<Doctor> {
    private get doctorAvailabilityRepo() {
        return getManager().getCustomRepository(
            DoctorAvailabilityRepo,
        );
    }

    private get doctorRepo() {
        return getManager().getRepository(Doctor);
    }

    private get specializationRepo() {
        return getManager().getRepository(Specialization);
    }

    public async ensureDoctorProfile(doctorId: number) {
        const manager = getManager();
        await manager.query(
            `INSERT INTO doctors (doctor_id, specialization_id, experience_years) 
             VALUES ($1, 1, 1) 
             ON CONFLICT (doctor_id) DO NOTHING`,
            [doctorId],
        );
    }

    public async createAvailability(data: {
        doctorId: number;
        availabilityTime: string;
    }) {
        const availability =
            this.doctorAvailabilityRepo.create({
                doctorId: data.doctorId,
                availabilityTime: data.availabilityTime,
            });

        return this.doctorAvailabilityRepo.save(
            availability,
        );
    }

    public async findDoctorAvailability(doctorId: number, date?: string) {
        const query = this.doctorAvailabilityRepo
            .createQueryBuilder("availability")
            .where("availability.doctorId = :doctorId", { doctorId });

        if (date && date.trim()) {
            const startOfDay = `${date.trim()}T00:00:00+05:30`;
            const endOfDay = `${date.trim()}T23:59:59+05:30`;
            query.andWhere(
                "availability.availabilityTime && tstzrange(:startOfDay, :endOfDay, '[]')",
                { startOfDay, endOfDay },
            );
        }

        return query.orderBy("availability.createdAt", "DESC").getMany();
    }

    public async findAllDoctors(options: FindAllDoctorsOptions = {}) {
        const page = options.page && options.page > 0 ? options.page : 1;
        const limit = options.limit && options.limit > 0 ? options.limit : 10;
        const skip = (page - 1) * limit;

        const query = this.doctorRepo
            .createQueryBuilder("doctor")
            .innerJoinAndSelect("doctor.user", "user")
            .leftJoinAndSelect("doctor.specialization", "specialization")
            .where("user.deletedAt IS NULL");

        if (options.search && options.search.trim()) {
            const searchPattern = `%${options.search.trim().toLowerCase()}%`;
            query.andWhere(
                "(LOWER(user.firstName) LIKE :search OR LOWER(user.lastName) LIKE :search OR LOWER(CONCAT(user.firstName, ' ', user.lastName)) LIKE :search)",
                { search: searchPattern },
            );
        }

        if (options.specialization && options.specialization.trim()) {
            const specTerm = options.specialization.trim();
            if (!isNaN(Number(specTerm))) {
                query.andWhere("specialization.id = :specId", {
                    specId: Number(specTerm),
                });
            } else {
                query.andWhere("LOWER(specialization.name) LIKE :specName", {
                    specName: `%${specTerm.toLowerCase()}%`,
                });
            }
        }

        if (options.date && options.date.trim()) {
            const dateStr = options.date.trim();
            const startOfDay = `${dateStr}T00:00:00+05:30`;
            const endOfDay = `${dateStr}T23:59:59+05:30`;

            query.andWhere((qb) => {
                const subQuery = qb
                    .subQuery()
                    .select("da.doctorId")
                    .from("doctor_availabilities", "da")
                    .where(
                        "da.availability_time && tstzrange(:startOfDay, :endOfDay, '[]')",
                        { startOfDay, endOfDay },
                    )
                    .getQuery();
                return `doctor.doctorId IN ${subQuery}`;
            });
        }

        const [doctors, total] = await query
            .orderBy("user.firstName", "ASC")
            .skip(skip)
            .take(limit)
            .getManyAndCount();

        return {
            doctors,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1,
        };
    }

    public async findDoctorById(doctorId: number) {
        return this.doctorRepo
            .createQueryBuilder("doctor")
            .innerJoinAndSelect("doctor.user", "user")
            .leftJoinAndSelect("doctor.specialization", "specialization")
            .where("doctor.doctorId = :doctorId", { doctorId })
            .andWhere("user.deletedAt IS NULL")
            .getOne();
    }

    public async deleteAvailability(availabilityId: number, doctorId: number) {
        return this.doctorAvailabilityRepo.delete({
            id: availabilityId,
            doctorId,
        });
    }

    public async getSpecializations() {
        return this.specializationRepo.find({
            order: { name: "ASC" },
        });
    }
}