import React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "../../utils/cn";

/**
 * Trailing CTA arrow that nudges right on hover. Relies on the parent having
 * `group` (the shared `Button` component already does), so it only needs to
 * be dropped in as a child.
 */
export const CtaArrow: React.FC<{ className?: string }> = ({ className }) => (
  <ArrowRight
    aria-hidden="true"
    className={cn(
      "w-4 h-4 transition-transform duration-(--motion-duration-fast) ease-(--motion-ease) group-hover:translate-x-0.5",
      className,
    )}
  />
);
