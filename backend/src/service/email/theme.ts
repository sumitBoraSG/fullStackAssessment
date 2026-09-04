// Design tokens for transactional emails, translated 1:1 from the live
// frontend (frontend/src/index.css CSS variables + Button.tsx + the site's
// status-badge palette) so emails read as an extension of the product, not
// a generic HTML template. Kept separate from the web app's Tailwind/CSS
// variables because email clients don't support CSS custom properties.

export const BRAND_NAME = "DocPulse";
export const BRAND_TAGLINE = "Doctor Appointment & Healthcare Platform";
export const BRAND_MONOGRAM = "D";

export const FONT_FAMILY =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export const COLOR = {
  // Outer canvas only — matches the website background. The inner content
  // card deliberately does NOT reuse this, so the email stays high-contrast
  // and readable rather than beige-on-beige.
  pageBackground: "#F0EEE6",
  surface: "#FFFFFF",
  surfaceMuted: "#FAF8F5",
  border: "#D8D0BF",
  textPrimary: "#141413",
  textMuted: "#6B6960",
  brandDark: "#141413",
  brandOnDark: "#F0EEE6",
};

export type BadgeTone = "success" | "pending" | "cancelled" | "completed" | "declined";

export const BADGE_TONE: Record<BadgeTone, { bg: string; text: string; border: string }> = {
  success: { bg: "#DCE7DD", text: "#1E3E26", border: "#BED4C1" },
  pending: { bg: "#EAE0CE", text: "#4A3B18", border: "#D4C4A8" },
  cancelled: { bg: "#EEDCDA", text: "#541C18", border: "#DEC0BD" },
  completed: { bg: "#D8DFE6", text: "#1E2E3E", border: "#BAC6D3" },
  declined: { bg: "#DDD7CA", text: "#2D2A24", border: "#CCC4B4" },
};

export const RADIUS = {
  button: 8,
  card: 12,
  badge: 6,
};

export const CONTENT_WIDTH = 600;
