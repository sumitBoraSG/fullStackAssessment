import { TEST_DATABASE_URL } from "./env";
import { resetE2eDatabase } from "./utils/db";

// Leaves the test DB in a clean, known state after the run (rather than
// littered with the last spec's fixture data) — every spec resets before
// running anyway, so this is hygiene, not a correctness requirement.
export default async function globalTeardown(): Promise<void> {
  await resetE2eDatabase(TEST_DATABASE_URL!);
}
