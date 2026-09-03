import React from "react";
import { cn } from "../../utils/cn";

export type CardVariant = "auth" | "section";

export interface CardProps {
  variant?: CardVariant;
  className?: string;
  children: React.ReactNode;
}

const variantClasses: Record<CardVariant, string> = {
  auth: "bg-[#E3DBCC] border border-[#D8D0BF] rounded-2xl shadow-xs p-6 sm:p-8 text-[#141413]",
  section: "bg-[#E3DBCC] border border-[#D8D0BF] rounded-xl shadow-xs p-6 sm:p-8 text-[#141413]",
};

export const Card: React.FC<CardProps> = ({ variant = "section", className, children }) => {
  return <div className={cn(variantClasses[variant], className)}>{children}</div>;
};
