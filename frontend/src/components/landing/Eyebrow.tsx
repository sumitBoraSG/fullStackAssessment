import React from "react";
import { cn } from "../../utils/cn";

interface EyebrowProps {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "center";
}

export const Eyebrow: React.FC<EyebrowProps> = ({ children, className, align = "left" }) => (
  <div
    className={cn(
      "flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#141413]/50",
      align === "center" && "justify-center",
      className,
    )}
  >
    <span className="inline-block w-6 h-px bg-[#141413]/30 shrink-0" />
    <span>{children}</span>
  </div>
);
