import type { ApiResponse, PaginationMeta } from "../types/auth";
import type {
  AvailabilitySlot,
  CreateAvailabilityPayload,
  DoctorAvailabilityDetails,
  DoctorListItem,
  DoctorSearchParams,
  SpecializationItem,
} from "../types/doctor";
import { apiFetch } from "./apiClient";

export async function createDoctorAvailabilityApi(
  payload: CreateAvailabilityPayload,
): Promise<ApiResponse<AvailabilitySlot>> {
  try {
    const response = await apiFetch("/doctor/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return {
        success: false,
        message: data.message || "Failed to add availability slot.",
        error: { code: data.code || "AVAILABILITY_ERROR", message: data.message },
      };
    }

    return {
      success: true,
      message: "Availability slot created successfully",
      data: data.data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Network error. Unable to create availability.",
    };
  }
}

export async function getOwnDoctorAvailabilityApi(
  date?: string,
): Promise<ApiResponse<AvailabilitySlot[]>> {
  try {
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    const response = await apiFetch(`/doctor/availability${query}`, {
      method: "GET",
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return {
        success: false,
        message: data.message || "Failed to fetch availability.",
      };
    }

    return {
      success: true,
      data: data.data || [],
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Network error fetching availability.",
    };
  }
}

export async function getDoctorsApi(
  params: DoctorSearchParams = {},
): Promise<ApiResponse<{ doctors: DoctorListItem[]; pagination: PaginationMeta }>> {
  try {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.set("search", params.search);
    if (params.specialization) queryParams.set("specialization", params.specialization);
    if (params.date) queryParams.set("date", params.date);
    if (params.page) queryParams.set("page", params.page.toString());
    if (params.limit) queryParams.set("limit", params.limit.toString());

    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
    const response = await apiFetch(`/doctors${queryString}`, {
      method: "GET",
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return {
        success: false,
        message: data.message || "Failed to fetch doctors list.",
      };
    }

    return {
      success: true,
      data: data.data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Network error fetching doctors.",
    };
  }
}

export async function getDoctorAvailabilityApi(
  doctorId: number | string,
  date?: string,
): Promise<ApiResponse<DoctorAvailabilityDetails>> {
  try {
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    const response = await apiFetch(`/doctors/${doctorId}/availability${query}`, {
      method: "GET",
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return {
        success: false,
        message: data.message || "Failed to fetch doctor availability.",
      };
    }

    return {
      success: true,
      data: data.data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Network error fetching doctor availability.",
    };
  }
}

export async function getSpecializationsApi(): Promise<ApiResponse<SpecializationItem[]>> {
  try {
    const response = await apiFetch("/doctors/specializations", {
      method: "GET",
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return {
        success: false,
        message: data.message || "Failed to fetch specializations.",
      };
    }

    return {
      success: true,
      data: data.data || [],
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Network error fetching specializations.",
    };
  }
}
