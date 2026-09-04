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
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";
import { EmptyState } from "../ui/EmptyState";
import { Modal } from "../ui/Modal";

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
          classes: "bg-[#EAE0CE] text-[#4A3B18] border-[#D4C4A8]",
          icon: <Clock className="w-3 h-3 text-[#7A5B18]" />,
        };
      case "CONFIRMED":
        return {
          label: "Confirmed",
          classes: "bg-[#DCE7DD] text-[#1E3E26] border-[#BED4C1]",
          icon: <CheckCircle2 className="w-3 h-3 text-[#265330]" />,
        };
      case "COMPLETED":
        return {
          label: "Completed",
          classes: "bg-[#D8DFE6] text-[#1E2E3E] border-[#BAC6D3]",
          icon: <Award className="w-3 h-3 text-[#274560]" />,
        };
      case "CANCELLED":
        return {
          label: "Cancelled",
          classes: "bg-[#EEDCDA] text-[#541C18] border-[#DEC0BD]",
          icon: <XCircle className="w-3 h-3 text-[#7A2420]" />,
        };
      case "REJECTED":
        return {
          label: "Declined",
          classes: "bg-[#DDD7CA] text-[#2D2A24] border-[#CCC4B4]",
          icon: <AlertCircle className="w-3 h-3 text-[#4D483F]" />,
        };
      default:
        return {
          label: status,
          classes: "bg-[#DDD7CA] text-[#2D2A24] border-[#CCC4B4]",
          icon: <Clock className="w-3 h-3 text-[#4D483F]" />,
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
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Editorial Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#141413]/60 block mb-1">
            Personal Care
          </span>
          <h2 className="text-xl sm:text-2xl font-semibold text-[#141413] tracking-tight m-0">
            My Appointments
          </h2>
          <p className="text-xs sm:text-sm text-[#141413]/60 mt-1 max-w-xl leading-relaxed">
            Track your consultations and manage your scheduled visits.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="secondary"
            onClick={() => fetchAppointments()}
            isLoading={isLoading}
            loadingText="Refreshing..."
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>

          {onNavigateToBooking && (
            <Button variant="primary" onClick={onNavigateToBooking}>
              <CalendarCheck className="w-4 h-4" />
              <span>Book New Appointment</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#E3DBCC] border border-[#D8D0BF] rounded-xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Status Filter (3 cols) */}
          <div className="lg:col-span-3">
            <label htmlFor="patient-appt-status" className="block text-[11px] font-medium text-[#141413]/70 mb-1">Status</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#141413]/40">
                <Filter className="w-3.5 h-3.5" />
              </div>
              <select
                id="patient-appt-status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as AppointmentStatus | "ALL");
                  setPage(1);
                }}
                className="w-full pl-9 pr-7 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-xs text-[#141413] focus:outline-none focus:border-[#141413] cursor-pointer"
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
          <div className="lg:col-span-2">
            <label htmlFor="patient-appt-date-filter" className="block text-[11px] font-medium text-[#141413]/70 mb-1">Date Filter</label>
            <select
              id="patient-appt-date-filter"
              value={dateFilterType}
              onChange={(e) => {
                setDateFilterType(e.target.value as "none" | "single" | "range");
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-xs text-[#141413] focus:outline-none focus:border-[#141413] cursor-pointer"
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
                <label htmlFor="patient-appt-single-date" className="block text-[11px] font-medium text-[#141413]/70 mb-1">Select Date</label>
                <input
                  id="patient-appt-single-date"
                  type="date"
                  value={singleDate}
                  onChange={(e) => {
                    setSingleDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-xs text-[#141413]"
                />
              </div>
            )}

            {dateFilterType === "range" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="patient-appt-date-from" className="block text-[11px] font-medium text-[#141413]/70 mb-1">From</label>
                  <input
                    id="patient-appt-date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-2 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-xs text-[#141413]"
                  />
                </div>
                <div>
                  <label htmlFor="patient-appt-date-to" className="block text-[11px] font-medium text-[#141413]/70 mb-1">To</label>
                  <input
                    id="patient-appt-date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-2 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-xs text-[#141413]"
                  />
                </div>
              </div>
            )}

            {dateFilterType === "none" && (
              <div>
                <span className="block text-[11px] font-medium text-[#141413]/40 mb-1">Date Filter Inactive</span>
                <div className="text-xs text-[#141413]/50 py-1.5">All dates included</div>
              </div>
            )}
          </div>

          {/* Sort By & Order (3 cols) */}
          <div className="lg:col-span-3 grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="patient-appt-sort-by" className="block text-[11px] font-medium text-[#141413]/70 mb-1 flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3" />
                <span>Sort By</span>
              </label>
              <select
                id="patient-appt-sort-by"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as "appointmentTime" | "createdAt" | "updatedAt");
                  setPage(1);
                }}
                className="w-full px-2 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-xs text-[#141413] focus:outline-none cursor-pointer"
              >
                <option value="appointmentTime">Date/Time</option>
                <option value="createdAt">Booked At</option>
                <option value="updatedAt">Updated At</option>
              </select>
            </div>
            <div>
              <label htmlFor="patient-appt-order" className="block text-[11px] font-medium text-[#141413]/70 mb-1">Order</label>
              <select
                id="patient-appt-order"
                value={order}
                onChange={(e) => {
                  setOrder(e.target.value as "ASC" | "DESC");
                  setPage(1);
                }}
                className="w-full px-2 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-xs text-[#141413] focus:outline-none cursor-pointer"
              >
                <option value="ASC">Ascending</option>
                <option value="DESC">Descending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Active Filters Clear Row */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2.5 border-t border-[#D8D0BF] text-xs">
            <span className="text-[#141413]/60 font-normal">Filtered results applied</span>
            <button
              onClick={handleClearFilters}
              className="text-[#141413] hover:underline font-medium cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Error State */}
      {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

      {/* Appointment Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[#E3DBCC] border border-[#D8D0BF] rounded-xl p-5 space-y-4 animate-pulse">
              <div className="flex justify-between items-center">
                <div className="w-24 h-5 bg-[#D8D0BF]/60 rounded-md" />
                <div className="w-16 h-4 bg-[#D8D0BF]/40 rounded-md" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-1/2 bg-[#D8D0BF]/60 rounded-md" />
                <div className="h-3 w-1/3 bg-[#D8D0BF]/40 rounded-md" />
              </div>
              <div className="h-8 w-full bg-[#D8D0BF]/60 rounded-lg" />
            </div>
          ))}
        </div>
      ) : !errorMsg && appointments.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          color="stone"
          title="No Appointments Found"
          description={
            hasActiveFilters
              ? "No appointments match your selected filter criteria. Try adjusting or clearing your filters."
              : "You don't have any appointments scheduled yet. Browse available doctors to book a consultation."
          }
          action={
            (hasActiveFilters || onNavigateToBooking) && (
              <div className="flex items-center justify-center gap-2.5">
                {hasActiveFilters && (
                  <Button variant="secondary" onClick={handleClearFilters}>
                    Clear Filters
                  </Button>
                )}
                {onNavigateToBooking && (
                  <Button variant="primary" onClick={onNavigateToBooking}>
                    Find & Book Doctors
                  </Button>
                )}
              </div>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {appointments.map((apt) => {
            const badge = getStatusBadge(apt.status);
            const isCancellable =
              (apt.status === "PENDING" || apt.status === "CONFIRMED") &&
              !isISTDateTimeInPast(apt.date, apt.startTime);

            return (
              <div
                key={apt.id}
                className="bg-[#E3DBCC] border border-[#D8D0BF] rounded-xl p-5 shadow-xs hover:border-[#141413]/30 transition-all flex flex-col justify-between space-y-4 text-[#141413]"
              >
                <div className="space-y-3.5">
                  {/* Top Bar: Status Badge & ID */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-md border ${badge.classes}`}
                    >
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>

                    <span className="text-[10px] font-mono text-[#141413]/50">
                      Ref #{apt.id}
                    </span>
                  </div>

                  {/* Doctor Info */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-[#141413] flex items-center justify-center shrink-0 shadow-xs font-medium text-xs">
                      <Stethoscope className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-[#141413] tracking-tight m-0">
                        Dr. {apt.doctor.firstName} {apt.doctor.lastName}
                      </h3>
                      <div className="text-xs text-[#141413]/80 font-medium mt-0.5">
                        <span>{apt.doctor.specialization}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#141413]/60 mt-1">
                        <Award className="w-3 h-3 text-[#141413]/40" />
                        <span>{apt.doctor.experienceYears} years experience</span>
                      </div>
                    </div>
                  </div>

                  {/* Time & Date Box */}
                  <div className="p-3 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] font-medium text-[#141413]/60 block uppercase tracking-wider">Date</span>
                      <div className="flex items-center gap-1.5 font-medium text-[#141413] mt-0.5">
                        <Calendar className="w-3.5 h-3.5 text-[#141413]/60" />
                        <span>{formatDisplayDate(apt.date)}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-[#141413]/60 block uppercase tracking-wider">Scheduled Time</span>
                      <div className="flex items-center gap-1.5 font-medium text-[#141413] mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-[#141413]/60" />
                        <span>
                          {formatDisplayTime(apt.startTime)} – {formatDisplayTime(apt.endTime)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions & Timestamps */}
                <div className="pt-3 border-t border-[#D8D0BF] flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[#141413]/50">
                    Booked {new Date(apt.createdAt).toLocaleDateString()}
                  </span>

                  {isCancellable && (
                    <button
                      onClick={() => setCancellingAppointment(apt)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[#8E2A22] hover:bg-[#EEDCDA] border border-[#DEC0BD] font-medium transition-all text-xs cursor-pointer"
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
        <div className="flex items-center justify-between pt-4 border-t border-[#D8D0BF] text-xs text-[#141413]/60">
          <span>
            Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} Appointments)
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-[#E3DBCC] border border-[#D8D0BF] hover:bg-[#D9D1C1] text-[#141413] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="p-1.5 rounded-lg bg-[#E3DBCC] border border-[#D8D0BF] hover:bg-[#D9D1C1] text-[#141413] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={!!cancellingAppointment}
        onClose={() => setCancellingAppointment(null)}
        title="Cancel Appointment?"
        description="This action cannot be undone."
        icon={AlertTriangle}
        iconColor="rose"
        disableClose={isCancelling}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setCancellingAppointment(null)}
              disabled={isCancelling}
              fullWidth
            >
              Keep Appointment
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmCancel}
              isLoading={isCancelling}
              loadingText="Cancelling..."
              fullWidth
            >
              Yes, Cancel
            </Button>
          </>
        }
      >
        {cancellingAppointment && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-[#E3DBCC] border border-[#D8D0BF] text-xs space-y-2 text-[#141413]">
              <div className="flex justify-between">
                <span className="text-[#141413]/60">Doctor:</span>
                <span className="font-semibold text-[#141413]">
                  Dr. {cancellingAppointment.doctor.firstName} {cancellingAppointment.doctor.lastName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#141413]/60">Scheduled Date:</span>
                <span className="font-semibold text-[#141413]">
                  {formatDisplayDate(cancellingAppointment.date)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#141413]/60">Time:</span>
                <span className="font-semibold text-[#141413]">
                  {formatDisplayTime(cancellingAppointment.startTime)} – {formatDisplayTime(cancellingAppointment.endTime)}
                </span>
              </div>
            </div>

            <p className="text-xs text-[#141413]/70 leading-relaxed m-0">
              Are you sure you want to cancel this appointment request? The slot will become available for other patients.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};
