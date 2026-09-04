import React from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { RouterProvider, useRouter } from "./context/RouterContext";
import { Navbar } from "./components/Navbar";
import { Toast } from "./components/Toast";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AcceptInvitationPage } from "./pages/AcceptInvitationPage";
import { PatientSelfRegisterPage } from "./pages/PatientSelfRegisterPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AdminLayout } from "./components/admin/AdminLayout";
import { AdminInvitationsPage } from "./pages/admin/AdminInvitationsPage";

const AppContent: React.FC = () => {
  const { isAuthenticated, user, setNotification } = useAuth();
  const { path, navigate } = useRouter();

  React.useEffect(() => {
    if (isAuthenticated && user?.role !== "ADMIN" && path.startsWith("/admin")) {
      navigate("/dashboard", { replace: true });
      setNotification({
        type: "error",
        message: "Access denied. Admin privileges are required for this section.",
      });
    }
  }, [isAuthenticated, user, path, navigate, setNotification]);

  // Signed-in users shouldn't land on sign-in-only pages (login, self-register,
  // accept-invitation) - e.g. a stale bookmark or a back-button visit would
  // otherwise show a "create your account" form right under their own name
  // and logout button. Redirect them to where they already belong instead.
  React.useEffect(() => {
    if (
      isAuthenticated &&
      (path === "/login" || path.startsWith("/register") || path.startsWith("/accept-invitation"))
    ) {
      navigate(user?.role === "ADMIN" ? "/admin" : "/dashboard", { replace: true });
    }
  }, [isAuthenticated, user, path, navigate]);

  // Public route: Accept Invitation
  if (path.startsWith("/accept-invitation")) {
    return (
      <div className="min-h-screen bg-[#F0EEE6] text-[#141413] flex flex-col font-sans">
        <Toast />
        <Navbar />
        <main className="flex-1">
          <AcceptInvitationPage />
        </main>
        <footer className="py-6 border-t border-[#D8D0BF] text-center text-xs text-[#141413]/50">
          Doctor Appointment & Healthcare Platform &copy; {new Date().getFullYear()} DocPulse
        </footer>
      </div>
    );
  }

  // Public route: patient self-registration (request a verification link)
  if (path.startsWith("/register")) {
    return (
      <div className="min-h-screen bg-[#F0EEE6] text-[#141413] flex flex-col font-sans">
        <Toast />
        <Navbar />
        <main className="flex-1">
          <PatientSelfRegisterPage />
        </main>
        <footer className="py-6 border-t border-[#D8D0BF] text-center text-xs text-[#141413]/50">
          Doctor Appointment & Healthcare Platform &copy; {new Date().getFullYear()} DocPulse
        </footer>
      </div>
    );
  }

  // Public route: marketing landing page (the unauthenticated home page)
  if (!isAuthenticated && path === "/") {
    return (
      <div className="min-h-screen bg-[#F0EEE6] text-[#141413] font-sans">
        <Toast />
        <LandingPage />
      </div>
    );
  }

  // If not authenticated, always show LoginPage for all other paths
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F0EEE6] text-[#141413] flex flex-col font-sans">
        <Toast />
        <Navbar />
        <main className="flex-1">
          <LoginPage />
        </main>
        <footer className="py-6 border-t border-[#D8D0BF] text-center text-xs text-[#141413]/50">
          Doctor Appointment & Healthcare Platform &copy; {new Date().getFullYear()} DocPulse
        </footer>
      </div>
    );
  }

  // Authenticated routing logic:
  // 1. If ADMIN:
  if (user?.role === "ADMIN") {
    if (path === "/dashboard") {
      return (
        <div className="min-h-screen bg-[#F0EEE6] text-[#141413] flex flex-col font-sans">
          <Toast />
          <Navbar />
          <main className="flex-1">
            <DashboardPage />
          </main>
          <footer className="py-6 border-t border-[#D8D0BF] text-center text-xs text-[#141413]/50">
            Doctor Appointment & Healthcare Platform &copy; {new Date().getFullYear()} DocPulse
          </footer>
        </div>
      );
    }

    if (path === "/profile") {
      return (
        <div className="min-h-screen bg-[#F0EEE6] text-[#141413] flex flex-col font-sans">
          <Toast />
          <Navbar />
          <main className="flex-1">
            <ProfilePage />
          </main>
          <footer className="py-6 border-t border-[#D8D0BF] text-center text-xs text-[#141413]/50">
            Doctor Appointment & Healthcare Platform &copy; {new Date().getFullYear()} DocPulse
          </footer>
        </div>
      );
    }

    // Default landing page for admin is Invitations within AdminLayout
    return (
      <div className="min-h-screen bg-[#F0EEE6] text-[#141413] font-sans">
        <Toast />
        <AdminLayout>
          <AdminInvitationsPage />
        </AdminLayout>
      </div>
    );
  }

  if (path === "/profile") {
    return (
      <div className="min-h-screen bg-[#F0EEE6] text-[#141413] flex flex-col font-sans">
        <Toast />
        <Navbar />
        <main className="flex-1">
          <ProfilePage />
        </main>
        <footer className="py-6 border-t border-[#D8D0BF] text-center text-xs text-[#141413]/50">
          Doctor Appointment & Healthcare Platform &copy; {new Date().getFullYear()} DocPulse
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0EEE6] text-[#141413] flex flex-col font-sans">
      <Toast />
      <Navbar />
      <main className="flex-1">
        <DashboardPage />
      </main>
      <footer className="py-6 border-t border-[#D8D0BF] text-center text-xs text-[#141413]/50">
        Doctor Appointment & Healthcare Platform &copy; {new Date().getFullYear()} DocPulse
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </RouterProvider>
  );
}
