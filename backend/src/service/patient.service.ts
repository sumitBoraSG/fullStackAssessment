import { getManager } from "typeorm";
import createError from "http-errors";
import logger from "@core/logger";
import { PatientRepository } from "@database/repository/patient.repository";
import { Patient } from "@database/model/Patient";
import constant from "@config/constant";

export interface UpdatePatientProfileInput {
  heightCm?: number;
  weightKg?: number;
}

export class PatientService {
  private get patientRepository() {
    return getManager().getCustomRepository(PatientRepository);
  }

  public async getOwnProfile(patientId: number) {
    const patient = await this.patientRepository.findByPatientId(patientId);
    if (!patient) {
      throw new createError.NotFound(constant.PATIENT_NOT_FOUND);
    }
    return this.toProfileResponse(patient);
  }

  public async updateOwnProfile(patientId: number, updates: UpdatePatientProfileInput) {
    const existing = await this.patientRepository.findByPatientId(patientId);
    if (!existing) {
      throw new createError.NotFound(constant.PATIENT_NOT_FOUND);
    }

    // Only pass along fields that were actually provided — the controller
    // destructures both optional fields from req.body, so an omitted field
    // arrives here as `undefined`. TypeORM's query builder writes an
    // `undefined` value as SQL NULL, which would silently wipe out the
    // other, untouched field on a single-field PATCH.
    const definedUpdates: UpdatePatientProfileInput = {};
    if (updates.heightCm !== undefined) {
      definedUpdates.heightCm = updates.heightCm;
    }
    if (updates.weightKg !== undefined) {
      definedUpdates.weightKg = updates.weightKg;
    }

    await this.patientRepository.updateProfile(patientId, definedUpdates);
    const updated = await this.patientRepository.findByPatientId(patientId);

    logger.info("Patient profile updated successfully", {
      data: { patientId, updates: definedUpdates },
    });

    return this.toProfileResponse(updated as Patient);
  }

  private toProfileResponse(patient: Patient) {
    return {
      id: patient.patientId,
      firstName: patient.user?.firstName,
      lastName: patient.user?.lastName,
      email: patient.user?.email,
      heightCm: patient.heightCm,
      weightKg: patient.weightKg,
      bloodGroup: patient.bloodGroup,
      dob: patient.dob,
    };
  }
}
