import { MigrationInterface, QueryRunner } from "typeorm";

// Base schema for a clean database: enums, tables, foreign keys, and the
// GIST exclusion constraints that back double-booking / overlapping-
// availability prevention. Written from scratch to match the current
// entities (User, Doctor, Patient, Specialization, DoctorAvailability,
// Appointment, UserInvitation) exactly.
export class InitialSchema20260101000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Required for GIST exclusion constraints combining an equality column
    // (doctor_id/patient_id) with a range column (tstzrange).
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);

    await queryRunner.query(`
      CREATE TYPE "user_role" AS ENUM ('ADMIN', 'PATIENT', 'DOCTOR')
    `);

    await queryRunner.query(`
      CREATE TYPE "appointment_status" AS ENUM ('CONFIRMED', 'CANCELLED', 'REJECTED', 'COMPLETED', 'PENDING')
    `);

    await queryRunner.query(`
      CREATE TYPE "blood_group" AS ENUM ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-')
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" smallserial PRIMARY KEY,
        "first_name" varchar(50) NOT NULL,
        "last_name" varchar(50) NOT NULL,
        "email" varchar(255) NOT NULL UNIQUE,
        "hashed_password" varchar(255) NOT NULL,
        "role" "user_role" NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "specializations" (
        "id" smallserial PRIMARY KEY,
        "name" varchar(100) NOT NULL,
        "description" varchar(500) NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_invitations" (
        "id" smallserial PRIMARY KEY,
        "email" varchar(255) NOT NULL,
        "role" "user_role" NOT NULL,
        "hashed_token" varchar(255) NOT NULL UNIQUE,
        "expires_at" timestamptz NOT NULL,
        "used_at" timestamptz NULL,
        "created_by" smallint NOT NULL,
        "updated_by" smallint NOT NULL,
        "revoked_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "user_invitations_created_by_users_id_fk"
          FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
        CONSTRAINT "user_invitations_updated_by_users_id_fk"
          FOREIGN KEY ("updated_by") REFERENCES "users" ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "doctors" (
        "doctor_id" smallint PRIMARY KEY,
        "specialization_id" smallint NOT NULL,
        "experience_years" smallint NOT NULL,
        CONSTRAINT "doctors_doctor_id_users_id_fk"
          FOREIGN KEY ("doctor_id") REFERENCES "users" ("id"),
        CONSTRAINT "doctors_specialization_id_specializations_id_fk"
          FOREIGN KEY ("specialization_id") REFERENCES "specializations" ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "patients" (
        "patient_id" smallint PRIMARY KEY,
        "height_cm" smallint NULL,
        "weight_kg" smallint NULL,
        "blood_group" "blood_group" NULL,
        "dob" date NULL,
        CONSTRAINT "patients_patient_id_users_id_fk"
          FOREIGN KEY ("patient_id") REFERENCES "users" ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "doctor_availabilities" (
        "id" smallserial PRIMARY KEY,
        "doctor_id" smallint NOT NULL,
        "availability_time" tstzrange NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "doctor_availabilities_doctor_id_doctors_doctor_id_fk"
          FOREIGN KEY ("doctor_id") REFERENCES "doctors" ("doctor_id"),
        CONSTRAINT "doctor_availability_no_overlap"
          EXCLUDE USING gist ("doctor_id" WITH =, "availability_time" WITH &&)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "appointments" (
        "id" smallserial PRIMARY KEY,
        "patient_id" smallint NOT NULL,
        "doctor_id" smallint NOT NULL,
        "status" "appointment_status" NOT NULL,
        "appointment_time" tstzrange NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "appointments_patient_id_patients_patient_id_fk"
          FOREIGN KEY ("patient_id") REFERENCES "patients" ("patient_id"),
        CONSTRAINT "appointments_doctor_id_doctors_doctor_id_fk"
          FOREIGN KEY ("doctor_id") REFERENCES "doctors" ("doctor_id"),
        CONSTRAINT "appointments_no_doctor_overlap"
          EXCLUDE USING gist ("doctor_id" WITH =, "appointment_time" WITH &&)
          WHERE (status IN ('PENDING', 'CONFIRMED')),
        CONSTRAINT "appointments_no_patient_overlap"
          EXCLUDE USING gist ("patient_id" WITH =, "appointment_time" WITH &&)
          WHERE (status IN ('PENDING', 'CONFIRMED'))
      )
    `);

    // Seed a starter set of specializations so doctor signup has real
    // options to validate against out of the box.
    await queryRunner.query(`
      INSERT INTO "specializations" ("name", "description") VALUES
        ('General Practitioner', 'Primary care and general health concerns'),
        ('Cardiology', 'Heart and cardiovascular system'),
        ('Dermatology', 'Skin, hair, and nail conditions'),
        ('Pediatrics', 'Medical care for infants, children, and adolescents')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "appointments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "doctor_availabilities"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "patients"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "doctors"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_invitations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "specializations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "blood_group"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "appointment_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role"`);
  }
}
