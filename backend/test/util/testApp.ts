import app from "../../src/app";
import { runMigrationsForTests, resetDatabase, closeTestDb } from "./testDb";
import { mockAllEmailDelivery } from "./factories";

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

    // Every EmailService method is mocked by default so no integration test
    // can ever trigger a real SMTP send. Tests that care about a specific
    // email re-spy on that method (jest.spyOn is idempotent) to assert on it.
    jest.restoreAllMocks();
    mockAllEmailDelivery();
  });

  afterAll(async () => {
    await closeTestDb();
  });
}
