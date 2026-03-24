-- CueCadence API — Initial Schema
-- Migration: 0001_initial
-- Run locally:  npm run db:migrate:local
-- Run remotely: npm run db:migrate

-- ── keys ─────────────────────────────────────────────────────────────────────
-- One row per license key. Source of truth for status, tier, and expiry.

CREATE TABLE IF NOT EXISTS keys (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,

  -- The user-facing key (CCAD-XXXX-XXXX-XXXX). Stored for support lookups.
  key                TEXT NOT NULL UNIQUE,

  -- HMAC-SHA256 of the key. Used for all programmatic lookups.
  key_hash           TEXT NOT NULL UNIQUE,

  -- SHA-256 of lowercased email. Privacy-safe duplicate detection.
  email_hash         TEXT NOT NULL,

  -- pending_verification | active | expired | revoked
  status             TEXT NOT NULL DEFAULT 'pending_verification',

  -- trial | basic | standard | pro
  tier               TEXT NOT NULL DEFAULT 'trial',

  -- One-time token for the email magic link. Nulled after use.
  verify_token       TEXT,

  -- Unix timestamp. Token expires 24 hours after issuance.
  verify_token_exp   INTEGER,

  -- Lifecycle timestamps. Set once, never overwritten.
  requested_at       INTEGER NOT NULL,
  verified_at        INTEGER,     -- null until email verified
  activated_at       INTEGER,     -- null until first in-app activation

  -- Admin-adjustable expiry. Always returned to the app on validation.
  expires_at         INTEGER,

  -- Device fingerprints. One seat per platform.
  windows_device_id  TEXT,
  mac_device_id      TEXT,

  -- Last successful app validation. Used for grace period calculation.
  last_validated_at  INTEGER,

  created_at         INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_keys_key_hash   ON keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_keys_email_hash ON keys(email_hash);
CREATE INDEX IF NOT EXISTS idx_keys_status     ON keys(status);
CREATE INDEX IF NOT EXISTS idx_keys_expires_at ON keys(expires_at);

-- ── key_events ────────────────────────────────────────────────────────────────
-- Append-only lifecycle event log. Never update or delete rows.

CREATE TABLE IF NOT EXISTS key_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,

  -- FK to keys.key_hash
  key_hash    TEXT NOT NULL,

  -- Event type. One of:
  --   key_requested     - email submitted, key record created
  --   email_verified    - magic link clicked, key activated
  --   app_activated     - first in-app key entry + validation
  --   app_validated     - per-launch validation (throttled: max 1/hr/device)
  --   expiry_changed    - admin updated expires_at
  --   tier_changed      - tier upgraded or downgraded
  --   key_revoked       - admin revoked the key
  --   device_reset      - admin cleared a device slot
  --   validation_failed - failed validation attempt
  event       TEXT NOT NULL,

  -- Device fingerprint, if applicable. Null for server-side events.
  device_id   TEXT,

  -- windows | mac | web | null
  platform    TEXT,

  -- JSON string. Extra context varies by event type:
  --   expiry_changed:    { old_expiry, new_expiry, changed_by }
  --   tier_changed:      { old_tier, new_tier }
  --   validation_failed: { result }   (expired|invalid|device_mismatch|revoked)
  --   key_requested:     { duplicate: true } if resent to existing email
  metadata    TEXT,

  -- Hashed IP for abuse detection. Not linked to personal data.
  ip_hash     TEXT,

  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_key_events_key_hash   ON key_events(key_hash);
CREATE INDEX IF NOT EXISTS idx_key_events_event       ON key_events(event);
CREATE INDEX IF NOT EXISTS idx_key_events_created_at  ON key_events(created_at);

-- ── admin_sessions ────────────────────────────────────────────────────────────
-- Audit log for admin actions. One row per meaningful admin action.

CREATE TABLE IF NOT EXISTS admin_sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Email of the Cloudflare Access-authenticated admin
  admin_email  TEXT NOT NULL,

  -- Human-readable description of the action taken
  action       TEXT NOT NULL,

  -- Key affected by the action, if any
  key_hash     TEXT,

  created_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_key_hash  ON admin_sessions(key_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_created_at ON admin_sessions(created_at);
