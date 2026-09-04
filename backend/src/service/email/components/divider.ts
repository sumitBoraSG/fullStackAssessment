import { COLOR } from "../theme";

export function renderDivider(): string {
  const barStyle = `height:1px;line-height:1px;font-size:1px;background-color:${COLOR.border};`;

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:0;">
          <div style="${barStyle}">&nbsp;</div>
        </td>
      </tr>
    </table>`;
}
