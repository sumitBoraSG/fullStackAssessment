import type {
  AcceptInvitationPayload,
  AcceptInvitationResponse,
  ApiResponse,
  InvitationDetails,
  LoginResponse,
  LogoutResponse,
} from "../types/auth";
import { apiFetch } from "./apiClient";

export async function loginApi(email: string, password: string): Promise<LoginResponse> {
  try {
    const response = await apiFetch("/auth/login", {
      method: "POST",
      skipAuthRefresh: true,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: err.message || "Failed to connect to the server. Please check your connection.",
      },
    };
  }
}

export async function logoutApi(): Promise<LogoutResponse> {
  try {
    const response = await apiFetch("/auth/logout", {
      method: "POST",
      skipAuthRefresh: true,
    });

    const data = await response.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: err.message || "Failed to communicate with logout service.",
      },
    };
  }
}

/**
 * Fetch an invitation's role/email before rendering the signup form, without
 * consuming it.
 * GET /auth/invitation/:token
 */
export async function getInvitationDetailsApi(
  token: string
): Promise<ApiResponse<InvitationDetails>> {
  try {
    const response = await apiFetch(`/auth/invitation/${encodeURIComponent(token)}`, {
      method: "GET",
      skipAuthRefresh: true,
    });

    const data = await response.json();

    if (!response.ok || data.success === false) {
      const errorMessage =
        data.message ||
        data.error?.message ||
        "This invitation link is invalid or has expired.";
      return {
        success: false,
        message: errorMessage,
        error: {
          code: data.code || data.error?.code || "INVITATION_LOOKUP_ERROR",
          message: errorMessage,
        },
      };
    }

    return {
      success: true,
      data: data.data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Network error. Please check your connection.",
      error: {
        code: "NETWORK_ERROR",
        message: err.message || "Failed to connect to the server.",
      },
    };
  }
}

/**
 * Accept an invitation and complete user registration.
 * POST /auth/accept-invitation
 */
export async function acceptInvitationApi(
  payload: AcceptInvitationPayload
): Promise<ApiResponse<AcceptInvitationResponse>> {
  try {
    const response = await apiFetch("/auth/accept-invitation", {
      method: "POST",
      skipAuthRefresh: true,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || data.success === false || data.status === false) {
      const errorMessage =
        data.message ||
        data.error?.message ||
        "Failed to complete registration. Please check your link.";
      return {
        success: false,
        message: errorMessage,
        error: {
          code: data.code || data.error?.code || "ACCEPT_INVITE_ERROR",
          message: errorMessage,
        },
      };
    }

    return {
      success: true,
      message: data.message || "Account created successfully",
      data: data.data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Network error. Please check your connection.",
      error: {
        code: "NETWORK_ERROR",
        message: err.message || "Failed to connect to the server.",
      },
    };
  }
}

