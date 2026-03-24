// POST /activate
// Validates a license key, binds it to a device, returns a JWT session token.

import type { Env, ActivateBody, Platform } from '../types/index.js';
import { hashKey, hashIp, signJwt } from '../lib/crypto.js';
import { getKeyByHash, setDeviceId, insertEvent } from '../lib/db.js';
import { jsonResponseWithCors } from '../lib/cors.js';


export async function handleActivate(
  request: Request,
  env: Env
): Promise<Response> {
  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: Partial<ActivateBody>;
  try {
    body = await request.json() as Partial<ActivateBody>;
  } catch {
    return jsonResponseWithCors({ error: 'Invalid JSON' }, env.CORS_ORIGIN, 400);
  }

  const key      = typeof body.key       === 'string' ? body.key.trim().toUpperCase() : null;
  const deviceId = typeof body.device_id === 'string' ? body.device_id.trim()        : null;
  const platform = body.platform === 'windows' || body.platform === 'mac' ? body.platform : null;

  if (!key || !deviceId || !platform) {
    return jsonResponseWithCors({ error: 'key, device_id, and platform are required' }, env.CORS_ORIGIN, 400);
  }

  // ── Look up key ─────────────────────────────────────────────────────────────
  const keyHash = await hashKey(key, env.HMAC_SECRET);
  const record  = await getKeyByHash(env.DB, keyHash);

  const now    = Math.floor(Date.now() / 1000);
  const ip     = request.headers.get('CF-Connecting-IP') ?? '';
  const ipHash = await hashIp(ip);

  if (!record) {
    await logFailure(env, keyHash, deviceId, platform, ipHash, now, 'invalid');
    return jsonResponseWithCors({ error: 'Invalid key' }, env.CORS_ORIGIN, 403);
  }

  if (record.status === 'revoked') {
    await logFailure(env, keyHash, deviceId, platform, ipHash, now, 'revoked');
    return jsonResponseWithCors({ error: 'Key has been revoked' }, env.CORS_ORIGIN, 403);
  }

  if (record.status === 'pending_verification') {
    return jsonResponseWithCors({ error: 'Email not verified' }, env.CORS_ORIGIN, 403);
  }

  if (record.expires_at && record.expires_at < now) {
    await logFailure(env, keyHash, deviceId, platform, ipHash, now, 'expired');
    return jsonResponseWithCors({ error: 'Key has expired' }, env.CORS_ORIGIN, 403);
  }

  // ── Device slot check ───────────────────────────────────────────────────────
  const existingDeviceId = platform === 'windows' ? record.windows_device_id : record.mac_device_id;

  if (existingDeviceId && existingDeviceId !== deviceId) {
    await logFailure(env, keyHash, deviceId, platform, ipHash, now, 'device_mismatch');
    return jsonResponseWithCors({ error: 'Key is already activated on another device' }, env.CORS_ORIGIN, 403);
  }

  // ── Bind device ─────────────────────────────────────────────────────────────
  await setDeviceId(env.DB, keyHash, platform as Platform, deviceId, now);

  await insertEvent(env.DB, {
    key_hash:   keyHash,
    event:      'app_activated',
    device_id:  deviceId,
    platform,
    metadata:   null,
    ip_hash:    ipHash,
    created_at: now,
  });

  // ── Issue JWT ───────────────────────────────────────────────────────────────
  const sessionToken = await signJwt({
    key_hash:   keyHash,
    device_id:  deviceId,
    platform,
    tier:       record.tier,
    expires_at: record.expires_at ?? 0,
    issued_at:  now,
  }, env.HMAC_SECRET);

  return jsonResponseWithCors({
    activated:     true,
    session_token: sessionToken,
    tier:          record.tier,
    expires_at:    record.expires_at,
  }, env.CORS_ORIGIN);
}

async function logFailure(
  env: Env,
  keyHash: string,
  deviceId: string,
  platform: string,
  ipHash: string,
  now: number,
  result: string
): Promise<void> {
  await insertEvent(env.DB, {
    key_hash:   keyHash,
    event:      'validation_failed',
    device_id:  deviceId,
    platform,
    metadata:   JSON.stringify({ result }),
    ip_hash:    ipHash,
    created_at: now,
  });
}
