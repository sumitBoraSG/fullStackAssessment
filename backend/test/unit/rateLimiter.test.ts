import express from "express";
import request from "supertest";

// This is the platform's first fully public, unauthenticated write
// endpoint, so unlike the other three limiters (general/auth/invitation,
// which have no dedicated test anywhere in this suite), its rate limit is
// worth verifying directly rather than trusting config alone.
//
// skipInTestEnv() reads ENVIRONMENT (= process.env.NODE_ENV) once at module
// load time, and the global test setup (test/util/testEnv.ts) forces
// NODE_ENV="test" so every other test's requests bypass rate limiting.
// This test deliberately flips NODE_ENV before a fresh require, in a
// standalone Express app with no DB/email involved, and restores it
// immediately afterwards so no other test file (run in the same
// --runInBand process) is affected.
describe("RateLimitMiddleware.patientSelfRegistration", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.resetModules();
  });

  it("returns 429 once the per-IP ceiling is exceeded, with the configured message", async () => {
    jest.resetModules();
    process.env.NODE_ENV = "development";

    const {
      RateLimitMiddleware,
      // eslint-disable-next-line @typescript-eslint/no-var-requires
    } = require("@middleware/rateLimiter.middleware");
    const rateLimitMiddleware = new RateLimitMiddleware();

    const app = express();
    app.use(express.json());
    app.post(
      "/auth/patient/self-register",
      rateLimitMiddleware.patientSelfRegistration,
      (_req: express.Request, res: express.Response) => {
        res.status(200).json({ success: true });
      },
    );

    // Configured ceiling is 10 requests per 15-minute window per IP.
    for (let i = 0; i < 10; i++) {
      const res = await request(app).post("/auth/patient/self-register").send({});
      expect(res.status).toBe(200);
    }

    const limited = await request(app).post("/auth/patient/self-register").send({});
    expect(limited.status).toBe(429);
    expect(limited.body.message).toBe(
      "Too many registration requests, please try again later.",
    );
  });

  it("does not rate-limit at all when NODE_ENV is test (matches every other limiter's test-bypass)", async () => {
    process.env.NODE_ENV = "test";
    jest.resetModules();

    const {
      RateLimitMiddleware,
      // eslint-disable-next-line @typescript-eslint/no-var-requires
    } = require("@middleware/rateLimiter.middleware");
    const rateLimitMiddleware = new RateLimitMiddleware();

    const app = express();
    app.use(express.json());
    app.post(
      "/auth/patient/self-register",
      rateLimitMiddleware.patientSelfRegistration,
      (_req: express.Request, res: express.Response) => {
        res.status(200).json({ success: true });
      },
    );

    for (let i = 0; i < 15; i++) {
      const res = await request(app).post("/auth/patient/self-register").send({});
      expect(res.status).toBe(200);
    }
  });
});
