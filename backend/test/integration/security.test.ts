import request from "supertest";
import { app, setupIntegrationTest } from "../util/testApp";

setupIntegrationTest();

describe("Security headers (Helmet)", () => {
  it("sets standard Helmet headers on a representative API response", async () => {
    const res = await request(app).get("/");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-dns-prefetch-control"]).toBe("off");
    expect(res.headers["x-download-options"]).toBe("noopen");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["x-permitted-cross-domain-policies"]).toBe("none");
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("also applies Helmet headers to auth endpoints", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "nobody@test.com", password: "wrongpassword" });

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
