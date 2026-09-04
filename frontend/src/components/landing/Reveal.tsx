import React from "react";
import { cn } from "../../utils/cn";
import { useInViewOnce } from "../../hooks/useInViewOnce";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger delay in ms, for revealing a group of items in sequence. */
  delayMs?: number;
}

/** Fades an element up into place the first time it enters the viewport. */
export const Reveal: React.FC<RevealProps> = ({ children, className, delayMs = 0 }) => {
  const { ref, inView } = useInViewOnce<HTMLDivElement>();

  return (
    <div
      ref={ref}
      data-revealed={inView}
      className={cn("reveal", className)}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
};
