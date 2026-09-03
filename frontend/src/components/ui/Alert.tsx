import React from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "../../utils/cn";

export type AlertVariant = "success" | "error" | "info" | "warning";

export interface AlertProps {
  variant: AlertVariant;
  title?: string;
  children: React.ReactNode;
}

const variantClasses: Record<AlertVariant, string> = {
  error: "bg-rose-50 border-rose-200 text-rose-800",
  success: "bg-emerald-50 border-emerald-200 text-emerald-800",
  info: "bg-amber-50 border-amber-200 text-amber-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
};

const variantIconClasses: Record<AlertVariant, string> = {
  error: "text-rose-600",
  success: "text-emerald-600",
  info: "text-amber-600",
  warning: "text-amber-600",
};

const variantIcon: Record<AlertVariant, React.ComponentType<{ className?: string }>> = {
  error: AlertTriangle,
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
};

const variantTitleClasses: Record<AlertVariant, string> = {
  error: "text-rose-900",
  success: "text-emerald-900",
  info: "text-amber-900",
  warning: "text-amber-900",
};

export const Alert: React.FC<AlertProps> = ({ variant, title, children }) => {
  const Icon = variantIcon[variant];
  return (
    <div
      className={cn(
        "p-3.5 rounded-2xl border text-xs flex items-start gap-3 animate-in fade-in duration-200 shadow-2xs",
        variantClasses[variant],
      )}
    >
      <Icon className={cn("w-4 h-4 shrink-0 mt-0.5", variantIconClasses[variant])} />
      <div className="flex-1">
        {title && <span className={cn("font-bold block", variantTitleClasses[variant])}>{title}</span>}
        <span>{children}</span>
      </div>
    </div>
  );
};
