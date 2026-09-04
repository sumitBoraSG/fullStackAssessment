import React, { useEffect, useRef, useState } from "react";
import { Activity, Menu, X } from "lucide-react";
import { useRouter } from "../../context/RouterContext";
import { Button } from "../ui/Button";
import { scrollToSection } from "../../utils/scrollToSection";

const NAV_LINKS: { label: string; id: string }[] = [
  { label: "Features", id: "features" },
  { label: "How It Works", id: "how-it-works" },
  { label: "For Doctors", id: "for-doctors" },
  { label: "For Patients", id: "for-patients" },
];

const MENU_PANEL_ID = "landing-mobile-nav";

const DesktopNavLink: React.FC<{ label: string; id: string }> = ({ label, id }) => (
  <a
    href={`#${id}`}
    onClick={(e) => {
      e.preventDefault();
      scrollToSection(id);
    }}
    className="group relative inline-flex items-center py-2 rounded-sm text-sm font-medium text-[#141413]/70 transition-colors duration-(--motion-duration-fast) ease-(--motion-ease) hover:text-[#141413] focus-visible:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141413]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F0EEE6]"
  >
    {label}
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 -bottom-0.5 h-px w-full origin-center -translate-x-1/2 scale-x-0 bg-[#141413] transition-transform duration-(--motion-duration-base) ease-(--motion-ease) group-hover:scale-x-100 group-focus-visible:scale-x-100"
    />
  </a>
);

export const LandingHeader: React.FC = () => {
  const { navigate } = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const firstMenuLinkRef = useRef<HTMLAnchorElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const closeMenu = () => setMenuOpen(false);

  const handleNavClick = (id: string) => {
    closeMenu();
    scrollToSection(id);
  };

  // Auto-close if the viewport grows into the desktop nav breakpoint (e.g. tablet rotation).
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) closeMenu();
    };
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  // Dismiss on outside click and on Escape; move focus into/out of the panel.
  useEffect(() => {
    if (!menuOpen) return;

    firstMenuLinkRef.current?.focus();

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || toggleButtonRef.current?.contains(target)) return;
      closeMenu();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu();
        toggleButtonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  // Lock background scroll while the panel is open.
  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#D8D0BF] bg-[#F0EEE6]/95 backdrop-blur-md animate-load-fade-in">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div
          onClick={() => navigate("/")}
          className="flex items-center gap-2.5 cursor-pointer group select-none shrink-0"
        >
          <div className="w-8 h-8 rounded-lg bg-[#141413] text-[#F0EEE6] flex items-center justify-center transition-opacity duration-(--motion-duration-fast) group-hover:opacity-85 shadow-xs">
            <Activity className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-base tracking-tight text-[#141413]">DocPulse</span>
            <span className="hidden sm:inline text-[10px] font-medium tracking-wider uppercase px-1.5 py-0.5 rounded bg-[#E3DBCC] text-[#141413]/80 border border-[#D8D0BF]">
              Portal
            </span>
          </div>
        </div>

        {/* Center nav links - shown once there's comfortable room (>=1024px) */}
        <nav className="hidden lg:flex items-center gap-7 xl:gap-8">
          {NAV_LINKS.map((link) => (
            <DesktopNavLink key={link.id} label={link.label} id={link.id} />
          ))}
        </nav>

        {/* Actions */}
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <Button variant="secondary" onClick={() => navigate("/login")}>
            Sign In
          </Button>
          <Button variant="primary" onClick={() => navigate("/register")}>
            <span>Get Started</span>
            <span aria-hidden="true" className="inline-block transition-transform duration-(--motion-duration-fast) ease-(--motion-ease) group-hover:translate-x-0.5">
              &rarr;
            </span>
          </Button>
        </div>

        {/* Compact menu toggle - covers everything below the full-nav breakpoint */}
        <button
          ref={toggleButtonRef}
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg border border-[#D8D0BF] bg-[#E3DBCC] text-[#141413] cursor-pointer transition-colors duration-(--motion-duration-fast) hover:bg-[#D9D1C1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141413]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F0EEE6]"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls={MENU_PANEL_ID}
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Compact nav panel - overlays content rather than pushing it down */}
      <div
        id={MENU_PANEL_ID}
        ref={panelRef}
        inert={!menuOpen}
        className={`lg:hidden absolute left-0 right-0 top-full origin-top border-b border-[#D8D0BF] bg-[#F0EEE6] shadow-lg transition-[opacity,transform] duration-(--motion-duration-base) ease-(--motion-ease) ${
          menuOpen ? "opacity-100 translate-y-0" : "pointer-events-none -translate-y-1 opacity-0"
        }`}
      >
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto px-4 py-4 space-y-4">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link, i) => (
              <a
                key={link.id}
                ref={i === 0 ? firstMenuLinkRef : undefined}
                href={`#${link.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(link.id);
                }}
                className="px-3 py-3 rounded-lg text-sm font-medium text-[#141413]/80 hover:text-[#141413] hover:bg-[#E3DBCC] active:bg-[#D9D1C1] transition-colors duration-(--motion-duration-fast)"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex flex-col gap-2.5 pt-3 border-t border-[#D8D0BF]">
            <Button variant="secondary" fullWidth onClick={() => { closeMenu(); navigate("/login"); }}>
              Sign In
            </Button>
            <Button variant="primary" fullWidth onClick={() => { closeMenu(); navigate("/register"); }}>
              <span>Get Started</span>
              <span aria-hidden="true">&rarr;</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
