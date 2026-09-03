import { EntityRepository, Repository, UpdateResult } from "typeorm";
import { Patient } from "@database/model/Patient";

@EntityRepository(Patient)
export class PatientRepository extends Repository<Patient> {
  public async findByPatientId(patientId: number): Promise<Patient | undefined> {
    return this.createQueryBuilder("patient")
      .innerJoinAndSelect("patient.user", "user")
      .where("patient.patientId = :patientId", { patientId })
      .andWhere("user.deletedAt IS NULL")
      .getOne();
  }

  public async updateProfile(
    patientId: number,
    updates: Partial<Pick<Patient, "heightCm" | "weightKg">>,
  ): Promise<UpdateResult> {
    return this.createQueryBuilder()
      .update(Patient)
      .set(updates)
      .where("patient_id = :patientId", { patientId })
      .execute();
  }
}
