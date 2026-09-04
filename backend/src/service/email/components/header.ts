import { BRAND_MONOGRAM, BRAND_NAME, COLOR, FONT_FAMILY } from "../theme";

// A small dark rounded-square monogram + wordmark, mirroring the site's
// real header treatment (Navbar.tsx). Built from table cells and a text
// glyph rather than an <img>/inline SVG — no logo asset file exists in the
// repo, and a text-based badge degrades gracefully everywhere (no
// broken-image icon, no client stripping an inline SVG).
export function renderEmailHeader(): string {
  const badgeStyle = [
    "width:28px",
    "height:28px",
    `background-color:${COLOR.brandDark}`,
    "border-radius:8px",
    "text-align:center",
    "vertical-align:middle",
    "line-height:28px",
    `font-family:${FONT_FAMILY}`,
    "font-size:14px",
    "font-weight:700",
    `color:${COLOR.brandOnDark}`,
  ].join(";");
  const wordmarkStyle = [
    `font-family:${FONT_FAMILY}`,
    "font-size:16px",
    "font-weight:600",
    "letter-spacing:-0.02em",
    `color:${COLOR.textPrimary}`,
    "vertical-align:middle",
  ].join(";");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="docpulse-email-header-padding" style="padding:28px 36px;border-bottom:1px solid ${COLOR.border};">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td bgcolor="${COLOR.brandDark}" style="${badgeStyle}">${BRAND_MONOGRAM}</td>
              <td style="width:10px;font-size:0;line-height:0;">&nbsp;</td>
              <td style="${wordmarkStyle}">${BRAND_NAME}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}
