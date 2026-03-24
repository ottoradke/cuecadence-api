# cuecadence-api

Cloudflare Worker + D1 backend for the CueCadence license key system.

Handles: trial key requests · email verification · in-app activation ·
per-launch validation · admin dashboard

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Copy secrets template and fill in real values
cp .dev.vars.example .dev.vars

# 3. Run migrations against local D1
npm run db:migrate:local

# 4. Start local dev server
npm run dev
# → http://localhost:8787

# 5. Test health check
curl http://localhost:8787/health
```

## Useful commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start local Worker + D1 |
| `npm run deploy` | Deploy Worker to Cloudflare |
| `npm run db:migrate:local` | Apply migrations to local D1 |
| `npm run db:migrate` | Apply migrations to production D1 |
| `npm run db:query:local -- --command="…"` | Query local D1 |
| `npm run db:query -- --command="…"` | Query production D1 |
| `npm run type-check` | TypeScript type check (no emit) |

## Key files

- `CLAUDE.md` — full project context for Claude (read this first)
- `TODO.md` — step-by-step setup and build checklist
- `migrations/0001_initial.sql` — D1 schema
- `wrangler.toml` — Cloudflare Worker config (add your `database_id` here)
- `src/index.ts` — Worker entry point and router
- `src/lib/` — crypto, db helpers, email, cors
- `src/routes/` — one file per endpoint
- `admin/index.html` — admin dashboard SPA

## Docs

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Resend](https://resend.com/docs)
- [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/)
