import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import { server } from "../../test/msw/server";
import { defaultSpecializations } from "../../test/msw/handlers";
import { PatientDoctorDiscovery } from "./PatientDoctorDiscovery";

const BASE = "http://localhost:3000";

const doctorsPage1 = [
  { id: 1, firstName: "Alice", lastName: "Smith", specialization: "Cardiology", experienceYears: 10 },
];

describe("PatientDoctorDiscovery", () => {
  it("shows an empty state when no doctors match", async () => {
    render(<PatientDoctorDiscovery />);
    expect(await screen.findByText("No Doctors Found")).toBeInTheDocument();
  });

  it("renders the doctor list returned by the API", async () => {
    server.use(
      http.get(`${BASE}/doctors`, () =>
        HttpResponse.json({
          success: true,
          data: { doctors: doctorsPage1, pagination: { page: 1, limit: 8, total: 1, totalPages: 1 } },
        }),
      ),
    );

    render(<PatientDoctorDiscovery />);
    expect(await screen.findByText("Dr. Alice Smith")).toBeInTheDocument();
    // "Cardiology" also appears as an <option> in the specialization filter,
    // so just confirm it renders at least once (on the doctor card) too.
    expect(screen.getAllByText("Cardiology").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("10 years experience")).toBeInTheDocument();
  });

  it("re-fetches with the search query when the user types in the search box", async () => {
    let lastSearch: string | null = null;
    server.use(
      http.get(`${BASE}/doctors`, ({ request }) => {
        const url = new URL(request.url);
        lastSearch = url.searchParams.get("search");
        return HttpResponse.json({
          success: true,
          data: { doctors: [], pagination: { page: 1, limit: 8, total: 0, totalPages: 1 } },
        });
      }),
    );

    const user = userEvent.setup();
    render(<PatientDoctorDiscovery />);
    await screen.findByText("No Doctors Found");

    await user.type(screen.getByPlaceholderText("Search doctors by name..."), "ali");

    await waitFor(() => expect(lastSearch).toBe("ali"));
    expect(screen.getByText('Name: "ali"')).toBeInTheDocument();
  });

  it("loads specializations into the filter dropdown", async () => {
    render(<PatientDoctorDiscovery />);
    await waitFor(() => {
      const select = screen.getAllByRole("combobox")[0];
      expect(select).toHaveTextContent(defaultSpecializations[0].name);
    });
  });

  it("opens the booking modal after fetching the selected doctor's availability", async () => {
    server.use(
      http.get(`${BASE}/doctors`, () =>
        HttpResponse.json({
          success: true,
          data: { doctors: doctorsPage1, pagination: { page: 1, limit: 8, total: 1, totalPages: 1 } },
        }),
      ),
      http.get(`${BASE}/doctors/:doctorId/availability`, () =>
        HttpResponse.json({
          success: true,
          data: {
            doctor: { id: 1, firstName: "Alice", lastName: "Smith", specialization: "Cardiology", experienceYears: 10 },
            availability: [],
          },
        }),
      ),
    );

    const user = userEvent.setup();
    render(<PatientDoctorDiscovery />);
    await screen.findByText("Dr. Alice Smith");

    await user.click(screen.getByRole("button", { name: /book appointment/i }));

    expect(await screen.findByText("Book Consultation")).toBeInTheDocument();
  });

  it("shows an error alert when fetching doctor availability for booking fails", async () => {
    server.use(
      http.get(`${BASE}/doctors`, () =>
        HttpResponse.json({
          success: true,
          data: { doctors: doctorsPage1, pagination: { page: 1, limit: 8, total: 1, totalPages: 1 } },
        }),
      ),
      http.get(`${BASE}/doctors/:doctorId/availability`, () =>
        HttpResponse.json({ success: false, message: "Doctor not found." }, { status: 404 }),
      ),
    );

    const user = userEvent.setup();
    render(<PatientDoctorDiscovery />);
    await screen.findByText("Dr. Alice Smith");

    await user.click(screen.getByRole("button", { name: /book appointment/i }));

    expect(await screen.findByText("Doctor not found.")).toBeInTheDocument();
  });

  it("calls onAppointmentBooked when a booking succeeds via the modal", async () => {
    server.use(
      http.get(`${BASE}/doctors`, () =>
        HttpResponse.json({
          success: true,
          data: { doctors: doctorsPage1, pagination: { page: 1, limit: 8, total: 1, totalPages: 1 } },
        }),
      ),
      http.get(`${BASE}/doctors/:doctorId/availability`, () =>
        HttpResponse.json({
          success: true,
          data: {
            doctor: { id: 1, firstName: "Alice", lastName: "Smith", specialization: "Cardiology", experienceYears: 10 },
            availability: [{ id: 1, date: "2099-01-01", startTime: "09:00", endTime: "10:00" }],
          },
        }),
      ),
    );

    const onAppointmentBooked = vi.fn();
    const user = userEvent.setup();
    render(<PatientDoctorDiscovery onAppointmentBooked={onAppointmentBooked} />);
    await screen.findByText("Dr. Alice Smith");

    await user.click(screen.getByRole("button", { name: /book appointment/i }));
    await screen.findByText("Book Consultation");

    await user.click(screen.getByText(/Jan 1/));
    await user.click(screen.getByText("9:00 AM - 9:30 AM"));
    await user.click(screen.getByRole("button", { name: /confirm appointment request/i }));

    // onSuccess/onAppointmentBooked is deliberately deferred ~1500ms after
    // booking (alongside the modal's own auto-close), so the success message
    // stays visible before the parent switches tabs away.
    await waitFor(() => expect(onAppointmentBooked).toHaveBeenCalledTimes(1), { timeout: 2000 });
  });
});
