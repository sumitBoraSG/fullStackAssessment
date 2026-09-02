import type { PaginationMeta } from "./auth";

export type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "REJECTED"
  | "COMPLETED";

export interface DoctorInfo {
  doctorId: number;
  firstName: string;
  lastName: string;
  specialization: string;
  experienceYears: number;
}

export interface PatientInfo {
  patientId: number;
  firstName: string;
  lastName: string;
  email: string;
}

export interface PatientAppointment {
  id: number;
  status: AppointmentStatus;
  date: string;
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt: string;
  doctor: DoctorInfo;
}

export interface DoctorAppointment {
  id: number;
  status: AppointmentStatus;
  date: string;
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt: string;
  patient: PatientInfo;
}

export interface CreateAppointmentPayload {
  doctorId: number;
  date: string;
  startTime: string;
  endTime: string;
}

export interface GetAppointmentsParams {
  page?: number;
  limit?: number;
  status?: AppointmentStatus | "ALL";
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  doctorId?: number;
  patientId?: number;
  sortBy?: "appointmentTime" | "createdAt" | "updatedAt";
  order?: "ASC" | "DESC";
}

export interface AppointmentsResponse<T> {
  appointments: T[];
  pagination: PaginationMeta;
}
