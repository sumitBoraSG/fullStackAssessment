import type {
  ApiResponse,
  InviteUserPayload,
  InviteUserResponse,
  GetInvitationsParams,
  GetInvitationsResponse,
  BulkInviteResponse,
  InvitationItem,
  UserRole,
} from "../types/auth";
import { apiFetch } from "./apiClient";

/**
 * Send an invitation to a new user with a specified role.
 * POST /admin/invite
 * Sends strictly { email, role } in request body.
 */
export async function inviteUserApi(
  email: string,
  role: UserRole
): Promise<ApiResponse<InviteUserResponse>> {
  try {
    const payload: InviteUserPayload = { email, role };

    const response = await apiFetch("/admin/invite", {
      method: "POST",
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
        "Failed to send invitation. Please try again.";
      return {
        success: false,
        message: errorMessage,
        error: {
          code: data.code || data.error?.code || "INVITE_ERROR",
          message: errorMessage,
        },
      };
    }

    return {
      success: true,
      message: data.message || "Invitation sent successfully",
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
 * Fetch paginated, searchable, and filterable list of invitations.
 * GET /admin/invitations?page=1&limit=10&search=...&status=...&role=...
 */
export async function getAllInvitationsApi(
  params: GetInvitationsParams = {}
): Promise<GetInvitationsResponse> {
  const page = params.page || 1;
  const limit = params.limit || 10;

  try {
    const queryParams = new URLSearchParams();
    queryParams.set("page", String(page));
    queryParams.set("limit", String(limit));

    if (params.search && params.search.trim()) {
      queryParams.set("search", params.search.trim());
    }

    if (params.status && params.status !== "ALL") {
      queryParams.set("status", params.status);
    }

    if (params.role && params.role !== "ALL") {
      queryParams.set("role", params.role);
    }

    const queryString = queryParams.toString();
    const url = `/admin/invitations${queryString ? `?${queryString}` : ""}`;

    const response = await apiFetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok || data.success === false || data.status === false) {
      const errorMessage =
        data.message ||
        data.error?.message ||
        "Failed to load invitations. Please try again.";
      return {
        success: false,
        message: errorMessage,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 1,
        },
        error: {
          code: data.code || data.error?.code || "FETCH_INVITATIONS_ERROR",
          message: errorMessage,
        },
      };
    }

    return {
      success: true,
      message: data.message || "Invitations fetched successfully",
      data: data.data || [],
      pagination: data.pagination || {
        page,
        limit,
        total: data.data?.length || 0,
        totalPages: Math.max(1, Math.ceil((data.data?.length || 0) / limit)),
      },
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Network error. Please check your connection.",
      data: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 1,
      },
      error: {
        code: "NETWORK_ERROR",
        message: err.message || "Failed to connect to the server.",
      },
    };
  }
}

/**
 * Bulk invite users via CSV file upload.
 * POST /admin/invitations/bulk
 * Sends multipart/form-data with 'file' field.
 */
export async function bulkInviteUsersApi(
  file: File
): Promise<BulkInviteResponse> {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiFetch("/admin/invitations/bulk", {
      method: "POST",
      // Do NOT specify Content-Type header so browser automatically sets multipart boundary
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || data.success === false || data.status === false) {
      const errorMessage =
        data.message ||
        data.error?.message ||
        "Failed to process bulk invitations. Please check the file format.";
      return {
        success: false,
        message: errorMessage,
        error: {
          code: data.code || data.error?.code || "BULK_INVITE_ERROR",
          message: errorMessage,
        },
      };
    }

    return {
      success: true,
      message: data.message || "Bulk invitation process completed",
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
 * Revoke an existing invitation by ID.
 * POST /admin/invitations/:id/revoke
 */
export async function revokeInvitationApi(
  id: number | string
): Promise<ApiResponse<InvitationItem>> {
  try {
    const response = await apiFetch(`/admin/invitations/${id}/revoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const data = await response.json();

    if (!response.ok || data.success === false || data.status === false) {
      const errorMessage =
        data.message ||
        data.error?.message ||
        "Failed to revoke invitation. Please try again.";
      return {
        success: false,
        message: errorMessage,
        error: {
          code: data.code || data.error?.code || "REVOKE_INVITATION_ERROR",
          message: errorMessage,
        },
      };
    }

    return {
      success: true,
      message: data.message || "Invitation revoked successfully",
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


