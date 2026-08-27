import type { RefreshTokenResponse } from "../types/auth";

export const API_BASE_URL = "http://localhost:3000";
export const USER_KEY = "docpulse_user";
const SESSION_EXPIRED_EVENT = "docpulse:session-expired";

let refreshRequest: Promise<void> | null = null;

export function clearAuthStorage() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("docpulse_access_token");
  localStorage.removeItem("docpulse_refresh_token");
  localStorage.removeItem("docpulse_token");
}

async function endSession() {
  clearAuthStorage();
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Ignore network error on logout cleanup
  }
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

async function refreshAccessToken(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  const data: RefreshTokenResponse = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || "Unable to refresh the session.");
  }
}

async function getRefreshedAccessToken(): Promise<void> {
  if (!refreshRequest) {
    refreshRequest = refreshAccessToken().finally(() => {
      refreshRequest = null;
    });
  }

  return refreshRequest;
}

interface ApiRequestOptions extends RequestInit {
  skipAuthRefresh?: boolean;
}

export async function apiFetch(input: string, options: ApiRequestOptions = {}, retried = false): Promise<Response> {
  const { skipAuthRefresh = false, headers: providedHeaders, ...requestOptions } = options;

  const response = await fetch(`${API_BASE_URL}${input}`, {
    ...requestOptions,
    credentials: "include",
    headers: providedHeaders,
  });

  if (response.status !== 401 || skipAuthRefresh || retried) {
    return response;
  }

  try {
    await getRefreshedAccessToken();
    return apiFetch(input, options, true);
  } catch {
    await endSession();
    return response;
  }
}

export { SESSION_EXPIRED_EVENT };

