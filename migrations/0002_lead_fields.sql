-- CueCadence API — Lead Fields
-- Migration: 0002_lead_fields
-- Adds optional lead capture fields to the keys table.
-- Run locally:  npm run db:migrate:local -- --file=migrations/0002_lead_fields.sql
-- Run remotely: npx wrangler d1 execute cuecadence-keys --file=migrations/0002_lead_fields.sql

ALTER TABLE keys ADD COLUMN first_name TEXT;
ALTER TABLE keys ADD COLUMN last_name  TEXT;
ALTER TABLE keys ADD COLUMN company    TEXT;
ALTER TABLE keys ADD COLUMN role       TEXT;
ALTER TABLE keys ADD COLUMN tools      TEXT;
