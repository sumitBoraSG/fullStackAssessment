import React from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { evaluatePasswordRules } from "../../utils/passwordPolicy";

interface PasswordRequirementChecklistProps {
  password: string;
}

export const PasswordRequirementChecklist: React.FC<PasswordRequirementChecklistProps> = ({
  password,
}) => {
  const rules = evaluatePasswordRules(password);

  return (
    <div className="space-y-1">
      {rules.map((rule) => (
        <div
          key={rule.key}
          className={`flex items-center gap-1.5 text-xs ${
            rule.passed ? "text-emerald-700" : "text-stone-400"
          }`}
        >
          {rule.passed ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <Circle className="w-3.5 h-3.5 text-stone-300" />
          )}
          <span>{rule.label}</span>
        </div>
      ))}
    </div>
  );
};
