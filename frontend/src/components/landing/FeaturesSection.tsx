import React from "react";
import {
  CalendarCheck,
  CalendarClock,
  Activity,
  Users,
  ShieldCheck,
  LockKeyhole,
  Mail,
  ClipboardList,
} from "lucide-react";
import { Eyebrow } from "./Eyebrow";
import { Reveal } from "./Reveal";

const FEATURES: { icon: React.ComponentType<{ className?: string }>; title: string; description: string }[] = [
  {
    icon: CalendarCheck,
    title: "Appointment Scheduling",
    description: "Search, compare, and book available doctors in just a few clicks.",
  },
  {
    icon: CalendarClock,
    title: "Availability Management",
    description: "Doctors publish the exact time slots they're open to see patients.",
  },
  {
    icon: Activity,
    title: "Status Tracking",
    description: "Every booking moves through Pending, Confirmed, Completed, or Cancelled.",
  },
  {
    icon: Users,
    title: "Patient Visibility",
    description: "Doctors see full patient details for every appointment they accept.",
  },
  {
    icon: ShieldCheck,
    title: "Role-Based Access",
    description: "Separate, tailored experiences for admins, doctors, and patients.",
  },
  {
    icon: LockKeyhole,
    title: "Secure Authentication",
    description: "Policy-enforced passwords keep every account protected.",
  },
  {
    icon: Mail,
    title: "Email Invitations",
    description: "Admins bring doctors and patients on board, one invite or a whole batch at a time.",
  },
  {
    icon: ClipboardList,
    title: "Structured Consultations",
    description: "A consistent path from booking to consultation, every time.",
  },
];

export const FeaturesSection: React.FC = () => {
  return (
    <section id="features" className="relative scroll-mt-24">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-20 py-16 sm:py-20 lg:py-24">
        <Reveal className="max-w-2xl mx-auto text-center mb-12 sm:mb-16">
          <Eyebrow align="center" className="justify-center mb-4">
            Capabilities
          </Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#141413] m-0">
            Everything scheduling needs, nothing it doesn't
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {FEATURES.map(({ icon: Icon, title, description }, i) => (
            <Reveal key={title} delayMs={(i % 4) * 70}>
              <div className="rounded-xl bg-[#FAF8F5] border border-[#D8D0BF] p-5 shadow-2xs">
                <div className="w-10 h-10 rounded-lg bg-[#E3DBCC] border border-[#D8D0BF] flex items-center justify-center mb-4">
                  <Icon className="w-4 h-4 text-[#141413]" />
                </div>
                <h3 className="text-sm font-semibold text-[#141413] m-0">{title}</h3>
                <p className="mt-1.5 text-xs text-[#141413]/60 leading-relaxed m-0">{description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};
