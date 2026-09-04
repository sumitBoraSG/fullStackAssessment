import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Clock,
  Plus,
  RefreshCw,
  CalendarCheck,
} from "lucide-react";
import {
  createDoctorAvailabilityApi,
  getOwnDoctorAvailabilityApi,
} from "../../api/doctorApi";
import type { AvailabilitySlot } from "../../types/doctor";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";
import { EmptyState } from "../ui/EmptyState";

export const DoctorAvailabilitySection: React.FC = () => {
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [date, setDate] = useState<string>(getTodayString());
  const [startTime, setStartTime] = useState<string>("09:00");
  const [endTime, setEndTime] = useState<string>("12:00");

  const [availabilities, setAvailabilities] = useState<AvailabilitySlot[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  // Kept separate from the form's own errorMsg - a failure to load the
  // existing schedule shouldn't be displayed as if the "Set Availability"
  // form submission itself failed.
  const [loadErrorMsg, setLoadErrorMsg] = useState<string | null>(null);

  const fetchAvailabilities = useCallback(async () => {
    setIsLoading(true);
    setLoadErrorMsg(null);
    const res = await getOwnDoctorAvailabilityApi();
    setIsLoading(false);
    if (res.success && res.data) {
      setAvailabilities(res.data);
    } else {
      setLoadErrorMsg(res.message || "Failed to load availability slots.");
    }
  }, []);

  useEffect(() => {
    fetchAvailabilities();
  }, [fetchAvailabilities]);

  const handleAddAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const todayStr = getTodayString();
    if (!date) {
      setErrorMsg("Please select a date.");
      return;
    }
    if (date < todayStr) {
      setErrorMsg("Availability date cannot be in the past.");
      return;
    }
    if (!startTime || !endTime) {
      setErrorMsg("Please select both start time and end time.");
      return;
    }
    if (startTime >= endTime) {
      setErrorMsg("Start time must be before end time.");
      return;
    }

    setIsSubmitting(true);
    const res = await createDoctorAvailabilityApi({
      date,
      startTime,
      endTime,
    });
    setIsSubmitting(false);

    if (res.success) {
      setSuccessMsg("Availability slot added successfully!");
      fetchAvailabilities();
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(res.message || "Failed to add availability slot.");
    }
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

  const groupedAvailabilities = availabilities.reduce<Record<string, AvailabilitySlot[]>>(
    (acc, slot) => {
      const key = slot.date;
      if (!acc[key]) acc[key] = [];
      acc[key].push(slot);
      return acc;
    },
    {},
  );

  const sortedDates = Object.keys(groupedAvailabilities).sort();

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Editorial Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#141413]/60 block mb-1">
            Clinical Schedule
          </span>
          <h2 className="text-xl sm:text-2xl font-semibold text-[#141413] tracking-tight m-0">
            My Availability
          </h2>
          <p className="text-xs sm:text-sm text-[#141413]/60 mt-1 max-w-xl leading-relaxed">
            Configure consultation windows when patients can book appointments with you.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={fetchAvailabilities}
          isLoading={isLoading}
          loadingText="Refreshing..."
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Schedule</span>
        </Button>
      </div>

      {/* Form & List Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Column (5 cols) */}
        <div className="lg:col-span-5">
          <div className="bg-[#E3DBCC] border border-[#D8D0BF] rounded-xl p-5 sm:p-6 shadow-xs sticky top-6 text-[#141413]">
            <div className="flex items-center gap-3 mb-5 pb-3.5 border-b border-[#D8D0BF]">
              <div className="w-9 h-9 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] flex items-center justify-center text-[#141413] shadow-xs">
                <CalendarCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#141413] tracking-tight m-0">
                  Set Availability
                </h3>
                <p className="text-xs text-[#141413]/60 m-0">Publish an appointment window</p>
              </div>
            </div>

            {/* Error Notification */}
            {errorMsg && (
              <div className="mb-3.5">
                <Alert variant="error">{errorMsg}</Alert>
              </div>
            )}

            {/* Success Notification */}
            {successMsg && (
              <div className="mb-3.5">
                <Alert variant="success">{successMsg}</Alert>
              </div>
            )}

            <form onSubmit={handleAddAvailability} className="space-y-3.5" noValidate>
              {/* Date */}
              <div>
                <label htmlFor="availability-date" className="block text-xs font-medium text-[#141413] mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#141413]/60" />
                  <span>Date</span>
                  <span className="text-[#8E2A22]">*</span>
                </label>
                <input
                  id="availability-date"
                  type="date"
                  min={getTodayString()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-[#141413] text-xs sm:text-sm focus:outline-none focus:border-[#141413] focus:ring-1 focus:ring-[#141413] transition-all"
                  required
                />
              </div>

              {/* Times Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Start Time */}
                <div>
                  <label htmlFor="availability-start" className="block text-xs font-medium text-[#141413] mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#141413]/60" />
                    <span>Start Time</span>
                    <span className="text-[#8E2A22]">*</span>
                  </label>
                  <input
                    id="availability-start"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-[#141413] text-xs sm:text-sm focus:outline-none focus:border-[#141413] focus:ring-1 focus:ring-[#141413] transition-all"
                    required
                  />
                </div>

                {/* End Time */}
                <div>
                  <label htmlFor="availability-end" className="block text-xs font-medium text-[#141413] mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#141413]/60" />
                    <span>End Time</span>
                    <span className="text-[#8E2A22]">*</span>
                  </label>
                  <input
                    id="availability-end"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-[#141413] text-xs sm:text-sm focus:outline-none focus:border-[#141413] focus:ring-1 focus:ring-[#141413] transition-all"
                    required
                  />
                </div>
              </div>

              {/* Preview helper pill */}
              <div className="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-[11px] text-[#141413] flex items-center justify-between">
                <span className="text-[#141413]/60">Slot duration:</span>
                <span className="font-semibold text-[#141413]">
                  {formatDisplayTime(startTime)} – {formatDisplayTime(endTime)}
                </span>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                loadingText="Adding Slot..."
                fullWidth
                className="mt-1"
              >
                <Plus className="w-4 h-4" />
                <span>Add Availability Slot</span>
              </Button>
            </form>
          </div>
        </div>

        {/* Availability List Column (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-base font-semibold text-[#141413] tracking-tight flex items-center gap-2 m-0">
              <span>Your Availability</span>
              <span className="px-2 py-0.5 text-xs rounded-md bg-[#FAF8F5] border border-[#D8D0BF] text-[#141413] font-medium">
                {availabilities.length}
              </span>
            </h3>
          </div>

          {/* Load Error */}
          {loadErrorMsg && !isLoading && <Alert variant="error">{loadErrorMsg}</Alert>}

          {/* Loading Skeleton */}
          {isLoading && (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="bg-[#E3DBCC] border border-[#D8D0BF] rounded-xl p-5 space-y-3 animate-pulse">
                  <div className="h-4 w-32 bg-[#D8D0BF]/60 rounded-md" />
                  <div className="flex gap-2">
                    <div className="h-7 w-28 bg-[#D8D0BF]/40 rounded-lg" />
                    <div className="h-7 w-28 bg-[#D8D0BF]/40 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !loadErrorMsg && availabilities.length === 0 && (
            <EmptyState
              icon={Calendar}
              color="stone"
              title="No Availability Slots Set"
              description="You haven't added any availability slots yet. Use the form on the left to publish your available hours for patients."
            />
          )}

          {/* Grouped Availability List */}
          {!isLoading && sortedDates.length > 0 && (
            <div className="space-y-3">
              {sortedDates.map((dateKey) => {
                const slots = groupedAvailabilities[dateKey];
                return (
                  <div
                    key={dateKey}
                    className="bg-[#E3DBCC] border border-[#D8D0BF] rounded-xl p-4 sm:p-5 shadow-xs space-y-2.5 text-[#141413]"
                  >
                    <div className="flex items-center gap-2 text-[#141413] font-semibold text-xs sm:text-sm">
                      <div className="w-2 h-2 rounded-full bg-[#141413]" />
                      <span>{formatDisplayDate(dateKey)}</span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {slots.map((slot) => (
                        <div
                          key={slot.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-[#141413] text-xs font-medium shadow-2xs"
                        >
                          <Clock className="w-3 h-3 text-[#141413]/60" />
                          <span>
                            {formatDisplayTime(slot.startTime)} – {formatDisplayTime(slot.endTime)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
