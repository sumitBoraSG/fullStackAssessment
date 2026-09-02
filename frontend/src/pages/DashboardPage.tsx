import React, { useState } from "react";
import {
  Stethoscope,
  UserCheck,
  LogOut,
  Sparkles,
  ShieldCheck,
  Lock,
  CalendarCheck,
  Search,
  Calendar,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { DoctorAvailabilitySection } from "../components/doctor/DoctorAvailabilitySection";
import { DoctorAppointmentsSection } from "../components/doctor/DoctorAppointmentsSection";
import { PatientDoctorDiscovery } from "../components/patient/PatientDoctorDiscovery";
import { PatientAppointmentsList } from "../components/patient/PatientAppointmentsList";

export const DashboardPage: React.FC = () => {
  const { user, logout, isLoading } = useAuth();

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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 border border-stone-200/80 text-xs font-semibold text-stone-700 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>DocPulse Portal Active</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight m-0">
              Welcome, {user?.firstName ? `${user.firstName} ${user.lastName || ""}` : user?.email}!
            </h1>

            <p className="text-stone-600 text-xs sm:text-sm max-w-xl leading-relaxed">
              Logged in as <span className="font-bold text-stone-900">{user?.email}</span> (
              <span className="font-semibold text-amber-800 uppercase">{user?.role}</span>).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/90 border border-stone-200 text-stone-700 text-xs font-semibold shadow-2xs">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>HttpOnly Cookies Active</span>
            </div>

            <button
              onClick={() => logout()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold shadow-sm hover:shadow-md transition-all duration-200 active:scale-95 cursor-pointer disabled:opacity-60"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
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
        <div className="bg-white border border-stone-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-4">
            <h2 className="text-lg font-extrabold text-stone-900 flex items-center gap-2 m-0">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              Admin Portal Overview
            </h2>
            <span className="text-xs font-bold text-amber-900 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              System Administrator
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">Admin Email</span>
              <p className="text-stone-800 font-semibold font-mono text-xs">{user?.email}</p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">Role Permissions</span>
              <p className="text-stone-800 font-semibold text-xs">Full System Access & Invitations</p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">Quick Action</span>
              <a
                href="/admin/invitations"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-900 underline"
              >
                Manage Invitations &rarr;
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


