import React from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { RouterProvider, useRouter } from "./context/RouterContext";
import { Navbar } from "./components/Navbar";
import { Toast } from "./components/Toast";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AcceptInvitationPage } from "./pages/AcceptInvitationPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AdminLayout } from "./components/admin/AdminLayout";
import { AdminInvitationsPage } from "./pages/admin/AdminInvitationsPage";

const AppContent: React.FC = () => {
  const { isAuthenticated, user, setNotification } = useAuth();
  const { path, navigate } = useRouter();

  // Non-admin users hitting /admin* get redirected to /dashboard with a
  // toast. This must run as an effect, not directly in the render body:
  // calling navigate()/setNotification() during render triggers a setState
  // on RouterProvider/AuthProvider while AppContent itself is still
  // rendering, which React flags with "Cannot update a component while
  // rendering a different component" (see React's rules of render purity).
  React.useEffect(() => {
    if (isAuthenticated && user?.role !== "ADMIN" && path.startsWith("/admin")) {
      navigate("/dashboard", { replace: true });
      setNotification({
        type: "error",
        message: "Access denied. Admin privileges are required for this section.",
      });
    }
  }, [isAuthenticated, user, path, navigate, setNotification]);

  // Public route: Accept Invitation
  if (path.startsWith("/accept-invitation")) {
    return (
      <div className="min-h-screen bg-[#faf8f5] text-stone-900 flex flex-col font-sans">
        <Toast />
        <Navbar />
        <main className="flex-1">
          <AcceptInvitationPage />
        </main>
        <footer className="py-6 border-t border-stone-200/80 text-center text-xs text-stone-500 bg-white/40">
          Doctor Appointment & Healthcare Platform &copy; {new Date().getFullYear()} DocPulse
        </footer>
      </div>
    );
  }

  // If not authenticated, always show LoginPage for all other paths
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#faf8f5] text-stone-900 flex flex-col font-sans">
        <Toast />
        <Navbar />
        <main className="flex-1">
          <LoginPage />
        </main>
        <footer className="py-6 border-t border-stone-200/80 text-center text-xs text-stone-500 bg-white/40">
          Doctor Appointment & Healthcare Platform &copy; {new Date().getFullYear()} DocPulse
        </footer>
      </div>
    );
  }

  // Authenticated routing logic:
  // 1. If ADMIN:
  if (user?.role === "ADMIN") {
    if (path === "/dashboard") {
      // Allow admin to also view regular user session view
      return (
        <div className="min-h-screen bg-[#faf8f5] text-stone-900 flex flex-col font-sans">
          <Toast />
          <Navbar />
          <main className="flex-1">
            <DashboardPage />
          </main>
          <footer className="py-6 border-t border-stone-200/80 text-center text-xs text-stone-500 bg-white/40">
            Doctor Appointment & Healthcare Platform &copy; {new Date().getFullYear()} DocPulse
          </footer>
        </div>
      );
    }

    if (path === "/profile") {
      return (
        <div className="min-h-screen bg-[#faf8f5] text-stone-900 flex flex-col font-sans">
          <Toast />
          <Navbar />
          <main className="flex-1">
            <ProfilePage />
          </main>
          <footer className="py-6 border-t border-stone-200/80 text-center text-xs text-stone-500 bg-white/40">
            Doctor Appointment & Healthcare Platform &copy; {new Date().getFullYear()} DocPulse
          </footer>
        </div>
      );
    }

    // Default landing page for admin is Invitations within AdminLayout
    return (
      <div className="min-h-screen bg-[#faf8f5] text-stone-900 font-sans">
        <Toast />
        <AdminLayout>
          <AdminInvitationsPage />
        </AdminLayout>
      </div>
    );
  }

  if (path === "/profile") {
    return (
      <div className="min-h-screen bg-[#faf8f5] text-stone-900 flex flex-col font-sans">
        <Toast />
        <Navbar />
        <main className="flex-1">
          <ProfilePage />
        </main>
        <footer className="py-6 border-t border-stone-200/80 text-center text-xs text-stone-500 bg-white/40">
          Doctor Appointment & Healthcare Platform &copy; {new Date().getFullYear()} DocPulse
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-900 flex flex-col font-sans">
      <Toast />
      <Navbar />
      <main className="flex-1">
        <DashboardPage />
      </main>
      <footer className="py-6 border-t border-stone-200/80 text-center text-xs text-stone-500 bg-white/40">
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

