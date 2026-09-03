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
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer px-4 py-2.5";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-amber-600 via-orange-500 to-amber-700 hover:from-amber-500 hover:to-orange-500 text-white shadow-md shadow-amber-600/20",
  secondary: "bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 shadow-2xs",
  danger: "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-sm hover:shadow-md",
  ghost: "text-stone-500 hover:text-amber-700 font-semibold bg-transparent",
  success: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20",
  info: "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20",
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
