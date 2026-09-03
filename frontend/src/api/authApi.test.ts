import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../test/msw/server";
import { defaultPatientUser } from "../test/msw/handlers";
import {
  acceptInvitationApi,
  getInvitationDetailsApi,
  loginApi,
  logoutApi,
} from "./authApi";

const BASE = "http://localhost:3000";

describe("authApi", () => {
  it("loginApi returns the user on success", async () => {
    const result = await loginApi(defaultPatientUser.email, "CorrectPassword1!");
    expect(result.success).toBe(true);
    expect(result.data?.user).toEqual(defaultPatientUser);
  });

  it("loginApi surfaces the error envelope on invalid credentials", async () => {
    server.use(
      http.post(`${BASE}/auth/login`, () =>
        HttpResponse.json(
          { success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials. Please try again." } },
          { status: 401 },
        ),
      ),
    );

    const result = await loginApi("wrong@test.com", "wrong");
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("INVALID_CREDENTIALS");
    expect(result.error?.message).toBe("Invalid credentials. Please try again.");
  });

  it("loginApi returns a NETWORK_ERROR envelope when the request throws", async () => {
    server.use(http.post(`${BASE}/auth/login`, () => HttpResponse.error()));

    const result = await loginApi(defaultPatientUser.email, "whatever");
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("NETWORK_ERROR");
  });

  it("logoutApi returns success on the happy path", async () => {
    const result = await logoutApi();
    expect(result.success).toBe(true);
  });

  it("getInvitationDetailsApi returns invitation details on success", async () => {
    const result = await getInvitationDetailsApi("sometoken");
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ email: "invitee@test.com", role: "PATIENT" });
  });

  it("getInvitationDetailsApi surfaces an error for an invalid/expired token", async () => {
    server.use(
      http.get(`${BASE}/auth/invitation/:token`, () =>
        HttpResponse.json({ success: false, message: "This invitation link is invalid or has expired." }, { status: 400 }),
      ),
    );

    const result = await getInvitationDetailsApi("bad-token");
    expect(result.success).toBe(false);
    expect(result.message).toBe("This invitation link is invalid or has expired.");
  });

  it("acceptInvitationApi returns the created user on success", async () => {
    const result = await acceptInvitationApi({
      token: "sometoken",
      firstName: "New",
      lastName: "User",
      password: "CorrectPassword1!",
    });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("invitee@test.com");
  });

  it("acceptInvitationApi surfaces a validation error envelope", async () => {
    server.use(
      http.post(`${BASE}/auth/accept-invitation`, () =>
        HttpResponse.json(
          { success: false, code: "WEAK_PASSWORD", message: "Password does not meet complexity requirements." },
          { status: 400 },
        ),
      ),
    );

    const result = await acceptInvitationApi({
      token: "sometoken",
      firstName: "New",
      lastName: "User",
      password: "weak",
    });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("WEAK_PASSWORD");
  });
});
