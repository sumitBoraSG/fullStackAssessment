import React from "react";
import { cn } from "../../utils/cn";

export interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return <div className={cn("animate-pulse rounded-2xl bg-stone-200/60", className)} />;
};
