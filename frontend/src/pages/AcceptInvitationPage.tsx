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
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "../context/RouterContext";
import { acceptInvitationApi } from "../api/authApi";

export const AcceptInvitationPage: React.FC = () => {
  const { setNotification } = useAuth();
  const { getParam, navigate } = useRouter();

  const tokenFromUrl = getParam("token") || "";

  const [token, setToken] = useState<string>(tokenFromUrl);
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<{
    firstName?: string;
    lastName?: string;
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});

  useEffect(() => {
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  const validate = (): boolean => {
    const errs: {
      firstName?: string;
      lastName?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

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
              <span>Invitation Verified</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 m-0 mb-2">
              Complete Your Registration
            </h1>
            <p className="text-sm text-stone-500 leading-relaxed max-w-sm mx-auto">
              You have been invited to join DocPulse. Please provide your name and set a secure password to activate your account.
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
                    className={`w-full pl-10 pr-3 py-2.5 rounded-xl bg-white border text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 shadow-2xs transition-all ${
                      errors.firstName
                        ? "border-rose-400 focus:ring-rose-500/20 bg-rose-50/30 text-rose-900"
                        : "border-stone-200 focus:border-amber-500 focus:ring-amber-500/20"
                    }`}
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
                    className={`w-full pl-10 pr-3 py-2.5 rounded-xl bg-white border text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 shadow-2xs transition-all ${
                      errors.lastName
                        ? "border-rose-400 focus:ring-rose-500/20 bg-rose-50/30 text-rose-900"
                        : "border-stone-200 focus:border-amber-500 focus:ring-amber-500/20"
                    }`}
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
                  className={`w-full pl-10 pr-11 py-2.5 rounded-xl bg-white border text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 shadow-2xs transition-all ${
                    errors.password
                      ? "border-rose-400 focus:ring-rose-500/20 bg-rose-50/30 text-rose-900"
                      : "border-stone-200 focus:border-amber-500 focus:ring-amber-500/20"
                  }`}
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
                  className={`w-full pl-10 pr-11 py-2.5 rounded-xl bg-white border text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 shadow-2xs transition-all ${
                    errors.confirmPassword
                      ? "border-rose-400 focus:ring-rose-500/20 bg-rose-50/30 text-rose-900"
                      : "border-stone-200 focus:border-amber-500 focus:ring-amber-500/20"
                  }`}
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
