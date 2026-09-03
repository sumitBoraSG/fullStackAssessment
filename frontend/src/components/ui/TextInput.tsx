import React from "react";
import { cn } from "../../utils/cn";

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const TextInput: React.FC<TextInputProps> = ({ hasError, className, ...props }) => {
  return (
    <input
      className={cn(
        "w-full px-3 py-2.5 rounded-xl bg-white border text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 shadow-2xs transition-all",
        hasError
          ? "border-rose-400 focus:ring-rose-500/20 bg-rose-50/30 text-rose-900"
          : "border-stone-200 focus:border-amber-500 focus:ring-amber-500/20",
        className,
      )}
      {...props}
    />
  );
};
