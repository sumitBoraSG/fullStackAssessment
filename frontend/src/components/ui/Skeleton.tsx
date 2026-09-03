import React from "react";
import { cn } from "../../utils/cn";

export interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return <div className={cn("animate-pulse rounded-lg bg-[#D8D0BF]/60", className)} />;
};
