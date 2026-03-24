// Resend email integration.
// Docs: https://resend.com/docs/api-reference/emails/send-email

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_ADDRESS   = 'CueCadence <hello@cloudflash.com>';

async function sendEmail(
  apiKey: string,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

// ── Verification email ────────────────────────────────────────────────────────

export async function sendVerificationEmail(
  apiKey: string,
  to: string,
  verifyUrl: string
): Promise<void> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1A1A2E;">
      <h2 style="color: #1F4B8E;">Verify your email to activate your CueCadence trial</h2>
      <p>Click the button below to verify your email and receive your license key.</p>
      <p>
        <a href="${verifyUrl}"
           style="display:inline-block; background:#1F4B8E; color:#fff;
                  padding:12px 24px; border-radius:6px; text-decoration:none;
                  font-weight:bold;">
          Verify Email &amp; Get My Key
        </a>
      </p>
      <p style="color:#5A6472; font-size:13px;">
        This link expires in 24 hours. If you didn't request a CueCadence trial,
        you can safely ignore this email.
      </p>
    </div>
  `;

  await sendEmail(apiKey, to, 'Verify your email — CueCadence trial', html);
}

// ── Key confirmation email ────────────────────────────────────────────────────

export async function sendKeyConfirmationEmail(
  apiKey: string,
  to: string,
  licenseKey: string
): Promise<void> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1A1A2E;">
      <h2 style="color: #1F4B8E;">Your CueCadence license key</h2>
      <p>Here's your key for safekeeping:</p>
      <div style="background:#F0F4F8; border:1px solid #C0CDD8; border-radius:6px;
                  padding:16px; font-family:monospace; font-size:20px;
                  letter-spacing:2px; text-align:center; color:#1A3A5C;">
        ${licenseKey}
      </div>
      <p>To activate, open CueCadence and paste this key when prompted.</p>
      <p style="color:#5A6472; font-size:13px;">
        Your 7-day free trial starts today. Download links are available at
        <a href="https://cuecadence.io" style="color:#1F4B8E;">cuecadence.io</a>.
      </p>
    </div>
  `;

  await sendEmail(apiKey, to, 'Your CueCadence license key', html);
}
