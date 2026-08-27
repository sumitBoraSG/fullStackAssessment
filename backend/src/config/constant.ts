const constant = {
  ENGLISH_LOCALE: "en",

  SPANISH_LOCALE: "el",

  PRODUCTION: "production",

  DEVELOPMENT: "development",

  // HTTP Status Codes
  HTTP_STATUS_OK: 200,

  HTTP_STATUS_CREATED: 201,

  HTTP_STATUS_BAD_REQUEST: 400,

  HTTP_STATUS_UNAUTHORIZED: 401,

  HTTP_STATUS_FORBIDDEN: 403,

  HTTP_STATUS_NOT_FOUND: 404,

  HTTP_STATUS_CONFLICT: 409,

  HTTP_STATUS_TOO_MANY_REQUESTS: 429,

  HTTP_STATUS_INTERNAL_ERROR: 500,

  // Auth messages
  ACCOUNT_CREATED_SUCCESSFULLY:
    "Account created successfully",

  INVALID_CREDENTIALS:
    "Invalid email or password",

  AUTH_TOKEN_REQUIRED:
    "Authentication token is required",

  AUTH_TOKEN_INVALID:
    "Invalid or expired authentication token",

  USER_NOT_AUTHENTICATED:
    "User is not authenticated",

  ACCESS_FORBIDDEN:
    "You do not have permission to access this resource",

  // Rate limiter messages
  RATE_LIMIT_GENERAL:
    "Too many requests, please try again later.",

  RATE_LIMIT_AUTH:
    "Too many authentication attempts, please try again later.",

  RATE_LIMIT_INVITATION:
    "Too many invitation requests, please try again later.",

  // Validation messages
  VALIDATION_ERROR:
    "Validation Error",

  // Admin messages
  INVITATION_SENT:
    "Invitation sent successfully",

  INVITATIONS_FETCHED:
    "Invitations fetched successfully",

  BULK_INVITATION_COMPLETED:
    "Bulk invitation process completed",

  INVITATION_REVOKED_SUCCESSFULLY:
    "Invitation revoked successfully",

  // Invitation errors
  USER_ALREADY_EXISTS:
    "A user with this email already exists",

  INVITATION_ALREADY_SENT:
    "An invitation has already been sent to this email",

  CSV_FILE_REQUIRED:
    "CSV file is required",

  INVALID_ROW_DATA:
    "Invalid row data",

  FAILED_TO_SEND_INVITATION:
    "Failed to send invitation",

  INVALID_INVITATION:
    "Invalid invitation",

  INVITATION_NOT_FOUND:
    "Invitation not found",

  INVITATION_ALREADY_USED:
    "This invitation has already been used",

  CANNOT_REVOKE_USED_INVITATION:
    "Cannot revoke an invitation that has already been used",

  INVITATION_REVOKED:
    "This invitation has been revoked",

  INVITATION_ALREADY_REVOKED:
    "This invitation has already been revoked",

  INVITATION_EXPIRED:
    "This invitation has expired",


  INVALID_REFRESH_TOKEN: "Invalid refresh token",
  REFRESH_TOKEN_EXPIRED: "Refresh token has expired",

  AVAILABILITY_DATE_IN_PAST: "Availability date cannot be in the past",

  INVALID_AVAILABILITY_TIME: "Start time must be before end time",

  AVAILABILITY_OVERLAP: "Availability overlaps with an existing availability slot",
  DOCTOR_NOT_FOUND: "Doctor not found",
};

export default constant;