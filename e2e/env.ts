import { config } from "dotenv";
import path from "path";

// Reuse the same backend/.env the Jest integration suite reads from, so the
// E2E harness never needs its own copy of the test DB credentials.
config({ path: path.resolve(__dirname, "../backend/.env") });

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

if (!TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL is not set in backend/.env — required to run the E2E suite " +
      "against a dedicated test database (see backend/.env.example).",
  );
}

export const BACKEND_DIR = path.resolve(__dirname, "../backend");
export const FRONTEND_DIR = path.resolve(__dirname, "../frontend");

export const E2E_ADMIN = {
  email: "e2e-admin@test.com",
  password: "AdminPass123!",
};
