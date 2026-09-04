import { COLOR, CONTENT_WIDTH, FONT_FAMILY } from "../theme";
import { escapeHtml, truncateForPreheader } from "../utils";

export interface EmailShellInput {
  bodyHtml: string;
  preheaderText: string;
}

// Only what genuinely can't be inlined lives here: -webkit-text-size-adjust,
// Outlook's mso-table-* spacing fixes, the body{margin:0} reset, and one
// mobile media query. Everything visually load-bearing (colors, fonts,
// padding) is inline on elements instead, since Gmail strips <head><style>
// in some rendering contexts.
function renderHeadStyles(): string {
  return `
    <style>
      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }
      a { text-decoration: none; }
      @media screen and (max-width: 600px) {
        .docpulse-email-container { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; }
        .docpulse-email-header-padding { padding: 24px 20px !important; }
        .docpulse-email-content-padding { padding: 24px 20px 8px !important; }
        .docpulse-email-footer-padding { padding-left: 20px !important; padding-right: 20px !important; }
      }
    </style>`;
}

// Hidden inbox-preview snippet, auto-derived from the email's own first
// paragraph — no new backend data required. The zero-width-joiner spacer
// stops Gmail/Outlook's snippet-scraper from spilling real body text
// (heading/greeting) into the preview line.
function renderPreheader(preheaderText: string): string {
  const text = escapeHtml(truncateForPreheader(preheaderText));
  const hideStyle = [
    "display:none",
    "max-height:0",
    "max-width:0",
    "opacity:0",
    "overflow:hidden",
    "mso-hide:all",
    "font-size:1px",
    "line-height:1px",
    `color:${COLOR.pageBackground}`,
  ].join(";");
  const spacer = "&nbsp;&zwnj;".repeat(40);

  return `<div style="${hideStyle}">${text}${spacer}</div>`;
}

export function renderEmailShell(input: EmailShellInput): string {
  const containerStyle = [
    `width:${CONTENT_WIDTH}px`,
    `max-width:${CONTENT_WIDTH}px`,
    `background-color:${COLOR.surface}`,
    `border:1px solid ${COLOR.border}`,
    "border-radius:12px",
    "overflow:hidden",
  ].join(";");

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<!--[if mso]>
<noscript><xml>
<o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings>
</xml></noscript>
<![endif]-->
<title>DocPulse</title>
${renderHeadStyles()}
</head>
<body style="margin:0;padding:0;background-color:${COLOR.pageBackground};font-family:${FONT_FAMILY};">
${renderPreheader(input.preheaderText)}
<table
  role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  bgcolor="${COLOR.pageBackground}" style="background-color:${COLOR.pageBackground};"
>
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table
        role="presentation" class="docpulse-email-container" width="${CONTENT_WIDTH}"
        cellpadding="0" cellspacing="0" border="0" align="center"
        bgcolor="${COLOR.surface}" style="${containerStyle}"
      >
        <tr>
          <td>${input.bodyHtml}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
