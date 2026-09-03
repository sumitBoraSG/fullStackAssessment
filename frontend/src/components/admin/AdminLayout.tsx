import React, { useState, useRef, useEffect } from "react";
import {
  Activity,
  Mail,
  LogOut,
  Menu,
  X,
  ExternalLink,
  ChevronDown,
  Shield,
  UserCog,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "../../context/RouterContext";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export interface NavItemConfig {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const { path, navigate } = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  const navItems: NavItemConfig[] = [
    {
      id: "invitations",
      label: "Invitations",
      path: "/admin/invitations",
      icon: Mail,
      description: "Manage registration access",
    },
  ];

  const isInvitationsActive =
    path === "/admin" || path === "/admin/invitations" || path.startsWith("/admin/invitations");

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node)
      ) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNavClick = (targetPath: string) => {
    navigate(targetPath);
    setMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    setProfileDropdownOpen(false);
    await logout();
  };

  return (
    <div className="min-h-screen flex bg-[#F0EEE6] text-[#141413] font-sans">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-[#141413]/30 backdrop-blur-xs transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Persistent Left Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#F0EEE6] border-r border-[#D8D0BF] flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar Header / Brand */}
        <div>
          <div className="h-16 px-5 border-b border-[#D8D0BF] flex items-center justify-between">
            <div
              onClick={() => navigate("/admin/invitations")}
              className="flex items-center gap-3 cursor-pointer group select-none"
            >
              <div className="w-8 h-8 rounded-lg bg-[#141413] text-[#F0EEE6] flex items-center justify-center transition-opacity group-hover:opacity-85 shadow-xs">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-base tracking-tight text-[#141413]">
                    DocPulse
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.2 rounded bg-[#E3DBCC] text-[#141413] border border-[#D8D0BF]">
                    Admin
                  </span>
                </div>
                <p className="text-[11px] text-[#141413]/50 m-0">Management Portal</p>
              </div>
            </div>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-[#141413]/50 hover:text-[#141413] hover:bg-[#E3DBCC] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Section */}
          <div className="p-3 space-y-1">
            <div className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#141413]/50">
              Admin Menu
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.id === "invitations"
                  ? isInvitationsActive
                  : path === item.path;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.path)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#E3DBCC] text-[#141413] border border-[#D8D0BF] shadow-xs"
                      : "text-[#141413]/70 hover:text-[#141413] hover:bg-[#E3DBCC]/50 border border-transparent"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? "text-[#141413]" : "text-[#141413]/50"
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 h-16 bg-[#F0EEE6]/95 backdrop-blur-md border-b border-[#D8D0BF] px-4 sm:px-8 flex items-center justify-between">
          {/* Mobile Menu Toggle & Breadcrumbs */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-[#141413]/70 hover:text-[#141413] hover:bg-[#E3DBCC] cursor-pointer"
              aria-label="Open sidebar menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-[#141413]/50">Admin</span>
              <span className="text-[#D8D0BF]">/</span>
              <span className="font-semibold text-[#141413]">Invitations</span>
            </div>
          </div>

          {/* Header Right Actions */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Shortcut to User Dashboard */}
            <button
              onClick={() => navigate("/dashboard")}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E3DBCC] hover:bg-[#D9D1C1] border border-[#D8D0BF] text-[#141413] text-xs font-medium shadow-xs transition-colors cursor-pointer"
              title="Switch to User View"
            >
              <span>User View</span>
              <ExternalLink className="w-3 h-3 text-[#141413]/50" />
            </button>

            {/* Profile Menu Dropdown */}
            <div className="relative" ref={profileDropdownRef}>
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#E3DBCC] hover:bg-[#D9D1C1] border border-[#D8D0BF] shadow-xs transition-colors cursor-pointer"
              >
                <div className="w-6 h-6 rounded-md bg-[#141413] text-[#F0EEE6] font-semibold text-xs flex items-center justify-center">
                  {user?.firstName ? user.firstName[0]?.toUpperCase() : user?.email?.[0]?.toUpperCase() || "A"}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="block text-xs font-medium text-[#141413] leading-tight">
                    {user?.firstName || "Admin"}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#141413]/50 hidden sm:block" />
              </button>

              {/* Profile Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[#E3DBCC] rounded-xl border border-[#D8D0BF] shadow-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-150 text-[#141413]">
                  <div className="px-4 py-2.5 border-b border-[#D8D0BF]">
                    <p className="text-xs font-semibold text-[#141413] truncate m-0">
                      {user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "Administrator"}
                    </p>
                    <p className="text-[11px] text-[#141413]/60 truncate m-0">
                      {user?.email}
                    </p>
                    <div className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#FAF8F5] border border-[#D8D0BF] text-[10px] font-medium text-[#141413]">
                      <Shield className="w-3 h-3 text-[#141413]/70" />
                      <span>Administrator</span>
                    </div>
                  </div>

                  <div className="p-1">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        navigate("/profile");
                      }}
                      className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium text-[#141413] hover:bg-[#FAF8F5]/80 transition-colors cursor-pointer"
                    >
                      <span>My Profile</span>
                      <UserCog className="w-3.5 h-3.5 text-[#141413]/50" />
                    </button>

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-[#8E2A22] hover:bg-[#EEDCDA]/60 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
