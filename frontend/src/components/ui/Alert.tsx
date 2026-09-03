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
  error: "bg-[#EEDCDA] border-[#DEC0BD] text-[#541C18]",
  success: "bg-[#DCE7DD] border-[#BED4C1] text-[#1E3E26]",
  info: "bg-[#EAE0CE] border-[#D4C4A8] text-[#4A3B18]",
  warning: "bg-[#EAE0CE] border-[#D4C4A8] text-[#4A3B18]",
};

const variantIconClasses: Record<AlertVariant, string> = {
  error: "text-[#7A2420]",
  success: "text-[#265330]",
  info: "text-[#7A5B18]",
  warning: "text-[#7A5B18]",
};

const variantIcon: Record<AlertVariant, React.ComponentType<{ className?: string }>> = {
  error: AlertTriangle,
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
};

const variantTitleClasses: Record<AlertVariant, string> = {
  error: "text-[#541C18]",
  success: "text-[#1E3E26]",
  info: "text-[#4A3B18]",
  warning: "text-[#4A3B18]",
};

export const Alert: React.FC<AlertProps> = ({ variant, title, children }) => {
  const Icon = variantIcon[variant];
  return (
    <div
      className={cn(
        "p-3 rounded-lg border text-xs flex items-start gap-2.5 animate-in fade-in duration-150 shadow-2xs",
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
