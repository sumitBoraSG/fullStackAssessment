import { COLOR, FONT_FAMILY, RADIUS } from "../theme";
import { escapeAttribute, escapeHtml } from "../utils";

export interface EmailButtonInput {
  label: string;
  url: string;
}

// Table + bgcolor + inline padding on the <a> ("bulletproof-lite") renders
// correctly in Gmail, Apple Mail, Outlook.com, and desktop Outlook without
// VML — there's no existing VML fallback in this codebase to preserve, and
// a v:roundrect fallback isn't worth the added conditional-comment
// complexity for a from-scratch build.
export function renderEmailButton(button: EmailButtonInput): string {
  const href = escapeAttribute(button.url);
  const label = escapeHtml(button.label);
  const linkStyle = [
    `background-color:${COLOR.brandDark}`,
    `border:1px solid ${COLOR.brandDark}`,
    `border-radius:${RADIUS.button}px`,
    `color:${COLOR.brandOnDark}`,
    "display:inline-block",
    `font-family:${FONT_FAMILY}`,
    "font-size:14px",
    "font-weight:600",
    "line-height:14px",
    "padding:14px 28px",
    "text-decoration:none",
    "white-space:nowrap",
  ].join(";");

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
      <tr>
        <td align="center" bgcolor="${COLOR.brandDark}" style="border-radius:${RADIUS.button}px;">
          <a href="${href}" target="_blank" style="${linkStyle}">${label}</a>
        </td>
      </tr>
    </table>`;
}
