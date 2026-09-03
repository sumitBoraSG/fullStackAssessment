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
  amber: "bg-amber-50 border-amber-200/80 text-amber-600",
  teal: "bg-teal-50 border-teal-200/80 text-teal-600",
  orange: "bg-orange-50 border-orange-200/80 text-orange-600",
  rose: "bg-rose-50 border-rose-200/80 text-rose-600",
  stone: "bg-stone-100 border-stone-200/80 text-stone-500",
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  color = "stone",
  action,
}) => {
  return (
    <div className="bg-white/80 border border-stone-200/80 rounded-3xl p-12 text-center space-y-4 shadow-2xs">
      <div
        className={cn(
          "w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto",
          colorClasses[color],
        )}
      >
        <Icon className="w-7 h-7" />
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-stone-900">{title}</h3>
        {description && (
          <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};
