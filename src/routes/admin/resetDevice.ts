// POST /admin/keys/:key_hash/reset-device

import type { Env, AdminResetDeviceBody } from '../../types/index.js';
import { getKeyByHash, resetDeviceSlot, insertEvent, insertAdminSession } from '../../lib/db.js';
import { jsonResponseWithCors } from '../../lib/cors.js';
import { getAdminEmail } from './shared.js';

export async function handleAdminResetDevice(
  request: Request,
  env: Env
): Promise<Response> {
  const url   = new URL(request.url);
  const match = url.pathname.match(/^\/admin\/keys\/([^/]+)\/reset-device$/);
  if (!match) return jsonResponseWithCors({ error: 'Not found' }, env.ADMIN_ORIGIN, 404);
  const keyHash = match[1];

  let body: Partial<AdminResetDeviceBody>;
  try {
    body = await request.json() as Partial<AdminResetDeviceBody>;
  } catch {
    return jsonResponseWithCors({ error: 'Invalid JSON' }, env.ADMIN_ORIGIN, 400);
  }

  const platform = body.platform === 'windows' || body.platform === 'mac' ? body.platform : null;
  if (!platform) {
    return jsonResponseWithCors({ error: 'platform is required (windows or mac)' }, env.ADMIN_ORIGIN, 400);
  }

  const record = await getKeyByHash(env.DB, keyHash);
  if (!record) return jsonResponseWithCors({ error: 'Key not found' }, env.ADMIN_ORIGIN, 404);

  const adminEmail = getAdminEmail(request);
  const now        = Math.floor(Date.now() / 1000);

  await resetDeviceSlot(env.DB, keyHash, platform);

  await insertEvent(env.DB, {
    key_hash:   keyHash,
    event:      'device_reset',
    device_id:  null,
    platform,
    metadata:   JSON.stringify({ reset_by: adminEmail }),
    ip_hash:    null,
    created_at: now,
  });

  await insertAdminSession(env.DB, adminEmail, `Reset ${platform} device for key ${keyHash}`, keyHash);

  return jsonResponseWithCors({ reset: true }, env.ADMIN_ORIGIN);
}
