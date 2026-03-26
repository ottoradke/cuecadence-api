import type { D1Database } from '@cloudflare/workers-types';
import type { KeyRecord, KeyEvent, Platform } from '../types/index.js';

// ── keys table ────────────────────────────────────────────────────────────────

export async function getKeyByHash(
  db: D1Database,
  keyHash: string
): Promise<KeyRecord | null> {
  return db.prepare('SELECT * FROM keys WHERE key_hash = ?')
    .bind(keyHash)
    .first<KeyRecord>();
}

export async function getKeyByVerifyToken(
  db: D1Database,
  token: string
): Promise<KeyRecord | null> {
  return db.prepare('SELECT * FROM keys WHERE verify_token = ?')
    .bind(token)
    .first<KeyRecord>();
}

export async function getKeyByEmailHash(
  db: D1Database,
  emailHash: string
): Promise<KeyRecord | null> {
  return db.prepare(
    "SELECT * FROM keys WHERE email_hash = ? AND status != 'revoked' ORDER BY created_at DESC LIMIT 1"
  ).bind(emailHash).first<KeyRecord>();
}

export async function insertKey(
  db: D1Database,
  record: Omit<KeyRecord, 'id'>
): Promise<void> {
  await db.prepare(`
    INSERT INTO keys (
      key, key_hash, email_hash, status, tier,
      verify_token, verify_token_exp,
      requested_at, verified_at, activated_at,
      expires_at, windows_device_id, mac_device_id,
      last_validated_at, created_at,
      first_name, last_name, company, role, tools,
      email
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.key, record.key_hash, record.email_hash,
    record.status, record.tier,
    record.verify_token, record.verify_token_exp,
    record.requested_at, record.verified_at, record.activated_at,
    record.expires_at, record.windows_device_id, record.mac_device_id,
    record.last_validated_at, record.created_at,
    record.first_name ?? null, record.last_name ?? null,
    record.company ?? null, record.role ?? null, record.tools ?? null,
    record.email ?? null
  ).run();
}

export async function activateKey(
  db: D1Database,
  keyHash: string,
  expiresAt: number
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`
    UPDATE keys
    SET status = 'active',
        verified_at = ?,
        expires_at = ?,
        verify_token = NULL,
        verify_token_exp = NULL
    WHERE key_hash = ?
  `).bind(now, expiresAt, keyHash).run();
}

export async function setDeviceId(
  db: D1Database,
  keyHash: string,
  platform: Platform,
  deviceId: string,
  activatedAt: number
): Promise<void> {
  const col = platform === 'windows' ? 'windows_device_id' : 'mac_device_id';
  await db.prepare(`
    UPDATE keys
    SET ${col} = ?,
        activated_at = COALESCE(activated_at, ?)
    WHERE key_hash = ?
  `).bind(deviceId, activatedAt, keyHash).run();
}

export async function updateLastValidated(
  db: D1Database,
  keyHash: string
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.prepare('UPDATE keys SET last_validated_at = ? WHERE key_hash = ?')
    .bind(now, keyHash).run();
}

export async function updateExpiry(
  db: D1Database,
  keyHash: string,
  expiresAt: number
): Promise<void> {
  await db.prepare('UPDATE keys SET expires_at = ? WHERE key_hash = ?')
    .bind(expiresAt, keyHash).run();
}

export async function revokeKey(db: D1Database, keyHash: string): Promise<void> {
  await db.prepare("UPDATE keys SET status = 'revoked' WHERE key_hash = ?")
    .bind(keyHash).run();
}

export async function revokeKeyWithNote(
  db: D1Database,
  keyHash: string,
  note: string
): Promise<void> {
  await db.prepare("UPDATE keys SET status = 'revoked', revoke_note = ? WHERE key_hash = ?")
    .bind(note, keyHash).run();
}

export async function updateAdminNotes(
  db: D1Database,
  keyHash: string,
  notes: string
): Promise<void> {
  await db.prepare('UPDATE keys SET admin_notes = ? WHERE key_hash = ?')
    .bind(notes, keyHash).run();
}

export async function verifyKeyManually(
  db: D1Database,
  keyHash: string,
  now: number
): Promise<void> {
  await db.prepare(`
    UPDATE keys
    SET status = 'active',
        verified_at = ?,
        verify_token = NULL,
        verify_token_exp = NULL
    WHERE key_hash = ?
  `).bind(now, keyHash).run();
}

export async function resetDeviceSlot(
  db: D1Database,
  keyHash: string,
  platform: Platform
): Promise<void> {
  const col = platform === 'windows' ? 'windows_device_id' : 'mac_device_id';
  await db.prepare(`UPDATE keys SET ${col} = NULL WHERE key_hash = ?`)
    .bind(keyHash).run();
}

// ── key_events table ──────────────────────────────────────────────────────────

export async function insertEvent(
  db: D1Database,
  event: Omit<KeyEvent, 'id'>
): Promise<void> {
  await db.prepare(`
    INSERT INTO key_events (key_hash, event, device_id, platform, metadata, ip_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    event.key_hash, event.event, event.device_id,
    event.platform, event.metadata, event.ip_hash, event.created_at
  ).run();
}

export async function getRecentValidationEvent(
  db: D1Database,
  keyHash: string,
  deviceId: string,
  windowSeconds = 3600
): Promise<KeyEvent | null> {
  const since = Math.floor(Date.now() / 1000) - windowSeconds;
  return db.prepare(`
    SELECT * FROM key_events
    WHERE key_hash = ? AND event = 'app_validated' AND device_id = ? AND created_at > ?
    ORDER BY created_at DESC LIMIT 1
  `).bind(keyHash, deviceId, since).first<KeyEvent>();
}

export async function getKeyEvents(
  db: D1Database,
  keyHash: string
): Promise<KeyEvent[]> {
  const result = await db.prepare(
    'SELECT * FROM key_events WHERE key_hash = ? ORDER BY created_at DESC'
  ).bind(keyHash).all<KeyEvent>();
  return result.results;
}

// ── admin_sessions table ──────────────────────────────────────────────────────

export async function insertAdminSession(
  db: D1Database,
  adminEmail: string,
  action: string,
  keyHash: string | null
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`
    INSERT INTO admin_sessions (admin_email, action, key_hash, created_at)
    VALUES (?, ?, ?, ?)
  `).bind(adminEmail, action, keyHash, now).run();
}
