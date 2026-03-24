// PATCH /admin/keys/:key_hash
// Updates expires_at and/or tier for a key.

import type { Env, AdminUpdateBody } from '../../types/index.js';
import { getKeyByHash, updateExpiry, insertEvent, insertAdminSession } from '../../lib/db.js';
import { jsonResponse } from '../../lib/cors.js';
import { getAdminEmail } from './shared.js';

export async function handleAdminUpdate(
  request: Request,
  env: Env
): Promise<Response> {
  const url      = new URL(request.url);
  const match    = url.pathname.match(/^\/admin\/keys\/([^/]+)$/);
  if (!match) return jsonResponse({ error: 'Not found' }, 404);
  const keyHash = match[1];

  let body: Partial<AdminUpdateBody>;
  try {
    body = await request.json() as Partial<AdminUpdateBody>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const record = await getKeyByHash(env.DB, keyHash);
  if (!record) return jsonResponse({ error: 'Key not found' }, 404);

  const adminEmail = getAdminEmail(request);
  const now        = Math.floor(Date.now() / 1000);

  // ── Update expiry ───────────────────────────────────────────────────────────
  if (typeof body.expires_at === 'number') {
    await updateExpiry(env.DB, keyHash, body.expires_at);

    await insertEvent(env.DB, {
      key_hash:   keyHash,
      event:      'expiry_changed',
      device_id:  null,
      platform:   null,
      metadata:   JSON.stringify({
        old_expiry:  record.expires_at,
        new_expiry:  body.expires_at,
        changed_by:  adminEmail,
      }),
      ip_hash:    null,
      created_at: now,
    });

    await insertAdminSession(env.DB, adminEmail, `Changed expiry for key ${keyHash}`, keyHash);
  }

  // ── Update tier ─────────────────────────────────────────────────────────────
  if (body.tier && body.tier !== record.tier) {
    await env.DB.prepare("UPDATE keys SET tier = ? WHERE key_hash = ?")
      .bind(body.tier, keyHash).run();

    await insertEvent(env.DB, {
      key_hash:   keyHash,
      event:      'tier_changed',
      device_id:  null,
      platform:   null,
      metadata:   JSON.stringify({ old_tier: record.tier, new_tier: body.tier }),
      ip_hash:    null,
      created_at: now,
    });

    await insertAdminSession(env.DB, adminEmail, `Changed tier for key ${keyHash} from ${record.tier} to ${body.tier}`, keyHash);
  }

  const updated = await getKeyByHash(env.DB, keyHash);
  return jsonResponse({ key: updated });
}
