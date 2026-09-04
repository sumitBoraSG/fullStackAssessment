import React from "react";
import { CalendarClock, ClipboardCheck, Users2, Stethoscope } from "lucide-react";
import { useRouter } from "../../context/RouterContext";
import { Button } from "../ui/Button";
import { Eyebrow } from "./Eyebrow";
import { Reveal } from "./Reveal";
import { CtaArrow } from "./CtaArrow";

const DOCTOR_POINTS = [
  {
    icon: CalendarClock,
    title: "Set your own availability",
    description: "Open the time slots that work for you and keep them current.",
  },
  {
    icon: ClipboardCheck,
    title: "Confirm or decline requests",
    description: "Review incoming bookings and respond in one place.",
  },
  {
    icon: Users2,
    title: "Know who you're seeing",
    description: "Patient details travel with every appointment you accept.",
  },
];

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const OPEN_DAYS = new Set(["Mon", "Wed", "Thu", "Fri"]);

const AvailabilityMock: React.FC = () => (
  <div className="relative w-full max-w-sm mx-auto" aria-hidden="true">
    <div className="absolute -inset-6 rounded-4xl border border-[#D8D0BF]" />
    <div className="relative rounded-2xl bg-[#FAF8F5] border border-[#D8D0BF] shadow-md p-5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#141413]/50 mb-4">
        <Stethoscope className="w-3.5 h-3.5" />
        <span>My availability</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEK.map((day) => (
          <div key={day} className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-medium text-[#141413]/50">{day}</span>
            <span
              className={
                OPEN_DAYS.has(day)
                  ? "w-full aspect-square rounded-md bg-[#141413]"
                  : "w-full aspect-square rounded-md bg-transparent border border-dashed border-[#D8D0BF]"
              }
            />
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-[#D8D0BF] flex items-center justify-between">
        <span className="text-xs text-[#141413]/60">4 days open this week</span>
        <span className="text-[11px] font-medium rounded-md px-2 py-1 bg-[#DCE7DD] text-[#1E3E26] border border-[#BED4C1]">
          On schedule
        </span>
      </div>
    </div>
  </div>
);

export const ForDoctorsSection: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <section id="for-doctors" className="relative overflow-x-hidden scroll-mt-24">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-20 py-16 sm:py-20 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:items-center gap-14 lg:gap-16">
          <Reveal className="text-center lg:text-left max-w-xl mx-auto lg:mx-0">
            <Eyebrow align="center" className="lg:justify-start mb-4">
              For doctors
            </Eyebrow>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#141413] m-0">
              Spend less time managing schedules, more time with patients.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-[#141413]/60 leading-relaxed max-w-md mx-auto lg:mx-0">
              Publish your availability, respond to requests, and move through consultations
              without the back-and-forth.
            </p>

            <div className="mt-8 space-y-5 text-left">
              {DOCTOR_POINTS.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-[#E3DBCC] border border-[#D8D0BF] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[#141413]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#141413] m-0">{title}</p>
                    <p className="text-sm text-[#141413]/60 m-0 mt-0.5">{description}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button variant="secondary" className="mt-8" onClick={() => navigate("/login")}>
              <span>Sign In to Your Dashboard</span>
              <CtaArrow />
            </Button>
          </Reveal>

          <Reveal delayMs={90}>
            <AvailabilityMock />
          </Reveal>
        </div>
      </div>
    </section>
  );
};
