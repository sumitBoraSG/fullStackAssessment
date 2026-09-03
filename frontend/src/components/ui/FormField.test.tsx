import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormField } from "./FormField";

describe("FormField", () => {
  it("renders the label and children, without a required marker or error by default", () => {
    render(
      <FormField label="Email">
        <input placeholder="email-input" />
      </FormField>,
    );
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("email-input")).toBeInTheDocument();
    expect(screen.queryByText("*")).not.toBeInTheDocument();
  });

  it("shows a required marker when required is true", () => {
    render(
      <FormField label="Email" required>
        <input />
      </FormField>,
    );
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("shows the hint text when provided", () => {
    render(
      <FormField label="Email" hint="Optional">
        <input />
      </FormField>,
    );
    expect(screen.getByText("Optional")).toBeInTheDocument();
  });

  it("shows the error message when provided, and hides it otherwise", () => {
    const { rerender } = render(
      <FormField label="Email" error="Email is required">
        <input />
      </FormField>,
    );
    expect(screen.getByText("Email is required")).toBeInTheDocument();

    rerender(
      <FormField label="Email">
        <input />
      </FormField>,
    );
    expect(screen.queryByText("Email is required")).not.toBeInTheDocument();
  });
});
