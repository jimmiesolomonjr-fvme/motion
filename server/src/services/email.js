import { Resend } from 'resend';
import config from '../config/index.js';

const resend = config.resend.apiKey ? new Resend(config.resend.apiKey) : null;

/**
 * Wraps HTML content in Motion's branded email template.
 * Table-based layout with inline styles for email client compatibility.
 */
export function brandedTemplate(bodyHtml, preheader = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Motion</title>
</head>
<body style="margin:0;padding:0;background-color:#0A0A0A;font-family:Arial,Helvetica,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0A0A;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#1A1A1A;border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding:32px 24px 16px;">
              <h1 style="margin:0;font-size:28px;font-weight:800;letter-spacing:4px;color:#D4AF37;">MOTION</h1>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding:0 24px;">
              <div style="height:1px;background:linear-gradient(to right,transparent,#D4AF37,transparent);"></div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:24px;color:#E5E5E5;font-size:15px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:0 24px;">
              <div style="height:1px;background:linear-gradient(to right,transparent,#333,transparent);"></div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 24px 28px;color:#666;font-size:12px;">
              &copy; ${new Date().getFullYear()} Motion &mdash; Move Different
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Send a single email via Resend.
 * Gracefully returns { success: false } when API key is not configured.
 */
export async function sendEmail({ to, subject, html }) {
  if (!resend) {
    console.warn('Resend API key not configured — skipping email send');
    return { success: false, error: 'Email not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: config.resend.from,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  } catch (err) {
    console.error('Email send failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Send branded emails in batches (10 at a time, 1s delay between batches).
 * Returns { sent, failed, errors }.
 */
export async function sendBulkEmails({ users, subject, bodyHtml, preheader }) {
  const html = brandedTemplate(bodyHtml, preheader);
  let sent = 0;
  let failed = 0;
  const errors = [];

  const BATCH_SIZE = 10;
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map((user) =>
        sendEmail({ to: user.email, subject, html })
      )
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        sent++;
      } else {
        failed++;
        const errMsg = result.status === 'fulfilled'
          ? result.value.error
          : result.reason?.message;
        if (errMsg) errors.push(errMsg);
      }
    }

    // Rate-limit delay between batches (skip after last batch)
    if (i + BATCH_SIZE < users.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return { sent, failed, errors };
}
