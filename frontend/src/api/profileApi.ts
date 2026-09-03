import type { ApiResponse } from "../types/auth";
import type {
  DoctorProfileData,
  PatientProfileData,
  UpdateDoctorProfilePayload,
  UpdatePatientProfilePayload,
} from "../types/profile";
import { apiFetch } from "./apiClient";

/**
 * Extract a user-friendly message from either the standard `{success,message,error}`
 * envelope or the Joi validation-error envelope produced by http-request-validator:
 * `{status:false, message:"Validation Error", code:"validation_error", data:[{message,label}, ...]}`.
 */
function extractErrorMessage(data: any, fallback: string): string {
  if (Array.isArray(data?.data) && data.data.length > 0) {
    return data.data[0]?.message || data.message || fallback;
  }
  return data?.message || data?.error?.message || fallback;
}

export async function getPatientProfileApi(): Promise<ApiResponse<PatientProfileData>> {
  try {
    const response = await apiFetch("/patient/profile", {
      method: "GET",
    });

    const data = await response.json();
    if (!response.ok || data.success === false || data.status === false) {
      return {
        success: false,
        message: extractErrorMessage(data, "Failed to load your profile."),
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
    };
  }
}

export async function updatePatientProfileApi(
  payload: UpdatePatientProfilePayload,
): Promise<ApiResponse<PatientProfileData>> {
  try {
    const response = await apiFetch("/patient/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || data.success === false || data.status === false) {
      return {
        success: false,
        message: extractErrorMessage(data, "Failed to update your profile."),
      };
    }

    return {
      success: true,
      message: data.message || "Profile updated successfully",
      data: data.data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Network error. Please check your connection.",
    };
  }
}

export async function getDoctorProfileApi(): Promise<ApiResponse<DoctorProfileData>> {
  try {
    const response = await apiFetch("/doctor/profile", {
      method: "GET",
    });

    const data = await response.json();
    if (!response.ok || data.success === false || data.status === false) {
      return {
        success: false,
        message: extractErrorMessage(data, "Failed to load your profile."),
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
    };
  }
}

export async function updateDoctorProfileApi(
  payload: UpdateDoctorProfilePayload,
): Promise<ApiResponse<DoctorProfileData>> {
  try {
    const response = await apiFetch("/doctor/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || data.success === false || data.status === false) {
      return {
        success: false,
        message: extractErrorMessage(data, "Failed to update your profile."),
      };
    }

    return {
      success: true,
      message: data.message || "Profile updated successfully",
      data: data.data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Network error. Please check your connection.",
    };
  }
}
