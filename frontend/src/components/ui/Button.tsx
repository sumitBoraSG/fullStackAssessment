import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "success" | "info";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  loadingText?: string;
  fullWidth?: boolean;
}

const baseClasses =
  "group inline-flex items-center justify-center gap-2 rounded-lg text-xs sm:text-sm font-medium tracking-tight transition-all duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 cursor-pointer px-4 py-2.5 select-none";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[#141413] hover:bg-[#262624] text-[#F0EEE6] border border-[#141413] shadow-xs",
  secondary:
    "bg-[#E3DBCC] hover:bg-[#D9D1C1] border border-[#D8D0BF] text-[#141413] shadow-xs",
  danger:
    "bg-[#8E2A22] hover:bg-[#7A231C] border border-[#8E2A22] text-[#F0EEE6] shadow-xs",
  ghost:
    "text-[#141413]/80 hover:text-[#141413] hover:bg-[#E3DBCC]/50 bg-transparent border border-transparent",
  success:
    "bg-[#2B5438] hover:bg-[#22442D] border border-[#2B5438] text-[#F0EEE6] shadow-xs",
  info:
    "bg-[#1E2E3D] hover:bg-[#16222E] border border-[#1E2E3D] text-[#F0EEE6] shadow-xs",
};

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  isLoading = false,
  loadingText,
  fullWidth = false,
  disabled,
  className,
  children,
  ...props
}) => {
  return (
    <button
      disabled={isLoading || disabled}
      className={cn(baseClasses, variantClasses[variant], fullWidth && "w-full", className)}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{loadingText ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};
