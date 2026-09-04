import React from "react";
import { cn } from "../../utils/cn";
import { CornerAccent } from "../decor/CornerAccent";
import { PulseLine } from "../decor/PulseLine";

interface AuthLayoutProps {
  children: React.ReactNode;
  formClassName?: string;
}

const BrandingColumn: React.FC = () => {
  return (
    <div className="relative flex flex-col items-center text-center lg:items-start lg:text-left max-w-lg mx-auto lg:mx-0">
      {/* Abstract curved shape + pulse motif, scoped behind this column's copy */}
      <div className="pointer-events-none absolute -z-10 inset-0" aria-hidden="true">
        <div
          className="absolute rounded-full bg-[#E3DBCC]
            w-56 h-56 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            sm:w-72 sm:h-72
            lg:w-120 lg:h-120 lg:-left-12 lg:translate-x-0 lg:top-1/2 lg:-translate-y-1/2"
        />
        <div
          className="absolute rounded-full border border-[#D8D0BF]
            w-72 h-72 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            sm:w-96 sm:h-96
            lg:w-xl lg:h-144 lg:-left-20 lg:translate-x-0 lg:top-1/2 lg:-translate-y-1/2"
        />
      </div>

      <div className="relative">
        <div className="flex items-center justify-center lg:justify-start gap-2 mb-4 text-[11px] font-medium uppercase tracking-wider text-[#141413]/50">
          <span className="inline-block w-6 h-px bg-[#141413]/30" />
          <span>Healthcare, coordinated</span>
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.03] m-0">
          <span className="text-[#141413]">Doc</span>
          <span className="text-[#141413]/35">Pulse</span>
        </h1>

        <p className="mt-5 text-sm sm:text-base text-[#141413]/60 leading-relaxed max-w-sm mx-auto lg:mx-0">
          One connected platform for booking appointments, managing patients, and keeping every
          consultation on schedule.
        </p>

        <PulseLine className="mt-6 w-36 sm:w-40 h-6 mx-auto lg:mx-0" />
      </div>
    </div>
  );
};

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, formClassName }) => {
  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-8rem)] flex items-center py-10 sm:py-12 lg:py-16 xl:py-20">
      <CornerAccent className="hidden sm:block absolute top-6 left-4 lg:top-10 lg:left-10" />
      <CornerAccent flipped className="hidden sm:block absolute bottom-6 right-4 lg:bottom-10 lg:right-10" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:items-center gap-16 lg:gap-8">
          <BrandingColumn />

          <div className="flex justify-center lg:justify-end">
            <div className={cn("w-full max-w-md", formClassName)}>{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
