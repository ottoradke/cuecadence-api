// POST /admin/keys/:key_hash/revoke

import type { Env } from '../../types/index.js';
import { getKeyByHash, revokeKey, insertEvent, insertAdminSession } from '../../lib/db.js';
import { jsonResponseWithCors } from '../../lib/cors.js';
import { getAdminEmail } from './shared.js';

export async function handleAdminRevoke(
  request: Request,
  env: Env
): Promise<Response> {
  const url   = new URL(request.url);
  const match = url.pathname.match(/^\/admin\/keys\/([^/]+)\/revoke$/);
  if (!match) return jsonResponseWithCors({ error: 'Not found' }, env.ADMIN_ORIGIN, 404);
  const keyHash = match[1];

  const record = await getKeyByHash(env.DB, keyHash);
  if (!record) return jsonResponseWithCors({ error: 'Key not found' }, env.ADMIN_ORIGIN, 404);

  if (record.status === 'revoked') {
    return jsonResponseWithCors({ error: 'Key is already revoked' }, env.ADMIN_ORIGIN, 400);
  }

  const adminEmail = getAdminEmail(request);
  const now        = Math.floor(Date.now() / 1000);

  await revokeKey(env.DB, keyHash);

  await insertEvent(env.DB, {
    key_hash:   keyHash,
    event:      'key_revoked',
    device_id:  null,
    platform:   null,
    metadata:   JSON.stringify({ revoked_by: adminEmail }),
    ip_hash:    null,
    created_at: now,
  });

  await insertAdminSession(env.DB, adminEmail, `Revoked key ${keyHash}`, keyHash);

  return jsonResponseWithCors({ revoked: true }, env.ADMIN_ORIGIN);
}
