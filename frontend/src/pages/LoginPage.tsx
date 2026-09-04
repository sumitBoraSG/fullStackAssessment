import React, { useState } from "react";
import { Mail, Lock, Eye, EyeOff, ArrowRight, LockKeyhole } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "../context/RouterContext";
import { Card } from "../components/ui/Card";
import { FormField } from "../components/ui/FormField";
import { TextInput } from "../components/ui/TextInput";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { AuthLayout } from "../components/auth/AuthLayout";

export const LoginPage: React.FC = () => {
  const { login, isLoading } = useAuth();
  const { navigate } = useRouter();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [generalError, setGeneralError] = useState<string | undefined>(undefined);

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
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(undefined);
    if (!validate()) return;

    const res = await login(email.trim(), password);
    if (!res.success) {
      setGeneralError(res.message || "Invalid credentials. Please try again.");
    }
  };

  return (
    <AuthLayout>
      <Card variant="auth" className="bg-[#E3DBCC] border border-[#D8D0BF] rounded-2xl p-7 sm:p-9 shadow-xs text-[#141413]">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] mb-4 text-[#141413] shadow-xs">
              <LockKeyhole className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#141413] m-0 mb-1.5">
              Welcome to DocPulse
            </h1>
            <p className="text-xs sm:text-sm text-[#141413]/60 max-w-xs mx-auto leading-relaxed m-0">
              Sign in to manage appointments, patients, and healthcare consultations.
            </p>
          </div>

          {generalError && (
            <div className="mb-4">
              <Alert variant="error">{generalError}</Alert>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email Field */}
            <FormField label="Email Address" error={errors.email}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#141413]/40">
                  <Mail className="w-4 h-4" />
                </div>
                <TextInput
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                    if (generalError) setGeneralError(undefined);
                  }}
                  placeholder="name@example.com"
                  className="pl-9 pr-3 py-2"
                  hasError={!!errors.email}
                  disabled={isLoading}
                />
              </div>
            </FormField>

            {/* Password Field */}
            <FormField label="Password" error={errors.password}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#141413]/40">
                  <Lock className="w-4 h-4" />
                </div>
                <TextInput
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                    if (generalError) setGeneralError(undefined);
                  }}
                  placeholder="••••••••"
                  className="pl-9 pr-10 py-2"
                  hasError={!!errors.password}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#141413]/40 hover:text-[#141413] transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </FormField>

            {/* Submit Button */}
            <Button
              type="submit"
              fullWidth
              isLoading={isLoading}
              loadingText="Authenticating..."
              className="mt-2 py-2.5"
            >
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          {/* New patient self-registration */}
          <div className="mt-5 pt-4 border-t border-[#D8D0BF] text-center">
            <button
              type="button"
              onClick={() => navigate("/register")}
              className="text-xs text-[#141413]/70 hover:text-[#141413] hover:underline font-medium transition-colors cursor-pointer"
            >
              New patient? Create an account &rarr;
            </button>
          </div>
      </Card>
    </AuthLayout>
  );
};
