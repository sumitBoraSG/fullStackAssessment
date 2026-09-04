import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { fireEvent, render, screen } from "@testing-library/react";
import { server } from "../../test/msw/server";
import { BulkInviteModal } from "./BulkInviteModal";

const BASE = "http://localhost:3000";

function getFileInput(): HTMLInputElement {
  // The <input type="file"> is visually hidden (className="hidden") and has
  // no accessible label, so there's no role/label-based query available.
  return document.querySelector("#bulk-csv-upload-input") as HTMLInputElement;
}

function makeCsvFile(name = "invites.csv", content = "email,role\na@test.com,DOCTOR") {
  return new File([content], name, { type: "text/csv" });
}

describe("BulkInviteModal", () => {
  it("renders nothing when isOpen is false", () => {
    const { container } = render(<BulkInviteModal isOpen={false} onClose={() => {}} onSuccess={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the upload dropzone and CSV format guidance when open", () => {
    render(<BulkInviteModal isOpen onClose={() => {}} onSuccess={() => {}} />);
    expect(screen.getByText("Bulk Invitations")).toBeInTheDocument();
    expect(screen.getByText("Click to browse or drag and drop your CSV file")).toBeInTheDocument();
  });

  it("rejects a non-CSV file with a validation error", async () => {
    render(<BulkInviteModal isOpen onClose={() => {}} onSuccess={() => {}} />);

    const badFile = new File(["not a csv"], "invites.txt", { type: "text/plain" });
    // userEvent.upload() emulates the browser's native accept-attribute
    // filtering (a .txt file would never reach the input via the file
    // picker), but the app's own validation exists specifically for the
    // drag-and-drop path, which bypasses that filtering. Use fireEvent to
    // exercise that validation branch directly.
    fireEvent.change(getFileInput(), { target: { files: [badFile] } });

    expect(await screen.findByText("Please select a valid .csv file.")).toBeInTheDocument();
  });

  it("rejects a CSV file larger than 5MB", async () => {
    const user = userEvent.setup();
    render(<BulkInviteModal isOpen onClose={() => {}} onSuccess={() => {}} />);

    const bigFile = makeCsvFile("big.csv", "x");
    Object.defineProperty(bigFile, "size", { value: 6 * 1024 * 1024 });
    await user.upload(getFileInput(), bigFile);

    expect(await screen.findByText("File size exceeds 5MB limit. Please upload a smaller file.")).toBeInTheDocument();
  });

  it("accepts a valid CSV, submits it, and shows a fully-successful results summary", async () => {
    server.use(
      http.post(`${BASE}/admin/invitations/bulk`, () =>
        HttpResponse.json({
          success: true,
          message: "Bulk invitation process completed",
          data: {
            total: 2,
            successful: 2,
            failed: 0,
            results: [
              { email: "a@test.com", role: "ADMIN", status: "INVITED" },
              { email: "b@test.com", role: "DOCTOR", status: "INVITED" },
            ],
          },
        }),
      ),
    );

    const user = userEvent.setup();
    render(<BulkInviteModal isOpen onClose={() => {}} onSuccess={() => {}} />);

    await user.upload(getFileInput(), makeCsvFile());
    expect(screen.getByText("invites.csv")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /upload & invite/i }));

    expect(await screen.findByText("All Invitations Processed Successfully")).toBeInTheDocument();
    expect(screen.getByText("2 successful of 2 total records processed.")).toBeInTheDocument();
  });

  it("shows a partial-failure summary and lets the user filter to just the failed rows", async () => {
    server.use(
      http.post(`${BASE}/admin/invitations/bulk`, () =>
        HttpResponse.json({
          success: true,
          data: {
            total: 2,
            successful: 1,
            failed: 1,
            results: [
              { email: "a@test.com", role: "DOCTOR", status: "INVITED" },
              { email: "bad@test.com", role: "DOCTOR", status: "FAILED", reason: "Duplicate invitation" },
            ],
          },
        }),
      ),
    );

    const user = userEvent.setup();
    render(<BulkInviteModal isOpen onClose={() => {}} onSuccess={() => {}} />);

    await user.upload(getFileInput(), makeCsvFile());
    await user.click(screen.getByRole("button", { name: /upload & invite/i }));

    expect(await screen.findByText("Bulk Invitation Process Completed with Partial Failures")).toBeInTheDocument();
    expect(screen.getByText("a@test.com")).toBeInTheDocument();
    expect(screen.getByText("bad@test.com")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^failed \(1\)$/i }));

    expect(screen.queryByText("a@test.com")).not.toBeInTheDocument();
    expect(screen.getByText("bad@test.com")).toBeInTheDocument();
    expect(screen.getByText("Duplicate invitation")).toBeInTheDocument();
  });

  it("renders a PATIENT row as FAILED: admins can no longer bulk-invite patients", async () => {
    server.use(
      http.post(`${BASE}/admin/invitations/bulk`, () =>
        HttpResponse.json({
          success: true,
          data: {
            total: 1,
            successful: 0,
            failed: 1,
            results: [
              {
                email: "patient-row@test.com",
                role: "PATIENT",
                status: "FAILED",
                reason: '"role" must be one of [ADMIN, DOCTOR]',
              },
            ],
          },
        }),
      ),
    );

    const user = userEvent.setup();
    render(<BulkInviteModal isOpen onClose={() => {}} onSuccess={() => {}} />);

    await user.upload(getFileInput(), makeCsvFile("invites.csv", "email,role\npatient-row@test.com,PATIENT"));
    await user.click(screen.getByRole("button", { name: /upload & invite/i }));

    expect(await screen.findByText("All Invitations Failed")).toBeInTheDocument();
    expect(screen.getByText("patient-row@test.com")).toBeInTheDocument();
    expect(screen.getByText('"role" must be one of [ADMIN, DOCTOR]')).toBeInTheDocument();
  });

  it("surfaces a server error envelope (e.g. row-limit exceeded) without showing a results view", async () => {
    server.use(
      http.post(`${BASE}/admin/invitations/bulk`, () =>
        HttpResponse.json(
          { success: false, code: "ROW_LIMIT_EXCEEDED", message: "CSV exceeds the maximum of 500 rows." },
          { status: 400 },
        ),
      ),
    );

    const user = userEvent.setup();
    render(<BulkInviteModal isOpen onClose={() => {}} onSuccess={() => {}} />);

    await user.upload(getFileInput(), makeCsvFile());
    await user.click(screen.getByRole("button", { name: /upload & invite/i }));

    expect(await screen.findByText("CSV exceeds the maximum of 500 rows.")).toBeInTheDocument();
    expect(screen.queryByText("Total Records")).not.toBeInTheDocument();
  });

  it("calls onSuccess and onClose when closing after at least one successful invite", async () => {
    server.use(
      http.post(`${BASE}/admin/invitations/bulk`, () =>
        HttpResponse.json({
          success: true,
          data: { total: 1, successful: 1, failed: 0, results: [{ email: "a@test.com", role: "DOCTOR", status: "INVITED" }] },
        }),
      ),
    );

    const onSuccess = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<BulkInviteModal isOpen onClose={onClose} onSuccess={onSuccess} />);

    await user.upload(getFileInput(), makeCsvFile());
    await user.click(screen.getByRole("button", { name: /upload & invite/i }));
    await screen.findByText("All Invitations Processed Successfully");

    await user.click(screen.getByRole("button", { name: /^done$/i }));

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onSuccess when closing after zero successful invites", async () => {
    server.use(
      http.post(`${BASE}/admin/invitations/bulk`, () =>
        HttpResponse.json({
          success: true,
          data: { total: 1, successful: 0, failed: 1, results: [{ email: "bad@test.com", role: "DOCTOR", status: "FAILED", reason: "Invalid email" }] },
        }),
      ),
    );

    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<BulkInviteModal isOpen onClose={() => {}} onSuccess={onSuccess} />);

    await user.upload(getFileInput(), makeCsvFile());
    await user.click(screen.getByRole("button", { name: /upload & invite/i }));
    await screen.findByText("All Invitations Failed");

    await user.click(screen.getByRole("button", { name: /^done$/i }));

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("'Upload Another CSV' resets back to the upload form view", async () => {
    server.use(
      http.post(`${BASE}/admin/invitations/bulk`, () =>
        HttpResponse.json({
          success: true,
          data: { total: 1, successful: 1, failed: 0, results: [{ email: "a@test.com", role: "DOCTOR", status: "INVITED" }] },
        }),
      ),
    );

    const user = userEvent.setup();
    render(<BulkInviteModal isOpen onClose={() => {}} onSuccess={() => {}} />);

    await user.upload(getFileInput(), makeCsvFile());
    await user.click(screen.getByRole("button", { name: /upload & invite/i }));
    await screen.findByText("All Invitations Processed Successfully");

    await user.click(screen.getByRole("button", { name: /upload another csv/i }));

    expect(screen.getByText("Click to browse or drag and drop your CSV file")).toBeInTheDocument();
  });
});
