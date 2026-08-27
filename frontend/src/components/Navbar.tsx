import React from "react";
import { Activity, LogOut, ShieldCheck, Stethoscope, UserCircle, Shield, LayoutDashboard } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "../context/RouterContext";

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const { path, navigate } = useRouter();

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-amber-50 text-amber-900 border-amber-200/90";
      case "DOCTOR":
        return "bg-teal-50 text-teal-800 border-teal-200/90";
      case "PATIENT":
      default:
        return "bg-orange-50 text-orange-800 border-orange-200/90";
    }
  };

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case "ADMIN":
        return <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />;
      case "DOCTOR":
        return <Stethoscope className="w-3.5 h-3.5 text-teal-600" />;
      case "PATIENT":
      default:
        return <UserCircle className="w-3.5 h-3.5 text-orange-600" />;
    }
  };

  const handleBrandClick = () => {
    if (!isAuthenticated) {
      navigate("/login");
    } else if (user?.role === "ADMIN") {
      navigate("/admin");
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-stone-200/80 bg-white/85 backdrop-blur-xl shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div
          onClick={handleBrandClick}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 p-0.5 shadow-md shadow-amber-500/15 flex items-center justify-center group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
              <Activity className="w-5 h-5 text-amber-600 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-stone-900">
                DocPulse
              </span>
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80">
                Portal
              </span>
            </div>
            <p className="text-xs text-stone-500 hidden sm:block">Doctor Appointment & Healthcare Platform</p>
          </div>
        </div>

        {/* Center / Navigation Shortcuts for Admin */}
        {isAuthenticated && user?.role === "ADMIN" && (
          <div className="hidden md:flex items-center gap-1.5 bg-stone-100/90 p-1 rounded-xl border border-stone-200/80 shadow-2xs">
            <button
              onClick={() => navigate("/admin/invitations")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                path.startsWith("/admin")
                  ? "bg-white text-amber-900 border border-amber-200/80 shadow-2xs"
                  : "text-stone-600 hover:text-stone-900 hover:bg-white/60"
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-amber-600" />
              <span>Admin Panel</span>
            </button>

            <button
              onClick={() => navigate("/dashboard")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                path === "/dashboard"
                  ? "bg-white text-stone-900 border border-stone-200 shadow-2xs"
                  : "text-stone-600 hover:text-stone-900 hover:bg-white/60"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-stone-600" />
              <span>User Dashboard</span>
            </button>
          </div>
        )}

        {/* User Info / Actions */}
        {isAuthenticated && user && (
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/90 border border-stone-200/80 shadow-2xs">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-xs font-bold text-white shadow-2xs">
                {user.firstName ? user.firstName[0]?.toUpperCase() : user.email[0]?.toUpperCase()}
              </div>

              <div className="text-left hidden md:block">
                <div className="text-xs font-semibold text-stone-800 truncate max-w-[150px]">
                  {user.firstName ? `${user.firstName} ${user.lastName || ""}` : user.email}
                </div>
                <div className="text-[11px] text-stone-500 truncate max-w-[150px]">
                  {user.email}
                </div>
              </div>

              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getRoleBadgeColor(
                  user.role
                )}`}
              >
                {getRoleIcon(user.role)}
                {user.role}
              </span>
            </div>

            <button
              onClick={() => logout()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-stone-600 hover:text-rose-700 border border-stone-200/80 hover:border-rose-200 text-xs font-semibold shadow-2xs transition-all duration-200 active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Logout from portal"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

