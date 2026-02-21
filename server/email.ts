import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

async function getUncachableResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail,
  };
}

export async function sendVerificationEmail(toEmail: string, firstName: string, verificationToken: string) {
  const { client, fromEmail } = await getUncachableResendClient();

  const baseUrl = getBaseUrl();
  const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;
  const sender = 'ScribeAI <noreply@email.fant-app.com>';

  console.log(`[email] Sending verification email to=${toEmail}, from=${sender}, baseUrl=${baseUrl}`);

  const result = await client.emails.send({
    from: sender,
    to: toEmail,
    subject: 'Verify your ScribeAI account',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; color: #1a1a1a; margin-bottom: 24px;">Welcome to ScribeAI, ${firstName}!</h1>
        <p style="font-size: 16px; color: #4a4a4a; line-height: 1.6; margin-bottom: 24px;">
          Thanks for signing up. Please verify your email address by clicking the button below to activate your account and start your 7-day free trial.
        </p>
        <a href="${verificationUrl}" style="display: inline-block; background: #18181b; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600;">
          Verify My Email
        </a>
        <p style="font-size: 14px; color: #888; margin-top: 32px; line-height: 1.5;">
          This link expires in 24 hours. If you didn't create a ScribeAI account, you can safely ignore this email.
        </p>
        <p style="font-size: 12px; color: #aaa; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
          ScribeAI - Session Transcription & Analysis
        </p>
      </div>
    `,
  });

  console.log(`[email] Verification email result:`, JSON.stringify(result));
}

export async function sendPasswordResetEmail(toEmail: string, firstName: string, resetToken: string) {
  const { client, fromEmail } = await getUncachableResendClient();

  const baseUrl = getBaseUrl();
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
  const sender = 'ScribeAI <noreply@email.fant-app.com>';

  console.log(`[email] Sending password reset email to=${toEmail}, from=${sender}, baseUrl=${baseUrl}`);

  const result = await client.emails.send({
    from: sender,
    to: toEmail,
    subject: 'Reset your ScribeAI password',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; color: #1a1a1a; margin-bottom: 24px;">Password Reset</h1>
        <p style="font-size: 16px; color: #4a4a4a; line-height: 1.6; margin-bottom: 24px;">
          Hi ${firstName}, we received a request to reset your password. Click the button below to choose a new password.
        </p>
        <a href="${resetUrl}" style="display: inline-block; background: #18181b; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600;">
          Reset Password
        </a>
        <p style="font-size: 14px; color: #888; margin-top: 32px; line-height: 1.5;">
          This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
        <p style="font-size: 12px; color: #aaa; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
          ScribeAI - Session Transcription & Analysis
        </p>
      </div>
    `,
  });

  console.log(`[email] Password reset email result:`, JSON.stringify(result));
}

export async function sendMeetingCompletedEmail(
  toEmail: string,
  firstName: string,
  meetingTitle: string,
  meetingDate: string | Date | null,
  meetingId: number,
  actionItems: { content: string; assignee: string | null }[]
) {
  try {
    const { client } = await getUncachableResendClient();
    const baseUrl = getBaseUrl();
    const meetingUrl = `${baseUrl}/meeting/${meetingId}`;
    const sender = 'ScribeAI <noreply@email.fant-app.com>';

    const dateStr = meetingDate
      ? new Date(meetingDate).toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" })
      : "Not specified";

    let actionItemsHtml = "";
    if (actionItems.length > 0) {
      const items = actionItems
        .map(
          (item, i) =>
            `<tr>
              <td style="padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 14px; color: #333;">${i + 1}. ${item.content}</td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 14px; color: #666; white-space: nowrap;">${item.assignee || "Unassigned"}</td>
            </tr>`
        )
        .join("");

      actionItemsHtml = `
        <h2 style="font-size: 18px; color: #1a1a1a; margin: 28px 0 12px;">Action Items</h2>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #eee; border-radius: 8px;">
          <thead>
            <tr style="background: #f9f9f9;">
              <th style="padding: 10px 12px; text-align: left; font-size: 13px; color: #666; border-bottom: 2px solid #eee;">Task</th>
              <th style="padding: 10px 12px; text-align: left; font-size: 13px; color: #666; border-bottom: 2px solid #eee;">Assigned To</th>
            </tr>
          </thead>
          <tbody>${items}</tbody>
        </table>
      `;
    } else {
      actionItemsHtml = `<p style="font-size: 14px; color: #888; margin-top: 20px;">No action items were identified for this session.</p>`;
    }

    const result = await client.emails.send({
      from: sender,
      to: toEmail,
      subject: `Session Ready: ${meetingTitle}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="font-size: 24px; color: #1a1a1a; margin-bottom: 8px;">Your session has been processed</h1>
          <p style="font-size: 16px; color: #4a4a4a; line-height: 1.6; margin-bottom: 24px;">
            Hi ${firstName}, your session analysis is ready to review.
          </p>

          <div style="background: #f9f9f9; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px; font-size: 14px;"><strong>Session:</strong> ${meetingTitle}</p>
            <p style="margin: 0; font-size: 14px;"><strong>Date:</strong> ${dateStr}</p>
          </div>

          ${actionItemsHtml}

          <div style="margin-top: 32px;">
            <a href="${meetingUrl}" style="display: inline-block; background: #18181b; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600;">
              View Full Report
            </a>
          </div>

          <p style="font-size: 12px; color: #aaa; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
            ScribeAI - Session Transcription & Analysis
          </p>
        </div>
      `,
    });

    console.log(`[email] Session completed email sent to=${toEmail}, result:`, JSON.stringify(result));
  } catch (err) {
    console.error("[email] Failed to send session completed email:", err);
  }
}

function getBaseUrl(): string {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL;
  }
  if (process.env.REPLIT_DEPLOYMENT && process.env.REPLIT_DOMAINS) {
    const domain = process.env.REPLIT_DOMAINS.split(",")[0];
    return `https://${domain}`;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  }
  return 'http://localhost:5000';
}
