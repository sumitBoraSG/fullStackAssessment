import React from "react";
import { Eyebrow } from "./Eyebrow";
import { Reveal } from "./Reveal";

const STEPS = [
  {
    title: "Find a Doctor",
    description: "Choose a doctor based on specialization and availability.",
  },
  {
    title: "Choose a Time",
    description: "View available slots and select a convenient appointment time.",
  },
  {
    title: "Book",
    description: "Confirm the appointment in a click.",
  },
  {
    title: "Consult",
    description: "A structured, on-schedule experience for doctors and patients.",
  },
];

export const HowItWorksSection: React.FC = () => {
  return (
    <section id="how-it-works" className="relative scroll-mt-24 bg-[#E3DBCC]/40 border-y border-[#D8D0BF]">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-20 py-16 sm:py-20 lg:py-24">
        <Reveal className="max-w-2xl mx-auto text-center mb-14 sm:mb-16">
          <Eyebrow align="center" className="justify-center mb-4">
            How it works
          </Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#141413] m-0">
            From search to consultation
          </h2>
        </Reveal>

        <div className="relative max-w-4xl mx-auto">
          <div
            className="absolute left-6 top-0 bottom-0 w-px bg-[#D8D0BF] sm:left-0 sm:right-0 sm:top-6 sm:bottom-auto sm:h-px sm:w-auto -z-0"
            aria-hidden="true"
          />

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-10 sm:gap-6">
            {STEPS.map((step, i) => (
              <Reveal key={step.title} delayMs={i * 80}>
                <div className="relative flex sm:flex-col items-start sm:items-center gap-4 sm:gap-0 text-left sm:text-center">
                  <div className="relative z-10 w-12 h-12 rounded-full bg-[#FAF8F5] border border-[#D8D0BF] flex items-center justify-center text-base font-bold text-[#141413] shrink-0 shadow-xs sm:mb-5">
                    {i + 1}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#141413] m-0">{step.title}</h3>
                    <p className="mt-1.5 text-sm text-[#141413]/60 leading-relaxed m-0 sm:max-w-60 sm:mx-auto">
                      {step.description}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
