import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Clock,
  Filter,
  RefreshCw,
  AlertCircle,
  XCircle,
  CheckCircle2,
  CalendarCheck,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Sparkles,
  Loader2,
  Award,
  AlertTriangle,
} from "lucide-react";
import {
  getPatientAppointmentsApi,
  cancelPatientAppointmentApi,
} from "../../api/appointmentApi";
import type {
  PatientAppointment,
  AppointmentStatus,
  GetAppointmentsParams,
} from "../../types/appointment";
import type { PaginationMeta } from "../../types/auth";
import { useAuth } from "../../context/AuthContext";
import { isISTDateTimeInPast } from "../../utils/istDateTime";

interface PatientAppointmentsListProps {
  onNavigateToBooking?: () => void;
}

export const PatientAppointmentsList: React.FC<PatientAppointmentsListProps> = ({
  onNavigateToBooking,
}) => {
  const { setNotification } = useAuth();

  // Filter & Pagination States
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "ALL">("ALL");
  const [dateFilterType, setDateFilterType] = useState<"none" | "single" | "range">("none");
  const [singleDate, setSingleDate] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [sortBy, setSortBy] = useState<"appointmentTime" | "createdAt" | "updatedAt">("appointmentTime");
  const [order, setOrder] = useState<"ASC" | "DESC">("ASC");
  const [page, setPage] = useState<number>(1);

  // Data States
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 8,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cancel Confirmation Modal State
  const [cancellingAppointment, setCancellingAppointment] = useState<PatientAppointment | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  // Fetch Appointments
  const fetchAppointments = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);

    const params: GetAppointmentsParams = {
      page,
      limit: 8,
      status: statusFilter !== "ALL" ? statusFilter : undefined,
      sortBy,
      order,
    };

    if (dateFilterType === "single" && singleDate) {
      params.date = singleDate;
    } else if (dateFilterType === "range") {
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
    }

    const res = await getPatientAppointmentsApi(params);
    setIsLoading(false);

    if (res.success && res.data) {
      setAppointments(res.data.appointments);
      setPagination(res.data.pagination);
    } else {
      setErrorMsg(res.message || "Failed to load appointments.");
    }
  }, [page, statusFilter, dateFilterType, singleDate, dateFrom, dateTo, sortBy, order]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Handle Cancellation
  const handleConfirmCancel = async () => {
    if (!cancellingAppointment) return;

    setIsCancelling(true);
    const res = await cancelPatientAppointmentApi(cancellingAppointment.id);
    setIsCancelling(false);

    if (res.success) {
      setNotification({
        type: "success",
        message: "Appointment cancelled successfully.",
      });
      setCancellingAppointment(null);
      fetchAppointments();
    } else {
      setNotification({
        type: "error",
        message: res.message || "Failed to cancel appointment.",
      });
    }
  };

  const handleClearFilters = () => {
    setStatusFilter("ALL");
    setDateFilterType("none");
    setSingleDate("");
    setDateFrom("");
    setDateTo("");
    setSortBy("appointmentTime");
    setOrder("ASC");
    setPage(1);
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

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case "PENDING":
        return {
          label: "Pending Approval",
          classes: "bg-amber-50 text-amber-900 border-amber-200/90",
          icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,
        };
      case "CONFIRMED":
        return {
          label: "Confirmed",
          classes: "bg-emerald-50 text-emerald-900 border-emerald-200/90",
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
        };
      case "COMPLETED":
        return {
          label: "Completed",
          classes: "bg-blue-50 text-blue-900 border-blue-200/90",
          icon: <Award className="w-3.5 h-3.5 text-blue-600" />,
        };
      case "CANCELLED":
        return {
          label: "Cancelled",
          classes: "bg-rose-50 text-rose-800 border-rose-200/90",
          icon: <XCircle className="w-3.5 h-3.5 text-rose-600" />,
        };
      case "REJECTED":
        return {
          label: "Declined",
          classes: "bg-stone-100 text-stone-700 border-stone-200",
          icon: <AlertCircle className="w-3.5 h-3.5 text-stone-500" />,
        };
      default:
        return {
          label: status,
          classes: "bg-stone-50 text-stone-800 border-stone-200",
          icon: <Clock className="w-3.5 h-3.5 text-stone-500" />,
        };
    }
  };

  const hasActiveFilters =
    statusFilter !== "ALL" ||
    (dateFilterType === "single" && singleDate) ||
    (dateFilterType === "range" && (dateFrom || dateTo)) ||
    sortBy !== "appointmentTime" ||
    order !== "ASC";

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner Header */}
      <div className="bg-white/80 border border-stone-200/80 rounded-3xl p-6 sm:p-8 shadow-sm backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-100/40 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200/80 text-[11px] font-bold text-orange-900 mb-2 shadow-2xs">
              <Sparkles className="w-3 h-3 text-orange-600" />
              <span>Patient Medical History</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
              My Appointments
            </h1>
            <p className="text-sm text-stone-500 mt-1 max-w-xl">
              Track your upcoming consultations, view status updates, and manage your scheduled healthcare visits.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => fetchAppointments()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>

            {onNavigateToBooking && (
              <button
                onClick={onNavigateToBooking}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold shadow-md shadow-amber-600/20 active:scale-95 transition-all cursor-pointer"
              >
                <CalendarCheck className="w-4 h-4" />
                <span>Book New Appointment</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white/90 border border-stone-200/80 rounded-3xl p-4 sm:p-6 shadow-sm backdrop-blur-md space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5">
          {/* Status Filter (3 cols) */}
          <div className="lg:col-span-3 relative">
            <label className="block text-[11px] font-bold text-stone-600 mb-1">Status</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                <Filter className="w-4 h-4" />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as AppointmentStatus | "ALL");
                  setPage(1);
                }}
                className="w-full pl-10 pr-8 py-2 rounded-xl bg-stone-50/60 border border-stone-200 text-xs text-stone-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Approval</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="REJECTED">Declined</option>
              </select>
            </div>
          </div>

          {/* Date Mode Selector (2 cols) */}
          <div className="lg:col-span-2 relative">
            <label className="block text-[11px] font-bold text-stone-600 mb-1">Date Filter</label>
            <select
              value={dateFilterType}
              onChange={(e) => {
                setDateFilterType(e.target.value as "none" | "single" | "range");
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl bg-stone-50/60 border border-stone-200 text-xs text-stone-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
            >
              <option value="none">Any Date</option>
              <option value="single">Specific Date</option>
              <option value="range">Date Range</option>
            </select>
          </div>

          {/* Dynamic Date Inputs (4 cols) */}
          <div className="lg:col-span-4">
            {dateFilterType === "single" && (
              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-1">Select Date</label>
                <input
                  type="date"
                  value={singleDate}
                  onChange={(e) => {
                    setSingleDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-1.5 rounded-xl bg-stone-50/60 border border-stone-200 text-xs text-stone-900 font-medium"
                />
              </div>
            )}

            {dateFilterType === "range" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-stone-50/60 border border-stone-200 text-xs text-stone-900 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-stone-50/60 border border-stone-200 text-xs text-stone-900 font-medium"
                  />
                </div>
              </div>
            )}

            {dateFilterType === "none" && (
              <div>
                <label className="block text-[11px] font-bold text-stone-400 mb-1">Date Filter Inactive</label>
                <div className="text-xs text-stone-400 py-2 italic">All upcoming and past dates included</div>
              </div>
            )}
          </div>

          {/* Sort By & Order (3 cols) */}
          <div className="lg:col-span-3 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-stone-600 mb-1 flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3" />
                <span>Sort By</span>
              </label>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as "appointmentTime" | "createdAt" | "updatedAt");
                  setPage(1);
                }}
                className="w-full px-2.5 py-2 rounded-xl bg-stone-50/60 border border-stone-200 text-xs text-stone-900 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="appointmentTime">Date/Time</option>
                <option value="createdAt">Booked At</option>
                <option value="updatedAt">Updated At</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-600 mb-1">Order</label>
              <select
                value={order}
                onChange={(e) => {
                  setOrder(e.target.value as "ASC" | "DESC");
                  setPage(1);
                }}
                className="w-full px-2.5 py-2 rounded-xl bg-stone-50/60 border border-stone-200 text-xs text-stone-900 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="ASC">Ascending</option>
                <option value="DESC">Descending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Active Filters Clear Row */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs">
            <span className="text-stone-500 font-medium">Filtered results applied</span>
            <button
              onClick={handleClearFilters}
              className="text-amber-800 hover:text-amber-950 font-bold underline cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Error State */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Appointment Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white/80 border border-stone-200/60 rounded-3xl p-6 space-y-4 animate-pulse">
              <div className="flex justify-between items-center">
                <div className="w-28 h-6 bg-stone-200 rounded-full" />
                <div className="w-20 h-5 bg-stone-100 rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="h-5 w-1/2 bg-stone-200 rounded-lg" />
                <div className="h-4 w-1/3 bg-stone-100 rounded-lg" />
              </div>
              <div className="h-10 w-full bg-stone-100 rounded-2xl" />
            </div>
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <div className="bg-white/80 border border-stone-200/80 rounded-3xl p-12 text-center space-y-4 shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center mx-auto">
            <CalendarCheck className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-stone-900">No Appointments Found</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
              {hasActiveFilters
                ? "No appointments match your selected filter criteria. Try adjusting or clearing your filters."
                : "You don't have any appointments scheduled yet. Browse available doctors to book a consultation."}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-all cursor-pointer"
              >
                Clear Filters
              </button>
            )}
            {onNavigateToBooking && (
              <button
                onClick={onNavigateToBooking}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                Find & Book Doctors
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {appointments.map((apt) => {
            const badge = getStatusBadge(apt.status);
            const isCancellable =
              (apt.status === "PENDING" || apt.status === "CONFIRMED") &&
              !isISTDateTimeInPast(apt.date, apt.startTime);

            return (
              <div
                key={apt.id}
                className="bg-white/90 border border-stone-200/80 rounded-3xl p-6 shadow-sm backdrop-blur-md hover:shadow-md transition-all flex flex-col justify-between space-y-5"
              >
                <div className="space-y-4">
                  {/* Top Bar: Status Badge & ID */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border shadow-2xs ${badge.classes}`}
                    >
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>

                    <span className="text-[11px] font-mono text-stone-400">
                      Ref #{apt.id}
                    </span>
                  </div>

                  {/* Doctor Info */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 shadow-2xs font-bold text-sm">
                      <Stethoscope className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-stone-900 tracking-tight">
                        Dr. {apt.doctor.firstName} {apt.doctor.lastName}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-amber-900 font-semibold mt-0.5">
                        <span>{apt.doctor.specialization}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-stone-500 mt-1">
                        <Award className="w-3.5 h-3.5 text-stone-400" />
                        <span>{apt.doctor.experienceYears} years experience</span>
                      </div>
                    </div>
                  </div>

                  {/* Time & Date Box */}
                  <div className="p-3.5 rounded-2xl bg-stone-50/80 border border-stone-200/80 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[11px] font-bold text-stone-500 block">Date</span>
                      <div className="flex items-center gap-1.5 font-bold text-stone-900 mt-0.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-600" />
                        <span>{formatDisplayDate(apt.date)}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-stone-500 block">Scheduled Time</span>
                      <div className="flex items-center gap-1.5 font-bold text-stone-900 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>
                          {formatDisplayTime(apt.startTime)} – {formatDisplayTime(apt.endTime)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions & Timestamps */}
                <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-stone-400">
                    Booked on {new Date(apt.createdAt).toLocaleDateString()}
                  </span>

                  {isCancellable && (
                    <button
                      onClick={() => setCancellingAppointment(apt)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-rose-700 hover:text-rose-900 hover:bg-rose-50 border border-rose-200/60 font-bold transition-all text-xs cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel Appointment</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {!isLoading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-stone-200/80 text-xs text-stone-500">
          <span>
            Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} Appointments)
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="p-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancellingAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-stone-200 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-stone-900">Cancel Appointment?</h3>
                <p className="text-xs text-stone-500">This action cannot be undone.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-stone-500">Doctor:</span>
                <span className="font-bold text-stone-900">
                  Dr. {cancellingAppointment.doctor.firstName} {cancellingAppointment.doctor.lastName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Scheduled Date:</span>
                <span className="font-bold text-stone-900">
                  {formatDisplayDate(cancellingAppointment.date)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Time:</span>
                <span className="font-bold text-stone-900">
                  {formatDisplayTime(cancellingAppointment.startTime)} – {formatDisplayTime(cancellingAppointment.endTime)}
                </span>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Are you sure you want to cancel this appointment request? The slot will become available for other patients.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCancellingAppointment(null)}
                disabled={isCancelling}
                className="flex-1 py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Keep Appointment
              </button>

              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <span>Yes, Cancel</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
