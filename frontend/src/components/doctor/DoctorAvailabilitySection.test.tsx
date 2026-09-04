import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { act, render, screen, waitFor } from "@testing-library/react";
import { server } from "../../test/msw/server";
import { DoctorAvailabilitySection } from "./DoctorAvailabilitySection";

const BASE = "http://localhost:3000";

describe("DoctorAvailabilitySection", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2099-06-05T04:30:00.000Z")); // 10:00 IST
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows an empty state when no availability slots exist", async () => {
    render(<DoctorAvailabilitySection />);
    expect(await screen.findByText("No Availability Slots Set")).toBeInTheDocument();
  });

  it("renders availability slots grouped by date", async () => {
    server.use(
      http.get(`${BASE}/doctor/availability`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 1, date: "2099-06-10", startTime: "09:00", endTime: "10:00" },
            { id: 2, date: "2099-06-10", startTime: "14:00", endTime: "15:00" },
          ],
        }),
      ),
    );

    render(<DoctorAvailabilitySection />);
    expect(await screen.findByText("9:00 AM – 10:00 AM")).toBeInTheDocument();
    expect(screen.getByText("2:00 PM – 3:00 PM")).toBeInTheDocument();
  });

  it("rejects a start time that is not before the end time", async () => {
    const user = userEvent.setup();
    render(<DoctorAvailabilitySection />);
    await screen.findByText("No Availability Slots Set");

    const [startInput, endInput] = screen.getAllByDisplayValue(/^\d{2}:\d{2}$/);
    await user.clear(endInput);
    await user.type(endInput, "08:00");
    await user.clear(startInput);
    await user.type(startInput, "09:00");

    await user.click(screen.getByRole("button", { name: /add availability slot/i }));

    expect(await screen.findByText("Start time must be before end time.")).toBeInTheDocument();
  });

  it("adds a new availability slot successfully and shows a success message that auto-dismisses", async () => {
    const user = userEvent.setup();
    render(<DoctorAvailabilitySection />);
    await screen.findByText("No Availability Slots Set");

    await user.click(screen.getByRole("button", { name: /add availability slot/i }));

    expect(await screen.findByText("Availability slot added successfully!")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    await waitFor(() => expect(screen.queryByText("Availability slot added successfully!")).not.toBeInTheDocument());
  });

  it("sends exactly {date, startTime, endTime} to POST /doctor/availability for the default form values", async () => {
    let capturedBody: Record<string, unknown> | undefined;
    server.use(
      http.post(`${BASE}/doctor/availability`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          success: true,
          data: { id: 1, ...capturedBody, createdAt: new Date().toISOString() },
        });
      }),
    );

    const user = userEvent.setup();
    render(<DoctorAvailabilitySection />);
    await screen.findByText("No Availability Slots Set");

    await user.click(screen.getByRole("button", { name: /add availability slot/i }));

    await waitFor(() => expect(capturedBody).toEqual({
      date: "2099-06-05",
      startTime: "09:00",
      endTime: "12:00",
    }));
  });

  it("surfaces an AVAILABILITY_OVERLAP error from the server", async () => {
    server.use(
      http.post(`${BASE}/doctor/availability`, () =>
        HttpResponse.json(
          { success: false, code: "AVAILABILITY_OVERLAP", message: "This slot overlaps with an existing availability window." },
          { status: 409 },
        ),
      ),
    );

    const user = userEvent.setup();
    render(<DoctorAvailabilitySection />);
    await screen.findByText("No Availability Slots Set");

    await user.click(screen.getByRole("button", { name: /add availability slot/i }));

    expect(await screen.findByText("This slot overlaps with an existing availability window.")).toBeInTheDocument();
  });

  it("rejects a past date via the min-date guard reflected in validation", async () => {
    const user = userEvent.setup();
    render(<DoctorAvailabilitySection />);
    await screen.findByText("No Availability Slots Set");

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    // The input has min=today, but directly setting an out-of-range value
    // still reaches React state via fireEvent-style typing; verify the
    // component's own validation catches it as a defense-in-depth check.
    await user.clear(dateInput);
    await user.type(dateInput, "2099-06-01");

    await user.click(screen.getByRole("button", { name: /add availability slot/i }));

    expect(await screen.findByText("Availability date cannot be in the past.")).toBeInTheDocument();
  });
});
