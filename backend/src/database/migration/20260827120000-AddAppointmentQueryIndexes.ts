import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAppointmentQueryIndexes20260827120000
  implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_appointments_patient_id_status
      ON appointments (patient_id, status)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id_status
      ON appointments (doctor_id, status)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_appointments_appointment_time_gist
      ON appointments USING GIST (appointment_time)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_appointments_appointment_time_gist
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_appointments_doctor_id_status
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_appointments_patient_id_status
    `);
  }
}
