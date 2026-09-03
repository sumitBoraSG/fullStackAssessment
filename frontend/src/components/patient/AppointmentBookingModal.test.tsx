import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { act, render, screen, waitFor } from "@testing-library/react";
import { server } from "../../test/msw/server";
import { AppointmentBookingModal } from "./AppointmentBookingModal";
import type { DoctorAvailabilityDetails } from "../../types/doctor";

const BASE = "http://localhost:3000";

const baseDoctor = {
  id: 2,
  firstName: "Doc",
  lastName: "Tor",
  specialization: "General Practitioner",
  experienceYears: 5,
};

function buildDetails(availability: DoctorAvailabilityDetails["availability"]): DoctorAvailabilityDetails {
  return { doctor: baseDoctor, availability };
}

describe("AppointmentBookingModal", () => {
  beforeEach(() => {
    // shouldAdvanceTime keeps setTimeout/act()/userEvent's internal timers
    // ticking in real time (just offset to this frozen epoch), so
    // interactions don't hang the way they would under plain fake timers.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2099-06-01T04:00:00.000Z")); // ~09:30 IST
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <AppointmentBookingModal
        doctorDetails={buildDetails([])}
        isOpen={false}
        onClose={() => {}}
        onSuccess={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the 'no open schedule' state when the doctor has no upcoming availability", () => {
    render(
      <AppointmentBookingModal
        doctorDetails={buildDetails([])}
        isOpen
        onClose={() => {}}
        onSuccess={() => {}}
      />,
    );
    expect(screen.getByText("No Open Schedule")).toBeInTheDocument();
  });

  it("filters out past-dated availability windows from the date picker", () => {
    render(
      <AppointmentBookingModal
        doctorDetails={buildDetails([
          { id: 1, date: "2099-05-30", startTime: "09:00", endTime: "10:00" }, // past
          { id: 2, date: "2099-06-05", startTime: "09:00", endTime: "10:00" }, // future
        ])}
        isOpen
        onClose={() => {}}
        onSuccess={() => {}}
      />,
    );
    expect(screen.getByText("1 upcoming date")).toBeInTheDocument();
  });

  it("generates 30-min suggested slots correctly from a bisected availability window (gap in the middle excluded)", async () => {
    // Mirrors the backend gap the plan flags: one raw availability window
    // with an appointment booked in the middle produces two separate free
    // segments (09:00-10:00 and 10:30-12:00), never a slot spanning the gap.
    const user = userEvent.setup({ delay: null });
    render(
      <AppointmentBookingModal
        doctorDetails={buildDetails([
          { id: 1, date: "2099-06-05", startTime: "09:00", endTime: "10:00" },
          { id: 2, date: "2099-06-05", startTime: "10:30", endTime: "12:00" },
        ])}
        isOpen
        onClose={() => {}}
        onSuccess={() => {}}
      />,
    );

    await user.click(screen.getByText(/Jun 5/));

    // Slots from the first segment.
    expect(screen.getByText("9:00 AM - 9:30 AM")).toBeInTheDocument();
    expect(screen.getByText("9:30 AM - 10:00 AM")).toBeInTheDocument();
    // No slot bridges the 10:00-10:30 gap.
    expect(screen.queryByText("10:00 AM - 10:30 AM")).not.toBeInTheDocument();
    // Slots from the second segment.
    expect(screen.getByText("10:30 AM - 11:00 AM")).toBeInTheDocument();
    expect(screen.getByText("11:00 AM - 11:30 AM")).toBeInTheDocument();
    expect(screen.getByText("11:30 AM - 12:00 PM")).toBeInTheDocument();
  });

  it("selecting a suggested slot fills the summary with that slot's time range", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <AppointmentBookingModal
        doctorDetails={buildDetails([{ id: 1, date: "2099-06-05", startTime: "09:00", endTime: "10:00" }])}
        isOpen
        onClose={() => {}}
        onSuccess={() => {}}
      />,
    );

    await user.click(screen.getByText(/Jun 5/));
    await user.click(screen.getByText("9:00 AM - 9:30 AM"));

    expect(screen.getByText("Appointment Summary")).toBeInTheDocument();
    const summarySection = screen.getByText("Appointment Summary").closest("div")!.parentElement!;
    expect(summarySection).toHaveTextContent("9:00 AM – 9:30 AM");
  });

  it("rejects a same-day slot whose start time has already passed", async () => {
    const user = userEvent.setup({ delay: null });
    // "today" in IST per the frozen system time above is 2099-06-01.
    render(
      <AppointmentBookingModal
        doctorDetails={buildDetails([{ id: 1, date: "2099-06-01", startTime: "00:00", endTime: "23:00" }])}
        isOpen
        onClose={() => {}}
        onSuccess={() => {}}
      />,
    );

    await user.click(screen.getByText(/Jun 1/));
    // Open the custom time range refinement and set a start time earlier than "now" (09:30 IST).
    await user.click(screen.getByText("Need a custom time range?"));
    const [startInput, endInput] = screen.getAllByDisplayValue(/^\d{2}:\d{2}$/);
    await user.clear(startInput);
    await user.type(startInput, "08:00");
    await user.clear(endInput);
    await user.type(endInput, "08:30");

    await user.click(screen.getByRole("button", { name: /confirm appointment request/i }));

    expect(await screen.findByText("Appointment time cannot be in the past.")).toBeInTheDocument();
  });

  it("books successfully, shows a success message, calls onSuccess, and auto-closes after a delay", async () => {
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <AppointmentBookingModal
        doctorDetails={buildDetails([{ id: 1, date: "2099-06-05", startTime: "09:00", endTime: "10:00" }])}
        isOpen
        onClose={onClose}
        onSuccess={onSuccess}
      />,
    );

    await user.click(screen.getByText(/Jun 5/));
    await user.click(screen.getByText("9:00 AM - 9:30 AM"));
    await user.click(screen.getByRole("button", { name: /confirm appointment request/i }));

    await waitFor(() => expect(screen.getByText("Appointment requested successfully!")).toBeInTheDocument());
    // onSuccess is deliberately deferred alongside onClose (not called
    // immediately) so the success message above stays visible for the same
    // 1500ms before the parent switches tabs away from this modal.
    expect(onSuccess).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("shows a server error message (e.g. DOCTOR_NOT_AVAILABLE) without closing the modal", async () => {
    server.use(
      http.post(`${BASE}/appointments`, () =>
        HttpResponse.json(
          { success: false, code: "DOCTOR_NOT_AVAILABLE", message: "The doctor is not available at this time." },
          { status: 409 },
        ),
      ),
    );

    const user = userEvent.setup({ delay: null });
    render(
      <AppointmentBookingModal
        doctorDetails={buildDetails([{ id: 1, date: "2099-06-05", startTime: "09:00", endTime: "10:00" }])}
        isOpen
        onClose={() => {}}
        onSuccess={() => {}}
      />,
    );

    await user.click(screen.getByText(/Jun 5/));
    await user.click(screen.getByText("9:00 AM - 9:30 AM"));
    await user.click(screen.getByRole("button", { name: /confirm appointment request/i }));

    expect(await screen.findByText("The doctor is not available at this time.")).toBeInTheDocument();
  });
});
