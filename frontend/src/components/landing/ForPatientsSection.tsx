import React from "react";
import { Search, CalendarCheck, History } from "lucide-react";
import { useRouter } from "../../context/RouterContext";
import { Button } from "../ui/Button";
import { Eyebrow } from "./Eyebrow";
import { Reveal } from "./Reveal";
import { CtaArrow } from "./CtaArrow";

const PATIENT_POINTS = [
  {
    icon: Search,
    title: "Search by specialization",
    description: "Filter doctors by specialty and see who has open slots.",
  },
  {
    icon: CalendarCheck,
    title: "Book in a few clicks",
    description: "Pick a time that works and confirm the appointment instantly.",
  },
  {
    icon: History,
    title: "Track every consultation",
    description: "Upcoming and past appointments, always in one list.",
  },
];

const RESULTS = [
  { initials: "RK", name: "Dr. R. Kapoor", specialty: "Dermatology" },
  { initials: "MS", name: "Dr. M. Santos", specialty: "Pediatrics" },
];

const DiscoveryMock: React.FC = () => (
  <div className="relative w-full max-w-sm mx-auto" aria-hidden="true">
    <div className="absolute -inset-6 rounded-4xl border border-[#D8D0BF]" />
    <div className="relative rounded-2xl bg-[#FAF8F5] border border-[#D8D0BF] shadow-md p-5">
      <div className="flex items-center gap-2 rounded-lg bg-[#F0EEE6] border border-[#D8D0BF] px-3 py-2 mb-4">
        <Search className="w-3.5 h-3.5 text-[#141413]/40 shrink-0" />
        <span className="text-xs text-[#141413]/40">Search specialization…</span>
      </div>

      <div className="space-y-2.5">
        {RESULTS.map((doc) => (
          <div
            key={doc.name}
            className="flex items-center justify-between gap-3 rounded-lg bg-[#F0EEE6] border border-[#D8D0BF] px-3 py-2.5"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-md bg-[#141413] text-[#F0EEE6] flex items-center justify-center text-[10px] font-semibold shrink-0">
                {doc.initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#141413] m-0 truncate">{doc.name}</p>
                <p className="text-[11px] text-[#141413]/55 m-0 truncate">{doc.specialty}</p>
              </div>
            </div>
            <span className="text-[11px] font-medium rounded-md px-2.5 py-1 bg-[#141413] text-[#F0EEE6] shrink-0">
              Book
            </span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const ForPatientsSection: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <section id="for-patients" className="relative overflow-x-hidden scroll-mt-24 bg-[#E3DBCC]/40 border-y border-[#D8D0BF]">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-20 py-16 sm:py-20 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:items-center gap-14 lg:gap-16">
          <Reveal>
            <DiscoveryMock />
          </Reveal>

          <Reveal delayMs={90} className="text-center lg:text-left max-w-xl mx-auto lg:mx-0">
            <Eyebrow align="center" className="lg:justify-start mb-4">
              For patients
            </Eyebrow>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#141413] m-0">
              A simpler way to find, book, and manage your care.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-[#141413]/60 leading-relaxed max-w-md mx-auto lg:mx-0">
              Search for the right doctor, see real availability, and keep every appointment
              organized in one place.
            </p>

            <div className="mt-8 space-y-5 text-left">
              {PATIENT_POINTS.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-[#FAF8F5] border border-[#D8D0BF] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[#141413]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#141413] m-0">{title}</p>
                    <p className="text-sm text-[#141413]/60 m-0 mt-0.5">{description}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button variant="primary" className="mt-8" onClick={() => navigate("/register")}>
              <span>Create Your Account</span>
              <CtaArrow />
            </Button>
          </Reveal>
        </div>
      </div>
    </section>
  );
};
