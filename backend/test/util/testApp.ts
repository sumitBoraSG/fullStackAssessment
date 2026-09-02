import app from "../../src/app";
import { runMigrationsForTests, resetDatabase, closeTestDb } from "./testDb";

export { app };

/**
 * Wires up the standard beforeAll/beforeEach/afterAll lifecycle shared by
 * every integration test file: wait for the app's DB connection, run
 * migrations once, reset data before each test, close the connection after
 * the suite.
 */
export function setupIntegrationTest(): void {
  beforeAll(async () => {
    await app.locals.ready;
    await runMigrationsForTests();
  }, 30000);

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await closeTestDb();
  });
}
