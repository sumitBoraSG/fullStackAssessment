import React, { useState } from "react";
import { Lock, Ruler, Weight } from "lucide-react";
import { Card } from "../ui/Card";
import { FormField } from "../ui/FormField";
import { TextInput } from "../ui/TextInput";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Alert } from "../ui/Alert";
import { updatePatientProfileApi } from "../../api/profileApi";
import type { PatientProfileData } from "../../types/profile";

interface PatientProfileFormProps {
  profile: PatientProfileData;
  onSaved: (updated: PatientProfileData) => void;
}

interface FormErrors {
  heightCm?: string;
  weightKg?: string;
}

const formatDob = (dob: string | null): string => {
  if (!dob) return "Not provided";
  const parsed = new Date(dob);
  if (isNaN(parsed.getTime())) return dob;
  return parsed.toLocaleDateString();
};

export const PatientProfileForm: React.FC<PatientProfileFormProps> = ({ profile, onSaved }) => {
  const [heightCm, setHeightCm] = useState<string>(profile.heightCm != null ? String(profile.heightCm) : "");
  const [weightKg, setWeightKg] = useState<string>(profile.weightKg != null ? String(profile.weightKg) : "");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const validate = (): boolean => {
    const errs: FormErrors = {};

    const height = Number(heightCm);
    if (heightCm === "" || isNaN(height)) {
      errs.heightCm = "Height is required";
    } else if (height < 30 || height > 300) {
      errs.heightCm = "Must be between 30 and 300 cm";
    }

    const weight = Number(weightKg);
    if (weightKg === "" || isNaN(weight)) {
      errs.weightKg = "Weight is required";
    } else if (weight < 2 || weight > 500) {
      errs.weightKg = "Must be between 2 and 500 kg";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (!validate()) return;

    setIsSaving(true);
    const res = await updatePatientProfileApi({
      heightCm: Number(heightCm),
      weightKg: Number(weightKg),
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <span className="block text-xs font-semibold text-stone-500 mb-1">Date of Birth</span>
            <p className="text-sm font-semibold text-stone-800 m-0">{formatDob(profile.dob)}</p>
          </div>

          <div>
            <span className="block text-xs font-semibold text-stone-500 mb-1.5">Blood Group</span>
            {profile.bloodGroup ? (
              <Badge color="rose">{profile.bloodGroup}</Badge>
            ) : (
              <p className="text-sm font-semibold text-stone-800 m-0">Not provided</p>
            )}
          </div>
        </div>
      </Card>

      {/* Editable Card */}
      <Card variant="section">
        <h3 className="text-sm font-bold text-stone-900 mb-5 pb-4 border-b border-stone-100">
          Vitals
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Height (cm)" required error={errors.heightCm}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Ruler className="w-4 h-4" />
                </div>
                <TextInput
                  type="number"
                  min={30}
                  max={300}
                  value={heightCm}
                  onChange={(e) => {
                    setHeightCm(e.target.value);
                    if (errors.heightCm) setErrors((prev) => ({ ...prev, heightCm: undefined }));
                  }}
                  placeholder="e.g. 170"
                  disabled={isSaving}
                  hasError={!!errors.heightCm}
                  className="pl-10"
                />
              </div>
            </FormField>

            <FormField label="Weight (kg)" required error={errors.weightKg}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Weight className="w-4 h-4" />
                </div>
                <TextInput
                  type="number"
                  min={2}
                  max={500}
                  value={weightKg}
                  onChange={(e) => {
                    setWeightKg(e.target.value);
                    if (errors.weightKg) setErrors((prev) => ({ ...prev, weightKg: undefined }));
                  }}
                  placeholder="e.g. 65"
                  disabled={isSaving}
                  hasError={!!errors.weightKg}
                  className="pl-10"
                />
              </div>
            </FormField>
          </div>

          {saveError && <Alert variant="error">{saveError}</Alert>}

          <Button type="submit" isLoading={isSaving} loadingText="Saving...">
            Save Changes
          </Button>
        </form>
      </Card>
    </div>
  );
};
