import React, { useState } from "react";
import { Lock, BriefcaseMedical } from "lucide-react";
import { Card } from "../ui/Card";
import { FormField } from "../ui/FormField";
import { TextInput } from "../ui/TextInput";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";
import { updateDoctorProfileApi } from "../../api/profileApi";
import type { DoctorProfileData } from "../../types/profile";

interface DoctorProfileFormProps {
  profile: DoctorProfileData;
  onSaved: (updated: DoctorProfileData) => void;
}

interface FormErrors {
  experienceYears?: string;
}

export const DoctorProfileForm: React.FC<DoctorProfileFormProps> = ({ profile, onSaved }) => {
  const [experienceYears, setExperienceYears] = useState<string>(String(profile.experienceYears));
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const validate = (): boolean => {
    const errs: FormErrors = {};

    const years = Number(experienceYears);
    if (experienceYears === "" || isNaN(years)) {
      errs.experienceYears = "Years of experience is required";
    } else if (years < 0 || years > 80) {
      errs.experienceYears = "Must be between 0 and 80 years";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (!validate()) return;

    setIsSaving(true);
    const res = await updateDoctorProfileApi({
      experienceYears: Number(experienceYears),
    });
    setIsSaving(false);

    if (res.success && res.data) {
      onSaved(res.data);
    } else {
      setSaveError(res.message || "Failed to update your profile. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Read-only Card */}
      <Card variant="section" className="bg-stone-50/60">
        <div className="flex items-center gap-2 text-stone-500 mb-5 pb-4 border-b border-stone-200/70">
          <Lock className="w-3.5 h-3.5" />
          <span className="text-xs font-bold uppercase tracking-wider">Read-only</span>
        </div>

        <div>
          <span className="block text-xs font-semibold text-stone-500 mb-1">Specialization</span>
          <p className="text-sm font-semibold text-stone-800 m-0">{profile.specialization}</p>
        </div>
      </Card>

      {/* Editable Card */}
      <Card variant="section">
        <h3 className="text-sm font-bold text-stone-900 mb-5 pb-4 border-b border-stone-100">
          Practice Details
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <FormField label="Years of Experience" required error={errors.experienceYears}>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                <BriefcaseMedical className="w-4 h-4" />
              </div>
              <TextInput
                type="number"
                min={0}
                max={80}
                value={experienceYears}
                onChange={(e) => {
                  setExperienceYears(e.target.value);
                  if (errors.experienceYears)
                    setErrors((prev) => ({ ...prev, experienceYears: undefined }));
                }}
                placeholder="e.g. 5"
                disabled={isSaving}
                hasError={!!errors.experienceYears}
                className="pl-10"
              />
            </div>
          </FormField>

          {saveError && <Alert variant="error">{saveError}</Alert>}

          <Button type="submit" isLoading={isSaving} loadingText="Saving...">
            Save Changes
          </Button>
        </form>
      </Card>
    </div>
  );
};
