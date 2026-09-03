import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PasswordRequirementChecklist } from "./PasswordRequirementChecklist";

describe("PasswordRequirementChecklist", () => {
  it("shows all five rules as unmet for an empty password", () => {
    render(<PasswordRequirementChecklist password="" />);
    expect(screen.getByText("At least 12 characters")).toBeInTheDocument();
    expect(screen.getByText("One uppercase letter")).toBeInTheDocument();
    expect(screen.getByText("One lowercase letter")).toBeInTheDocument();
    expect(screen.getByText("One number")).toBeInTheDocument();
    expect(screen.getByText("One special character")).toBeInTheDocument();
  });

  it("marks a rule as passed (text-emerald-700 class) once satisfied", () => {
    render(<PasswordRequirementChecklist password="A" />);
    const upperRule = screen.getByText("One uppercase letter").closest("div");
    expect(upperRule).toHaveClass("text-emerald-700");

    const lowerRule = screen.getByText("One lowercase letter").closest("div");
    expect(lowerRule).toHaveClass("text-stone-400");
  });

  it("marks every rule as passed for a fully compliant password", () => {
    render(<PasswordRequirementChecklist password="CorrectPassword1!" />);
    for (const label of [
      "At least 12 characters",
      "One uppercase letter",
      "One lowercase letter",
      "One number",
      "One special character",
    ]) {
      expect(screen.getByText(label).closest("div")).toHaveClass("text-emerald-700");
    }
  });
});
