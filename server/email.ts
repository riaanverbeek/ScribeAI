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

  await client.emails.send({
    from: fromEmail || 'ScribeAI <noreply@resend.dev>',
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
          ScribeAI - Meeting Transcription & Analysis
        </p>
      </div>
    `,
  });
}

function getBaseUrl(): string {
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  }
  return 'http://localhost:5000';
}
