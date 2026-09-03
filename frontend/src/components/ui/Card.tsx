import React from "react";
import { cn } from "../../utils/cn";

export type CardVariant = "auth" | "section";

export interface CardProps {
  variant?: CardVariant;
  className?: string;
  children: React.ReactNode;
}

const variantClasses: Record<CardVariant, string> = {
  auth: "bg-white/90 border border-stone-200/80 rounded-3xl shadow-xl shadow-stone-200/60 backdrop-blur-2xl p-6 sm:p-8",
  section: "bg-white/80 border border-stone-200/80 rounded-3xl shadow-sm backdrop-blur-md p-6 sm:p-8",
};

export const Card: React.FC<CardProps> = ({ variant = "section", className, children }) => {
  return <div className={cn(variantClasses[variant], className)}>{children}</div>;
};
