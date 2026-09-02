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
  AVAILABILITY_TIME_IN_PAST: "Availability time cannot be in the past",


  INVALID_AVAILABILITY_TIME: "Start time must be before end time",

  AVAILABILITY_OVERLAP: "Availability overlaps with an existing availability slot",
  AVAILABILITY_NOT_FOUND: "Availability slot not found or does not belong to you",

  DOCTOR_NOT_FOUND: "Doctor not found",

  // Appointment messages & errors
  PATIENT_NOT_FOUND: "Patient not found",
  APPOINTMENT_NOT_FOUND: "Appointment not found",
  DOCTOR_NOT_AVAILABLE: "Doctor is not available at this time",
  APPOINTMENT_TIME_UNAVAILABLE: "Appointment time is no longer available",
  APPOINTMENT_DATE_IN_PAST: "Appointment date cannot be in the past",
  APPOINTMENT_TIME_IN_PAST: "Appointment time cannot be in the past",
  INVALID_APPOINTMENT_TIME: "Start time must be before end time",
  INVALID_STATUS_TRANSITION: "Invalid appointment status transition",
  PATIENT_CAN_ONLY_CANCEL: "Patients can only update appointment status to CANCELLED",
  INVALID_DATE_FILTER: "Use either date or dateFrom/dateTo filters",
  INVALID_DATE_RANGE: "dateFrom cannot be after dateTo",
  APPOINTMENT_CREATED_SUCCESSFULLY: "Appointment created successfully",
  APPOINTMENTS_FETCHED: "Appointments fetched successfully",
  APPOINTMENT_STATUS_UPDATED: "Appointment status updated successfully",
  APPOINTMENT_CANCELLED_SUCCESSFULLY: "Appointment cancelled successfully",
  APPOINTMENT_TIME_ALREADY_PASSED: "Cannot confirm an appointment whose scheduled time has already passed",
  APPOINTMENT_NOT_YET_STARTED: "Cannot mark an appointment as completed before its scheduled time has started",
  CANNOT_CANCEL_PAST_APPOINTMENT: "Cannot cancel an appointment whose scheduled time has already passed",
  APPOINTMENT_STATUS_CONFLICT: "This appointment was already updated by another request. Please refresh and try again.",

  // Bulk invitation limits
  MAX_BULK_INVITE_ROWS: 500,
  CSV_ROW_LIMIT_EXCEEDED: "CSV file exceeds the maximum allowed number of rows (500)",
  DUPLICATE_EMAIL_IN_FILE: "Duplicate email within the uploaded file",

  // Role-specific signup profile validation
  SPECIALIZATION_ID_REQUIRED: "Specialization is required for doctor accounts",
  INVALID_SPECIALIZATION: "Selected specialization does not exist or is inactive",
  EXPERIENCE_YEARS_REQUIRED: "Years of experience is required for doctor accounts",
  INVALID_EXPERIENCE_YEARS: "Years of experience must be between 0 and 80",
  DOB_REQUIRED: "Date of birth is required for patient accounts",
  INVALID_DOB: "Date of birth must be a valid past date",
  HEIGHT_REQUIRED: "Height is required for patient accounts",
  INVALID_HEIGHT: "Height must be between 30 and 300 cm",
  WEIGHT_REQUIRED: "Weight is required for patient accounts",
  INVALID_WEIGHT: "Weight must be between 2 and 500 kg",
  BLOOD_GROUP_REQUIRED: "Blood group is required for patient accounts",
  INVALID_BLOOD_GROUP: "Invalid blood group",

};

export default constant;