// POST /admin/keys/generate
// Generates up to 50 pre-activated keys with no email requirement.
// Used for social media giveaways, promo codes, etc.
// Users who enter one of these keys in the app can optionally provide
// their name and email at activation time (POST /activate).

import type { Env, KeyTier } from '../../types/index.js';
import { generateKey, hashKey, hashEmail } from '../../lib/crypto.js';
import { insertKey, insertEvent, insertAdminSession } from '../../lib/db.js';
import { jsonResponseWithCors } from '../../lib/cors.js';
import { getAdminEmail } from './shared.js';

const VALID_TIERS: KeyTier[] = ['trial', 'basic', 'standard', 'pro'];

export async function handleAdminGenerateKeys(
  request: Request,
  env: Env
): Promise<Response> {
  let body: { count?: unknown; tier?: unknown; expires_in_days?: unknown; note?: unknown } = {};
  try { body = await request.json() as typeof body; } catch { /* all fields have defaults */ }

  const count         = Math.min(50, Math.max(1, Number(body.count)         || 1));
  const tier          = VALID_TIERS.includes(body.tier as KeyTier) ? (body.tier as KeyTier) : 'trial';
  const expiresInDays = Math.min(365, Math.max(1, Number(body.expires_in_days) || 7));
  const note          = typeof body.note === 'string' ? body.note.trim() || null : null;

  const now        = Math.floor(Date.now() / 1000);
  const expiresAt  = now + expiresInDays * 86400;
  const adminEmail = getAdminEmail(request);

  const keys: string[] = [];

  for (let i = 0; i < count; i++) {
    const key     = generateKey();
    const keyHash = await hashKey(key, env.HMAC_SECRET);

    // Unique placeholder email_hash — won't match any real email hash.
    const emailHash = await hashEmail(`generated:${keyHash}`);

    await insertKey(env.DB, {
      key,
      key_hash:          keyHash,
      email_hash:        emailHash,
      status:            'active',
      tier,
      verify_token:      null,
      verify_token_exp:  null,
      requested_at:      now,
      verified_at:       now,
      activated_at:      null,
      expires_at:        expiresAt,
      windows_device_id: null,
      mac_device_id:     null,
      last_validated_at: null,
      created_at:        now,
      first_name:        null,
      last_name:         null,
      company:           null,
      role:              null,
      tools:             null,
      email:             null,
      admin_notes:       note,
      revoke_note:       null,
    });

    await insertEvent(env.DB, {
      key_hash:   keyHash,
      event:      'key_requested',
      device_id:  null,
      platform:   null,
      metadata:   JSON.stringify({ generated_by: adminEmail, ...(note ? { note } : {}) }),
      ip_hash:    null,
      created_at: now,
    });

    keys.push(key);
  }

  await insertAdminSession(
    env.DB,
    adminEmail,
    `Generated ${count} ${tier} key(s) — ${expiresInDays}d expiry${note ? `: ${note}` : ''}`,
    null
  );

  return jsonResponseWithCors({ keys, count: keys.length }, env.ADMIN_ORIGIN);
}
