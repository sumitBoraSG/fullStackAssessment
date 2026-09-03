import { execFileSync } from "child_process";
import { BACKEND_DIR, TEST_DATABASE_URL } from "./env";
import { resetE2eDatabase } from "./utils/db";

/**
 * Runs the backend's own TypeORM migrations against the test DB (reusing the
 * project's existing `npm run typeorm` script rather than importing
 * ormconfig.ts directly — ormconfig.ts resolves entity/migration globs via
 * `path.resolve("./src/...")`, which is relative to process.cwd(), so it only
 * works correctly when run from inside backend/).
 */
function runMigrations(): void {
  execFileSync("npm", ["run", "typeorm", "--", "migration:run"], {
    cwd: BACKEND_DIR,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, NODE_ENV: "test" },
    stdio: "inherit",
  });
}

/**
 * Builds the backend once, synchronously, before Playwright's webServer ever
 * spawns a server process. Deliberately NOT done via the webServer's own
 * `command` (e.g. "npm run start" = "build-ts && serve") — chaining two npm
 * scripts with && means Playwright's teardown kill signal hits the top-level
 * npm process but can leave the grandchild `node dist/server.js` orphaned and
 * still bound to the port (observed directly: a stray listener survived a
 * full test run). Keeping the webServer command to a single "npm run serve"
 * avoids that process-tree depth entirely.
 */
function buildBackend(): void {
  execFileSync("npm", ["run", "build-ts"], { cwd: BACKEND_DIR, stdio: "inherit" });
}

export default async function globalSetup(): Promise<void> {
  buildBackend();
  runMigrations();
  await resetE2eDatabase(TEST_DATABASE_URL!);
}
