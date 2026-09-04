function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/**
 * Scrolls to an in-page section by id, accounting for the sticky header via
 * each section's `scroll-mt-*` class. Used instead of a bare `href="#id"`
 * jump so we can respect prefers-reduced-motion and avoid a native
 * jump-then-smooth-scroll double motion.
 */
export function scrollToSection(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;

  el.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });

  if (window.location.hash !== `#${id}`) {
    window.history.replaceState(null, "", `#${id}`);
  }
}
