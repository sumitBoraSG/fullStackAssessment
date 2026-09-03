import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../test/msw/server";
import {
  API_BASE_URL,
  SESSION_EXPIRED_EVENT,
  USER_KEY,
  apiFetch,
  clearAuthStorage,
} from "./apiClient";

const PROTECTED = "/__test/protected";

afterEach(() => {
  localStorage.clear();
});

describe("apiFetch", () => {
  it("returns the response directly on success without touching /auth/refresh", async () => {
    let refreshCalls = 0;
    server.use(
      http.post(`${API_BASE_URL}/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ success: true });
      }),
      http.get(`${API_BASE_URL}${PROTECTED}`, () => HttpResponse.json({ success: true, data: "ok" })),
    );

    const response = await apiFetch(PROTECTED, { method: "GET" });

    expect(response.status).toBe(200);
    expect(refreshCalls).toBe(0);
  });

  it("does not attempt a refresh when skipAuthRefresh is set, even on 401", async () => {
    let refreshCalls = 0;
    let protectedCalls = 0;
    server.use(
      http.post(`${API_BASE_URL}/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ success: true });
      }),
      http.get(`${API_BASE_URL}${PROTECTED}`, () => {
        protectedCalls += 1;
        return HttpResponse.json({ success: false }, { status: 401 });
      }),
    );

    const response = await apiFetch(PROTECTED, { method: "GET", skipAuthRefresh: true });

    expect(response.status).toBe(401);
    expect(refreshCalls).toBe(0);
    expect(protectedCalls).toBe(1);
  });

  it("refreshes the access token once on a 401 and retries the original request exactly once", async () => {
    let refreshCalls = 0;
    let protectedCalls = 0;
    server.use(
      http.post(`${API_BASE_URL}/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ success: true });
      }),
      http.get(`${API_BASE_URL}${PROTECTED}`, () => {
        protectedCalls += 1;
        if (protectedCalls === 1) {
          return HttpResponse.json({ success: false }, { status: 401 });
        }
        return HttpResponse.json({ success: true, data: "ok" });
      }),
    );

    const response = await apiFetch(PROTECTED, { method: "GET" });

    expect(response.status).toBe(200);
    expect(refreshCalls).toBe(1);
    expect(protectedCalls).toBe(2);
  });

  it("does not retry a second time if the retried request is still a 401", async () => {
    let refreshCalls = 0;
    let protectedCalls = 0;
    server.use(
      http.post(`${API_BASE_URL}/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ success: true });
      }),
      http.get(`${API_BASE_URL}${PROTECTED}`, () => {
        protectedCalls += 1;
        return HttpResponse.json({ success: false }, { status: 401 });
      }),
      http.post(`${API_BASE_URL}/auth/logout`, () => HttpResponse.json({ success: true })),
    );

    const response = await apiFetch(PROTECTED, { method: "GET" });

    expect(response.status).toBe(401);
    expect(refreshCalls).toBe(1);
    expect(protectedCalls).toBe(2);
  });

  it("de-duplicates concurrent refresh calls behind a single in-flight request (single-flight)", async () => {
    let refreshCalls = 0;
    let protectedCalls = 0;
    server.use(
      http.post(`${API_BASE_URL}/auth/refresh`, async () => {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return HttpResponse.json({ success: true });
      }),
      http.get(`${API_BASE_URL}${PROTECTED}`, () => {
        protectedCalls += 1;
        // Every "first attempt" 401s; every retry (after refresh) succeeds.
        // We distinguish via a header set only on the retried call path is not
        // available, so instead key off call parity per invocation using a
        // WeakMap-free trick: alternate 401/200 by call count modulo the two
        // concurrent callers (4 calls total: 2 initial 401s, 2 retried 200s).
        if (protectedCalls <= 2) {
          return HttpResponse.json({ success: false }, { status: 401 });
        }
        return HttpResponse.json({ success: true, data: "ok" });
      }),
    );

    const [r1, r2] = await Promise.all([
      apiFetch(PROTECTED, { method: "GET" }),
      apiFetch(PROTECTED, { method: "GET" }),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(refreshCalls).toBe(1);
    expect(protectedCalls).toBe(4);
  });

  it("ends the session (clears storage, calls /auth/logout, dispatches SESSION_EXPIRED_EVENT) when refresh itself fails", async () => {
    localStorage.setItem(USER_KEY, JSON.stringify({ id: 1 }));
    localStorage.setItem("docpulse_access_token", "abc");

    let logoutCalls = 0;
    const eventListener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, eventListener);

    server.use(
      http.post(`${API_BASE_URL}/auth/refresh`, () =>
        HttpResponse.json({ success: false, error: { code: "REFRESH_FAILED", message: "expired" } }, { status: 401 }),
      ),
      http.get(`${API_BASE_URL}${PROTECTED}`, () => HttpResponse.json({ success: false }, { status: 401 })),
      http.post(`${API_BASE_URL}/auth/logout`, () => {
        logoutCalls += 1;
        return HttpResponse.json({ success: true });
      }),
    );

    const response = await apiFetch(PROTECTED, { method: "GET" });

    expect(response.status).toBe(401);
    expect(localStorage.getItem(USER_KEY)).toBeNull();
    expect(localStorage.getItem("docpulse_access_token")).toBeNull();
    expect(logoutCalls).toBe(1);
    expect(eventListener).toHaveBeenCalledTimes(1);

    window.removeEventListener(SESSION_EXPIRED_EVENT, eventListener);
  });

  it("clearAuthStorage removes every known auth-related localStorage key", () => {
    localStorage.setItem(USER_KEY, "u");
    localStorage.setItem("docpulse_access_token", "a");
    localStorage.setItem("docpulse_refresh_token", "r");
    localStorage.setItem("docpulse_token", "t");

    clearAuthStorage();

    expect(localStorage.getItem(USER_KEY)).toBeNull();
    expect(localStorage.getItem("docpulse_access_token")).toBeNull();
    expect(localStorage.getItem("docpulse_refresh_token")).toBeNull();
    expect(localStorage.getItem("docpulse_token")).toBeNull();
  });
});
