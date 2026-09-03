import { defineConfig, devices } from "@playwright/test";
import { BACKEND_DIR, FRONTEND_DIR, TEST_DATABASE_URL } from "./env";

export default defineConfig({
  testDir: "./tests",
  // Deliberate: specs share one Postgres test DB and each resets it in its
  // own beforeAll, so two spec files must never run concurrently.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  globalSetup: require.resolve("./global-setup"),
  globalTeardown: require.resolve("./global-teardown"),
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run serve",
      cwd: BACKEND_DIR,
      url: "http://localhost:3000/",
      timeout: 60_000,
      // Never reuse an already-running server: this suite writes real data,
      // and a server left running from a normal dev session would be pointed
      // at the real DATABASE_URL, not the test DB. Failing loudly on a port
      // conflict is far safer than silently reusing the wrong backend.
      reuseExistingServer: false,
      env: { DATABASE_URL: TEST_DATABASE_URL!, NODE_ENV: "test", PORT: "3000" },
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "npm run dev",
      cwd: FRONTEND_DIR,
      url: "http://localhost:5173/",
      timeout: 30_000,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
