// POST /validate
// Verifies a JWT session token and returns current key status from D1.

import type { Env } from '../types/index.js';
import { verifyJwt, hashIp } from '../lib/crypto.js';
import { getKeyByHash, getRecentValidationEvent, updateLastValidated, insertEvent } from '../lib/db.js';
import { jsonResponseWithCors } from '../lib/cors.js';

export async function handleValidate(
  request: Request,
  env: Env
): Promise<Response> {
  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: { session_token?: unknown; device_id?: unknown; platform?: unknown };
  try {
    body = await request.json() as { session_token?: unknown; device_id?: unknown; platform?: unknown };
  } catch {
    return jsonResponseWithCors({ valid: false, error: 'Invalid JSON' }, env.CORS_ORIGIN, 400);
  }

  const sessionToken = typeof body.session_token === 'string' ? body.session_token.trim() : null;
  const deviceId     = typeof body.device_id     === 'string' ? body.device_id.trim()     : null;
  const platform     = body.platform === 'windows' || body.platform === 'mac' ? body.platform : null;

  if (!sessionToken || !deviceId || !platform) {
    return jsonResponseWithCors({ valid: false, error: 'session_token, device_id, and platform are required' }, env.CORS_ORIGIN, 400);
  }

  // ── Verify JWT ──────────────────────────────────────────────────────────────
  const payload = await verifyJwt(sessionToken, env.HMAC_SECRET);

  if (!payload) {
    return jsonResponseWithCors({ valid: false, error: 'Invalid session token' }, env.CORS_ORIGIN, 401);
  }

  if (payload.device_id !== deviceId || payload.platform !== platform) {
    return jsonResponseWithCors({ valid: false, error: 'Token does not match device' }, env.CORS_ORIGIN, 401);
  }

  // ── Check D1 (source of truth) ──────────────────────────────────────────────
  const record = await getKeyByHash(env.DB, payload.key_hash);
  const now    = Math.floor(Date.now() / 1000);
  const ip     = request.headers.get('CF-Connecting-IP') ?? '';
  const ipHash = await hashIp(ip);

  if (!record) {
    return jsonResponseWithCors({ valid: false, error: 'Key not found' }, env.CORS_ORIGIN, 403);
  }

  if (record.status === 'revoked') {
    await insertEvent(env.DB, {
      key_hash:   payload.key_hash,
      event:      'validation_failed',
      device_id:  deviceId,
      platform,
      metadata:   JSON.stringify({ result: 'revoked' }),
      ip_hash:    ipHash,
      created_at: now,
    });
    return jsonResponseWithCors({ valid: false, error: 'Key has been revoked' }, env.CORS_ORIGIN, 403);
  }

  if (record.expires_at && record.expires_at < now) {
    await insertEvent(env.DB, {
      key_hash:   payload.key_hash,
      event:      'validation_failed',
      device_id:  deviceId,
      platform,
      metadata:   JSON.stringify({ result: 'expired' }),
      ip_hash:    ipHash,
      created_at: now,
    });
    return jsonResponseWithCors({ valid: false, error: 'Key has expired' }, env.CORS_ORIGIN, 403);
  }

  // ── Throttle event logging (max 1 app_validated per hour per device) ────────
  const recent = await getRecentValidationEvent(env.DB, payload.key_hash, deviceId);

  if (!recent) {
    await insertEvent(env.DB, {
      key_hash:   payload.key_hash,
      event:      'app_validated',
      device_id:  deviceId,
      platform,
      metadata:   null,
      ip_hash:    ipHash,
      created_at: now,
    });
  }

  // ── Update last_validated_at ────────────────────────────────────────────────
  await updateLastValidated(env.DB, payload.key_hash);

  return jsonResponseWithCors({
    valid:      true,
    tier:       record.tier,
    expires_at: record.expires_at,
  }, env.CORS_ORIGIN);
}
