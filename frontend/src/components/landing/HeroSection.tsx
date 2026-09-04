import React from "react";
import { CalendarCheck, Stethoscope } from "lucide-react";
import { useRouter } from "../../context/RouterContext";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { CornerAccent } from "../decor/CornerAccent";
import { PulseLine } from "../decor/PulseLine";
import { Eyebrow } from "./Eyebrow";
import { CtaArrow } from "./CtaArrow";
import { scrollToSection } from "../../utils/scrollToSection";

const TIME_SLOTS = ["9:00", "9:30", "10:30", "11:00"];

const HeroVisual: React.FC = () => (
  <div className="relative w-full max-w-md mx-auto aspect-square" aria-hidden="true">
    {/* Concentric circle backdrop, matching the auth pages' motif */}
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-[85%] h-[85%] rounded-full bg-[#E3DBCC]" />
    </div>
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-full h-full rounded-full border border-[#D8D0BF]" />
    </div>
    <div
      className="absolute inset-0 rounded-full opacity-[0.35]"
      style={{
        backgroundImage: "radial-gradient(#141413 1px, transparent 1px)",
        backgroundSize: "18px 18px",
        maskImage: "radial-gradient(circle, black 45%, transparent 70%)",
        WebkitMaskImage: "radial-gradient(circle, black 45%, transparent 70%)",
      }}
    />

    {/* Time-slot chip, layered top-right */}
    <div className="absolute top-[8%] right-[2%] w-44 rotate-[4deg] rounded-xl bg-[#FAF8F5] border border-[#D8D0BF] shadow-sm p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#141413]/50 mb-2">
        <CalendarCheck className="w-3 h-3" />
        <span>Choose a time</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {TIME_SLOTS.map((slot, i) => (
          <span
            key={slot}
            className={
              i === 2
                ? "text-[11px] font-medium rounded-md px-2 py-1 text-center bg-[#141413] text-[#F0EEE6]"
                : "text-[11px] font-medium rounded-md px-2 py-1 text-center bg-transparent border border-[#D8D0BF] text-[#141413]/70"
            }
          >
            {slot}
          </span>
        ))}
      </div>
    </div>

    {/* Appointment card, layered center-left */}
    <div className="absolute bottom-[10%] left-[0%] w-64 -rotate-[3deg] rounded-2xl bg-[#E3DBCC] border border-[#D8D0BF] shadow-md p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-lg bg-[#141413] text-[#F0EEE6] flex items-center justify-center text-xs font-semibold shrink-0">
            AW
          </div>
          <div>
            <p className="text-xs font-semibold text-[#141413] m-0 leading-tight">Dr. A. Whitfield</p>
            <p className="text-[11px] text-[#141413]/55 m-0 leading-tight">Cardiology</p>
          </div>
        </div>
        <Stethoscope className="w-3.5 h-3.5 text-[#141413]/30 shrink-0" />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#141413]/60">Thu, 10:30 AM</span>
        <Badge color="emerald" size="xs">
          Confirmed
        </Badge>
      </div>
    </div>

    <PulseLine className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2/3 h-8 opacity-30" />
  </div>
);

export const HeroSection: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <section className="relative overflow-hidden">
      <CornerAccent className="hidden sm:block absolute top-6 left-4 lg:top-10 lg:left-10" />

      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-20 pt-14 pb-16 sm:pt-20 sm:pb-24 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:items-center gap-16 lg:gap-8">
          {/* Primary content */}
          <div className="text-center lg:text-left max-w-xl mx-auto lg:mx-0">
            <Eyebrow align="center" className="lg:justify-start mb-5 animate-load-fade-in-up">
              Healthcare, coordinated
            </Eyebrow>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] m-0 animate-load-fade-in-up [animation-delay:90ms]">
              <span className="text-[#141413]">Healthcare appointments,</span>
              <br />
              <span className="text-[#141413]/40">kept on schedule.</span>
            </h1>

            <p className="mt-6 text-sm sm:text-base text-[#141413]/60 leading-relaxed max-w-md mx-auto lg:mx-0 animate-load-fade-in-up [animation-delay:180ms]">
              DocPulse connects doctors and patients on one platform, so booking, managing, and
              tracking every appointment stays simple, from the first search to the final
              consultation.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 animate-load-fade-in-up [animation-delay:270ms]">
              <Button variant="primary" className="w-full sm:w-auto px-6 py-3" onClick={() => navigate("/register")}>
                <span>Get Started</span>
                <CtaArrow />
              </Button>
              <a
                href="#what-we-do"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection("what-we-do");
                }}
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-medium text-[#141413]/80 hover:text-[#141413] border border-transparent hover:border-[#D8D0BF] transition-colors duration-(--motion-duration-fast) ease-(--motion-ease) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141413]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F0EEE6]"
              >
                <span>Learn More</span>
                <CtaArrow />
              </a>
            </div>
          </div>

          {/* Visual */}
          <div className="animate-load-scale-in [animation-delay:150ms]">
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  );
};
