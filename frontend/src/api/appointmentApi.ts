import type { ApiResponse } from "../types/auth";
import type {
  PatientAppointment,
  DoctorAppointment,
  CreateAppointmentPayload,
  GetAppointmentsParams,
  AppointmentsResponse,
  AppointmentStatus,
} from "../types/appointment";
import { apiFetch } from "./apiClient";

export async function createAppointmentApi(
  payload: CreateAppointmentPayload,
): Promise<ApiResponse<PatientAppointment>> {
  try {
    const response = await apiFetch("/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return {
        success: false,
        message: data.message || "Failed to book appointment.",
        error: { code: data.code || "BOOKING_ERROR", message: data.message },
      };
    }

    return {
      success: true,
      message: "Appointment booked successfully!",
      data: data.data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Network error. Unable to book appointment.",
    };
  }
}

export async function getPatientAppointmentsApi(
  params: GetAppointmentsParams = {},
): Promise<ApiResponse<AppointmentsResponse<PatientAppointment>>> {
  try {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set("page", params.page.toString());
    if (params.limit) queryParams.set("limit", params.limit.toString());
    if (params.status && params.status !== "ALL") queryParams.set("status", params.status);
    if (params.date) queryParams.set("date", params.date);
    if (params.dateFrom) queryParams.set("dateFrom", params.dateFrom);
    if (params.dateTo) queryParams.set("dateTo", params.dateTo);
    if (params.doctorId) queryParams.set("doctorId", params.doctorId.toString());
    if (params.sortBy) queryParams.set("sortBy", params.sortBy);
    if (params.order) queryParams.set("order", params.order);

    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
    const response = await apiFetch(`/appointments${queryString}`, {
      method: "GET",
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return {
        success: false,
        message: data.message || "Failed to fetch patient appointments.",
      };
    }

    return {
      success: true,
      data: data.data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Network error fetching appointments.",
    };
  }
}

export async function cancelPatientAppointmentApi(
  appointmentId: number | string,
): Promise<ApiResponse<PatientAppointment>> {
  try {
    const response = await apiFetch(`/appointments/${appointmentId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return {
        success: false,
        message: data.message || "Failed to cancel appointment.",
        error: { code: data.code || "CANCEL_ERROR", message: data.message },
      };
    }

    return {
      success: true,
      message: "Appointment cancelled successfully.",
      data: data.data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Network error cancelling appointment.",
    };
  }
}

export async function getDoctorAppointmentsApi(
  params: GetAppointmentsParams = {},
): Promise<ApiResponse<AppointmentsResponse<DoctorAppointment>>> {
  try {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set("page", params.page.toString());
    if (params.limit) queryParams.set("limit", params.limit.toString());
    if (params.status && params.status !== "ALL") queryParams.set("status", params.status);
    if (params.date) queryParams.set("date", params.date);
    if (params.dateFrom) queryParams.set("dateFrom", params.dateFrom);
    if (params.dateTo) queryParams.set("dateTo", params.dateTo);
    if (params.patientId) queryParams.set("patientId", params.patientId.toString());
    if (params.sortBy) queryParams.set("sortBy", params.sortBy);
    if (params.order) queryParams.set("order", params.order);

    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
    const response = await apiFetch(`/doctor/appointments${queryString}`, {
      method: "GET",
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return {
        success: false,
        message: data.message || "Failed to fetch doctor appointments.",
      };
    }

    return {
      success: true,
      data: data.data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Network error fetching doctor appointments.",
    };
  }
}

export async function updateDoctorAppointmentStatusApi(
  appointmentId: number | string,
  status: AppointmentStatus,
): Promise<ApiResponse<DoctorAppointment>> {
  try {
    const response = await apiFetch(`/doctor/appointments/${appointmentId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return {
        success: false,
        message: data.message || `Failed to update appointment status to ${status}.`,
        error: { code: data.code || "UPDATE_ERROR", message: data.message },
      };
    }

    return {
      success: true,
      message: `Appointment status updated to ${status}.`,
      data: data.data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Network error updating appointment status.",
    };
  }
}
