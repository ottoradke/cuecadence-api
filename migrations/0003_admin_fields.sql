-- Migration: 0003_admin_fields
-- Adds email storage (for admin resend-verification), per-key admin notes,
-- and revoke reason to the keys table.
--
-- Run locally:  npx wrangler d1 execute cuecadence-keys --local --file=migrations/0003_admin_fields.sql
-- Run remotely: npx wrangler d1 execute cuecadence-keys --file=migrations/0003_admin_fields.sql

-- Plain email address — stored so admins can resend verification emails.
-- Only exposed via /admin/* routes, never the user-facing API.
ALTER TABLE keys ADD COLUMN email TEXT;

-- Private admin notes per key. Never returned to the end-user API.
ALTER TABLE keys ADD COLUMN admin_notes TEXT;

-- Reason stored when a key is revoked. Shown on the admin detail page.
ALTER TABLE keys ADD COLUMN revoke_note TEXT;
