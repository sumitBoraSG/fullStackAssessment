import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  Stethoscope,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  Award,
  CalendarDays,
  UserCheck,
} from "lucide-react";
import {
  getDoctorsApi,
  getDoctorAvailabilityApi,
  getSpecializationsApi,
} from "../../api/doctorApi";
import type {
  DoctorListItem,
  SpecializationItem,
  DoctorAvailabilityDetails,
} from "../../types/doctor";
import type { PaginationMeta } from "../../types/auth";
import type { PatientAppointment } from "../../types/appointment";
import { AppointmentBookingModal } from "./AppointmentBookingModal";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";
import { EmptyState } from "../ui/EmptyState";
import { Badge } from "../ui/Badge";

interface PatientDoctorDiscoveryProps {
  onAppointmentBooked?: (appointment: PatientAppointment) => void;
}

export const PatientDoctorDiscovery: React.FC<PatientDoctorDiscoveryProps> = ({
  onAppointmentBooked,
}) => {
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Data State
  const [doctors, setDoctors] = useState<DoctorListItem[]>([]);
  const [specializations, setSpecializations] = useState<SpecializationItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 8,
    total: 0,
    totalPages: 1,
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Booking Modal State
  const [bookingDoctorDetails, setBookingDoctorDetails] =
    useState<DoctorAvailabilityDetails | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [isLoadingDoctorDetails, setIsLoadingDoctorDetails] = useState<number | null>(null);

  // Fetch Specializations Dropdown List
  useEffect(() => {
    async function loadSpecs() {
      const res = await getSpecializationsApi();
      if (res.success && res.data) {
        setSpecializations(res.data);
      } else {
        setErrorMsg(
          res.message || "Failed to load specializations. The specialization filter may be incomplete.",
        );
      }
    }
    loadSpecs();
  }, []);

  // Fetch Doctors List
  const fetchDoctors = useCallback(
    async (pageNum: number = 1) => {
      setIsLoading(true);
      setErrorMsg(null);

      const res = await getDoctorsApi({
        search: searchQuery,
        specialization: selectedSpecialization,
        date: selectedDate,
        page: pageNum,
        limit: 8,
      });

      setIsLoading(false);

      if (res.success && res.data) {
        setDoctors(res.data.doctors);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      } else {
        setErrorMsg(res.message || "Failed to load doctors list.");
      }
    },
    [searchQuery, selectedSpecialization, selectedDate],
  );

  useEffect(() => {
    fetchDoctors(1);
  }, [fetchDoctors]);

  // Open Booking Modal for a Doctor
  const handleOpenBooking = async (doctorId: number) => {
    setIsLoadingDoctorDetails(doctorId);
    setErrorMsg(null);

    const res = await getDoctorAvailabilityApi(doctorId);
    setIsLoadingDoctorDetails(null);

    if (res.success && res.data) {
      setBookingDoctorDetails(res.data);
      setIsBookingModalOpen(true);
    } else {
      setErrorMsg(res.message || "Failed to fetch doctor schedule for booking.");
    }
  };

  const handleBookingSuccess = (appointment: PatientAppointment) => {
    if (onAppointmentBooked) {
      onAppointmentBooked(appointment);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedSpecialization("");
    setSelectedDate("");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Editorial Section Header */}
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#141413]/60 block mb-1">
          Specialist Directory
        </span>
        <h2 className="text-xl sm:text-2xl font-semibold text-[#141413] tracking-tight m-0">
          Find the right doctor
        </h2>
        <p className="text-xs sm:text-sm text-[#141413]/60 mt-1 max-w-xl leading-relaxed">
          Browse verified medical specialists and schedule your consultation.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#E3DBCC] border border-[#D8D0BF] rounded-xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Search Input (5 cols) */}
          <div className="lg:col-span-5 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#141413]/40">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search doctors by name..."
              aria-label="Search doctors by name"
              className="w-full pl-9 pr-8 py-2 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-xs sm:text-sm text-[#141413] placeholder-[#141413]/40 focus:outline-none focus:border-[#141413] focus:ring-1 focus:ring-[#141413] transition-all font-normal"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#141413]/40 hover:text-[#141413] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Specialization Filter (4 cols) */}
          <div className="lg:col-span-4 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#141413]/40">
              <Filter className="w-4 h-4" />
            </div>
            <select
              value={selectedSpecialization}
              onChange={(e) => setSelectedSpecialization(e.target.value)}
              aria-label="Filter by specialization"
              className="w-full pl-9 pr-7 py-2 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-xs sm:text-sm text-[#141413] focus:outline-none focus:border-[#141413] focus:ring-1 focus:ring-[#141413] transition-all font-normal appearance-none cursor-pointer"
            >
              <option value="">All Specializations</option>
              {specializations.map((spec) => (
                <option key={spec.id} value={spec.name}>
                  {spec.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter (3 cols) */}
          <div className="lg:col-span-3 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#141413]/40">
              <Calendar className="w-4 h-4" />
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              aria-label="Filter by availability date"
              className="w-full pl-9 pr-2.5 py-2 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-xs sm:text-sm text-[#141413] focus:outline-none focus:border-[#141413] focus:ring-1 focus:ring-[#141413] transition-all font-normal"
            />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {(searchQuery || selectedSpecialization || selectedDate) && (
          <div className="flex items-center justify-between pt-2.5 border-t border-[#D8D0BF] text-xs text-[#141413]/70">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-[#141413]">Active filters:</span>
              {searchQuery && (
                <span className="px-2 py-0.5 rounded-md bg-[#FAF8F5] text-[#141413] border border-[#D8D0BF] text-[11px] font-medium">
                  Name: "{searchQuery}"
                </span>
              )}
              {selectedSpecialization && (
                <span className="px-2 py-0.5 rounded-md bg-[#FAF8F5] text-[#141413] border border-[#D8D0BF] text-[11px] font-medium">
                  {selectedSpecialization}
                </span>
              )}
              {selectedDate && (
                <span className="px-2 py-0.5 rounded-md bg-[#FAF8F5] text-[#141413] border border-[#D8D0BF] text-[11px] font-medium">
                  Date: {selectedDate}
                </span>
              )}
            </div>

            <button
              onClick={handleClearFilters}
              className="text-[#141413] hover:underline font-medium cursor-pointer text-xs shrink-0 ml-auto"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

      {/* Doctors Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[#E3DBCC] border border-[#D8D0BF] rounded-xl p-5 space-y-4 animate-pulse">
              <div className="w-10 h-10 rounded-lg bg-[#D8D0BF]/60" />
              <div className="space-y-2">
                <div className="h-4 w-3/4 bg-[#D8D0BF]/60 rounded-md" />
                <div className="h-3 w-1/2 bg-[#D8D0BF]/40 rounded-md" />
              </div>
              <div className="h-8 w-full bg-[#D8D0BF]/60 rounded-lg" />
            </div>
          ))}
        </div>
      ) : !errorMsg && doctors.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          color="stone"
          title="No Doctors Found"
          description="No medical specialists matched your selected filters or search query. Try clearing filters to view all doctors."
          action={
            (searchQuery || selectedSpecialization || selectedDate) ? (
              <Button variant="secondary" onClick={handleClearFilters}>
                Clear Search Filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {doctors.map((doc) => (
            <div
              key={doc.id}
              className="bg-[#E3DBCC] border border-[#D8D0BF] rounded-xl p-5 shadow-xs hover:border-[#141413]/30 transition-all flex flex-col justify-between group space-y-4 text-[#141413]"
            >
              <div className="space-y-3">
                {/* Avatar & Verified Badge */}
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-[#141413] flex items-center justify-center font-medium shadow-2xs">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <Badge color="emerald" icon={UserCheck} size="xs">
                    Verified
                  </Badge>
                </div>

                {/* Info */}
                <div>
                  <h3 className="text-base font-semibold text-[#141413] tracking-tight group-hover:underline">
                    Dr. {doc.firstName} {doc.lastName}
                  </h3>
                  <div className="text-xs font-medium text-[#141413]/80 mt-0.5">
                    <span>{doc.specialization}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-[#141413]/60 mt-1.5">
                    <Award className="w-3.5 h-3.5 text-[#141413]/40" />
                    <span>{doc.experienceYears} years experience</span>
                  </div>
                </div>
              </div>

              {/* Book Appointment Action */}
              <Button
                variant="primary"
                fullWidth
                onClick={() => handleOpenBooking(doc.id)}
                isLoading={isLoadingDoctorDetails === doc.id}
                loadingText="Loading..."
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Book Appointment</span>
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Footer */}
      {!isLoading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-[#D8D0BF] text-xs text-[#141413]/60">
          <span>
            Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} Doctors)
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => fetchDoctors(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded-lg bg-[#E3DBCC] border border-[#D8D0BF] hover:bg-[#D9D1C1] text-[#141413] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => fetchDoctors(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="p-1.5 rounded-lg bg-[#E3DBCC] border border-[#D8D0BF] hover:bg-[#D9D1C1] text-[#141413] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      <AppointmentBookingModal
        doctorDetails={bookingDoctorDetails}
        isOpen={isBookingModalOpen}
        onClose={() => {
          setIsBookingModalOpen(false);
          setBookingDoctorDetails(null);
        }}
        onSuccess={handleBookingSuccess}
      />
    </div>
  );
};
