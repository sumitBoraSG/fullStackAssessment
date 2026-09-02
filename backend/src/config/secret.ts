import { config as dotenvConfig } from "dotenv";

dotenvConfig();

const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "JWT_SECRET",
  "REFRESH_TOKEN_SECRET",
  "FRONTEND_URL",
] as const;

function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        "Set them in your .env file before starting the app.",
    );
  }
}

validateEnv();

export const ENVIRONMENT = process.env.NODE_ENV;

export const {
  DATABASE_URL,

  TYPEORM_LOGGING,

  SENTRY_DSN,
  PORT,
  JWT_SECRET,
  REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
  SMTP_HOST,
  SMTP_USER,
  SMTP_PASSWORD,
  FRONTEND_URL
} = process.env;

export const SMTP_PORT = Number(process.env.SMTP_PORT);