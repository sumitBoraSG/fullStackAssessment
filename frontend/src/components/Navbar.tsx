import React from "react";
import {
  Activity,
  LogOut,
  ShieldCheck,
  Stethoscope,
  UserCircle,
  Shield,
  LayoutDashboard,
  UserCog,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "../context/RouterContext";
import { Badge, type BadgeColor } from "./ui/Badge";

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const { path, navigate } = useRouter();

  const getRoleBadgeColor = (role?: string): BadgeColor => {
    switch (role) {
      case "ADMIN":
        return "amber";
      case "DOCTOR":
        return "teal";
      case "PATIENT":
      default:
        return "orange";
    }
  };

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case "ADMIN":
        return ShieldCheck;
      case "DOCTOR":
        return Stethoscope;
      case "PATIENT":
      default:
        return UserCircle;
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
    <header className="sticky top-0 z-40 w-full border-b border-[#D8D0BF] bg-[#F0EEE6]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div
          onClick={handleBrandClick}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-8 h-8 rounded-lg bg-[#141413] text-[#F0EEE6] flex items-center justify-center transition-opacity group-hover:opacity-85 shadow-xs">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base tracking-tight text-[#141413]">
                DocPulse
              </span>
              <span className="text-[10px] font-medium tracking-wider uppercase px-1.5 py-0.5 rounded bg-[#E3DBCC] text-[#141413]/80 border border-[#D8D0BF]">
                Portal
              </span>
            </div>
            <p className="text-[11px] text-[#141413]/50 hidden sm:block">Doctor Appointment Platform</p>
          </div>
        </div>

        {/* Center Navigation Shortcuts for Admin */}
        {isAuthenticated && user?.role === "ADMIN" && (
          <div className="hidden md:flex items-center gap-1 bg-[#E3DBCC]/60 p-1 rounded-lg border border-[#D8D0BF]">
            <button
              onClick={() => navigate("/admin/invitations")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                path.startsWith("/admin")
                  ? "bg-[#141413] text-[#F0EEE6] shadow-xs"
                  : "text-[#141413]/70 hover:text-[#141413] hover:bg-[#E3DBCC]"
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Panel</span>
            </button>

            <button
              onClick={() => navigate("/dashboard")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                path === "/dashboard"
                  ? "bg-[#141413] text-[#F0EEE6] shadow-xs"
                  : "text-[#141413]/70 hover:text-[#141413] hover:bg-[#E3DBCC]"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>User Dashboard</span>
            </button>
          </div>
        )}

        {/* User Info / Actions */}
        {isAuthenticated && user && (
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#E3DBCC]/70 border border-[#D8D0BF]">
              <div className="w-6 h-6 rounded-md bg-[#141413] text-[#F0EEE6] flex items-center justify-center text-[10px] font-semibold">
                {user.firstName ? user.firstName[0]?.toUpperCase() : user.email[0]?.toUpperCase()}
              </div>

              <div className="text-left hidden md:block">
                <div className="text-xs font-medium text-[#141413] truncate max-w-[140px]">
                  {user.firstName ? `${user.firstName} ${user.lastName || ""}` : user.email}
                </div>
              </div>

              <Badge color={getRoleBadgeColor(user.role)} icon={getRoleIcon(user.role)} size="xs">
                {user.role}
              </Badge>
            </div>

            <button
              onClick={() => navigate("/profile")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                path === "/profile"
                  ? "bg-[#141413] text-[#F0EEE6] border-[#141413]"
                  : "bg-[#E3DBCC] hover:bg-[#D9D1C1] text-[#141413] border-[#D8D0BF]"
              }`}
              title="View your profile"
            >
              <UserCog className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Profile</span>
            </button>

            <button
              onClick={() => logout()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E3DBCC] hover:bg-[#EEDCDA] text-[#141413] hover:text-[#8E2A22] border border-[#D8D0BF] hover:border-[#DEC0BD] text-xs font-medium transition-all disabled:opacity-50 cursor-pointer"
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
