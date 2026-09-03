// Shared rendering for every transactional email — keeps subject/branding/
// styling consistent across invitation and appointment lifecycle emails
// without copy-pasting the same HTML wrapper into each template.

const BRAND_NAME = "DocPulse";

export interface EmailDetailRow {
  label: string;
  value: string;
}

export interface TransactionalEmailOptions {
  heading: string;
  greeting: string;
  paragraphs: string[];
  details?: EmailDetailRow[];
  cta?: { label: string; url: string };
  closingNote?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderDetailsHtml(details: EmailDetailRow[]): string {
  if (!details.length) return "";

  const rows = details
    .map((row) => {
      const label = `<td style="padding:4px 12px 4px 0;color:#555;">${escapeHtml(row.label)}</td>`;
      const value = `<td style="padding:4px 0;font-weight:600;">${escapeHtml(row.value)}</td>`;
      return `<tr>${label}${value}</tr>`;
    })
    .join("");

  return `<table style="margin:16px 0;border-collapse:collapse;">${rows}</table>`;
}

function renderCtaHtml(cta?: { label: string; url: string }): string {
  if (!cta) return "";

  return `
        <p>
          <a
            href="${cta.url}"
            style="
              display: inline-block;
              padding: 10px 20px;
              background-color: #000;
              color: #fff;
              text-decoration: none;
              border-radius: 5px;
            "
          >
            ${escapeHtml(cta.label)}
          </a>
        </p>`;
}

export function renderTransactionalEmail(
  options: TransactionalEmailOptions,
): { text: string; html: string } {
  const { heading, greeting, paragraphs, details = [], cta, closingNote } = options;

  const textLines = [
    greeting,
    "",
    ...paragraphs,
    ...(details.length ? ["", ...details.map((d) => `${d.label}: ${d.value}`)] : []),
    ...(cta ? ["", `${cta.label}: ${cta.url}`] : []),
    ...(closingNote ? ["", closingNote] : []),
    "",
    `${BRAND_NAME} - Doctor Appointment & Healthcare Platform`,
  ];

  const html = `
        <h2>${escapeHtml(heading)}</h2>

        <p>${escapeHtml(greeting)}</p>

        ${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n")}

        ${renderDetailsHtml(details)}
        ${renderCtaHtml(cta)}

        ${closingNote ? `<p>${escapeHtml(closingNote)}</p>` : ""}

        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="color:#888;font-size:12px;">${BRAND_NAME} &middot; Doctor Appointment &amp; Healthcare Platform</p>
      `;

  return { text: textLines.join("\n"), html };
}
