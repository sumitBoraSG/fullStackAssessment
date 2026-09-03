import { describe, expect, it } from "vitest";
import {
  PASSWORD_MIN_LENGTH,
  evaluatePasswordRules,
  getFailedPasswordRules,
  isPasswordValid,
} from "./passwordPolicy";

function rule(password: string, key: string) {
  return evaluatePasswordRules(password).find((r) => r.key === key)!;
}

describe("evaluatePasswordRules", () => {
  it("fails the length rule below the minimum and passes at/above it", () => {
    expect(rule("Ab1!".repeat(2), "length").passed).toBe(false); // 8 chars
    expect(rule("Ab1!Ab1!Ab1!", "length").passed).toBe(true); // 12 chars
  });

  it("checks for at least one uppercase letter", () => {
    expect(rule("alllower1!", "upper").passed).toBe(false);
    expect(rule("Somelower1!", "upper").passed).toBe(true);
  });

  it("checks for at least one lowercase letter", () => {
    expect(rule("ALLUPPER1!", "lower").passed).toBe(false);
    expect(rule("ALLUPPERa1!", "lower").passed).toBe(true);
  });

  it("checks for at least one digit", () => {
    expect(rule("NoDigitsHere!", "number").passed).toBe(false);
    expect(rule("HasOneDigit1!", "number").passed).toBe(true);
  });

  it("checks for at least one special character", () => {
    expect(rule("NoSpecialChars1", "special").passed).toBe(false);
    expect(rule("HasSpecial1!", "special").passed).toBe(true);
  });

  it("passes every rule for a fully compliant password", () => {
    const password = "Str0ng!Passw0rd";
    expect(password.length).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH);
    expect(evaluatePasswordRules(password).every((r) => r.passed)).toBe(true);
  });
});

describe("getFailedPasswordRules", () => {
  it("returns an empty array for a fully compliant password", () => {
    expect(getFailedPasswordRules("Str0ng!Passw0rd")).toEqual([]);
  });

  it("returns only the labels of failing rules", () => {
    const failed = getFailedPasswordRules("alllowercase");
    expect(failed).toContain("One uppercase letter");
    expect(failed).toContain("One number");
    expect(failed).toContain("One special character");
    expect(failed).not.toContain("One lowercase letter");
  });
});

describe("isPasswordValid", () => {
  it("is false for an empty string", () => {
    expect(isPasswordValid("")).toBe(false);
  });

  it("is false when exactly one rule fails", () => {
    expect(isPasswordValid("str0ng!passw0rd")).toBe(false); // no uppercase
  });

  it("is true only when every rule passes", () => {
    expect(isPasswordValid("Str0ng!Passw0rd")).toBe(true);
  });
});
