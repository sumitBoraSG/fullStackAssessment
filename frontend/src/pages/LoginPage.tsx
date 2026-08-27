import React, { useState } from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Stethoscope,
  UserCircle,
  Sparkles,
  Loader2,
  LockKeyhole,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export const LoginPage: React.FC = () => {
  const { login, isLoading } = useAuth();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = (): boolean => {
    const errs: { email?: string; password?: string } = {};

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errs.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errs.email = "Please enter a valid email address";
    }

    if (!password) {
      errs.password = "Password is required";
    } else if (password.length < 8) {
      errs.password = "Password must be at least 8 characters";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await login(email.trim(), password);
  };

  const handleQuickDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrors({});
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Background ambient warm lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-orange-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-rose-200/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Card */}
        <div className="bg-white/90 border border-stone-200/80 rounded-3xl p-6 sm:p-8 shadow-xl shadow-stone-200/60 backdrop-blur-2xl transition-all">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 mb-4 shadow-sm text-amber-600">
              <LockKeyhole className="w-7 h-7" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 m-0 mb-2">
              Welcome to DocPulse
            </h1>
            <p className="text-sm text-stone-500">
              Sign in to manage appointments, patients, and healthcare services
            </p>
          </div>

          {/* Quick Fill Demo Badges */}
          <div className="mb-6 bg-stone-50/80 p-3.5 rounded-2xl border border-stone-200/80">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Quick Demo Accounts
              </span>
              <span className="text-[10px] text-stone-400 font-mono">Click to autofill</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemo("admin@example.com", "Password123!")}
                className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100/80 border border-amber-200/80 text-amber-900 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] active:scale-95 shadow-2xs cursor-pointer"
              >
                <ShieldCheck className="w-3 h-3 text-amber-600" />
                Admin
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo("robert@example.com", "Password123!")}
                className="px-2.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100/80 border border-teal-200/80 text-teal-900 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] active:scale-95 shadow-2xs cursor-pointer"
              >
                <Stethoscope className="w-3 h-3 text-teal-600" />
                Doctor
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo("john@example.com", "Password123!")}
                className="px-2.5 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100/80 border border-orange-200/80 text-orange-900 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] active:scale-95 shadow-2xs cursor-pointer"
              >
                <UserCircle className="w-3 h-3 text-orange-600" />
                Patient
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  placeholder="name@example.com"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 shadow-2xs transition-all ${
                    errors.email
                      ? "border-rose-400 focus:ring-rose-500/20 bg-rose-50/30 text-rose-900"
                      : "border-stone-200 focus:border-amber-500 focus:ring-amber-500/20"
                  }`}
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{errors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-stone-700">
                  Password
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
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-11 py-2.5 rounded-xl bg-white border text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 shadow-2xs transition-all ${
                    errors.password
                      ? "border-rose-400 focus:ring-rose-500/20 bg-rose-50/30 text-rose-900"
                      : "border-stone-200 focus:border-amber-500 focus:ring-amber-500/20"
                  }`}
                  disabled={isLoading}
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 via-orange-500 to-amber-700 hover:from-amber-500 hover:to-orange-500 text-white text-sm font-bold shadow-md shadow-amber-600/20 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer Security Badge */}
          <div className="mt-6 pt-4 border-t border-stone-100 text-center">
            <p className="text-[11px] text-stone-500 flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Protected by Rate Limiter & JWT Role-Based Access
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
