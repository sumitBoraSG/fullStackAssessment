import { MigrationInterface, QueryRunner } from "typeorm";

// Prevents two concurrent admin-invite requests for the same email from
// both creating a "pending" invitation (previously only guarded by an
// application-level read-then-write check). Deliberately excludes
// expires_at from the predicate (NOW() isn't allowed in an index predicate,
// and expiry is time-dependent) — AdminService.inviteUser handles an
// expired-but-still-"active" conflicting row by revoking it and retrying.
export class AddActiveInvitationUniqueIndex20260827130000
  implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_invitations_active_email
      ON user_invitations (email)
      WHERE used_at IS NULL AND revoked_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_user_invitations_active_email
    `);
  }
}
