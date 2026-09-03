import React, { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Stethoscope, UserCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Badge, type BadgeColor } from "../components/ui/Badge";
import { PatientProfileForm } from "../components/profile/PatientProfileForm";
import { DoctorProfileForm } from "../components/profile/DoctorProfileForm";
import { getDoctorProfileApi, getPatientProfileApi } from "../api/profileApi";
import type { DoctorProfileData, PatientProfileData } from "../types/profile";

type ProfileData = PatientProfileData | DoctorProfileData;

const roleBadge: Record<string, { color: BadgeColor; icon: React.ComponentType<{ className?: string }> }> = {
  ADMIN: { color: "amber", icon: ShieldCheck },
  DOCTOR: { color: "teal", icon: Stethoscope },
  PATIENT: { color: "orange", icon: UserCircle },
};

export const ProfilePage: React.FC = () => {
  const { user, setNotification } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) return;

    if (user.role === "ADMIN") {
      setIsLoading(false);
      setLoadError(null);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    const res = user.role === "PATIENT" ? await getPatientProfileApi() : await getDoctorProfileApi();

    setIsLoading(false);
    if (res.success && res.data) {
      setProfile(res.data);
    } else {
      setLoadError(res.message || "Failed to load your profile.");
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSaved = (updated: ProfileData) => {
    setProfile(updated);
    setNotification({ type: "success", message: "Profile updated successfully" });
  };

  const badge = user?.role ? roleBadge[user.role] : undefined;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Card */}
      <Card variant="section">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-lg font-bold text-white shadow-2xs shrink-0">
            {user?.firstName ? user.firstName[0]?.toUpperCase() : user?.email[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-extrabold text-stone-900 tracking-tight m-0 truncate">
              {user?.firstName ? `${user.firstName} ${user.lastName || ""}` : user?.email}
            </h1>
            <p className="text-xs text-stone-500 truncate">{user?.email}</p>
          </div>
          {badge && (
            <Badge color={badge.color} icon={badge.icon}>
              {user?.role}
            </Badge>
          )}
        </div>
      </Card>

      {/* Loading */}
      {isLoading && (
        <Card variant="section">
          <div className="space-y-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-10 w-2/3" />
          </div>
        </Card>
      )}

      {/* Load Error */}
      {!isLoading && loadError && (
        <div className="space-y-3">
          <Alert variant="error" title="Failed to load profile">
            {loadError}
          </Alert>
          <Button variant="secondary" onClick={fetchProfile}>
            Retry
          </Button>
        </div>
      )}

      {/* Loaded */}
      {!isLoading && !loadError && user?.role === "PATIENT" && profile && (
        <PatientProfileForm profile={profile as PatientProfileData} onSaved={handleSaved} />
      )}

      {!isLoading && !loadError && user?.role === "DOCTOR" && profile && (
        <DoctorProfileForm profile={profile as DoctorProfileData} onSaved={handleSaved} />
      )}

      {!isLoading && !loadError && user?.role === "ADMIN" && (
        <p className="text-sm text-stone-500">Profile editing is not applicable to admin accounts.</p>
      )}
    </div>
  );
};
