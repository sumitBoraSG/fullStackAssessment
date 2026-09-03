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

  // Future-ready navigation configuration
  const navItems: NavItemConfig[] = [
    {
      id: "invitations",
      label: "Invitations",
      path: "/admin/invitations",
      icon: Mail,
      description: "Manage registration access",
    },
  ];

  // Determine active item (default /admin to /admin/invitations)
  const isInvitationsActive =
    path === "/admin" || path === "/admin/invitations" || path.startsWith("/admin/invitations");

  // Close dropdown when clicking outside
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
    <div className="min-h-screen flex bg-[#faf8f5] text-stone-900 font-sans">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-stone-900/30 backdrop-blur-xs transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Persistent Left Sidebar (Desktop & Mobile Drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-stone-200/90 flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar Header / Brand */}
        <div>
          <div className="h-16 px-5 border-b border-stone-100 flex items-center justify-between">
            <div
              onClick={() => navigate("/admin/invitations")}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 p-0.5 shadow-md shadow-amber-500/15 flex items-center justify-center group-hover:scale-105 transition-transform">
                <div className="w-full h-full bg-white rounded-[9px] flex items-center justify-center">
                  <Activity className="w-4 h-4 text-amber-600" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-stone-900">
                    DocPulse
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                    Admin
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 m-0">Management Portal</p>
              </div>
            </div>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Section */}
          <div className="p-3 space-y-1">
            <div className="px-3 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">
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
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-amber-50/90 text-amber-950 border border-amber-200/80 shadow-2xs"
                      : "text-stone-600 hover:text-stone-900 hover:bg-stone-50 border border-transparent"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? "text-amber-600" : "text-stone-400"
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
        <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur-md border-b border-stone-200/90 px-4 sm:px-8 flex items-center justify-between shadow-2xs">
          {/* Mobile Menu Toggle & Breadcrumbs */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
              aria-label="Open sidebar menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-stone-400">Admin</span>
              <span className="text-stone-300">/</span>
              <span className="font-bold text-stone-900">Invitations</span>
            </div>
          </div>

          {/* Header Right Actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Shortcut to User Dashboard */}
            <button
              onClick={() => navigate("/dashboard")}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-600 hover:text-stone-900 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Switch to User View"
            >
              <span>User View</span>
              <ExternalLink className="w-3 h-3 text-stone-400" />
            </button>

            {/* Profile Menu Dropdown */}
            <div className="relative" ref={profileDropdownRef}>
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-white hover:bg-stone-50 border border-stone-200/90 shadow-2xs transition-colors cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 text-white font-bold text-xs flex items-center justify-center">
                  {user?.firstName ? user.firstName[0]?.toUpperCase() : user?.email?.[0]?.toUpperCase() || "A"}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="block text-xs font-bold text-stone-900 leading-tight">
                    {user?.firstName || "Admin"}
                  </span>
                  <span className="block text-[10px] text-amber-700 font-semibold leading-tight">
                    Root Admin
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400 hidden sm:block" />
              </button>

              {/* Profile Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-stone-200 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-2.5 border-b border-stone-100">
                    <p className="text-xs font-bold text-stone-900 truncate m-0">
                      {user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "Administrator"}
                    </p>
                    <p className="text-[11px] text-stone-500 truncate m-0">
                      {user?.email}
                    </p>
                    <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-800">
                      <Shield className="w-3 h-3 text-amber-600" />
                      <span>Administrator</span>
                    </div>
                  </div>

                  <div className="p-1">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        navigate("/profile");
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-50 hover:text-stone-900 transition-colors cursor-pointer"
                    >
                      <span>My Profile</span>
                      <UserCog className="w-3.5 h-3.5 text-stone-400" />
                    </button>

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
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
