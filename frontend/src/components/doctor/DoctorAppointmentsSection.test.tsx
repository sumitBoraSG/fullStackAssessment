import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "../../context/AuthContext";
import { server } from "../../test/msw/server";
import { Toast } from "../Toast";
import { DoctorAppointmentsSection } from "./DoctorAppointmentsSection";
import type { DoctorAppointment } from "../../types/appointment";

const BASE = "http://localhost:3000";

function renderSection() {
  return render(
    <AuthProvider>
      <DoctorAppointmentsSection />
      <Toast />
    </AuthProvider>,
  );
}

function makeAppointment(overrides: Partial<DoctorAppointment>): DoctorAppointment {
  return {
    id: 1,
    status: "PENDING",
    date: "2099-06-05",
    startTime: "09:00",
    endTime: "09:30",
    createdAt: "2099-06-01T00:00:00.000Z",
    updatedAt: "2099-06-01T00:00:00.000Z",
    patient: { patientId: 5, firstName: "Pat", lastName: "Ient", email: "patient@test.com" },
    ...overrides,
  };
}

function withAppointments(appointments: DoctorAppointment[]) {
  server.use(
    http.get(`${BASE}/doctor/appointments`, () =>
      HttpResponse.json({
        success: true,
        data: { appointments, pagination: { page: 1, limit: 8, total: appointments.length, totalPages: 1 } },
      }),
    ),
  );
}

describe("DoctorAppointmentsSection", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2099-06-05T04:30:00.000Z")); // 10:00 IST
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows an empty state when there are no appointments", async () => {
    renderSection();
    expect(await screen.findByText("No Appointments Found")).toBeInTheDocument();
  });

  it("renders a PENDING appointment with Decline and Confirm actions available before its time passes", async () => {
    withAppointments([makeAppointment({ status: "PENDING", startTime: "12:00", endTime: "12:30" })]);
    renderSection();

    expect(await screen.findByText("Pat Ient")).toBeInTheDocument();
    const confirmButton = screen.getByRole("button", { name: /confirm/i });
    expect(confirmButton).toBeEnabled();
    expect(screen.getByRole("button", { name: /decline/i })).toBeEnabled();
  });

  it("disables Confirm for a PENDING appointment whose scheduled time has already passed", async () => {
    // "now" is frozen at 10:00 IST on 2099-06-05; this slot was 09:00-09:30.
    withAppointments([makeAppointment({ status: "PENDING", startTime: "09:00", endTime: "09:30" })]);
    renderSection();

    await screen.findByText("Pat Ient");
    const confirmButton = screen.getByRole("button", { name: /confirm/i });
    expect(confirmButton).toBeDisabled();
    expect(confirmButton).toHaveAttribute(
      "title",
      "This appointment's scheduled time has already passed and can no longer be confirmed.",
    );
  });

  it("disables Complete Visit for a CONFIRMED appointment whose time has not started yet", async () => {
    withAppointments([makeAppointment({ status: "CONFIRMED", startTime: "12:00", endTime: "12:30" })]);
    renderSection();

    await screen.findByText("Pat Ient");
    const completeButton = screen.getByRole("button", { name: /complete visit/i });
    expect(completeButton).toBeDisabled();
  });

  it("enables Complete Visit for a CONFIRMED appointment whose time has already started", async () => {
    withAppointments([makeAppointment({ status: "CONFIRMED", startTime: "09:00", endTime: "09:30" })]);
    renderSection();

    await screen.findByText("Pat Ient");
    const completeButton = screen.getByRole("button", { name: /complete visit/i });
    expect(completeButton).toBeEnabled();
  });

  it("shows 'No pending actions' for terminal-status appointments (COMPLETED/CANCELLED/REJECTED)", async () => {
    withAppointments([makeAppointment({ status: "COMPLETED" })]);
    renderSection();

    await screen.findByText("Pat Ient");
    expect(screen.getByText("No pending actions")).toBeInTheDocument();
  });

  it("confirms a PENDING appointment via the confirmation modal and shows a success toast", async () => {
    withAppointments([makeAppointment({ status: "PENDING", startTime: "12:00", endTime: "12:30" })]);
    server.use(
      http.patch(`${BASE}/doctor/appointments/:id/status`, () =>
        HttpResponse.json({ success: true, data: { id: 1, status: "CONFIRMED" } }),
      ),
    );

    const user = userEvent.setup();
    renderSection();
    await screen.findByText("Pat Ient");

    await user.click(screen.getByRole("button", { name: /^confirm$/i }));
    expect(await screen.findByText("Confirm Appointment?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /confirm status change/i }));

    expect(await screen.findByText("Appointment marked as confirmed successfully.")).toBeInTheDocument();
  });

  it("shows an error toast when a status update fails (e.g. APPOINTMENT_TIME_ALREADY_PASSED)", async () => {
    withAppointments([makeAppointment({ status: "PENDING", startTime: "12:00", endTime: "12:30" })]);
    server.use(
      http.patch(`${BASE}/doctor/appointments/:id/status`, () =>
        HttpResponse.json(
          { success: false, code: "APPOINTMENT_TIME_ALREADY_PASSED", message: "This appointment's time has already passed." },
          { status: 409 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderSection();
    await screen.findByText("Pat Ient");

    await user.click(screen.getByRole("button", { name: /^confirm$/i }));
    await user.click(screen.getByRole("button", { name: /confirm status change/i }));

    expect(await screen.findByText("This appointment's time has already passed.")).toBeInTheDocument();
  });

  it("filters by status, refetching with the selected status", async () => {
    let lastStatus: string | null = null;
    server.use(
      http.get(`${BASE}/doctor/appointments`, ({ request }) => {
        const url = new URL(request.url);
        lastStatus = url.searchParams.get("status");
        return HttpResponse.json({
          success: true,
          data: { appointments: [], pagination: { page: 1, limit: 8, total: 0, totalPages: 1 } },
        });
      }),
    );

    const user = userEvent.setup();
    renderSection();
    await screen.findByText("No Appointments Found");

    const statusSelect = screen.getAllByRole("combobox")[0];
    await user.selectOptions(statusSelect, "CONFIRMED");

    await waitFor(() => expect(lastStatus).toBe("CONFIRMED"));
    expect(screen.getByText("Reset all filters")).toBeInTheDocument();
  });
});
