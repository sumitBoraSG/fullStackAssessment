import { config as dotenvConfig } from "dotenv";

dotenvConfig();

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