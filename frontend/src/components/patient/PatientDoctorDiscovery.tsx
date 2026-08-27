import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  Stethoscope,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  X,
  Sparkles,
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

export const PatientDoctorDiscovery: React.FC = () => {
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

  // Selected Doctor Modal State
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [doctorDetails, setDoctorDetails] = useState<DoctorAvailabilityDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [modalDateFilter, setModalDateFilter] = useState<string>("");

  // Fetch Specializations Dropdown List
  useEffect(() => {
    async function loadSpecs() {
      const res = await getSpecializationsApi();
      if (res.success && res.data) {
        setSpecializations(res.data);
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

  // Fetch Doctor Availability for Modal
  const openDoctorModal = async (doctorId: number) => {
    setSelectedDoctorId(doctorId);
    setDoctorDetails(null);
    setIsLoadingDetails(true);
    setModalDateFilter("");

    const res = await getDoctorAvailabilityApi(doctorId);
    setIsLoadingDetails(false);

    if (res.success && res.data) {
      setDoctorDetails(res.data);
    } else {
      setErrorMsg(res.message || "Failed to load doctor availability.");
    }
  };

  const fetchModalFilteredAvailability = async (dateStr: string) => {
    if (!selectedDoctorId) return;
    setModalDateFilter(dateStr);
    setIsLoadingDetails(true);
    const res = await getDoctorAvailabilityApi(selectedDoctorId, dateStr);
    setIsLoadingDetails(false);
    if (res.success && res.data) {
      setDoctorDetails(res.data);
    }
  };

  const closeDoctorModal = () => {
    setSelectedDoctorId(null);
    setDoctorDetails(null);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedSpecialization("");
    setSelectedDate("");
  };

  const formatDisplayTime = (timeStr: string) => {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":").map(Number);
    if (isNaN(h)) return timeStr;
    const period = h >= 12 ? "PM" : "AM";
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    const displayMin = String(m).padStart(2, "0");
    return `${displayHour}:${displayMin} ${period}`;
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const [y, m, d] = dateStr.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Group availability by date for modal
  const groupedModalAvailabilities = (doctorDetails?.availability || []).reduce<
    Record<string, typeof doctorDetails.availability>
  >((acc, slot) => {
    const key = slot.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(slot);
    return acc;
  }, {});

  const sortedModalDates = Object.keys(groupedModalAvailabilities).sort();

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner Header */}
      <div className="bg-white/80 border border-stone-200/80 rounded-3xl p-6 sm:p-8 shadow-sm backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-100/40 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/80 text-[11px] font-bold text-teal-900 mb-2 shadow-2xs">
            <Sparkles className="w-3 h-3 text-teal-600" />
            <span>Healthcare Services</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
            Find a Doctor
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Browse qualified healthcare specialists, filter by department or date, and view upcoming availability hours.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white/90 border border-stone-200/80 rounded-3xl p-4 sm:p-6 shadow-sm backdrop-blur-md space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5">
          {/* Search Input (5 cols) */}
          <div className="lg:col-span-5 relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search doctors by name..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-50/60 border border-stone-200 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Specialization Filter (4 cols) */}
          <div className="lg:col-span-4 relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
              <Filter className="w-4 h-4" />
            </div>
            <select
              value={selectedSpecialization}
              onChange={(e) => setSelectedSpecialization(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-stone-50/60 border border-stone-200 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium appearance-none cursor-pointer"
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
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
              <Calendar className="w-4 h-4" />
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-stone-50/60 border border-stone-200 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
            />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {(searchQuery || selectedSpecialization || selectedDate) && (
          <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs text-stone-600">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-stone-700">Active filters:</span>
              {searchQuery && (
                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 font-medium">
                  Name: "{searchQuery}"
                </span>
              )}
              {selectedSpecialization && (
                <span className="px-2.5 py-1 rounded-full bg-teal-50 text-teal-900 border border-teal-200 font-medium">
                  {selectedSpecialization}
                </span>
              )}
              {selectedDate && (
                <span className="px-2.5 py-1 rounded-full bg-orange-50 text-orange-900 border border-orange-200 font-medium">
                  Date: {selectedDate}
                </span>
              )}
            </div>

            <button
              onClick={handleClearFilters}
              className="text-amber-800 hover:text-amber-950 font-semibold cursor-pointer text-xs underline shrink-0 ml-auto"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Doctors Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white/80 border border-stone-200/60 rounded-3xl p-6 space-y-4 animate-pulse">
              <div className="w-12 h-12 rounded-2xl bg-stone-200" />
              <div className="space-y-2">
                <div className="h-5 w-3/4 bg-stone-200 rounded-lg" />
                <div className="h-4 w-1/2 bg-stone-100 rounded-lg" />
              </div>
              <div className="h-9 w-full bg-stone-100 rounded-xl" />
            </div>
          ))}
        </div>
      ) : doctors.length === 0 ? (
        <div className="bg-white/80 border border-stone-200/80 rounded-3xl p-12 text-center space-y-4 shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center mx-auto">
            <Stethoscope className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-stone-900">No Doctors Found</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
              No medical specialists matched your selected filters or search query. Try clearing filters to view all doctors.
            </p>
          </div>
          {(searchQuery || selectedSpecialization || selectedDate) && (
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold border border-amber-200 transition-all cursor-pointer"
            >
              Clear Search Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {doctors.map((doc) => (
            <div
              key={doc.id}
              className="bg-white/90 border border-stone-200/80 rounded-3xl p-6 shadow-sm backdrop-blur-md hover:shadow-md hover:border-amber-300 transition-all flex flex-col justify-between group space-y-5"
            >
              <div className="space-y-4">
                {/* Doctor Avatar Badge */}
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-50 to-amber-100 border border-amber-200/80 text-amber-700 flex items-center justify-center font-bold text-base shadow-2xs group-hover:scale-105 transition-all">
                    <Stethoscope className="w-6 h-6" />
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[10px] font-bold">
                    <UserCheck className="w-3 h-3 text-emerald-600" />
                    <span>Verified</span>
                  </span>
                </div>

                {/* Info */}
                <div>
                  <h3 className="text-base font-extrabold text-stone-900 tracking-tight group-hover:text-amber-800 transition-colors">
                    Dr. {doc.firstName} {doc.lastName}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-amber-900 font-semibold mt-1">
                    <span>{doc.specialization}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-stone-500 mt-2">
                    <Award className="w-3.5 h-3.5 text-stone-400" />
                    <span>{doc.experienceYears} years experience</span>
                  </div>
                </div>
              </div>

              {/* Action */}
              <button
                onClick={() => openDoctorModal(doc.id)}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-50 hover:bg-amber-600 hover:text-white border border-stone-200 hover:border-amber-600 text-stone-800 text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>View Availability</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Footer */}
      {!isLoading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-stone-200/80 text-xs text-stone-500">
          <span>
            Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} Doctors)
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchDoctors(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => fetchDoctors(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="p-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Selected Doctor Availability Modal */}
      {selectedDoctorId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-stone-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-stone-900 tracking-tight">
                    Dr. {doctorDetails?.doctor.firstName || "..."} {doctorDetails?.doctor.lastName || ""}
                  </h3>
                  <p className="text-xs text-amber-900 font-semibold">
                    {doctorDetails?.doctor.specialization || "Specialist"} &bull;{" "}
                    {doctorDetails?.doctor.experienceYears || 0} years experience
                  </p>
                </div>
              </div>

              <button
                onClick={closeDoctorModal}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Filter by Date */}
            <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
              <span className="text-xs font-semibold text-stone-700 shrink-0">Filter Date:</span>
              <input
                type="date"
                value={modalDateFilter}
                onChange={(e) => fetchModalFilteredAvailability(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
              {modalDateFilter && (
                <button
                  onClick={() => fetchModalFilteredAvailability("")}
                  className="text-xs text-amber-800 underline font-medium cursor-pointer"
                >
                  Show All
                </button>
              )}
            </div>

            {/* Modal Body - Availability List */}
            <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
              {isLoadingDetails ? (
                <div className="py-12 text-center text-stone-400 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-600" />
                  <p className="text-xs">Loading available schedule...</p>
                </div>
              ) : sortedModalDates.length === 0 ? (
                <div className="py-8 text-center bg-stone-50 rounded-2xl border border-stone-200/80 space-y-2">
                  <Calendar className="w-6 h-6 text-stone-400 mx-auto" />
                  <p className="text-xs font-bold text-stone-700">No Open Availability Slots</p>
                  <p className="text-[11px] text-stone-400">
                    This doctor has not published availability slots for the selected date.
                  </p>
                </div>
              ) : (
                sortedModalDates.map((dateKey) => {
                  const slots = groupedModalAvailabilities[dateKey];
                  return (
                    <div key={dateKey} className="p-4 rounded-2xl bg-stone-50/80 border border-stone-200/80 space-y-2.5">
                      <div className="flex items-center gap-2 text-stone-900 font-bold text-xs">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span>{formatDisplayDate(dateKey)}</span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {slots.map((slot) => (
                          <div
                            key={slot.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-stone-900 text-xs font-semibold shadow-2xs"
                          >
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>
                              {formatDisplayTime(slot.startTime)} – {formatDisplayTime(slot.endTime)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer Note */}
            <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/50 text-[11px] text-amber-900">
              <span className="font-semibold block mb-0.5">Availability View Only</span>
              <span>Online appointment booking will be available in the upcoming release.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
