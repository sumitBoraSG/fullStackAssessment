import React from "react";
import { Activity } from "lucide-react";
import { scrollToSection } from "../../utils/scrollToSection";

const PRODUCT_LINKS = [
  { label: "For Doctors", id: "for-doctors" },
  { label: "For Patients", id: "for-patients" },
  { label: "Features", id: "features" },
];

const LEGAL_LINKS = ["Privacy Policy", "Terms & Conditions"];

export const LandingFooter: React.FC = () => {
  return (
    <footer className="border-t border-[#D8D0BF] bg-[#F0EEE6]">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-20 py-12 sm:py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 lg:gap-8">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#141413] text-[#F0EEE6] flex items-center justify-center shadow-xs shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <span className="font-semibold text-base tracking-tight text-[#141413]">DocPulse</span>
            </div>
            <p className="text-sm text-[#141413]/60 leading-relaxed m-0">
              A connected platform for booking appointments, managing patients, and keeping every
              consultation on schedule.
            </p>
          </div>

          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#141413]/50 mb-3.5">
              Product
            </h3>
            <ul className="space-y-2.5">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.id}>
                  <a
                    href={`#${link.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection(link.id);
                    }}
                    className="text-sm text-[#141413]/70 hover:text-[#141413] transition-colors duration-(--motion-duration-fast) ease-(--motion-ease) focus-visible:outline-none focus-visible:underline focus-visible:text-[#141413]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#141413]/50 mb-3.5">
              Legal
            </h3>
            <ul className="space-y-2.5">
              {LEGAL_LINKS.map((label) => (
                <li key={label}>
                  <span className="text-sm text-[#141413]/60">{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[#D8D0BF] text-center text-xs text-[#141413]/50">
          Doctor Appointment &amp; Healthcare Platform &copy; {new Date().getFullYear()} DocPulse
        </div>
      </div>
    </footer>
  );
};
