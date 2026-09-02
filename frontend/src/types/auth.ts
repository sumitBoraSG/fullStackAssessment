export type UserRole = "ADMIN" | "PATIENT" | "DOCTOR";

export interface User {
  id: number | string;
  email: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
}

export interface ApiError {
  code?: string;
  message: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: ApiError;
}

export interface LoginResponse {
  success: boolean;
  data?: {
    user: User;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface RefreshTokenResponse {
  success: boolean;
  error?: {
    code: string;
    message: string;
  };
}

export interface LogoutResponse {
  success: boolean;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface InviteUserPayload {
  email: string;
  role: UserRole;
}

export interface InviteUserResponse {
  id: number;
  email: string;
  role: UserRole;
  expiresAt: string;
}

export type BloodGroup = "O+" | "O-" | "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-";

export const BLOOD_GROUPS: BloodGroup[] = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

export interface AcceptInvitationPayload {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
  // Doctor-specific
  specializationId?: number;
  experienceYears?: number;
  // Patient-specific
  dob?: string;
  heightCm?: number;
  weightKg?: number;
  bloodGroup?: BloodGroup;
}

export interface AcceptInvitationResponse {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
}

export interface InvitationDetails {
  email: string;
  role: UserRole;
}

export type InvitationStatus = "PENDING" | "USED" | "EXPIRED" | "REVOKED";

export interface InvitationItem {
  id: number | string;
  email: string;
  role: UserRole;
  status: InvitationStatus;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface GetInvitationsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: InvitationStatus | "ALL";
  role?: UserRole | "ALL";
}

export interface GetInvitationsResponse {
  success: boolean;
  message?: string;
  data?: InvitationItem[];
  pagination?: PaginationMeta;
  error?: ApiError;
}

export interface BulkInviteResultItem {
  email: string;
  role: UserRole | string;
  status: "INVITED" | "FAILED";
  reason?: string;
  invitation?: {
    id: number;
    email: string;
    role: UserRole;
    expiresAt: string;
  };
}

export interface BulkInviteData {
  total: number;
  successful: number;
  failed: number;
  results: BulkInviteResultItem[];
}

export interface BulkInviteResponse {
  success: boolean;
  message?: string;
  data?: BulkInviteData;
  error?: ApiError;
}


