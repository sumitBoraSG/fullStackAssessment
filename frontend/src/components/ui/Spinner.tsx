import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";

export type SpinnerSize = "sm" | "md" | "lg";

export interface SpinnerProps {
  size?: SpinnerSize;
  label?: string;
  className?: string;
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

export const Spinner: React.FC<SpinnerProps> = ({ size = "md", label, className }) => {
  return (
    <div className="flex flex-col items-center gap-3 text-[#141413]/70">
      <Loader2 className={cn("animate-spin text-[#141413]", sizeClasses[size], className)} />
      {label && <span className="text-xs font-medium text-[#141413]">{label}</span>}
    </div>
  );
};
