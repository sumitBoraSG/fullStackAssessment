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

  const fetchAvailabilities = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    const res = await getOwnDoctorAvailabilityApi();
    setIsLoading(false);
    if (res.success && res.data) {
      setAvailabilities(res.data);
    } else {
      setErrorMsg(res.message || "Failed to load availability slots.");
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
      // Auto clear success message after 4s
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

  // Group availabilities by date
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
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-sm text-stone-500 max-w-xl m-0">
          Set the time slots when patients can book you for a consultation.
        </p>
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Column (5 cols) */}
        <div className="lg:col-span-5">
          <div className="bg-white/90 border border-stone-200/80 rounded-3xl p-6 sm:p-7 shadow-lg shadow-stone-200/50 backdrop-blur-xl sticky top-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-stone-100">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shadow-2xs">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-stone-900 tracking-tight">
                  Set Availability
                </h2>
                <p className="text-xs text-stone-500">Add a new time slot to your calendar</p>
              </div>
            </div>

            {/* Error Notification */}
            {errorMsg && (
              <div className="mb-4">
                <Alert variant="error">{errorMsg}</Alert>
              </div>
            )}

            {/* Success Notification */}
            {successMsg && (
              <div className="mb-4">
                <Alert variant="success">{successMsg}</Alert>
              </div>
            )}

            <form onSubmit={handleAddAvailability} className="space-y-4" noValidate>
              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-stone-400" />
                  <span>Date</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  min={getTodayString()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50/50 border border-stone-200 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
                  required
                />
              </div>

              {/* Times Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Start Time */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    <span>Start Time</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-stone-50/50 border border-stone-200 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
                    required
                  />
                </div>

                {/* End Time */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    <span>End Time</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-stone-50/50 border border-stone-200 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
                    required
                  />
                </div>
              </div>

              {/* Preview helper pill */}
              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/50 text-[11px] text-amber-900 flex items-center justify-between">
                <span className="text-stone-500">Slot duration:</span>
                <span className="font-semibold text-amber-900">
                  {formatDisplayTime(startTime)} – {formatDisplayTime(endTime)}
                </span>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                isLoading={isSubmitting}
                loadingText="Adding Slot..."
                fullWidth
                className="mt-2"
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
            <h2 className="text-lg font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <span>Your Availability</span>
              <span className="px-2 py-0.5 text-xs rounded-full bg-stone-200/80 text-stone-700 font-semibold">
                {availabilities.length}
              </span>
            </h2>
          </div>

          {/* Loading Skeleton */}
          {isLoading && (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white/80 border border-stone-200/60 rounded-3xl p-6 space-y-3 animate-pulse">
                  <div className="h-4 w-36 bg-stone-200 rounded-lg" />
                  <div className="flex gap-2">
                    <div className="h-8 w-32 bg-stone-100 rounded-xl" />
                    <div className="h-8 w-32 bg-stone-100 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && availabilities.length === 0 && (
            <EmptyState
              icon={Calendar}
              color="amber"
              title="No Availability Slots Set"
              description="You haven't added any availability slots yet. Use the form on the left to publish your available hours for patients."
            />
          )}

          {/* Grouped Availability List */}
          {!isLoading && sortedDates.length > 0 && (
            <div className="space-y-4">
              {sortedDates.map((dateKey) => {
                const slots = groupedAvailabilities[dateKey];
                return (
                  <div
                    key={dateKey}
                    className="bg-white/90 border border-stone-200/80 rounded-3xl p-5 sm:p-6 shadow-sm backdrop-blur-md hover:shadow-md transition-all space-y-3"
                  >
                    <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>{formatDisplayDate(dateKey)}</span>
                    </div>

                    <div className="flex flex-wrap gap-2.5 pt-1">
                      {slots.map((slot) => (
                        <div
                          key={slot.id}
                          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-950 text-xs font-semibold shadow-2xs hover:bg-amber-100/80 transition-all"
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
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
