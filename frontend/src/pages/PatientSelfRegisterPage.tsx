import React, { useState } from "react";
import { Mail, ArrowRight, MailCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "../context/RouterContext";
import { requestPatientRegistrationApi } from "../api/authApi";
import { FormField } from "../components/ui/FormField";
import { TextInput } from "../components/ui/TextInput";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { AuthLayout } from "../components/auth/AuthLayout";

export const PatientSelfRegisterPage: React.FC = () => {
  const { setNotification } = useAuth();
  const { navigate } = useRouter();

  const [email, setEmail] = useState<string>("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [generalError, setGeneralError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [submittedEmail, setSubmittedEmail] = useState<string>("");

  const validate = (): boolean => {
    const trimmed = email.trim();

    if (!trimmed) {
      setFieldError("Email address is required");
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setFieldError("Please enter a valid email address");
      return false;
    }

    setFieldError(undefined);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(undefined);
    if (!validate()) return;

    const trimmedEmail = email.trim();
    setIsSubmitting(true);
    const res = await requestPatientRegistrationApi(trimmedEmail);
    setIsSubmitting(false);

    // This endpoint always responds the same way regardless of whether the
    // email belongs to an existing account, already has a pending invite,
    // or is brand new. The UI must not branch on response content, only
    // on whether the request itself succeeded (format/network level).
    if (res.success) {
      setSubmittedEmail(trimmedEmail);
      setIsSubmitted(true);
      setNotification({
        type: "success",
        message: res.message || "Check your inbox for a verification link.",
      });
    } else {
      const errMsg =
        res.error?.message || res.message || "Something went wrong. Please try again.";
      setGeneralError(errMsg);
      setNotification({ type: "error", message: errMsg });
    }
  };

  if (isSubmitted) {
    return (
      <AuthLayout>
        <div className="w-full bg-[#E3DBCC] border border-[#D8D0BF] rounded-2xl p-6 sm:p-8 shadow-xs text-center space-y-5 text-[#141413]">
          <div className="w-11 h-11 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-[#141413] flex items-center justify-center mx-auto shadow-xs">
            <MailCheck className="w-5 h-5" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold text-[#141413] tracking-tight m-0">
              Check Your Inbox
            </h1>
            <p className="text-xs sm:text-sm text-[#141413]/60 leading-relaxed m-0">
              If <strong>{submittedEmail}</strong> is eligible for registration, you'll receive
              an email with a link to finish setting up your account. The link expires in 24
              hours.
            </p>
          </div>

          <Button variant="secondary" fullWidth onClick={() => navigate("/login")}>
            Back to Login
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="w-full bg-[#E3DBCC] border border-[#D8D0BF] rounded-2xl p-7 sm:p-9 shadow-xs text-[#141413]">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] mb-4 text-[#141413] shadow-xs">
              <Mail className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#141413] m-0 mb-1.5">
              Create Your Patient Account
            </h1>
            <p className="text-xs sm:text-sm text-[#141413]/60 max-w-xs mx-auto leading-relaxed m-0">
              Enter your email address and we'll send you a link to finish setting up your
              account.
            </p>
          </div>

          {generalError && (
            <div className="mb-4">
              <Alert variant="error">{generalError}</Alert>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <FormField label="Email Address" error={fieldError}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#141413]/40">
                  <Mail className="w-4 h-4" />
                </div>
                <TextInput
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldError) setFieldError(undefined);
                  }}
                  placeholder="name@example.com"
                  className="pl-9 pr-3 py-2"
                  hasError={!!fieldError}
                  disabled={isSubmitting}
                />
              </div>
            </FormField>

            <Button
              type="submit"
              fullWidth
              isLoading={isSubmitting}
              loadingText="Sending..."
              className="mt-2 py-2.5"
            >
              <span>Verify Email</span>
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
    </AuthLayout>
  );
};
