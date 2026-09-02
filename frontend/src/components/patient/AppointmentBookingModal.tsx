import React, { useState, useMemo, useEffect } from "react";
import {
  Calendar,
  Clock,
  Stethoscope,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  CalendarCheck,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { createAppointmentApi } from "../../api/appointmentApi";
import type { DoctorAvailabilityDetails, AvailabilitySlot } from "../../types/doctor";
import type { PatientAppointment } from "../../types/appointment";
import { getISTCurrentTimeString, getISTTodayString } from "../../utils/istDateTime";

interface AppointmentBookingModalProps {
  doctorDetails: DoctorAvailabilityDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (appointment: PatientAppointment) => void;
}

export const AppointmentBookingModal: React.FC<AppointmentBookingModalProps> = ({
  doctorDetails,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("10:00");
  const [endTime, setEndTime] = useState<string>("10:30");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // The modal is kept mounted by its parent and toggled via isOpen/
  // doctorDetails props, so reset all form/notification state whenever it
  // opens or the selected doctor changes — otherwise a stale date/time or
  // leftover success/error banner from a previous booking can linger.
  useEffect(() => {
    if (isOpen) {
      setSelectedDate("");
      setStartTime("10:00");
      setEndTime("10:30");
      setErrorMsg(null);
      setSuccessMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen, doctorDetails?.doctor.id]);

  // Group doctor's availability by date
  const groupedAvailabilities = useMemo(() => {
    if (!doctorDetails?.availability) return {};
    const today = getISTTodayString();
    return doctorDetails.availability
      .filter((slot) => slot.date >= today)
      .reduce<Record<string, AvailabilitySlot[]>>((acc, slot) => {
        if (!acc[slot.date]) acc[slot.date] = [];
        acc[slot.date].push(slot);
        return acc;
      }, {});
  }, [doctorDetails]);

  const availableDates = Object.keys(groupedAvailabilities).sort();

  // Slots available on the chosen date
  const dateSlots = selectedDate ? groupedAvailabilities[selectedDate] || [] : [];

  // Generate suggested 30-minute slots from the doctor's availability windows
  const suggestedSlots = useMemo(() => {
    if (!dateSlots.length) return [];
    const slots: { startTime: string; endTime: string; slotId: number; label: string }[] = [];

    dateSlots.forEach((availSlot) => {
      const [startH, startM] = availSlot.startTime.split(":").map(Number);
      const [endH, endM] = availSlot.endTime.split(":").map(Number);

      let currentMins = startH * 60 + startM;
      const endMins = endH * 60 + endM;

      while (currentMins + 30 <= endMins) {
        const slotStartH = Math.floor(currentMins / 60);
        const slotStartM = currentMins % 60;
        const slotEndH = Math.floor((currentMins + 30) / 60);
        const slotEndM = (currentMins + 30) % 60;

        const sStr = `${String(slotStartH).padStart(2, "0")}:${String(slotStartM).padStart(2, "0")}`;
        const eStr = `${String(slotEndH).padStart(2, "0")}:${String(slotEndM).padStart(2, "0")}`;

        slots.push({
          slotId: availSlot.id,
          startTime: sStr,
          endTime: eStr,
          label: `${sStr} - ${eStr}`,
        });

        currentMins += 30;
      }
    });

    return slots;
  }, [dateSlots]);

  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr);
    setErrorMsg(null);
  };

  const handleSlotSelect = (slot: { startTime: string; endTime: string }) => {
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorDetails?.doctor.id) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const todayStr = getISTTodayString();
    if (!selectedDate) {
      setErrorMsg("Please select an appointment date.");
      return;
    }
    if (selectedDate < todayStr) {
      setErrorMsg("Appointment date cannot be in the past.");
      return;
    }
    if (!startTime || !endTime) {
      setErrorMsg("Please choose a start and end time for your appointment.");
      return;
    }
    if (startTime >= endTime) {
      setErrorMsg("Start time must be before end time.");
      return;
    }
    if (selectedDate === todayStr && startTime <= getISTCurrentTimeString()) {
      setErrorMsg("Appointment time cannot be in the past.");
      return;
    }

    setIsSubmitting(true);
    const res = await createAppointmentApi({
      doctorId: doctorDetails.doctor.id,
      date: selectedDate,
      startTime,
      endTime,
    });
    setIsSubmitting(false);

    if (res.success && res.data) {
      setSuccessMsg("Appointment requested successfully!");
      onSuccess(res.data);
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setErrorMsg(res.message || "Failed to book appointment. Please try another slot.");
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
      });
    } catch {
      return dateStr;
    }
  };

  if (!isOpen || !doctorDetails) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-stone-200 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-stone-100 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-50 to-orange-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 shadow-2xs">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200/80 mb-0.5">
                <CalendarCheck className="w-3 h-3 text-amber-600" />
                <span>Book Consultation</span>
              </div>
              <h3 className="text-lg font-extrabold text-stone-900 tracking-tight">
                Dr. {doctorDetails.doctor.firstName} {doctorDetails.doctor.lastName}
              </h3>
              <p className="text-xs text-stone-500 font-medium">
                {doctorDetails.doctor.specialization} &bull; {doctorDetails.doctor.experienceYears} yrs experience
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto pr-1 flex-1">
          {/* Notifications */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{successMsg}</span>
            </div>
          )}

          {/* 1. Date Selection */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-stone-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>1. Select Available Date</span>
                <span className="text-rose-500">*</span>
              </span>
              <span className="text-[11px] font-medium text-stone-500">
                {availableDates.length} upcoming date{availableDates.length === 1 ? "" : "s"}
              </span>
            </label>

            {availableDates.length === 0 ? (
              <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 text-center space-y-1.5">
                <p className="text-xs font-bold text-stone-700">No Open Schedule</p>
                <p className="text-[11px] text-stone-500">
                  This doctor has not published any upcoming availability slots yet.
                </p>
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {availableDates.map((dateStr) => {
                  const isSelected = selectedDate === dateStr;
                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => handleDateSelect(dateStr)}
                      className={`px-3.5 py-2.5 rounded-2xl border text-xs font-bold shrink-0 transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                        isSelected
                          ? "bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20"
                          : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50 hover:border-amber-300"
                      }`}
                    >
                      <span className="text-[10px] uppercase font-semibold opacity-80">
                        {new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })}
                      </span>
                      <span>{formatDisplayDate(dateStr)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Time Slot Selection (Active when date chosen) */}
          {selectedDate && (
            <div className="space-y-3 pt-2 border-t border-stone-100">
              <label className="block text-xs font-bold text-stone-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>2. Choose 30-min Consultation Slot</span>
                  <span className="text-rose-500">*</span>
                </span>
                <span className="text-[11px] font-medium text-stone-500">
                  Window: {dateSlots.map((s) => `${formatDisplayTime(s.startTime)}–${formatDisplayTime(s.endTime)}`).join(", ")}
                </span>
              </label>

              {suggestedSlots.length === 0 ? (
                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/60 text-xs text-amber-900">
                  No 30-min slot intervals fit in the selected schedule window.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-1">
                  {suggestedSlots.map((slot, idx) => {
                    const isSelected =
                      startTime === slot.startTime && endTime === slot.endTime;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSlotSelect(slot)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? "bg-amber-100/90 text-amber-950 border-amber-400 ring-2 ring-amber-500/20 font-bold"
                            : "bg-stone-50/70 hover:bg-white text-stone-800 border-stone-200/80 hover:border-amber-300"
                        }`}
                      >
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>
                          {formatDisplayTime(slot.startTime)} - {formatDisplayTime(slot.endTime)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Custom time refinement if needed */}
              <div className="pt-2">
                <details className="text-xs text-stone-600">
                  <summary className="cursor-pointer font-semibold text-amber-800 hover:text-amber-950">
                    Need a custom time range?
                  </summary>
                  <div className="grid grid-cols-2 gap-3 mt-2 p-3 bg-stone-50 rounded-2xl border border-stone-200/80">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-stone-200 text-xs text-stone-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">End Time</label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-stone-200 text-xs text-stone-900"
                      />
                    </div>
                  </div>
                </details>
              </div>
            </div>
          )}

          {/* 3. Summary & Confirmation Info */}
          {selectedDate && startTime && endTime && (
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 space-y-2 text-xs text-amber-950">
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Appointment Summary</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-200/70 text-[10px] uppercase font-bold text-amber-900">
                  Pending Approval
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <div>
                  <span className="text-stone-500 block">Date:</span>
                  <span className="font-bold">{formatDisplayDate(selectedDate)}</span>
                </div>
                <div>
                  <span className="text-stone-500 block">Time:</span>
                  <span className="font-bold">
                    {formatDisplayTime(startTime)} – {formatDisplayTime(endTime)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !selectedDate || !startTime || !endTime}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-600 via-orange-500 to-amber-700 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold shadow-md shadow-amber-600/20 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Booking Appointment...</span>
                </>
              ) : (
                <>
                  <span>Confirm Appointment Request</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
