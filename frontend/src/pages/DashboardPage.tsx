import React, { useState } from "react";
import {
  Stethoscope,
  UserCheck,
  ShieldCheck,
  CalendarCheck,
  Search,
  Calendar,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "../context/RouterContext";
import { DoctorAvailabilitySection } from "../components/doctor/DoctorAvailabilitySection";
import { DoctorAppointmentsSection } from "../components/doctor/DoctorAppointmentsSection";
import { PatientDoctorDiscovery } from "../components/patient/PatientDoctorDiscovery";
import { PatientAppointmentsList } from "../components/patient/PatientAppointmentsList";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

const getRoleSubtitle = (role?: string): string => {
  switch (role) {
    case "DOCTOR":
      return "Manage your appointments, availability, and patient consultations.";
    case "PATIENT":
      return "Manage your appointments and find the right care for you.";
    case "ADMIN":
    default:
      return "Manage users, doctors, appointments, and platform operations.";
  }
};

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { navigate } = useRouter();

  // Tab State
  const [patientTab, setPatientTab] = useState<"discovery" | "appointments">("discovery");
  const [doctorTab, setDoctorTab] = useState<"appointments" | "availability">("appointments");

  const getRoleTheme = (role?: string) => {
    switch (role) {
      case "ADMIN":
        return {
          gradient: "from-amber-50 via-orange-50/40 to-stone-50",
          border: "border-amber-200/80",
          badge: "bg-amber-100/80 text-amber-900 border-amber-200/90",
          accent: "text-amber-700",
          icon: <ShieldCheck className="w-4 h-4 text-amber-600" />,
        };
      case "DOCTOR":
        return {
          gradient: "from-teal-50 via-amber-50/30 to-stone-50",
          border: "border-teal-200/80",
          badge: "bg-teal-100/80 text-teal-900 border-teal-200/90",
          accent: "text-teal-700",
          icon: <Stethoscope className="w-4 h-4 text-teal-600" />,
        };
      case "PATIENT":
      default:
        return {
          gradient: "from-orange-50 via-amber-50/30 to-stone-50",
          border: "border-orange-200/80",
          badge: "bg-orange-100/80 text-orange-900 border-orange-200/90",
          accent: "text-orange-700",
          icon: <UserCheck className="w-4 h-4 text-orange-600" />,
        };
    }
  };

  const theme = getRoleTheme(user?.role);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Top Session Banner */}
      <div
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-r ${theme.gradient} border ${theme.border} p-6 sm:p-8 shadow-sm backdrop-blur-xl`}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight m-0">
              Welcome, {user?.firstName ? `${user.firstName} ${user.lastName || ""}` : user?.email}!
            </h1>

            <p className="text-stone-600 text-xs sm:text-sm max-w-xl leading-relaxed">
              {getRoleSubtitle(user?.role)}
            </p>
          </div>
        </div>
      </div>

      {/* PATIENT VIEW */}
      {user?.role === "PATIENT" && (
        <div className="space-y-6">
          {/* Navigation Pill Switcher */}
          <div className="flex items-center gap-2 bg-stone-100/90 p-1.5 rounded-2xl border border-stone-200/80 max-w-md shadow-2xs">
            <button
              onClick={() => setPatientTab("discovery")}
              className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                patientTab === "discovery"
                  ? "bg-white text-orange-950 shadow-xs border border-orange-200/80"
                  : "text-stone-600 hover:text-stone-900 hover:bg-white/50"
              }`}
            >
              <Search className="w-3.5 h-3.5 text-orange-600" />
              <span>Find & Book Doctors</span>
            </button>

            <button
              onClick={() => setPatientTab("appointments")}
              className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                patientTab === "appointments"
                  ? "bg-white text-orange-950 shadow-xs border border-orange-200/80"
                  : "text-stone-600 hover:text-stone-900 hover:bg-white/50"
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5 text-orange-600" />
              <span>My Appointments</span>
            </button>
          </div>

          {patientTab === "discovery" && (
            <PatientDoctorDiscovery
              onAppointmentBooked={() => setPatientTab("appointments")}
            />
          )}

          {patientTab === "appointments" && (
            <PatientAppointmentsList
              onNavigateToBooking={() => setPatientTab("discovery")}
            />
          )}
        </div>
      )}

      {/* DOCTOR VIEW */}
      {user?.role === "DOCTOR" && (
        <div className="space-y-6">
          {/* Navigation Pill Switcher */}
          <div className="flex items-center gap-2 bg-stone-100/90 p-1.5 rounded-2xl border border-stone-200/80 max-w-md shadow-2xs">
            <button
              onClick={() => setDoctorTab("appointments")}
              className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                doctorTab === "appointments"
                  ? "bg-white text-teal-950 shadow-xs border border-teal-200/80"
                  : "text-stone-600 hover:text-stone-900 hover:bg-white/50"
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>Patient Appointments</span>
            </button>

            <button
              onClick={() => setDoctorTab("availability")}
              className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                doctorTab === "availability"
                  ? "bg-white text-teal-950 shadow-xs border border-teal-200/80"
                  : "text-stone-600 hover:text-stone-900 hover:bg-white/50"
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-teal-600" />
              <span>My Availability</span>
            </button>
          </div>

          {doctorTab === "appointments" && <DoctorAppointmentsSection />}

          {doctorTab === "availability" && <DoctorAvailabilitySection />}
        </div>
      )}

      {/* ADMIN VIEW */}
      {user?.role === "ADMIN" && (
        <Card variant="section">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-stone-900 m-0">Administrative Tools</h2>
              <p className="text-xs text-stone-500 mt-1 max-w-md">
                Invite new doctors and patients, and manage pending registration access from the Admin Panel.
              </p>
            </div>
            <Button onClick={() => navigate("/admin/invitations")}>
              <ShieldCheck className="w-4 h-4" />
              <span>Go to Admin Panel</span>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};


