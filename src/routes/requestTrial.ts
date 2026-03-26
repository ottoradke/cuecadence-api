// POST /request-trial
// Accepts an email, generates a license key, sends a verification email.

import type { Env } from '../types/index.js';
import { generateKey, generateVerifyToken, hashEmail, hashKey, hashIp } from '../lib/crypto.js';
import { getKeyByEmailHash, insertKey, insertEvent } from '../lib/db.js';
import { sendVerificationEmail } from '../lib/email.js';
import { jsonResponseWithCors } from '../lib/cors.js';

const VERIFY_TOKEN_TTL = 60 * 60 * 24; // 24 hours in seconds
const TRIAL_DURATION  = 60 * 60 * 24 * 7; // 7 days in seconds

export async function handleRequestTrial(
  request: Request,
  env: Env
): Promise<Response> {
  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: { email?: unknown; firstName?: unknown; lastName?: unknown; company?: unknown; role?: unknown; tools?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return jsonResponseWithCors({ error: 'Invalid JSON' }, env.CORS_ORIGIN, 400);
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : null;
  if (!email || !email.includes('@')) {
    return jsonResponseWithCors({ error: 'Valid email required' }, env.CORS_ORIGIN, 400);
  }

  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() || null : null;
  const lastName  = typeof body.lastName  === 'string' ? body.lastName.trim()  || null : null;
  const company   = typeof body.company   === 'string' ? body.company.trim()   || null : null;
  const role      = typeof body.role      === 'string' ? body.role.trim()      || null : null;
  const tools     = typeof body.tools     === 'string' ? body.tools.trim()     || null : null;

  // ── Duplicate check ─────────────────────────────────────────────────────────
  const emailHash  = await hashEmail(email);
  const existing   = await getKeyByEmailHash(env.DB, emailHash);
  const now        = Math.floor(Date.now() / 1000);
  const ip         = request.headers.get('CF-Connecting-IP') ?? '';
  const ipHash     = await hashIp(ip);

  if (existing) {
    // Resend the verification email with the existing token (if still valid)
    // or issue a fresh token if the old one has expired.
    const token    = existing.verify_token && existing.verify_token_exp && existing.verify_token_exp > now
      ? existing.verify_token
      : generateVerifyToken();

    if (token !== existing.verify_token) {
      // Token expired — update it in D1
      await env.DB.prepare(
        'UPDATE keys SET verify_token = ?, verify_token_exp = ? WHERE key_hash = ?'
      ).bind(token, now + VERIFY_TOKEN_TTL, existing.key_hash).run();
    }

    const verifyUrl = `https://cuecadence.io/verify?token=${token}`;
    await sendVerificationEmail(env.RESEND_API_KEY, email, verifyUrl);

    await insertEvent(env.DB, {
      key_hash:   existing.key_hash,
      event:      'key_requested',
      device_id:  null,
      platform:   'web',
      metadata:   JSON.stringify({ duplicate: true }),
      ip_hash:    ipHash,
      created_at: now,
    });

    return jsonResponseWithCors({ sent: true }, env.CORS_ORIGIN);
  }

  // ── Create new key ──────────────────────────────────────────────────────────
  const key        = generateKey();
  const keyHash    = await hashKey(key, env.HMAC_SECRET);
  const verifyToken    = generateVerifyToken();
  const verifyTokenExp = now + VERIFY_TOKEN_TTL;
  const expiresAt      = now + TRIAL_DURATION;

  await insertKey(env.DB, {
    key,
    key_hash:          keyHash,
    email_hash:        emailHash,
    status:            'pending_verification',
    tier:              'trial',
    verify_token:      verifyToken,
    verify_token_exp:  verifyTokenExp,
    requested_at:      now,
    verified_at:       null,
    activated_at:      null,
    expires_at:        expiresAt,
    windows_device_id: null,
    mac_device_id:     null,
    last_validated_at: null,
    created_at:        now,
    first_name:        firstName,
    last_name:         lastName,
    company,
    role,
    tools,
  });

  await insertEvent(env.DB, {
    key_hash:   keyHash,
    event:      'key_requested',
    device_id:  null,
    platform:   'web',
    metadata:   null,
    ip_hash:    ipHash,
    created_at: now,
  });

  const verifyUrl = `https://cuecadence.io/verify?token=${verifyToken}`;
  await sendVerificationEmail(env.RESEND_API_KEY, email, verifyUrl);

  return jsonResponseWithCors({ sent: true }, env.CORS_ORIGIN);
}
