import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { RouterProvider, useRouter } from "./RouterContext";

function LocationProbe() {
  const { path, search, getParam, navigate } = useRouter();
  return (
    <div>
      <span data-testid="path">{path}</span>
      <span data-testid="search">{search}</span>
      <span data-testid="param-foo">{getParam("foo") ?? "null"}</span>
      <button onClick={() => navigate("/dashboard")}>push-dashboard</button>
      <button onClick={() => navigate("/profile", { replace: true })}>replace-profile</button>
    </div>
  );
}

function renderRouter(route: string) {
  window.history.pushState({}, "", route);
  return render(
    <RouterProvider>
      <LocationProbe />
    </RouterProvider>,
  );
}

describe("RouterContext", () => {
  it("reads the initial path, search and query param from window.location", () => {
    renderRouter("/dashboard?foo=bar");

    expect(screen.getByTestId("path")).toHaveTextContent("/dashboard");
    expect(screen.getByTestId("search")).toHaveTextContent("?foo=bar");
    expect(screen.getByTestId("param-foo")).toHaveTextContent("bar");
  });

  it("getParam returns null for a missing query param", () => {
    renderRouter("/dashboard");
    expect(screen.getByTestId("param-foo")).toHaveTextContent("null");
  });

  it("navigate() pushes a new history entry and re-renders with the new path", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    renderRouter("/login");

    await user.click(screen.getByRole("button", { name: "push-dashboard" }));

    expect(screen.getByTestId("path")).toHaveTextContent("/dashboard");
    expect(window.location.pathname).toBe("/dashboard");
  });

  it("navigate({replace: true}) replaces the current history entry instead of pushing", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    renderRouter("/login");
    const initialLength = window.history.length;

    await user.click(screen.getByRole("button", { name: "replace-profile" }));

    expect(screen.getByTestId("path")).toHaveTextContent("/profile");
    // replaceState must not grow history length the way pushState would.
    expect(window.history.length).toBe(initialLength);
  });

  it("navigate() calls window.scrollTo (stubbed in setupTests since jsdom lacks it)", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const scrollToSpy = vi.spyOn(window, "scrollTo");
    renderRouter("/login");

    await user.click(screen.getByRole("button", { name: "push-dashboard" }));

    expect(scrollToSpy).toHaveBeenCalled();
    scrollToSpy.mockRestore();
  });

  it("responds to a popstate event (e.g. browser back button) by re-reading window.location", () => {
    renderRouter("/dashboard");

    act(() => {
      window.history.pushState({}, "", "/profile");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(screen.getByTestId("path")).toHaveTextContent("/profile");
  });
});
