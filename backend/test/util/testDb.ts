import { getConnection } from "typeorm";

const BUSINESS_TABLES = [
  "appointments",
  "doctor_availabilities",
  "doctors",
  "patients",
  "user_invitations",
  "specializations",
  "users",
];

export async function runMigrationsForTests(): Promise<void> {
  await getConnection().runMigrations();
}

/** Wipes all business data and re-seeds a couple of known specializations. */
export async function resetDatabase(): Promise<void> {
  await getConnection().query(
    `TRUNCATE TABLE ${BUSINESS_TABLES.join(", ")} RESTART IDENTITY CASCADE`,
  );

  await getConnection().query(`
    INSERT INTO specializations (name, description) VALUES
      ('General Practitioner', 'Primary care'),
      ('Cardiology', 'Heart and cardiovascular system')
  `);
}

export async function closeTestDb(): Promise<void> {
  await getConnection().close();
}
