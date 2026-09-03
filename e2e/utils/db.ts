import { Client } from "pg";
import bcrypt from "bcrypt";
import { E2E_ADMIN } from "../env";

// Mirrors backend/test/util/testDb.ts's truncate+reseed pattern, extended to
// also re-insert a fixed admin user every reset (E2E specs need a working
// admin account every run, unlike the Jest suite which creates its own admin
// per-test via factories.ts).
const BUSINESS_TABLES = [
  "appointments",
  "doctor_availabilities",
  "doctors",
  "patients",
  "user_invitations",
  "specializations",
  "users",
];

/** Opens a short-lived connection scoped to a single call, never held open
 * across the run, so it can't fight the live server's own connection pool. */
async function withClient<T>(databaseUrl: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function resetE2eDatabase(databaseUrl: string): Promise<void> {
  await withClient(databaseUrl, async (client) => {
    await client.query(`TRUNCATE TABLE ${BUSINESS_TABLES.join(", ")} RESTART IDENTITY CASCADE`);

    await client.query(`
      INSERT INTO specializations (name, description) VALUES
        ('General Practitioner', 'Primary care'),
        ('Cardiology', 'Heart and cardiovascular system')
    `);

    const hashedPassword = await bcrypt.hash(E2E_ADMIN.password, 12);
    await client.query(
      `INSERT INTO users (first_name, last_name, email, hashed_password, role)
       VALUES ('E2E', 'Admin', $1, $2, 'ADMIN')`,
      [E2E_ADMIN.email, hashedPassword],
    );
  });
}
