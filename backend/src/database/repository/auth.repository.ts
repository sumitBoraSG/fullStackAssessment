import { getManager } from "typeorm";
import { UserRepo } from "@database/repository/user.repository";
import { UserRole } from "@database/enum/userRole";
import { Patient } from "@database/model/Patient";
import { Doctor } from "@database/model/Doctor";
export class AuthRepository {
  private get userRepo() {
    return getManager().getCustomRepository(UserRepo);
  }

  public async findUserForLogin(email: string) {
    return this.userRepo
      .createQueryBuilder("user")
      .where("user.email = :email", {
        email: email.toLowerCase(),
      })
      .andWhere("user.deleted_at IS NULL")
      .getOne();
  }
  public async findUserForRefresh(userId: number) {
    return this.userRepo
      .createQueryBuilder("user")
      .where("user.id = :userId", {
        userId,
      })
      .andWhere("user.deleted_at IS NULL")
      .getOne();
  }
  public async createPatientProfile(patientId: number) {
    const patient = getManager()
        .getRepository(Patient)
        .create({
            patientId,
        });

    return getManager()
        .getRepository(Patient)
        .save(patient);
  }

  public async createDoctorProfile(
    doctorId: number,
    specializationId: number,
    experienceYears: number,
) {
    const doctor = getManager()
        .getRepository(Doctor)
        .create({
            doctorId,
            specializationId,
            experienceYears,
        });

    return getManager()
        .getRepository(Doctor)
        .save(doctor);
}
  public async createUser(data: {
    firstName: string;
    lastName: string;
    email: string;
    hashedPassword: string;
    role: UserRole;
  }) {
    const user = this.userRepo.create({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email.toLowerCase(),
      hashedPassword: data.hashedPassword,
      role: data.role,
    });

    return this.userRepo.save(user);
  }
}