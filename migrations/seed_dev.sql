-- CueCadence Dev Seed Data
-- Seven users showcasing all key states and admin features.
-- Run: npx wrangler d1 execute cuecadence-keys --remote --file=migrations/seed_dev.sql
-- WARNING: Development only. Do not run against a database with real user data.
--
-- All timestamps relative to 2026-03-26 00:00:00 UTC (1774483200).

-- ── 1. Diana Prince — Active Trial, expiring in 9 days ──────────────────────

INSERT OR IGNORE INTO keys
  (key, key_hash, email_hash, email, first_name, last_name, company, role,
   status, tier, requested_at, verified_at, activated_at, expires_at,
   windows_device_id, last_validated_at, created_at)
VALUES (
  'CCAD-DIAN-PRIN-T22X',
  'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1',
  '1111111111111111111111111111111111111111111111111111111111111111',
  'diana@themyscira.gov', 'Diana', 'Prince', 'Themyscira Embassy', 'Ambassador',
  'active', 'trial',
  1773273600, 1773360000, 1773446400, 1775260800,
  'WIN-B83F2A9E-6C1D-4E7F-A2B3-C5D9E1F3A847',
  1774479600, 1773273600
);

INSERT OR IGNORE INTO key_events (key_hash, event, device_id, platform, metadata, ip_hash, created_at) VALUES
  ('a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1', 'key_requested', NULL, NULL, NULL, NULL, 1773273600),
  ('a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1', 'email_verified', NULL, NULL, NULL, NULL, 1773360000),
  ('a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1', 'app_activated',  'WIN-B83F2A9E-6C1D-4E7F-A2B3-C5D9E1F3A847', 'windows', NULL, NULL, 1773446400),
  ('a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1', 'app_validated',  'WIN-B83F2A9E-6C1D-4E7F-A2B3-C5D9E1F3A847', 'windows', NULL, NULL, 1774479600);


-- ── 2. Clark Kent — Active Standard, both devices ───────────────────────────

INSERT OR IGNORE INTO keys
  (key, key_hash, email_hash, email, first_name, last_name, company, role,
   status, tier, requested_at, verified_at, activated_at, expires_at,
   windows_device_id, mac_device_id, last_validated_at, created_at)
VALUES (
  'CCAD-CLAR-KENT-S33Y',
  'b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2',
  '2222222222222222222222222222222222222222222222222222222222222222',
  'ckent@dailyplanet.com', 'Clark', 'Kent', 'Daily Planet', 'Senior Reporter',
  'active', 'standard',
  1771891200, 1771977600, 1772064000, 1803427200,
  'WIN-A1B2C3D4-E5F6-7890-ABCD-EF1234567890',
  'MAC-DEADBEEF-CAFE-BABE-FEED-FACEB00CF00D',
  1774476000, 1771891200
);

INSERT OR IGNORE INTO key_events (key_hash, event, device_id, platform, metadata, ip_hash, created_at) VALUES
  ('b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2', 'key_requested', NULL, NULL, NULL, NULL, 1771891200),
  ('b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2', 'email_verified', NULL, NULL, NULL, NULL, 1771977600),
  ('b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2', 'app_activated',  'WIN-A1B2C3D4-E5F6-7890-ABCD-EF1234567890', 'windows', NULL, NULL, 1772064000),
  ('b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2', 'app_activated',  'MAC-DEADBEEF-CAFE-BABE-FEED-FACEB00CF00D', 'mac',     NULL, NULL, 1772150400),
  ('b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2', 'tier_changed',   NULL, NULL, '{"from":"trial","to":"standard","changed_by":"admin@cuecadence.io"}', NULL, 1772500000),
  ('b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2', 'app_validated',  'WIN-A1B2C3D4-E5F6-7890-ABCD-EF1234567890', 'windows', NULL, NULL, 1774476000);


-- ── 3. Bruce Wayne — Pending Verification, duplicate request warning ─────────

INSERT OR IGNORE INTO keys
  (key, key_hash, email_hash, email, first_name, last_name, company, role,
   status, tier, requested_at, verified_at, activated_at, expires_at,
   created_at)
VALUES (
  'CCAD-BRUC-WAYN-T44Z',
  'c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3',
  '3333333333333333333333333333333333333333333333333333333333333333',
  'bruce@wayneenterprises.com', 'Bruce', 'Wayne', 'Wayne Enterprises', 'CEO',
  'pending_verification', 'trial',
  1774310400, NULL, NULL, 1775520000,
  1774310400
);

INSERT OR IGNORE INTO key_events (key_hash, event, device_id, platform, metadata, ip_hash, created_at) VALUES
  ('c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3', 'key_requested', NULL, NULL, NULL, NULL, 1774223900),
  ('c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3', 'key_requested', NULL, NULL, '{"duplicate":true}', NULL, 1774310400);


-- ── 4. Selina Kyle — Expired Trial ──────────────────────────────────────────

INSERT OR IGNORE INTO keys
  (key, key_hash, email_hash, email, first_name, last_name, company, role,
   status, tier, requested_at, verified_at, activated_at, expires_at,
   windows_device_id, last_validated_at, created_at)
VALUES (
  'CCAD-SELI-KYLE-T55W',
  'd4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4',
  '4444444444444444444444444444444444444444444444444444444444444444',
  'selina@gotham.net', 'Selina', 'Kyle', 'Gotham Antiquities', 'Acquisitions',
  'expired', 'trial',
  1770595200, 1770681600, 1770768000, 1773187200,
  'WIN-F9E8D7C6-B5A4-3210-FEDC-BA9876543210',
  1773100800, 1770595200
);

INSERT OR IGNORE INTO key_events (key_hash, event, device_id, platform, metadata, ip_hash, created_at) VALUES
  ('d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4', 'key_requested', NULL, NULL, NULL, NULL, 1770595200),
  ('d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4', 'email_verified', NULL, NULL, NULL, NULL, 1770681600),
  ('d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4', 'app_activated',  'WIN-F9E8D7C6-B5A4-3210-FEDC-BA9876543210', 'windows', NULL, NULL, 1770768000),
  ('d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4', 'app_validated',  'WIN-F9E8D7C6-B5A4-3210-FEDC-BA9876543210', 'windows', NULL, NULL, 1773100800),
  ('d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4', 'validation_failed', 'WIN-F9E8D7C6-B5A4-3210-FEDC-BA9876543210', 'windows', '{"reason":"key_expired"}', NULL, 1773273600);


-- ── 5. Jack Napier — Revoked Trial, revoke note + validation_failed events ───

INSERT OR IGNORE INTO keys
  (key, key_hash, email_hash, email, first_name, last_name, company, role,
   status, tier, revoke_note, requested_at, verified_at, activated_at, expires_at,
   windows_device_id, created_at)
VALUES (
  'CCAD-JACK-NAPR-R66V',
  'e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5',
  '5555555555555555555555555555555555555555555555555555555555555555',
  'jnapier@acechemicals.com', 'Jack', 'Napier', 'Ace Chemicals', 'Sales Rep',
  'revoked', 'trial',
  'Suspicious activity — multiple device fingerprints registered within 24 hours.',
  1772755200, 1772841600, 1772928000, 1775347200,
  'WIN-JACK0001-6C1D-4E7F-BAD0-BADDEED00001',
  1772755200
);

INSERT OR IGNORE INTO key_events (key_hash, event, device_id, platform, metadata, ip_hash, created_at) VALUES
  ('e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5', 'key_requested',   NULL, NULL, NULL, NULL, 1772755200),
  ('e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5', 'email_verified',  NULL, NULL, NULL, NULL, 1772841600),
  ('e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5', 'app_activated',   'WIN-JACK0001-6C1D-4E7F-BAD0-BADDEED00001', 'windows', NULL, NULL, 1772928000),
  ('e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5', 'validation_failed','WIN-JACK0002-9A8B-7C6D-5E4F-BADDEED00002', 'windows', '{"reason":"device_mismatch"}', NULL, 1773100000),
  ('e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5', 'validation_failed','WIN-JACK0003-1F2E-3D4C-5B6A-BADDEED00003', 'windows', '{"reason":"device_mismatch"}', NULL, 1773186400),
  ('e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5', 'key_revoked',     NULL, NULL, '{"revoked_by":"admin@cuecadence.io","note":"Suspicious activity — multiple device fingerprints registered within 24 hours."}', NULL, 1773272000);


-- ── 6. Lois Lane — Active Pro, both devices, tier upgrades in timeline ───────

INSERT OR IGNORE INTO keys
  (key, key_hash, email_hash, email, first_name, last_name, company, role, tools,
   status, tier, requested_at, verified_at, activated_at, expires_at,
   windows_device_id, mac_device_id, last_validated_at, created_at)
VALUES (
  'CCAD-LOIS-LANE-P77U',
  'f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6',
  '6666666666666666666666666666666666666666666666666666666666666666',
  'llane@dailyplanet.com', 'Lois', 'Lane', 'Daily Planet', 'Investigative Reporter', 'Google Docs, Zoom, Slack, Teams',
  'active', 'pro',
  1769299200, 1769385600, 1769472000, 1800835200,
  'WIN-LOIS1234-ABCD-EF01-2345-DAILYPLANET0',
  'MAC-LOIS5678-CAFE-BABE-6789-DAILYPLANET1',
  1774481400, 1769299200
);

INSERT OR IGNORE INTO key_events (key_hash, event, device_id, platform, metadata, ip_hash, created_at) VALUES
  ('f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6', 'key_requested', NULL, NULL, NULL, NULL, 1769299200),
  ('f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6', 'email_verified', NULL, NULL, NULL, NULL, 1769385600),
  ('f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6', 'app_activated',  'WIN-LOIS1234-ABCD-EF01-2345-DAILYPLANET0', 'windows', NULL, NULL, 1769472000),
  ('f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6', 'app_activated',  'MAC-LOIS5678-CAFE-BABE-6789-DAILYPLANET1', 'mac',     NULL, NULL, 1769558400),
  ('f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6', 'tier_changed',   NULL, NULL, '{"from":"trial","to":"standard","changed_by":"admin@cuecadence.io","note":"Upgraded after sales call"}', NULL, 1770768000),
  ('f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6', 'tier_changed',   NULL, NULL, '{"from":"standard","to":"pro","changed_by":"admin@cuecadence.io","note":"Annual plan purchase"}', NULL, 1772064000),
  ('f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6', 'app_validated',  'WIN-LOIS1234-ABCD-EF01-2345-DAILYPLANET0', 'windows', NULL, NULL, 1774481400);


-- ── 7. Alfred Pennyworth — Expired Trial, admin note, linked to Wayne ────────

INSERT OR IGNORE INTO keys
  (key, key_hash, email_hash, email, first_name, last_name, company, role,
   status, tier, admin_notes, requested_at, verified_at, activated_at, expires_at,
   windows_device_id, last_validated_at, created_at)
VALUES (
  'CCAD-ALFR-PENW-T88T',
  'a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7',
  '7777777777777777777777777777777777777777777777777777777777777777',
  'alfred@waynemanor.com', 'Alfred', 'Pennyworth', 'Wayne Manor', 'Executive Assistant',
  'expired', 'trial',
  'Bruce Wayne''s EA — coordinate with Bruce (c3c3...c3c3) re: account upgrade or add-on seat.',
  1770163200, 1770249600, 1770336000, 1772755200,
  'WIN-ALFRED01-6C1D-4E7F-WAYNE-MANOR00001',
  1772668800, 1770163200
);

INSERT OR IGNORE INTO key_events (key_hash, event, device_id, platform, metadata, ip_hash, created_at) VALUES
  ('a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7', 'key_requested',   NULL, NULL, NULL, NULL, 1770163200),
  ('a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7', 'email_verified',  NULL, NULL, NULL, NULL, 1770249600),
  ('a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7', 'app_activated',   'WIN-ALFRED01-6C1D-4E7F-WAYNE-MANOR00001', 'windows', NULL, NULL, 1770336000),
  ('a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7', 'app_validated',   'WIN-ALFRED01-6C1D-4E7F-WAYNE-MANOR00001', 'windows', NULL, NULL, 1772668800),
  ('a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7', 'validation_failed','WIN-ALFRED01-6C1D-4E7F-WAYNE-MANOR00001', 'windows', '{"reason":"key_expired"}', NULL, 1772842000);
