# CueCadence API — Claude Context

## What this project is

The backend for CueCadence, a desktop AI meeting teleprompter app. This repo is the
Cloudflare Worker + D1 database that handles license key lifecycle management:
trial key requests, email verification, in-app activation, per-launch validation,
and the admin dashboard.

This is **not** a Node.js server. It runs on Cloudflare's edge runtime (Workers),
which is a V8 isolate — not Node. Some Node APIs are unavailable. Use the Web
Crypto API (`crypto.subtle`) instead of Node's `crypto` module.

---

## Repo map

```
cuecadence-api/
├── src/
│   ├── index.ts              # Worker entry point — request router
│   ├── types/
│   │   └── index.ts          # Shared TypeScript types (Env, KeyRecord, KeyEvent, etc.)
│   ├── lib/
│   │   ├── crypto.ts         # Key generation, HMAC hashing, JWT sign/verify
│   │   ├── db.ts             # D1 query helpers
│   │   ├── email.ts          # Resend integration
│   │   └── cors.ts           # CORS headers helper
│   └── routes/
│       ├── requestTrial.ts   # POST /request-trial
│       ├── verify.ts         # POST /verify
│       ├── activate.ts       # POST /activate
│       ├── validate.ts       # POST /validate
│       └── admin/
│           ├── keys.ts       # GET /admin/keys, GET /admin/keys/:key_hash
│           ├── update.ts     # PATCH /admin/keys/:key_hash
│           ├── revoke.ts     # POST /admin/keys/:key_hash/revoke
│           ├── resetDevice.ts# POST /admin/keys/:key_hash/reset-device
│           └── stats.ts      # GET /admin/stats
├── admin/
│   └── index.html            # Admin dashboard SPA (Cloudflare Pages)
├── migrations/
│   └── 0001_initial.sql      # D1 schema — keys, key_events, admin_sessions tables
├── wrangler.toml             # Cloudflare Worker config — name, D1 binding, routes
├── package.json
├── tsconfig.json
├── TODO.md                   # Setup checklist — work through this top to bottom
├── CLAUDE.md                 # This file
└── .dev.vars                 # Local dev secrets (gitignored) — see Environment section
```

---

## The three sibling repos

| Repo | Hosting | Role |
|------|---------|------|
| `cuecadence` | Self-distributed (GitHub Releases) | Tauri desktop app — calls `api.cuecadence.io` via Rust/reqwest |
| `cuecadence-web` | Vercel | Marketing site — trial request form and verify landing page call `api.cuecadence.io` via fetch() |
| `cuecadence-api` | Cloudflare Workers + Pages | **This repo** — the entire backend |

---

## Environment variables

**Never commit secrets.** Local secrets go in `.dev.vars` (gitignored).
Production secrets are set in the Cloudflare dashboard under Workers → Settings → Variables.

| Variable | Where set | Description |
|----------|-----------|-------------|
| `HMAC_SECRET` | `.dev.vars` + CF dashboard | Secret for HMAC-SHA256 key hashing and JWT signing. Generate with: `openssl rand -hex 32` |
| `RESEND_API_KEY` | `.dev.vars` + CF dashboard | Resend API key from resend.com dashboard |
| `ADMIN_SECRET` | `.dev.vars` + CF dashboard | Optional secondary guard on admin endpoints (in addition to Cloudflare Access) |

`.dev.vars` format (plain text, not JSON):
```
HMAC_SECRET=your-secret-here
RESEND_API_KEY=re_xxxxxxxxxxxx
ADMIN_SECRET=your-admin-secret-here
```

In Worker code, all variables are accessed via `env.VARIABLE_NAME` — they are
injected into the `Env` interface defined in `src/types/index.ts`.

---

## D1 database

**Binding name:** `DB` (configured in `wrangler.toml`)

**Access in Worker code:**
```typescript
const result = await env.DB.prepare(
  'SELECT * FROM keys WHERE key_hash = ?'
).bind(keyHash).first<KeyRecord>();
```

**Running migrations locally:**
```bash
npx wrangler d1 execute cuecadence-keys --local --file=migrations/0001_initial.sql
```

**Running migrations on production:**
```bash
npx wrangler d1 execute cuecadence-keys --file=migrations/0001_initial.sql
```

**Inspecting local DB:**
```bash
npx wrangler d1 execute cuecadence-keys --local --command="SELECT name FROM sqlite_master WHERE type='table'"
```

---

## Key data model

### `keys` table — one row per license key
- `key` — the CCAD-XXXX-XXXX-XXXX string shown to users
- `key_hash` — HMAC-SHA256 of the key, used for all lookups (never query by raw key)
- `email_hash` — SHA-256 of lowercased email, used for duplicate detection
- `status` — `pending_verification` | `active` | `expired` | `revoked`
- `tier` — `trial` | `basic` | `standard` | `pro`
- `requested_at`, `verified_at`, `activated_at` — lifecycle timestamps, set once, never overwritten
- `expires_at` — admin-adjustable; always returned to the app on validation so the app stays in sync
- `windows_device_id`, `mac_device_id` — device fingerprints (1 seat per platform)

### `key_events` table — append-only lifecycle log
Every meaningful action writes a row. Event types:
`key_requested` | `email_verified` | `app_activated` | `app_validated` (throttled, max 1/hr/device) |
`expiry_changed` | `tier_changed` | `key_revoked` | `device_reset` | `validation_failed`

### `admin_sessions` table — audit log for admin actions

---

## Key format

```
CCAD-XXXX-XXXX-XXXX
```

- `CCAD` — fixed app prefix
- Characters: uppercase A–Z + 2–9, excluding O, 0, I, 1 to avoid visual confusion
- Generated from 15 cryptographically random bytes

---

## CORS policy

Public endpoints (`/request-trial`, `/verify`, `/activate`, `/validate`) must
include CORS headers allowing `https://cuecadence.io` (the Vercel marketing site).

The Tauri desktop app uses `reqwest` (Rust HTTP client) which does not enforce
CORS — no CORS headers needed for app requests, but they don't hurt either.

Admin endpoints (`/admin/*`) are same-origin only. Cloudflare Access blocks
external requests before they reach the Worker.

The `src/lib/cors.ts` helper adds the correct headers. Call it at the top of
every public route handler.

---

## JWT session tokens

After successful activation or validation, the Worker returns a short-lived JWT.
The app stores this in `tauri-plugin-store` and sends it on every `/validate` call.

JWT payload:
```json
{
  "key_hash": "...",
  "device_id": "...",
  "platform": "windows|mac",
  "tier": "trial|basic|standard|pro",
  "expires_at": 1234567890,
  "issued_at": 1234567890
}
```

Signed with HMAC-SHA256 using `HMAC_SECRET`. Use `src/lib/crypto.ts` for
sign and verify — do not roll JWT logic inline in route handlers.

**Important:** `expires_at` in the JWT is a cache only. The Worker always
reads `expires_at` from D1 and returns the current value in every `/validate`
response. The app must overwrite its local cache with the server's value.

---

## Grace period (offline behaviour)

When the app cannot reach the Worker:
- If `last_validated_at` is within 72 hours → app launches normally using cached tier/expiry
- If `last_validated_at` is older than 72 hours → app shows offline warning and locks

This is enforced entirely in the Tauri app (`cuecadence` repo). The Worker has
no awareness of offline state — it just responds or doesn't.

---

## Admin dashboard UI conventions

- **No browser dialogs** — never use `confirm()` or `alert()`. Use the `showModal()` helper instead.
  ```js
  showModal({ title, body, confirmLabel, confirmStyle, onConfirm })
  ```
  Destructive actions (revoke, reset) use a red confirm button. Errors reuse the modal with an OK button.

---

## Admin dashboard

A single HTML file at `admin/index.html`, deployed via Cloudflare Pages from
this same repo. Served at `admin.cuecadence.io`, gated by Cloudflare Access
(Google SSO — no custom auth code needed).

Communicates with the Worker via `/admin/*` endpoints using fetch(). All admin
actions are logged to `admin_sessions` in D1.

### Cloudflare Pages setup — important gotchas

The Worker (`cuecadence-api`) and the Pages site (`cuecadence-admin`) are **two
separate projects** in Cloudflare, even though they live in the same repo.

- The Worker auto-deploys via `wrangler.toml` on every push to `main`.
- The Pages site is the `cuecadence-admin` Pages project, connected to this
  repo's `main` branch with **no build command** and build output directory
  set to `admin`.

**Do not use the "Create a Worker" flow** in the Cloudflare dashboard to set up
Pages — it will detect `wrangler.toml` and deploy a duplicate Worker instead.
Use **Create application → Pages → Connect to Git** (the separate Pages flow).

**Build settings for `cuecadence-admin`:**
| Field | Value |
|---|---|
| Framework preset | None |
| Build command | *(empty)* |
| Build output directory | `admin` |

If the build command is left as `npx wrangler deploy` (the auto-filled default),
Cloudflare will deploy a Worker named `cuecadence-admin` instead of serving the
static HTML file. Clear it.

`pages.toml` in the repo root sets `pages_build_output_dir = "admin"` as a
hint, but the build command field in the dashboard must still be cleared manually.

---

## Local dev workflow

```bash
# Install dependencies
npm install

# Start local dev server (Worker + D1 local SQLite)
npm run dev
# → Worker available at http://localhost:8787

# Run migrations against local DB
npm run db:migrate:local

# Query local DB
npm run db:query:local -- --command="SELECT * FROM keys"

# Deploy to production
npm run deploy
```

---

## Deployment

**Worker** — deploys automatically on every push to `main` via Cloudflare's
Git integration (configured in the `cuecadence-api` Workers project).

```bash
npm run deploy   # manual deploy if needed
```

**Admin dashboard** — deploys automatically on every push to `main` via the
`cuecadence-admin` Pages project's Git integration.

The D1 database is not affected by either deploy — schema changes require
running migration files manually:

```bash
npx wrangler d1 execute cuecadence-keys --file=migrations/<file>.sql
```

---

## What to build first

Work through `TODO.md` top to bottom. The order matters — don't build route
handlers before the D1 schema exists, and don't build the admin UI before the
admin endpoints are working with curl.
