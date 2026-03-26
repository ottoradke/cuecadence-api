// POST /admin/keys/:key_hash/verify
// Manually marks a pending key as verified, bypassing the email link.
// Use when a user confirms their identity via another channel.

import type { Env } from '../../types/index.js';
import { getKeyByHash, verifyKeyManually, insertEvent, insertAdminSession } from '../../lib/db.js';
import { jsonResponseWithCors } from '../../lib/cors.js';
import { getAdminEmail } from './shared.js';

export async function handleAdminVerify(
  request: Request,
  env: Env
): Promise<Response> {
  const url   = new URL(request.url);
  const match = url.pathname.match(/^\/admin\/keys\/([^/]+)\/verify$/);
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

  let body: { note?: unknown } = {};
  try { body = await request.json() as typeof body; } catch { /* note is optional */ }
  const note = typeof body.note === 'string' ? body.note.trim() || null : null;

  const adminEmail = getAdminEmail(request);
  const now        = Math.floor(Date.now() / 1000);

  await verifyKeyManually(env.DB, keyHash, now);

  await insertEvent(env.DB, {
    key_hash:   keyHash,
    event:      'email_verified',
    device_id:  null,
    platform:   null,
    metadata:   JSON.stringify({ verified_by: adminEmail, manual: true, ...(note ? { note } : {}) }),
    ip_hash:    null,
    created_at: now,
  });

  await insertAdminSession(
    env.DB,
    adminEmail,
    `Manually verified key ${keyHash}${note ? `: ${note}` : ''}`,
    keyHash
  );

  return jsonResponseWithCors({ verified: true }, env.ADMIN_ORIGIN);
}
