export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Attribute context needs quote-escaping in addition to escapeHtml()'s
// tag-escaping. Hardens a latent gap in the previous implementation, where
// cta.url was interpolated into href="" with no escaping at all.
export function escapeAttribute(value: string): string {
  return escapeHtml(value)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function truncateForPreheader(value: string, maxLength = 110): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}
