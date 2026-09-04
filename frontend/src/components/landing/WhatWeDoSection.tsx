import React from "react";
import { CheckCircle2, Stethoscope, User } from "lucide-react";
import { Eyebrow } from "./Eyebrow";
import { Reveal } from "./Reveal";

const PATIENT_ITEMS = [
  "Discover doctors by specialization",
  "View real availability before booking",
  "Book appointments in a few clicks",
  "Keep track of upcoming and past consultations",
];

const DOCTOR_ITEMS = [
  "Publish and manage your availability",
  "Review incoming requests and confirm or decline",
  "Move consultations through to completion",
  "See patient details for every booking",
];

const ValueCard: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  items: string[];
}> = ({ icon: Icon, title, subtitle, items }) => (
  <div className="rounded-2xl bg-[#E3DBCC] border border-[#D8D0BF] shadow-xs p-6 sm:p-8">
    <div className="w-11 h-11 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] flex items-center justify-center shadow-xs mb-5">
      <Icon className="w-5 h-5 text-[#141413]" />
    </div>
    <h3 className="text-xl font-semibold tracking-tight text-[#141413] m-0">{title}</h3>
    <p className="mt-1.5 text-sm text-[#141413]/60 leading-relaxed m-0">{subtitle}</p>

    <ul className="mt-6 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm text-[#141413]/80">
          <CheckCircle2 className="w-4 h-4 text-[#141413]/40 mt-0.5 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </div>
);

export const WhatWeDoSection: React.FC = () => {
  return (
    <section id="what-we-do" className="relative scroll-mt-24">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-20 py-16 sm:py-20 lg:py-24">
        <Reveal className="max-w-2xl mx-auto text-center mb-12 sm:mb-16">
          <Eyebrow align="center" className="justify-center mb-4">
            What DocPulse does
          </Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#141413] m-0">
            One connected platform for both sides of care
          </h2>
          <p className="mt-4 text-sm sm:text-base text-[#141413]/60 leading-relaxed">
            A connected platform for booking appointments, managing patients, and keeping every
            consultation on schedule.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          <Reveal>
            <ValueCard
              icon={User}
              title="For Patients"
              subtitle="A simpler way to find, book, and manage healthcare appointments."
              items={PATIENT_ITEMS}
            />
          </Reveal>
          <Reveal delayMs={90}>
            <ValueCard
              icon={Stethoscope}
              title="For Doctors"
              subtitle="Less time managing schedules, more time with patients."
              items={DOCTOR_ITEMS}
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
};
