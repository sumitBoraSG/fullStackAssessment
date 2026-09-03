import React from "react";
import { cn } from "../../utils/cn";

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const TextInput: React.FC<TextInputProps> = ({ hasError, className, ...props }) => {
  return (
    <input
      className={cn(
        "w-full px-3 py-2 rounded-lg bg-[#FAF8F5] border text-xs sm:text-sm text-[#141413] placeholder-[#141413]/40 focus:outline-none transition-all shadow-2xs",
        hasError
          ? "border-[#8E2A22] focus:border-[#8E2A22] focus:ring-1 focus:ring-[#8E2A22] bg-[#FAF3F2] text-[#541C18]"
          : "border-[#D8D0BF] focus:border-[#141413] focus:ring-1 focus:ring-[#141413]",
        className,
      )}
      {...props}
    />
  );
};
