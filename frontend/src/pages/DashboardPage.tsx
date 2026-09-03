import React, { useState } from "react";
import {
  CalendarCheck,
  Search,
  Calendar,
  ShieldCheck,
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
      {/* Top Editorial Banner */}
      <div className="rounded-xl bg-[#E3DBCC] border border-[#D8D0BF] p-6 sm:p-8 shadow-xs text-[#141413]">
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#141413]/60 block">
            {user?.role || "Healthcare"} Portal
          </span>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#141413] tracking-tight m-0">
            Welcome, {user?.firstName ? `${user.firstName} ${user.lastName || ""}` : user?.email}!
          </h1>
          <p className="text-[#141413]/60 text-xs sm:text-sm max-w-xl leading-relaxed m-0 pt-0.5">
            {getRoleSubtitle(user?.role)}
          </p>
        </div>
      </div>

      {/* PATIENT VIEW */}
      {user?.role === "PATIENT" && (
        <div className="space-y-6">
          {/* Navigation Segmented Switcher */}
          <div className="flex items-center gap-1 bg-[#E3DBCC] p-1 rounded-lg border border-[#D8D0BF] max-w-md shadow-xs">
            <button
              onClick={() => setPatientTab("discovery")}
              className={`flex-1 py-1.5 px-3.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
                patientTab === "discovery"
                  ? "bg-[#141413] text-[#F0EEE6] shadow-xs"
                  : "text-[#141413]/70 hover:text-[#141413] hover:bg-[#FAF8F5]/60"
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Find & Book Doctors</span>
            </button>

            <button
              onClick={() => setPatientTab("appointments")}
              className={`flex-1 py-1.5 px-3.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
                patientTab === "appointments"
                  ? "bg-[#141413] text-[#F0EEE6] shadow-xs"
                  : "text-[#141413]/70 hover:text-[#141413] hover:bg-[#FAF8F5]/60"
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5" />
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
          {/* Navigation Segmented Switcher */}
          <div className="flex items-center gap-1 bg-[#E3DBCC] p-1 rounded-lg border border-[#D8D0BF] max-w-md shadow-xs">
            <button
              onClick={() => setDoctorTab("appointments")}
              className={`flex-1 py-1.5 px-3.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
                doctorTab === "appointments"
                  ? "bg-[#141413] text-[#F0EEE6] shadow-xs"
                  : "text-[#141413]/70 hover:text-[#141413] hover:bg-[#FAF8F5]/60"
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              <span>Patient Appointments</span>
            </button>

            <button
              onClick={() => setDoctorTab("availability")}
              className={`flex-1 py-1.5 px-3.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
                doctorTab === "availability"
                  ? "bg-[#141413] text-[#F0EEE6] shadow-xs"
                  : "text-[#141413]/70 hover:text-[#141413] hover:bg-[#FAF8F5]/60"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
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
              <h2 className="text-base font-semibold text-[#141413] m-0">Administrative Tools</h2>
              <p className="text-xs text-[#141413]/60 mt-1 max-w-md">
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
