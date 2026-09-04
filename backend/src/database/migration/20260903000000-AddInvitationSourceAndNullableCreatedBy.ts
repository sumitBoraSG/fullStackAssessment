import { MigrationInterface, QueryRunner } from "typeorm";

// Supports patient self-registration (Option B): invitations can now
// originate either from an admin (ADMIN_INVITATION, the only kind that
// existed before this migration) or from a patient requesting their own
// signup link (PATIENT_SELF_REGISTRATION). Self-requested invitations have
// no inviting admin, so created_by/updated_by must become nullable.
//
// down() reverses cleanly only while every row still has a non-null
// created_by/updated_by, i.e. before this feature has been used in
// production. This is the same limitation already present in
// InitialSchema's down(), which drops tables unconditionally with no
// data-preservation attempt either.
export class AddInvitationSourceAndNullableCreatedBy20260903000000
  implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "invitation_source" AS ENUM ('ADMIN_INVITATION', 'PATIENT_SELF_REGISTRATION')
    `);

    await queryRunner.query(`
      ALTER TABLE "user_invitations"
      ADD COLUMN "source" "invitation_source" NOT NULL DEFAULT 'ADMIN_INVITATION'
    `);

    await queryRunner.query(`
      ALTER TABLE "user_invitations" ALTER COLUMN "created_by" DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "user_invitations" ALTER COLUMN "updated_by" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_invitations" ALTER COLUMN "updated_by" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "user_invitations" ALTER COLUMN "created_by" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "user_invitations" DROP COLUMN "source"
    `);

    await queryRunner.query(`
      DROP TYPE "invitation_source"
    `);
  }
}
