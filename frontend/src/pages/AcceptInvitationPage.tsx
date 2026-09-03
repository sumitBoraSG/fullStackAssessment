import React, { useState, useEffect } from "react";
import {
  UserPlus,
  Lock,
  Eye,
  EyeOff,
  User,
  ArrowRight,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  HeartPulse,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "../context/RouterContext";
import { acceptInvitationApi, getInvitationDetailsApi } from "../api/authApi";
import { getSpecializationsApi } from "../api/doctorApi";
import { BLOOD_GROUPS, type BloodGroup, type InvitationDetails } from "../types/auth";
import type { SpecializationItem } from "../types/doctor";
import { isPasswordValid, getFailedPasswordRules } from "../utils/passwordPolicy";
import { PasswordRequirementChecklist } from "../components/auth/PasswordRequirementChecklist";
import { FormField } from "../components/ui/FormField";
import { TextInput } from "../components/ui/TextInput";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";

interface FormErrors {
  firstName?: string;
  lastName?: string;
  password?: string;
  confirmPassword?: string;
  specializationId?: string;
  experienceYears?: string;
  dob?: string;
  heightCm?: string;
  weightKg?: string;
  bloodGroup?: string;
  general?: string;
}

export const AcceptInvitationPage: React.FC = () => {
  const { setNotification } = useAuth();
  const { getParam, navigate } = useRouter();

  const tokenFromUrl = getParam("token") || "";

  const [token, setToken] = useState<string>(tokenFromUrl);

  // Invitation lookup state
  const [isLoadingInvitation, setIsLoadingInvitation] = useState<boolean>(true);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);

  // Common fields
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  // Doctor-specific fields
  const [specializations, setSpecializations] = useState<SpecializationItem[]>([]);
  const [specializationId, setSpecializationId] = useState<string>("");
  const [experienceYears, setExperienceYears] = useState<string>("");

  // Patient-specific fields
  const [dob, setDob] = useState<string>("");
  const [heightCm, setHeightCm] = useState<string>("");
  const [weightKg, setWeightKg] = useState<string>("");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | "">("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  useEffect(() => {
    if (!token) {
      setIsLoadingInvitation(false);
      return;
    }

    let cancelled = false;
    setIsLoadingInvitation(true);
    setInvitationError(null);

    getInvitationDetailsApi(token).then((res) => {
      if (cancelled) return;
      setIsLoadingInvitation(false);

      if (res.success && res.data) {
        setInvitation(res.data);
      } else {
        setInvitationError(
          res.message || "This invitation link is invalid or has expired."
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (invitation?.role !== "DOCTOR") return;

    getSpecializationsApi().then((res) => {
      if (res.success && res.data) {
        setSpecializations(res.data);
      }
    });
  }, [invitation]);

  const validate = (): boolean => {
    const errs: FormErrors = {};

    const trimmedFirst = firstName.trim();
    if (!trimmedFirst) {
      errs.firstName = "First name is required";
    } else if (trimmedFirst.length < 2) {
      errs.firstName = "First name must be at least 2 characters";
    }

    const trimmedLast = lastName.trim();
    if (!trimmedLast) {
      errs.lastName = "Last name is required";
    } else if (trimmedLast.length < 2) {
      errs.lastName = "Last name must be at least 2 characters";
    }

    if (!password) {
      errs.password = "Password is required";
    } else if (!isPasswordValid(password)) {
      errs.password = `Password must include: ${getFailedPasswordRules(password).join(", ")}`;
    }

    if (!confirmPassword) {
      errs.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match";
    }

    if (invitation?.role === "DOCTOR") {
      if (!specializationId) {
        errs.specializationId = "Specialization is required";
      }
      const exp = Number(experienceYears);
      if (experienceYears === "" || isNaN(exp)) {
        errs.experienceYears = "Years of experience is required";
      } else if (exp < 0 || exp > 80) {
        errs.experienceYears = "Experience must be between 0 and 80 years";
      }
    }

    if (invitation?.role === "PATIENT") {
      if (!dob) {
        errs.dob = "Date of birth is required";
      } else {
        const d = new Date(dob);
        if (isNaN(d.getTime())) {
          errs.dob = "Please enter a valid date";
        } else if (d > new Date()) {
          errs.dob = "Date of birth cannot be in the future";
        }
      }

      if (!bloodGroup) {
        errs.bloodGroup = "Blood group is required";
      }

      const h = Number(heightCm);
      if (heightCm === "" || isNaN(h)) {
        errs.heightCm = "Height is required";
      } else if (h < 30 || h > 300) {
        errs.heightCm = "Height must be between 30 and 300 cm";
      }

      const w = Number(weightKg);
      if (weightKg === "" || isNaN(w)) {
        errs.weightKg = "Weight is required";
      } else if (w < 2 || w > 500) {
        errs.weightKg = "Weight must be between 2 and 500 kg";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !invitation) return;
    if (!validate()) return;

    setIsSubmitting(true);
    setErrors({});

    const payload: {
      token: string;
      firstName: string;
      lastName: string;
      password: string;
      specializationId?: number;
      experienceYears?: number;
      dob?: string;
      bloodGroup?: BloodGroup;
      heightCm?: number;
      weightKg?: number;
    } = {
      token,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      password,
    };

    if (invitation.role === "DOCTOR") {
      payload.specializationId = Number(specializationId);
      payload.experienceYears = Number(experienceYears);
    } else if (invitation.role === "PATIENT") {
      payload.dob = dob;
      payload.bloodGroup = bloodGroup as BloodGroup;
      payload.heightCm = Number(heightCm);
      payload.weightKg = Number(weightKg);
    }

    const res = await acceptInvitationApi(payload);
    setIsSubmitting(false);

    if (res.success) {
      setNotification({
        type: "success",
        message: "Account registered successfully! You can now log in.",
      });

      setTimeout(() => {
        navigate("/login");
      }, 1200);
    } else {
      const errMsg =
        res.error?.message ||
        res.message ||
        "Unable to complete registration. The invitation may be expired or already used.";
      setNotification({
        type: "error",
        message: errMsg,
      });
      setErrors({ general: errMsg });
    }
  };

  // State when no token exists in the URL
  if (!token) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md bg-[#E3DBCC] border border-[#D8D0BF] rounded-2xl p-6 sm:p-8 shadow-xs text-center space-y-5 text-[#141413]">
          <div className="w-11 h-11 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-[#8E2A22] flex items-center justify-center mx-auto shadow-xs">
            <AlertTriangle className="w-5 h-5" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold text-[#141413] tracking-tight m-0">
              Invalid Invitation Link
            </h1>
            <p className="text-xs sm:text-sm text-[#141413]/60 leading-relaxed m-0">
              No valid invitation token was detected in your link. Please verify that you opened the full URL provided in your invitation email.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-xs text-[#141413]/70 text-left space-y-1">
            <p className="font-semibold text-[#141413] m-0">Expected link format:</p>
            <code className="text-[#141413] text-[11px] block font-mono break-all">
              /accept-invitation?token=&lt;token&gt;
            </code>
          </div>

          <Button variant="secondary" fullWidth onClick={() => navigate("/login")}>
            Go to Login Page
          </Button>
        </div>
      </div>
    );
  }

  // Loading state while the invitation's role/email is being resolved
  if (isLoadingInvitation) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center gap-3 text-[#141413]/60">
          <Loader2 className="w-6 h-6 animate-spin text-[#141413]" />
          <span className="text-xs font-medium text-[#141413]">Verifying your invitation...</span>
        </div>
      </div>
    );
  }

  // Invitation is invalid/expired/used/revoked
  if (invitationError || !invitation) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md bg-[#E3DBCC] border border-[#D8D0BF] rounded-2xl p-6 sm:p-8 shadow-xs text-center space-y-5 text-[#141413]">
          <div className="w-11 h-11 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-[#8E2A22] flex items-center justify-center mx-auto shadow-xs">
            <AlertTriangle className="w-5 h-5" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold text-[#141413] tracking-tight m-0">
              Invitation Unavailable
            </h1>
            <p className="text-xs sm:text-sm text-[#141413]/60 leading-relaxed m-0">
              {invitationError || "This invitation link is invalid or has expired."}
            </p>
          </div>

          <Button variant="secondary" fullWidth onClick={() => navigate("/login")}>
            Go to Login Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-lg">
        <div className="bg-[#E3DBCC] border border-[#D8D0BF] rounded-2xl p-6 sm:p-8 shadow-xs text-[#141413]">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] mb-3 text-[#141413] shadow-xs">
              <UserPlus className="w-5 h-5" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#FAF8F5] border border-[#D8D0BF] text-[11px] font-medium text-[#141413] mb-2">
              <Sparkles className="w-3 h-3 text-[#141413]" />
              <span>Invitation Verified &bull; {invitation.role === "DOCTOR" ? "Doctor" : "Patient"} Account</span>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-[#141413] m-0 mb-1">
              Complete Your Registration
            </h1>
            <p className="text-xs sm:text-sm text-[#141413]/60 leading-relaxed max-w-sm mx-auto m-0">
              You've been invited to join DocPulse as <strong>{invitation.email}</strong>. Fill in your details below to activate your account.
            </p>
          </div>

          {/* General Error Banner */}
          {errors.general && (
            <div className="mb-5">
              <Alert variant="error" title="Registration Error">
                {errors.general}
              </Alert>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Name Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* First Name */}
              <FormField label="First Name" required error={errors.firstName}>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#141413]/40">
                    <User className="w-4 h-4" />
                  </div>
                  <TextInput
                    type="text"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      if (errors.firstName)
                        setErrors((prev) => ({ ...prev, firstName: undefined }));
                    }}
                    placeholder="John"
                    disabled={isSubmitting}
                    hasError={!!errors.firstName}
                    className="pl-9 pr-3"
                  />
                </div>
              </FormField>

              {/* Last Name */}
              <FormField label="Last Name" required error={errors.lastName}>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#141413]/40">
                    <User className="w-4 h-4" />
                  </div>
                  <TextInput
                    type="text"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      if (errors.lastName)
                        setErrors((prev) => ({ ...prev, lastName: undefined }));
                    }}
                    placeholder="Doe"
                    disabled={isSubmitting}
                    hasError={!!errors.lastName}
                    className="pl-9 pr-3"
                  />
                </div>
              </FormField>
            </div>

            {/* Password */}
            <FormField label="Choose Password" required error={errors.password}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#141413]/40">
                  <Lock className="w-4 h-4" />
                </div>
                <TextInput
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password)
                      setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  hasError={!!errors.password}
                  className="pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#141413]/40 hover:text-[#141413] transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="mt-2">
                <PasswordRequirementChecklist password={password} />
              </div>
            </FormField>

            {/* Confirm Password */}
            <FormField label="Confirm Password" required error={errors.confirmPassword}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#141413]/40">
                  <Lock className="w-4 h-4" />
                </div>
                <TextInput
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword)
                      setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                  }}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  hasError={!!errors.confirmPassword}
                  className="pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#141413]/40 hover:text-[#141413] transition-colors cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </FormField>

            {/* Role-specific fields */}
            {invitation.role === "DOCTOR" && (
              <div className="pt-2 border-t border-[#D8D0BF] space-y-3.5">
                <p className="text-xs font-semibold text-[#141413] flex items-center gap-1.5 m-0">
                  <Stethoscope className="w-3.5 h-3.5 text-[#141413]/70" />
                  <span>Doctor Profile</span>
                </p>

                <div>
                  <label className="block text-xs font-medium text-[#141413] mb-1">
                    Specialization <span className="text-[#8E2A22]">*</span>
                  </label>
                  <select
                    value={specializationId}
                    onChange={(e) => {
                      setSpecializationId(e.target.value);
                      if (errors.specializationId)
                        setErrors((prev) => ({ ...prev, specializationId: undefined }));
                    }}
                    disabled={isSubmitting}
                    className={`w-full px-3 py-2 rounded-lg bg-[#FAF8F5] border text-xs sm:text-sm text-[#141413] focus:outline-none focus:border-[#141413] transition-all ${
                      errors.specializationId
                        ? "border-[#8E2A22] text-[#8E2A22]"
                        : "border-[#D8D0BF]"
                    }`}
                  >
                    <option value="">Select a specialization</option>
                    {specializations.map((spec) => (
                      <option key={spec.id} value={spec.id}>
                        {spec.name}
                      </option>
                    ))}
                  </select>
                  {errors.specializationId && (
                    <p className="mt-1 text-xs text-[#8E2A22] font-medium">{errors.specializationId}</p>
                  )}
                </div>

                <FormField label="Years of Experience" required error={errors.experienceYears}>
                  <TextInput
                    type="number"
                    min={0}
                    max={80}
                    value={experienceYears}
                    onChange={(e) => {
                      setExperienceYears(e.target.value);
                      if (errors.experienceYears)
                        setErrors((prev) => ({ ...prev, experienceYears: undefined }));
                    }}
                    placeholder="e.g. 5"
                    disabled={isSubmitting}
                    hasError={!!errors.experienceYears}
                  />
                </FormField>
              </div>
            )}

            {invitation.role === "PATIENT" && (
              <div className="pt-2 border-t border-[#D8D0BF] space-y-3.5">
                <p className="text-xs font-semibold text-[#141413] flex items-center gap-1.5 m-0">
                  <HeartPulse className="w-3.5 h-3.5 text-[#141413]/70" />
                  <span>Patient Profile</span>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <FormField label="Date of Birth" required error={errors.dob}>
                    <TextInput
                      type="date"
                      value={dob}
                      onChange={(e) => {
                        setDob(e.target.value);
                        if (errors.dob) setErrors((prev) => ({ ...prev, dob: undefined }));
                      }}
                      disabled={isSubmitting}
                      max={new Date().toISOString().slice(0, 10)}
                      hasError={!!errors.dob}
                    />
                  </FormField>

                  <div>
                    <label className="block text-xs font-medium text-[#141413] mb-1">
                      Blood Group <span className="text-[#8E2A22]">*</span>
                    </label>
                    <select
                      value={bloodGroup}
                      onChange={(e) => {
                        setBloodGroup(e.target.value as BloodGroup);
                        if (errors.bloodGroup)
                          setErrors((prev) => ({ ...prev, bloodGroup: undefined }));
                      }}
                      disabled={isSubmitting}
                      className={`w-full px-3 py-2 rounded-lg bg-[#FAF8F5] border text-xs sm:text-sm text-[#141413] focus:outline-none focus:border-[#141413] transition-all ${
                        errors.bloodGroup
                          ? "border-[#8E2A22] text-[#8E2A22]"
                          : "border-[#D8D0BF]"
                      }`}
                    >
                      <option value="">Select</option>
                      {BLOOD_GROUPS.map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))}
                    </select>
                    {errors.bloodGroup && (
                      <p className="mt-1 text-xs text-[#8E2A22] font-medium">{errors.bloodGroup}</p>
                    )}
                  </div>

                  <FormField label="Height (cm)" required error={errors.heightCm}>
                    <TextInput
                      type="number"
                      min={30}
                      max={300}
                      value={heightCm}
                      onChange={(e) => {
                        setHeightCm(e.target.value);
                        if (errors.heightCm)
                          setErrors((prev) => ({ ...prev, heightCm: undefined }));
                      }}
                      placeholder="e.g. 170"
                      disabled={isSubmitting}
                      hasError={!!errors.heightCm}
                    />
                  </FormField>

                  <FormField label="Weight (kg)" required error={errors.weightKg}>
                    <TextInput
                      type="number"
                      min={2}
                      max={500}
                      value={weightKg}
                      onChange={(e) => {
                        setWeightKg(e.target.value);
                        if (errors.weightKg)
                          setErrors((prev) => ({ ...prev, weightKg: undefined }));
                      }}
                      placeholder="e.g. 65"
                      disabled={isSubmitting}
                      hasError={!!errors.weightKg}
                    />
                  </FormField>
                </div>
              </div>
            )}

            {/* Security note */}
            <div className="py-1">
              <p className="text-[11px] text-[#141413]/60 flex items-center gap-1.5 m-0">
                <ShieldCheck className="w-3.5 h-3.5 text-[#141413]/70" />
                <span>Your email and role are pre-assigned by the administrator.</span>
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              fullWidth
              isLoading={isSubmitting}
              loadingText="Creating Account..."
              className="mt-2 py-2.5"
            >
              <span>Create & Activate Account</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          {/* Already have an account */}
          <div className="mt-5 pt-4 border-t border-[#D8D0BF] text-center">
            <button
              onClick={() => navigate("/login")}
              className="text-xs text-[#141413]/70 hover:text-[#141413] hover:underline font-medium transition-colors cursor-pointer"
            >
              Already registered? Sign in instead &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
