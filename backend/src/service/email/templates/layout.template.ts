// Shared rendering for every transactional email — keeps branding/styling
// consistent across invitation and appointment lifecycle emails without
// copy-pasting the same HTML wrapper into each template. Composes the
// design-system pieces in ../components/* into one document.

import { BRAND_NAME, COLOR, FONT_FAMILY, BadgeTone } from "../theme";
import { escapeHtml } from "../utils";
import { renderEmailButton } from "../components/button";
import { renderEmailFooter } from "../components/footer";
import { renderEmailHeader } from "../components/header";
import { EmailBadge, EmailDetailRow, renderInfoCard } from "../components/infoCard";
import { renderEmailShell } from "../components/shell";

export { EmailDetailRow, EmailBadge, BadgeTone };

export interface TransactionalEmailOptions {
  heading: string;
  greeting: string;
  paragraphs: string[];
  details?: EmailDetailRow[];
  cta?: { label: string; url: string };
  closingNote?: string;
  // Additive, HTML-only fields — never read by the plain-text renderer, so
  // they cannot change the wording asserted by existing email tests.
  badge?: EmailBadge;
  preheader?: string;
}

function buildTextBody(options: TransactionalEmailOptions): string {
  const { greeting, paragraphs, details = [], cta, closingNote } = options;

  const lines = [
    greeting,
    "",
    ...paragraphs,
    ...(details.length ? ["", ...details.map((row) => `${row.label}: ${row.value}`)] : []),
    ...(cta ? ["", `${cta.label}: ${cta.url}`] : []),
    ...(closingNote ? ["", closingNote] : []),
    "",
    `${BRAND_NAME} - Doctor Appointment & Healthcare Platform`,
  ];

  return lines.join("\n");
}

interface ContentTextStyles {
  heading: string;
  greeting: string;
  paragraph: string;
  closing: string;
}

function buildContentTextStyles(): ContentTextStyles {
  const base = [`font-family:${FONT_FAMILY}`, "line-height:1.6"];

  return {
    heading: [
      "margin:0 0 16px",
      ...base,
      "font-size:22px",
      "font-weight:700",
      "letter-spacing:-0.02em",
      `color:${COLOR.textPrimary}`,
      "word-break:break-word",
    ].join(";"),
    greeting: ["margin:0 0 16px", ...base, "font-size:15px", `color:${COLOR.textPrimary}`].join(";"),
    paragraph: [
      "margin:0 0 16px",
      ...base,
      "font-size:15px",
      `color:${COLOR.textMuted}`,
      "word-break:break-word",
      "overflow-wrap:anywhere",
    ].join(";"),
    closing: ["margin:20px 0 0", ...base, "font-size:13px", `color:${COLOR.textMuted}`].join(";"),
  };
}

function buildButtonHtml(cta: TransactionalEmailOptions["cta"]): string {
  if (!cta) {
    return "";
  }

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center" style="padding:4px 0 8px;">${renderEmailButton(cta)}</td></tr>
    </table>`;
}

function buildContentHtml(options: TransactionalEmailOptions): string {
  const { heading, greeting, paragraphs, details = [], cta, closingNote, badge } = options;
  const styles = buildContentTextStyles();

  const paragraphsHtml = paragraphs.map((p) => `<p style="${styles.paragraph}">${escapeHtml(p)}</p>`).join("");
  const infoCardHtml = details.length
    ? `<div style="margin:8px 0 24px;">${renderInfoCard({ rows: details, badge })}</div>`
    : "";
  const buttonHtml = buildButtonHtml(cta);
  const closingHtml = closingNote ? `<p style="${styles.closing}">${escapeHtml(closingNote)}</p>` : "";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="docpulse-email-content-padding" style="padding:36px 36px 8px;">
          <h1 style="${styles.heading}">${escapeHtml(heading)}</h1>
          <p style="${styles.greeting}">${escapeHtml(greeting)}</p>
          ${paragraphsHtml}
          ${infoCardHtml}
          ${buttonHtml}
          ${closingHtml}
        </td>
      </tr>
    </table>`;
}

export function renderTransactionalEmail(
  options: TransactionalEmailOptions,
): { text: string; html: string } {
  const preheaderText = options.preheader ?? options.paragraphs[0] ?? options.greeting;
  const bodyHtml = [renderEmailHeader(), buildContentHtml(options), renderEmailFooter()].join("");
  const html = renderEmailShell({ bodyHtml, preheaderText });

  return { text: buildTextBody(options), html };
}
