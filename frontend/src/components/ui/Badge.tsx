import React from "react";
import { cn } from "../../utils/cn";

export type BadgeColor = "amber" | "teal" | "orange" | "emerald" | "rose" | "stone" | "blue";
export type BadgeSize = "xs" | "sm";

export interface BadgeProps {
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  color?: BadgeColor;
  size?: BadgeSize;
}

const colorClasses: Record<BadgeColor, string> = {
  amber: "bg-amber-50 text-amber-900 border-amber-200/90",
  teal: "bg-teal-50 text-teal-800 border-teal-200/90",
  orange: "bg-orange-50 text-orange-800 border-orange-200/90",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  stone: "bg-stone-100 text-stone-700 border-stone-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
};

const sizeClasses: Record<BadgeSize, string> = {
  xs: "px-2.5 py-0.5 text-[10px]",
  sm: "px-2.5 py-1 text-[11px]",
};

// Slightly deeper shade than the badge's own text color, matching the exact
// icon tint used by Navbar.tsx's getRoleIcon for amber/teal/orange.
const iconColorClasses: Record<BadgeColor, string> = {
  amber: "text-amber-600",
  teal: "text-teal-600",
  orange: "text-orange-600",
  emerald: "text-emerald-600",
  rose: "text-rose-600",
  stone: "text-stone-500",
  blue: "text-blue-600",
};

export const Badge: React.FC<BadgeProps> = ({ children, icon: Icon, color = "stone", size = "sm" }) => {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-bold uppercase tracking-wider rounded-full border",
        colorClasses[color],
        sizeClasses[size],
      )}
    >
      {Icon && <Icon className={cn("w-3.5 h-3.5", iconColorClasses[color])} />}
      {children}
    </span>
  );
};
