export const PASSWORD_MIN_LENGTH = 12;

export interface PasswordRuleResult {
  key: string;
  label: string;
  passed: boolean;
}

export function evaluatePasswordRules(password: string): PasswordRuleResult[] {
  return [
    {
      key: "length",
      label: `At least ${PASSWORD_MIN_LENGTH} characters`,
      passed: password.length >= PASSWORD_MIN_LENGTH,
    },
    { key: "upper", label: "One uppercase letter", passed: /[A-Z]/.test(password) },
    { key: "lower", label: "One lowercase letter", passed: /[a-z]/.test(password) },
    { key: "number", label: "One number", passed: /[0-9]/.test(password) },
    { key: "special", label: "One special character", passed: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function getFailedPasswordRules(password: string): string[] {
  return evaluatePasswordRules(password)
    .filter((r) => !r.passed)
    .map((r) => r.label);
}

export function isPasswordValid(password: string): boolean {
  return evaluatePasswordRules(password).every((r) => r.passed);
}
