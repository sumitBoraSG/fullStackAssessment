export interface AvailabilitySlot {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
}

export interface DoctorListItem {
  id: number;
  firstName: string;
  lastName: string;
  specialization: string;
  experienceYears: number;
}

export interface SpecializationItem {
  id: number;
  name: string;
  description?: string;
}

export interface DoctorSearchParams {
  search?: string;
  specialization?: string;
  date?: string;
  page?: number;
  limit?: number;
}

export interface DoctorAvailabilityDetails {
  doctor: {
    id: number;
    firstName: string;
    lastName: string;
    specialization: string;
    experienceYears: number;
  };
  availability: AvailabilitySlot[];
}

export interface CreateAvailabilityPayload {
  date: string;
  startTime: string;
  endTime: string;
}
