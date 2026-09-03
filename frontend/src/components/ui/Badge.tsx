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
  amber: "bg-[#EAE0CE] text-[#4A3B18] border-[#D4C4A8]",
  teal: "bg-[#D7E3DC] text-[#1E3A2E] border-[#BACEC3]",
  orange: "bg-[#E9DFCE] text-[#4C2E14] border-[#D8C4A7]",
  emerald: "bg-[#DCE7DD] text-[#1E3E26] border-[#BED4C1]",
  rose: "bg-[#EEDCDA] text-[#541C18] border-[#DEC0BD]",
  stone: "bg-[#DDD7CA] text-[#2D2A24] border-[#CCC4B4]",
  blue: "bg-[#D8DFE6] text-[#1E2E3E] border-[#BAC6D3]",
};

const sizeClasses: Record<BadgeSize, string> = {
  xs: "px-2 py-0.5 text-[10px]",
  sm: "px-2.5 py-0.5 text-[11px]",
};

const iconColorClasses: Record<BadgeColor, string> = {
  amber: "text-[#7A5B18]",
  teal: "text-[#285741]",
  orange: "text-[#7A4518]",
  emerald: "text-[#265330]",
  rose: "text-[#7A2420]",
  stone: "text-[#4D483F]",
  blue: "text-[#274560]",
};

export const Badge: React.FC<BadgeProps> = ({ children, icon: Icon, color = "stone", size = "sm" }) => {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium uppercase tracking-wider rounded-md border",
        colorClasses[color],
        sizeClasses[size],
      )}
    >
      {Icon && <Icon className={cn("w-3 h-3", iconColorClasses[color])} />}
      {children}
    </span>
  );
};
