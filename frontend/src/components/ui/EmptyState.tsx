import React from "react";
import { cn } from "../../utils/cn";

export type EmptyStateColor = "amber" | "teal" | "orange" | "rose" | "stone";

export interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  color?: EmptyStateColor;
  action?: React.ReactNode;
}

const colorClasses: Record<EmptyStateColor, string> = {
  amber: "bg-[#EAE0CE] border-[#D4C4A8] text-[#7A5B18]",
  teal: "bg-[#D7E3DC] border-[#BACEC3] text-[#285741]",
  orange: "bg-[#E9DFCE] border-[#D8C4A7] text-[#7A4518]",
  rose: "bg-[#EEDCDA] border-[#DEC0BD] text-[#7A2420]",
  stone: "bg-[#DDD7CA] border-[#CCC4B4] text-[#4D483F]",
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  color = "stone",
  action,
}) => {
  return (
    <div className="bg-[#E3DBCC] border border-[#D8D0BF] rounded-xl p-8 sm:p-12 text-center space-y-3.5 shadow-2xs">
      <div
        className={cn(
          "w-11 h-11 rounded-lg border flex items-center justify-center mx-auto shadow-2xs",
          colorClasses[color],
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-[#141413] tracking-tight">{title}</h3>
        {description && (
          <p className="text-xs text-[#141413]/60 max-w-sm mx-auto leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};
