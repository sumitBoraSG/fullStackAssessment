import { BRAND_NAME, BRAND_TAGLINE, COLOR, FONT_FAMILY } from "../theme";
import { renderDivider } from "./divider";

export function renderEmailFooter(): string {
  const textStyle = [
    `font-family:${FONT_FAMILY}`,
    "font-size:12px",
    "line-height:1.6",
    `color:${COLOR.textMuted}`,
  ].join(";");
  const year = new Date().getFullYear();

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="docpulse-email-footer-padding" style="padding:0 36px;">${renderDivider()}</td>
      </tr>
      <tr>
        <td align="center" class="docpulse-email-footer-padding" style="padding:20px 36px 28px;${textStyle}">
          <div style="font-weight:600;color:${COLOR.textPrimary};margin-bottom:2px;">${BRAND_NAME}</div>
          <div>${BRAND_TAGLINE}</div>
          <div style="margin-top:6px;">&copy; ${year} ${BRAND_NAME}. All rights reserved.</div>
        </td>
      </tr>
    </table>`;
}
