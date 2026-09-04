import React from "react";
import { cn } from "../../utils/cn";

interface CornerAccentProps {
  className?: string;
  flipped?: boolean;
}

export const CornerAccent: React.FC<CornerAccentProps> = ({ className, flipped }) => (
  <svg
    className={cn("text-[#141413]/8", className)}
    width="56"
    height="56"
    viewBox="0 0 56 56"
    fill="none"
    aria-hidden="true"
    style={flipped ? { transform: "rotate(180deg)" } : undefined}
  >
    <path d="M4 4 L28 4 L4 28 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M20 4 L44 4 L20 28 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M36 4 L52 4 L36 20 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);
