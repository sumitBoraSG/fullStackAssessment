import React from "react";
import { cn } from "../../utils/cn";

export interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className={cn("animate-pulse rounded-lg bg-[#D8D0BF]/60", className)}
    />
  );
};
