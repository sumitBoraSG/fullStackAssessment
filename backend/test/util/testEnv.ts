// Jest `setupFiles` entry — runs before the test framework and any test
// file/src module is imported, so setting process.env.DATABASE_URL here
// (before secret.ts's dotenv.config() call) takes effect, since dotenv
// never overwrites an already-set variable.
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(__dirname, "../../.env") });

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else {
  throw new Error(
    "TEST_DATABASE_URL is not set — required to run the backend test suite " +
      "against a dedicated test database (see backend/.env.example).",
  );
}

process.env.NODE_ENV = "test";
