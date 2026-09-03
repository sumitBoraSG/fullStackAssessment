import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { AuthProvider } from "../context/AuthContext";
import { RouterProvider } from "../context/RouterContext";

interface RenderWithProvidersOptions extends Omit<RenderOptions, "wrapper"> {
  /** Pushed onto window.history before render, since RouterContext reads window.location directly. */
  route?: string;
}

function AllProviders({ children }: { children: ReactNode }) {
  return (
    <RouterProvider>
      <AuthProvider>{children}</AuthProvider>
    </RouterProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  { route = "/", ...options }: RenderWithProvidersOptions = {},
) {
  window.history.pushState({}, "", route);
  return render(ui, { wrapper: AllProviders, ...options });
}

export * from "@testing-library/react";
