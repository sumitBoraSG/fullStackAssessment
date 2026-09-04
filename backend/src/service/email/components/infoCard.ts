import { BADGE_TONE, BadgeTone, COLOR, FONT_FAMILY, RADIUS } from "../theme";
import { escapeHtml } from "../utils";

export interface EmailDetailRow {
  label: string;
  value: string;
}

export interface EmailBadge {
  label: string;
  tone: BadgeTone;
}

export interface EmailInfoCardInput {
  rows: EmailDetailRow[];
  badge?: EmailBadge;
}

function renderBadge(badge: EmailBadge): string {
  const tone = BADGE_TONE[badge.tone];
  const cellStyle = [
    `border:1px solid ${tone.border}`,
    `border-radius:${RADIUS.badge}px`,
    "padding:4px 10px",
  ].join(";");
  const textStyle = [
    `font-family:${FONT_FAMILY}`,
    "font-size:11px",
    "font-weight:600",
    "letter-spacing:0.02em",
    `color:${tone.text}`,
  ].join(";");

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
      <tr>
        <td bgcolor="${tone.bg}" style="${cellStyle}">
          <span style="${textStyle}">${escapeHtml(badge.label)}</span>
        </td>
      </tr>
    </table>`;
}

function renderRow(row: EmailDetailRow, isLast: boolean): string {
  const labelStyle = [
    `font-family:${FONT_FAMILY}`,
    "font-size:11px",
    "font-weight:600",
    "letter-spacing:0.06em",
    "text-transform:uppercase",
    `color:${COLOR.textMuted}`,
    "padding-bottom:4px",
  ].join(";");
  const valueStyle = [
    `font-family:${FONT_FAMILY}`,
    "font-size:15px",
    "font-weight:600",
    `color:${COLOR.textPrimary}`,
    "word-break:break-word",
    "overflow-wrap:anywhere",
  ].join(";");
  const padding = isLast ? "0" : "0 0 14px";

  return `
    <tr>
      <td style="padding:${padding};">
        <div style="${labelStyle}">${escapeHtml(row.label)}</div>
        <div style="${valueStyle}">${escapeHtml(row.value)}</div>
      </td>
    </tr>`;
}

// A bordered/rounded box rendering label/value pairs as stacked
// "uppercase micro-label above bold value" rows, mirroring the site's own
// appointment-card convention (PatientAppointmentsList.tsx), plus an
// optional status badge — replaces the old flat 2-column table.
export function renderInfoCard(card: EmailInfoCardInput): string {
  const rowsHtml = card.rows.map((row, index) => renderRow(row, index === card.rows.length - 1)).join("");
  const cardStyle = [
    `background-color:${COLOR.surfaceMuted}`,
    `border:1px solid ${COLOR.border}`,
    `border-radius:${RADIUS.card}px`,
  ].join(";");
  const badgeHtml = card.badge ? renderBadge(card.badge) : "";

  return `
    <table
      role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      bgcolor="${COLOR.surfaceMuted}" style="${cardStyle}"
    >
      <tr>
        <td style="padding:20px 24px;">
          ${badgeHtml}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${rowsHtml}
          </table>
        </td>
      </tr>
    </table>`;
}
