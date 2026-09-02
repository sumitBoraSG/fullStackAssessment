import { EntityManager, getManager } from "typeorm";
import { UserRepo } from "@database/repository/user.repository";
import { UserRole } from "@database/enum/userRole";
import { Patient } from "@database/model/Patient";
import { Doctor } from "@database/model/Doctor";
import { BloodGroup } from "@database/enum/BloodGroup";
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
  public async createPatientProfile(
    patientId: number,
    profile: {
      dob: string;
      heightCm: number;
      weightKg: number;
      bloodGroup: BloodGroup;
    },
    manager: EntityManager = getManager(),
  ) {
    const repo = manager.getRepository(Patient);
    const patient = repo.create({
      patientId,
      dob: profile.dob,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      bloodGroup: profile.bloodGroup,
    });

    return repo.save(patient);
  }

  public async createDoctorProfile(
    doctorId: number,
    specializationId: number,
    experienceYears: number,
    manager: EntityManager = getManager(),
  ) {
    const repo = manager.getRepository(Doctor);
    const doctor = repo.create({
      doctorId,
      specializationId,
      experienceYears,
    });

    return repo.save(doctor);
  }
  public async createUser(
    data: {
      firstName: string;
      lastName: string;
      email: string;
      hashedPassword: string;
      role: UserRole;
    },
    manager: EntityManager = getManager(),
  ) {
    const repo = manager.getCustomRepository(UserRepo);
    const user = repo.create({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email.toLowerCase(),
      hashedPassword: data.hashedPassword,
      role: data.role,
    });

    return repo.save(user);
  }
}