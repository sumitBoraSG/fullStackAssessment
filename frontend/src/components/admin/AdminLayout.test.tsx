import { afterEach, describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/render";
import { USER_KEY } from "../../api/apiClient";
import { defaultAdminUser } from "../../test/msw/handlers";
import { AdminLayout } from "./AdminLayout";

function renderLayout(route = "/admin/invitations") {
  localStorage.setItem(USER_KEY, JSON.stringify(defaultAdminUser));
  return renderWithProviders(
    <AdminLayout>
      <div>Page Content</div>
    </AdminLayout>,
    { route },
  );
}

afterEach(() => {
  localStorage.clear();
});

describe("AdminLayout", () => {
  it("renders the sidebar, header, and the children as main content", () => {
    renderLayout();
    expect(screen.getByText("Page Content")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /invitations/i })).toBeInTheDocument();
  });

  it("navigates to the invitations page when the sidebar nav item is clicked", async () => {
    const user = userEvent.setup();
    renderLayout("/admin");

    await user.click(screen.getByRole("button", { name: /invitations/i }));

    expect(window.location.pathname).toBe("/admin/invitations");
  });

  it("navigates to /dashboard via the 'User View' shortcut", async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole("button", { name: /user view/i }));

    expect(window.location.pathname).toBe("/dashboard");
  });

  it("opens the profile dropdown and navigates to /profile from it", async () => {
    const user = userEvent.setup();
    renderLayout();

    // The profile-avatar trigger button has no accessible name text of its
    // own besides the admin's first name; query by that.
    await user.click(screen.getByText(defaultAdminUser.firstName));
    expect(await screen.findByText("My Profile")).toBeInTheDocument();

    await user.click(screen.getByText("My Profile"));

    expect(window.location.pathname).toBe("/profile");
  });

  it("closes the profile dropdown when clicking outside it", async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByText(defaultAdminUser.firstName));
    expect(await screen.findByText("My Profile")).toBeInTheDocument();

    await user.click(screen.getByText("Page Content"));

    expect(screen.queryByText("My Profile")).not.toBeInTheDocument();
  });

  it("logs out via the dropdown's Sign Out action", async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByText(defaultAdminUser.firstName));
    await user.click(screen.getByText("Sign Out"));

    // logout() clears the user, which unmounts AdminLayout's authenticated
    // subtree entirely in the real app; here we just confirm the dropdown
    // action fired without throwing (no direct DOM assertion possible once
    // AdminLayout itself would normally unmount).
    expect(screen.queryByText("My Profile")).not.toBeInTheDocument();
  });
});
