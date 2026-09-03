import type { BloodGroup } from "./auth";

// Field shapes mirror the backend contract exactly:
// GET/PATCH /patient/profile -> {id, firstName, lastName, email, heightCm, weightKg, bloodGroup, dob}
// GET/PATCH /doctor/profile -> {id, firstName, lastName, email, specialization, experienceYears}
// Role is intentionally not part of these payloads - it's already known from
// AuthContext's `user.role`, which is what ProfilePage uses to pick a form.
export interface PatientProfileData {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  dob: string | null;
  bloodGroup: BloodGroup | null;
  heightCm: number | null;
  weightKg: number | null;
}

export interface DoctorProfileData {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  specialization: string;
  experienceYears: number;
}

export interface UpdatePatientProfilePayload {
  heightCm: number;
  weightKg: number;
}

export interface UpdateDoctorProfilePayload {
  experienceYears: number;
}
