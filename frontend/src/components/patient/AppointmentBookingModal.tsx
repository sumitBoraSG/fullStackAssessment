import React, { useState, useMemo, useEffect } from "react";
import {
  Calendar,
  Clock,
  Stethoscope,
  X,
  CalendarCheck,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { createAppointmentApi } from "../../api/appointmentApi";
import type { DoctorAvailabilityDetails, AvailabilitySlot } from "../../types/doctor";
import type { PatientAppointment } from "../../types/appointment";
import { getISTCurrentTimeString, getISTTodayString } from "../../utils/istDateTime";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";

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
      const bookedAppointment = res.data;
      setTimeout(() => {
        onSuccess(bookedAppointment);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141413]/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#F0EEE6] border border-[#D8D0BF] rounded-2xl max-w-xl w-full p-6 sm:p-7 shadow-lg space-y-5 relative overflow-hidden animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col text-[#141413]">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[#D8D0BF] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#E3DBCC] border border-[#D8D0BF] text-[#141413] flex items-center justify-center shrink-0 shadow-xs">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#E3DBCC] text-[#141413] text-[10px] font-medium border border-[#D8D0BF] mb-1">
                <CalendarCheck className="w-3 h-3 text-[#141413]" />
                <span>Book Consultation</span>
              </div>
              <h3 className="text-base font-semibold text-[#141413] tracking-tight m-0">
                Dr. {doctorDetails.doctor.firstName} {doctorDetails.doctor.lastName}
              </h3>
              <p className="text-xs text-[#141413]/60 font-normal m-0">
                {doctorDetails.doctor.specialization} &bull; {doctorDetails.doctor.experienceYears} yrs experience
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-[#141413]/50 hover:text-[#141413] hover:bg-[#E3DBCC] transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Notifications */}
          {errorMsg && <Alert variant="error">{errorMsg}</Alert>}
          {successMsg && <Alert variant="success">{successMsg}</Alert>}

          {/* 1. Date Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#141413] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#141413]/70" />
                <span>1. Select Available Date</span>
                <span className="text-[#8E2A22]">*</span>
              </span>
              <span className="text-[11px] font-normal text-[#141413]/50">
                {availableDates.length} upcoming date{availableDates.length === 1 ? "" : "s"}
              </span>
            </label>

            {availableDates.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#E3DBCC]/60 border border-[#D8D0BF] text-center space-y-1">
                <p className="text-xs font-semibold text-[#141413]">No Open Schedule</p>
                <p className="text-[11px] text-[#141413]/60">
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
                      className={`px-3 py-2 rounded-lg border text-xs shrink-0 transition-all flex flex-col items-center gap-0.5 cursor-pointer font-medium ${
                        isSelected
                          ? "bg-[#141413] text-[#F0EEE6] border-[#141413] shadow-xs"
                          : "bg-[#E3DBCC] text-[#141413] border-[#D8D0BF] hover:bg-[#D9D1C1]"
                      }`}
                    >
                      <span className="text-[10px] uppercase tracking-wider opacity-75">
                        {new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })}
                      </span>
                      <span>{formatDisplayDate(dateStr)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Time Slot Selection */}
          {selectedDate && (
            <div className="space-y-2.5 pt-3 border-t border-[#D8D0BF]">
              <label className="block text-xs font-semibold text-[#141413] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#141413]/70" />
                  <span>2. Choose 30-min Consultation Slot</span>
                  <span className="text-[#8E2A22]">*</span>
                </span>
                <span className="text-[11px] font-normal text-[#141413]/50">
                  Window: {dateSlots.map((s) => `${formatDisplayTime(s.startTime)}–${formatDisplayTime(s.endTime)}`).join(", ")}
                </span>
              </label>

              {suggestedSlots.length === 0 ? (
                <div className="p-3 rounded-lg bg-[#E3DBCC]/60 border border-[#D8D0BF] text-xs text-[#141413]/70">
                  No 30-min slot intervals fit in the selected schedule window.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-0.5">
                  {suggestedSlots.map((slot, idx) => {
                    const isSelected =
                      startTime === slot.startTime && endTime === slot.endTime;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSlotSelect(slot)}
                        className={`p-2 rounded-lg border text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? "bg-[#141413] text-[#F0EEE6] border-[#141413] shadow-xs"
                            : "bg-[#FAF8F5] text-[#141413] border-[#D8D0BF] hover:border-[#141413]"
                        }`}
                      >
                        <Clock className={`w-3 h-3 ${isSelected ? "text-[#F0EEE6]" : "text-[#141413]/60"}`} />
                        <span>
                          {formatDisplayTime(slot.startTime)} - {formatDisplayTime(slot.endTime)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Custom time refinement if needed */}
              <div className="pt-1">
                <details className="text-xs text-[#141413]/70">
                  <summary className="cursor-pointer font-medium text-[#141413] hover:underline">
                    Need a custom time range?
                  </summary>
                  <div className="grid grid-cols-2 gap-2.5 mt-2 p-3 bg-[#E3DBCC] rounded-lg border border-[#D8D0BF]">
                    <div>
                      <label className="block text-[11px] font-medium text-[#141413]/70 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-xs text-[#141413]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#141413]/70 mb-1">End Time</label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] text-xs text-[#141413]"
                      />
                    </div>
                  </div>
                </details>
              </div>
            </div>
          )}

          {/* 3. Summary & Confirmation Info */}
          {selectedDate && startTime && endTime && (
            <div className="p-3.5 rounded-xl bg-[#E3DBCC] border border-[#D8D0BF] space-y-2 text-xs text-[#141413]">
              <div className="flex items-center justify-between font-semibold">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#2B5438]" />
                  <span>Appointment Summary</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-[#FAF8F5] text-[10px] uppercase font-medium text-[#141413] border border-[#D8D0BF]">
                  Pending Approval
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <div>
                  <span className="text-[#141413]/60 block">Date:</span>
                  <span className="font-semibold">{formatDisplayDate(selectedDate)}</span>
                </div>
                <div>
                  <span className="text-[#141413]/60 block">Time:</span>
                  <span className="font-semibold">
                    {formatDisplayTime(startTime)} – {formatDisplayTime(endTime)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={isSubmitting}
              loadingText="Booking Appointment..."
              disabled={isSubmitting || !selectedDate || !startTime || !endTime}
            >
              <span>Confirm Appointment Request</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
