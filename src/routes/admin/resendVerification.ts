// POST /admin/keys/:key_hash/resend-verification
// Re-sends the verification email for a pending key.
// Requires that the key has an email stored (keys created after migration 0003).

import type { Env } from '../../types/index.js';
import { getKeyByHash, insertAdminSession } from '../../lib/db.js';
import { sendVerificationEmail } from '../../lib/email.js';
import { generateVerifyToken } from '../../lib/crypto.js';
import { jsonResponseWithCors } from '../../lib/cors.js';
import { getAdminEmail } from './shared.js';

const VERIFY_TOKEN_TTL = 60 * 60 * 24; // 24 hours

export async function handleAdminResendVerification(
  request: Request,
  env: Env
): Promise<Response> {
  const url   = new URL(request.url);
  const match = url.pathname.match(/^\/admin\/keys\/([^/]+)\/resend-verification$/);
  if (!match) return jsonResponseWithCors({ error: 'Not found' }, env.ADMIN_ORIGIN, 404);
  const keyHash = match[1];

  const record = await getKeyByHash(env.DB, keyHash);
  if (!record) return jsonResponseWithCors({ error: 'Key not found' }, env.ADMIN_ORIGIN, 404);

  if (record.status !== 'pending_verification') {
    return jsonResponseWithCors(
      { error: 'Key is not pending verification' },
      env.ADMIN_ORIGIN,
      400
    );
  }

  if (!record.email) {
    return jsonResponseWithCors(
      { error: 'No email address stored for this key — it was created before email storage was added' },
      env.ADMIN_ORIGIN,
      400
    );
  }

  const now = Math.floor(Date.now() / 1000);

  // Reuse existing token if still valid, otherwise issue a fresh one
  const token = record.verify_token && record.verify_token_exp && record.verify_token_exp > now
    ? record.verify_token
    : generateVerifyToken();

  if (token !== record.verify_token) {
    await env.DB.prepare(
      'UPDATE keys SET verify_token = ?, verify_token_exp = ? WHERE key_hash = ?'
    ).bind(token, now + VERIFY_TOKEN_TTL, keyHash).run();
  }

  const verifyUrl = `https://cuecadence.io/verify?token=${token}`;
  await sendVerificationEmail(env.RESEND_API_KEY, record.email, verifyUrl);

  const adminEmail = getAdminEmail(request);
  await insertAdminSession(env.DB, adminEmail, `Resent verification email for key ${keyHash}`, keyHash);

  return jsonResponseWithCors({ sent: true }, env.ADMIN_ORIGIN);
}
