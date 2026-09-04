import React from "react";
import { cn } from "../../utils/cn";

interface PulseLineProps {
  className?: string;
}

/** The DocPulse heartbeat motif: a flat baseline with one ECG-style blip. */
export const PulseLine: React.FC<PulseLineProps> = ({ className }) => (
  <svg
    className={cn("text-[#141413]/25", className)}
    viewBox="0 0 300 40"
    preserveAspectRatio="none"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M0,20 L95,20 L108,4 L120,36 L132,20 L300,20"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
