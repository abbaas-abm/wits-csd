// Shared by the email sender and the admin preview, so keep it free of
// server-only code.
import { absoluteLink, SITE_URL } from "@/lib/announcements";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface AnnouncementContext {
  text: string;
  linkUrl: string | null;
  linkLabel: string | null;
  eventId: string;
  eventTitle: string;
}

export function renderAnnouncementHtml(name: string, ctx: AnnouncementContext) {
  const body = escapeHtml(ctx.text).replace(/\r?\n/g, "<br />");
  const href = absoluteLink(ctx.linkUrl ?? `/events/${ctx.eventId}`);
  const label = escapeHtml(ctx.linkLabel?.trim() || "View on the platform");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${escapeHtml(ctx.eventTitle)}</title>
<style>
  body { margin: 0; padding: 0; background: #eef2f7; }
  table { border-collapse: collapse; }
  a { text-decoration: none; }
  @media only screen and (max-width: 600px) {
    .wrap { padding: 14px 10px !important; }
    .card { border-radius: 14px !important; }
    .pad { padding-left: 20px !important; padding-right: 20px !important; }
    .h1 { font-size: 21px !important; }
    .btn a { display: block !important; width: 100% !important; box-sizing: border-box !important; padding-left: 0 !important; padding-right: 0 !important; }
  }
</style>
</head>
<body>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;">
    <tr>
      <td align="center" class="wrap" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:#003366;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="height:5px;background:#d9b45b;font-size:0;line-height:0;">&nbsp;</td></tr>
                <tr>
                  <td align="center" class="pad" style="padding:30px 28px 26px;">
                    <p style="margin:0;color:#d9b45b;font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:700;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">Announcement</p>
                    <h1 class="h1" style="margin:10px 0 0;color:#ffffff;font-size:24px;line-height:1.3;font-weight:700;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">${escapeHtml(ctx.eventTitle)}</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="pad" style="padding:30px 28px 28px;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#1f2937;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi ${escapeHtml(name)},</p>
              <p style="margin:0;font-size:15px;line-height:1.7;color:#374151;">${body}</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="btn" style="margin:28px 0 6px;">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(href)}" style="display:inline-block;background:#003366;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:15px 36px;border-radius:999px;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">${label}</a>
                  </td>
                </tr>
              </table>

              <p style="margin:22px 0 0;font-size:14px;line-height:1.7;color:#4b5563;">From the CSD Team</p>
            </td>
          </tr>

          <tr>
            <td align="center" style="border-top:3px solid #d9b45b;background:#003366;padding:20px 28px;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
              <p style="margin:0;color:#ffffff;font-size:12px;line-height:1.6;">University of the Witwatersrand &middot; Centre for Student Development</p>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.6);font-size:11px;">You received this because you registered for ${escapeHtml(ctx.eventTitle)} on <a href="${SITE_URL}" style="color:rgba(255,255,255,0.8);">witscsd.co.za</a>.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
