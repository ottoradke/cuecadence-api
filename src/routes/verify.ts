// POST /verify
// Validates the email verification token and activates the key record.

import type { Env } from '../types/index.js';
import { hashIp } from '../lib/crypto.js';
import { getKeyByVerifyToken, activateKey, insertEvent } from '../lib/db.js';
import { sendKeyConfirmationEmail } from '../lib/email.js';
import { jsonResponseWithCors } from '../lib/cors.js';

export async function handleVerify(
  request: Request,
  env: Env
): Promise<Response> {
  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: { token?: unknown; email?: unknown };
  try {
    body = await request.json() as { token?: unknown; email?: unknown };
  } catch {
    return jsonResponseWithCors({ error: 'Invalid JSON' }, env.CORS_ORIGIN, 400);
  }

  const token = typeof body.token === 'string' ? body.token.trim() : null;
  if (!token) {
    return jsonResponseWithCors({ error: 'Token required' }, env.CORS_ORIGIN, 400);
  }

  // Email is optional — used to send the key confirmation email.
  // The verify page on cuecadence-web should pass it if available.
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : null;

  // ── Look up key ─────────────────────────────────────────────────────────────
  const record = await getKeyByVerifyToken(env.DB, token);

  if (!record) {
    return jsonResponseWithCors({ error: 'Invalid or expired token' }, env.CORS_ORIGIN, 400);
  }

  const now = Math.floor(Date.now() / 1000);

  if (record.verify_token_exp && record.verify_token_exp < now) {
    return jsonResponseWithCors({ error: 'Invalid or expired token' }, env.CORS_ORIGIN, 400);
  }

  if (record.status !== 'pending_verification') {
    return jsonResponseWithCors({ error: 'Invalid or expired token' }, env.CORS_ORIGIN, 400);
  }

  // ── Activate key — trial clock starts at verification ───────────────────────
  const TRIAL_DURATION = 60 * 60 * 24 * 14; // 14 days
  const expiresAt = now + TRIAL_DURATION;
  await activateKey(env.DB, record.key_hash, expiresAt);

  const ip     = request.headers.get('CF-Connecting-IP') ?? '';
  const ipHash = await hashIp(ip);

  await insertEvent(env.DB, {
    key_hash:   record.key_hash,
    event:      'email_verified',
    device_id:  null,
    platform:   'web',
    metadata:   null,
    ip_hash:    ipHash,
    created_at: now,
  });

  // ── Send confirmation email (if email provided) ─────────────────────────────
  if (email) {
    await sendKeyConfirmationEmail(env.RESEND_API_KEY, email, record.key);
  }

  return jsonResponseWithCors({ verified: true, key: record.key }, env.CORS_ORIGIN);
}
