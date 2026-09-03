import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "../../context/AuthContext";
import { server } from "../../test/msw/server";
import { Toast } from "../Toast";
import { PatientAppointmentsList } from "./PatientAppointmentsList";
import type { PatientAppointment } from "../../types/appointment";

const BASE = "http://localhost:3000";

function renderList(props: ComponentProps<typeof PatientAppointmentsList> = {}) {
  return render(
    <AuthProvider>
      <PatientAppointmentsList {...props} />
      <Toast />
    </AuthProvider>,
  );
}

function makeAppointment(overrides: Partial<PatientAppointment>): PatientAppointment {
  return {
    id: 1,
    status: "PENDING",
    date: "2099-06-05",
    startTime: "09:00",
    endTime: "09:30",
    createdAt: "2099-06-01T00:00:00.000Z",
    updatedAt: "2099-06-01T00:00:00.000Z",
    doctor: { doctorId: 2, firstName: "Doc", lastName: "Tor", specialization: "General Practitioner", experienceYears: 5 },
    ...overrides,
  };
}

function withAppointments(appointments: PatientAppointment[]) {
  server.use(
    http.get(`${BASE}/appointments`, () =>
      HttpResponse.json({
        success: true,
        data: { appointments, pagination: { page: 1, limit: 8, total: appointments.length, totalPages: 1 } },
      }),
    ),
  );
}

describe("PatientAppointmentsList", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2099-06-05T04:30:00.000Z")); // 10:00 IST
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows an empty state with a booking CTA when there are no appointments and onNavigateToBooking is provided", async () => {
    const onNavigateToBooking = vi.fn();
    const user = userEvent.setup();
    renderList({ onNavigateToBooking });

    expect(await screen.findByText("No Appointments Found")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /find & book doctors/i }));
    expect(onNavigateToBooking).toHaveBeenCalledTimes(1);
  });

  it("shows the Cancel Appointment action for a future PENDING appointment", async () => {
    withAppointments([makeAppointment({ status: "PENDING", startTime: "12:00", endTime: "12:30" })]);
    renderList();

    expect(await screen.findByText("Dr. Doc Tor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel appointment/i })).toBeInTheDocument();
  });

  it("hides the Cancel Appointment action once the appointment's start time has passed", async () => {
    // "now" is frozen at 10:00 IST; this appointment started at 09:00.
    withAppointments([makeAppointment({ status: "PENDING", startTime: "09:00", endTime: "09:30" })]);
    renderList();

    await screen.findByText("Dr. Doc Tor");
    expect(screen.queryByRole("button", { name: /cancel appointment/i })).not.toBeInTheDocument();
  });

  it("hides the Cancel Appointment action for a COMPLETED appointment even if in the future", async () => {
    withAppointments([makeAppointment({ status: "COMPLETED", startTime: "12:00", endTime: "12:30" })]);
    renderList();

    await screen.findByText("Dr. Doc Tor");
    expect(screen.queryByRole("button", { name: /cancel appointment/i })).not.toBeInTheDocument();
  });

  it("cancels a future appointment via the confirmation modal and shows a success toast", async () => {
    withAppointments([makeAppointment({ status: "PENDING", startTime: "12:00", endTime: "12:30" })]);
    server.use(
      http.patch(`${BASE}/appointments/:id/status`, () =>
        HttpResponse.json({ success: true, data: { id: 1, status: "CANCELLED" } }),
      ),
    );

    const user = userEvent.setup();
    renderList();
    await screen.findByText("Dr. Doc Tor");

    await user.click(screen.getByRole("button", { name: /cancel appointment/i }));
    expect(await screen.findByText("Cancel Appointment?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /yes, cancel/i }));

    expect(await screen.findByText("Appointment cancelled successfully.")).toBeInTheDocument();
  });

  it("keeps the appointment and shows an error toast when cancellation fails", async () => {
    withAppointments([makeAppointment({ status: "PENDING", startTime: "12:00", endTime: "12:30" })]);
    server.use(
      http.patch(`${BASE}/appointments/:id/status`, () =>
        HttpResponse.json(
          { success: false, code: "INVALID_STATUS_TRANSITION", message: "This appointment cannot be cancelled." },
          { status: 409 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderList();
    await screen.findByText("Dr. Doc Tor");

    await user.click(screen.getByRole("button", { name: /cancel appointment/i }));
    await user.click(screen.getByRole("button", { name: /yes, cancel/i }));

    expect(await screen.findByText("This appointment cannot be cancelled.")).toBeInTheDocument();
  });

  it("keeping the appointment via 'Keep Appointment' closes the modal without cancelling", async () => {
    withAppointments([makeAppointment({ status: "PENDING", startTime: "12:00", endTime: "12:30" })]);
    const user = userEvent.setup();
    renderList();
    await screen.findByText("Dr. Doc Tor");

    await user.click(screen.getByRole("button", { name: /cancel appointment/i }));
    await screen.findByText("Cancel Appointment?");
    await user.click(screen.getByRole("button", { name: /keep appointment/i }));

    await waitFor(() => expect(screen.queryByText("Cancel Appointment?")).not.toBeInTheDocument());
  });

  it("applies a status filter and re-fetches accordingly", async () => {
    let lastStatus: string | null = null;
    server.use(
      http.get(`${BASE}/appointments`, ({ request }) => {
        const url = new URL(request.url);
        lastStatus = url.searchParams.get("status");
        return HttpResponse.json({
          success: true,
          data: { appointments: [], pagination: { page: 1, limit: 8, total: 0, totalPages: 1 } },
        });
      }),
    );

    const user = userEvent.setup();
    renderList();
    await screen.findByText("No Appointments Found");

    const statusSelect = screen.getAllByRole("combobox")[0];
    await user.selectOptions(statusSelect, "CANCELLED");

    await waitFor(() => expect(lastStatus).toBe("CANCELLED"));
  });
});
