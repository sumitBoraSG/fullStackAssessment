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

  // Look up the invitation's role/email as soon as we have a token, so the
  // form can render the correct role-specific fields. The role is never
  // chosen by the user — it comes entirely from the invitation.
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

  // Doctor invitations need a specialization list to choose from.
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
    } else if (password.length < 8) {
      errs.password = "Password must be at least 8 characters";
    }

    if (!confirmPassword) {
      errs.confirmPassword = "Please confirm your password";
    } else if (confirmPassword !== password) {
      errs.confirmPassword = "Passwords do not match";
    }

    if (invitation?.role === "DOCTOR") {
      if (!specializationId) {
        errs.specializationId = "Please select a specialization";
      }
      const years = Number(experienceYears);
      if (experienceYears === "" || isNaN(years)) {
        errs.experienceYears = "Years of experience is required";
      } else if (years < 0 || years > 80) {
        errs.experienceYears = "Must be between 0 and 80 years";
      }
    }

    if (invitation?.role === "PATIENT") {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (!dob) {
        errs.dob = "Date of birth is required";
      } else if (dob >= todayStr) {
        errs.dob = "Date of birth must be in the past";
      }

      const height = Number(heightCm);
      if (heightCm === "" || isNaN(height)) {
        errs.heightCm = "Height is required";
      } else if (height < 30 || height > 300) {
        errs.heightCm = "Must be between 30 and 300 cm";
      }

      const weight = Number(weightKg);
      if (weightKg === "" || isNaN(weight)) {
        errs.weightKg = "Weight is required";
      } else if (weight < 2 || weight > 500) {
        errs.weightKg = "Must be between 2 and 500 kg";
      }

      if (!bloodGroup) {
        errs.bloodGroup = "Blood group is required";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const currentToken = getParam("token") || token;
    if (!currentToken) {
      setErrors({ general: "No invitation token found in the URL." });
      return;
    }

    if (!validate()) return;

    setIsSubmitting(true);
    setErrors({});

    const res = await acceptInvitationApi({
      token: currentToken,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      password,
      ...(invitation?.role === "DOCTOR"
        ? {
            specializationId: Number(specializationId),
            experienceYears: Number(experienceYears),
          }
        : {}),
      ...(invitation?.role === "PATIENT"
        ? {
            dob,
            heightCm: Number(heightCm),
            weightKg: Number(weightKg),
            bloodGroup: bloodGroup as BloodGroup,
          }
        : {}),
    });

    setIsSubmitting(false);

    if (res.success) {
      setNotification({
        type: "success",
        message: "Account registered successfully! You can now log in.",
      });

      // Redirect user to login page
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

  const fieldClasses = (hasError?: string) =>
    `w-full pl-10 pr-3 py-2.5 rounded-xl bg-white border text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 shadow-2xs transition-all ${
      hasError
        ? "border-rose-400 focus:ring-rose-500/20 bg-rose-50/30 text-rose-900"
        : "border-stone-200 focus:border-amber-500 focus:ring-amber-500/20"
    }`;

  // State when no token exists in the URL
  if (!token) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
        <div className="w-full max-w-md bg-white/90 border border-stone-200/80 rounded-3xl p-6 sm:p-8 shadow-xl shadow-stone-200/60 backdrop-blur-2xl text-center space-y-6 animate-in fade-in duration-300">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-2xs">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight m-0">
              Invalid Invitation Link
            </h1>
            <p className="text-sm text-stone-500 leading-relaxed">
              No valid invitation token was detected in your link. Please verify that you opened the full URL provided in your invitation email.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs text-stone-600 text-left space-y-1.5">
            <p className="font-bold text-stone-800">Expected link format:</p>
            <code className="text-amber-800 text-[11px] block font-mono break-all bg-stone-100 px-2.5 py-1 rounded-xl">
              /accept-invitation?token=&lt;token&gt;
            </code>
          </div>

          <button
            onClick={() => navigate("/login")}
            className="w-full py-3 px-4 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 text-sm font-semibold transition-all cursor-pointer shadow-2xs"
          >
            Go to Login Page
          </button>
        </div>
      </div>
    );
  }

  // Loading state while the invitation's role/email is being resolved
  if (isLoadingInvitation) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center gap-3 text-stone-500">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
          <span className="text-sm font-semibold">Verifying your invitation...</span>
        </div>
      </div>
    );
  }

  // Invitation is invalid/expired/used/revoked
  if (invitationError || !invitation) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
        <div className="w-full max-w-md bg-white/90 border border-stone-200/80 rounded-3xl p-6 sm:p-8 shadow-xl shadow-stone-200/60 backdrop-blur-2xl text-center space-y-6 animate-in fade-in duration-300">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-2xs">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight m-0">
              Invitation Unavailable
            </h1>
            <p className="text-sm text-stone-500 leading-relaxed">
              {invitationError || "This invitation link is invalid or has expired."}
            </p>
          </div>

          <button
            onClick={() => navigate("/login")}
            className="w-full py-3 px-4 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 text-sm font-semibold transition-all cursor-pointer shadow-2xs"
          >
            Go to Login Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Ambient warm lighting accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-orange-200/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        <div className="bg-white/90 border border-stone-200/80 rounded-3xl p-6 sm:p-10 shadow-xl shadow-stone-200/60 backdrop-blur-2xl transition-all">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 mb-4 shadow-sm text-amber-600">
              <UserPlus className="w-7 h-7" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-[11px] font-bold text-amber-900 mb-2 shadow-2xs">
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>Invitation Verified &bull; {invitation.role === "DOCTOR" ? "Doctor" : "Patient"} Account</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 m-0 mb-2">
              Complete Your Registration
            </h1>
            <p className="text-sm text-stone-500 leading-relaxed max-w-sm mx-auto">
              You've been invited to join DocPulse as <strong>{invitation.email}</strong>. Fill in your details below to activate your account.
            </p>
          </div>

          {/* General Error Banner */}
          {errors.general && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3 animate-in fade-in duration-200 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block text-rose-900">Registration Error</span>
                <span>{errors.general}</span>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Name Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* First Name */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  First Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      if (errors.firstName)
                        setErrors((prev) => ({ ...prev, firstName: undefined }));
                    }}
                    placeholder="John"
                    disabled={isSubmitting}
                    className={fieldClasses(errors.firstName)}
                  />
                </div>
                {errors.firstName && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{errors.firstName}</p>
                )}
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Last Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      if (errors.lastName)
                        setErrors((prev) => ({ ...prev, lastName: undefined }));
                    }}
                    placeholder="Doe"
                    disabled={isSubmitting}
                    className={fieldClasses(errors.lastName)}
                  />
                </div>
                {errors.lastName && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{errors.lastName}</p>
                )}
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-stone-700">
                  Choose Password <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-stone-400">Min. 8 characters</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password)
                      setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  className={`${fieldClasses(errors.password)} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Confirm Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword)
                      setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                  }}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  className={`${fieldClasses(errors.confirmPassword)} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Role-specific fields */}
            {invitation.role === "DOCTOR" && (
              <div className="pt-2 border-t border-stone-100 space-y-4">
                <p className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5 text-amber-600" />
                  <span>Doctor Profile</span>
                </p>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Specialization <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={specializationId}
                    onChange={(e) => {
                      setSpecializationId(e.target.value);
                      if (errors.specializationId)
                        setErrors((prev) => ({ ...prev, specializationId: undefined }));
                    }}
                    disabled={isSubmitting}
                    className={`w-full px-3 py-2.5 rounded-xl bg-white border text-sm text-stone-900 focus:outline-none focus:ring-2 shadow-2xs transition-all ${
                      errors.specializationId
                        ? "border-rose-400 focus:ring-rose-500/20"
                        : "border-stone-200 focus:border-amber-500 focus:ring-amber-500/20"
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
                    <p className="mt-1 text-xs text-rose-600 font-medium">{errors.specializationId}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Years of Experience <span className="text-rose-500">*</span>
                  </label>
                  <input
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
                    className={`w-full px-3 py-2.5 rounded-xl bg-white border text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 shadow-2xs transition-all ${
                      errors.experienceYears
                        ? "border-rose-400 focus:ring-rose-500/20"
                        : "border-stone-200 focus:border-amber-500 focus:ring-amber-500/20"
                    }`}
                  />
                  {errors.experienceYears && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">{errors.experienceYears}</p>
                  )}
                </div>
              </div>
            )}

            {invitation.role === "PATIENT" && (
              <div className="pt-2 border-t border-stone-100 space-y-4">
                <p className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                  <HeartPulse className="w-3.5 h-3.5 text-amber-600" />
                  <span>Patient Profile</span>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      Date of Birth <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => {
                        setDob(e.target.value);
                        if (errors.dob) setErrors((prev) => ({ ...prev, dob: undefined }));
                      }}
                      disabled={isSubmitting}
                      max={new Date().toISOString().slice(0, 10)}
                      className={`w-full px-3 py-2.5 rounded-xl bg-white border text-sm text-stone-900 focus:outline-none focus:ring-2 shadow-2xs transition-all ${
                        errors.dob
                          ? "border-rose-400 focus:ring-rose-500/20"
                          : "border-stone-200 focus:border-amber-500 focus:ring-amber-500/20"
                      }`}
                    />
                    {errors.dob && (
                      <p className="mt-1 text-xs text-rose-600 font-medium">{errors.dob}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      Blood Group <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={bloodGroup}
                      onChange={(e) => {
                        setBloodGroup(e.target.value as BloodGroup);
                        if (errors.bloodGroup)
                          setErrors((prev) => ({ ...prev, bloodGroup: undefined }));
                      }}
                      disabled={isSubmitting}
                      className={`w-full px-3 py-2.5 rounded-xl bg-white border text-sm text-stone-900 focus:outline-none focus:ring-2 shadow-2xs transition-all ${
                        errors.bloodGroup
                          ? "border-rose-400 focus:ring-rose-500/20"
                          : "border-stone-200 focus:border-amber-500 focus:ring-amber-500/20"
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
                      <p className="mt-1 text-xs text-rose-600 font-medium">{errors.bloodGroup}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      Height (cm) <span className="text-rose-500">*</span>
                    </label>
                    <input
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
                      className={`w-full px-3 py-2.5 rounded-xl bg-white border text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 shadow-2xs transition-all ${
                        errors.heightCm
                          ? "border-rose-400 focus:ring-rose-500/20"
                          : "border-stone-200 focus:border-amber-500 focus:ring-amber-500/20"
                      }`}
                    />
                    {errors.heightCm && (
                      <p className="mt-1 text-xs text-rose-600 font-medium">{errors.heightCm}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      Weight (kg) <span className="text-rose-500">*</span>
                    </label>
                    <input
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
                      className={`w-full px-3 py-2.5 rounded-xl bg-white border text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 shadow-2xs transition-all ${
                        errors.weightKg
                          ? "border-rose-400 focus:ring-rose-500/20"
                          : "border-stone-200 focus:border-amber-500 focus:ring-amber-500/20"
                      }`}
                    />
                    {errors.weightKg && (
                      <p className="mt-1 text-xs text-rose-600 font-medium">{errors.weightKg}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Security note */}
            <div className="py-1">
              <p className="text-[11px] text-stone-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>Your email and role are pre-assigned by the administrator.</span>
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-3 py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 via-orange-500 to-amber-700 hover:from-amber-500 hover:via-orange-400 hover:to-amber-600 text-white text-sm font-bold shadow-md shadow-amber-600/20 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create & Activate Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Already have an account */}
          <div className="mt-6 pt-4 border-t border-stone-100 text-center">
            <button
              onClick={() => navigate("/login")}
              className="text-xs text-stone-500 hover:text-amber-700 font-semibold transition-colors cursor-pointer"
            >
              Already registered? Sign in instead &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
