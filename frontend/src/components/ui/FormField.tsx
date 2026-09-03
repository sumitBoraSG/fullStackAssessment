import React from "react";

export interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({ label, required, error, hint, children }) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-medium text-[#141413]/90 tracking-tight">
          {label} {required && <span className="text-[#8E2A22]">*</span>}
        </label>
        {hint && <span className="text-[11px] text-[#141413]/50">{hint}</span>}
      </div>
      {children}
      {error && <p className="mt-1 text-xs text-[#8E2A22] font-medium">{error}</p>}
    </div>
  );
};
