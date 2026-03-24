# CueCadence API — TODO

Work through this top to bottom. Each section has a clear completion condition
so you know when to move on. Don't skip ahead — later steps depend on earlier ones.

---

## PHASE 1 — Cloudflare Account & CLI Setup

- [ ] Create a Cloudflare account at https://cloudflare.com (free)
- [ ] Add cuecadence.io to Cloudflare (or confirm it's already there if your domain
      is already on Cloudflare) — needed to create subdomains for api. and admin.
- [ ] Install Wrangler CLI globally:
      ```
      npm install -g wrangler
      ```
- [ ] Log in to Cloudflare via Wrangler:
      ```
      wrangler login
      ```
      This opens a browser — authorize with your Cloudflare account.
- [ ] Verify login worked:
      ```
      wrangler whoami
      ```
      Should print your Cloudflare email and account ID.

**✓ Done when:** `wrangler whoami` prints your account info without errors.

---

## PHASE 2 — Create the D1 Database

- [ ] Create the D1 database:
      ```
      wrangler d1 create cuecadence-keys
      ```
      Wrangler prints back a `database_id` UUID. **Copy this — you need it for wrangler.toml.**
- [ ] Paste the `database_id` into `wrangler.toml` in the `[[d1_databases]]` block
      (the placeholder is already there, just replace `YOUR_DATABASE_ID_HERE`)
- [ ] Run the initial migration against the local DB to test the schema:
      ```
      npm run db:migrate:local
      ```
- [ ] Verify the local tables were created:
      ```
      npm run db:query:local -- --command="SELECT name FROM sqlite_master WHERE type='table'"
      ```
      Should return: `keys`, `key_events`, `admin_sessions`
- [ ] Run the migration against the production D1 database:
      ```
      npm run db:migrate
      ```
- [ ] Verify production tables:
      ```
      npm run db:query -- --command="SELECT name FROM sqlite_master WHERE type='table'"
      ```

**✓ Done when:** All three tables exist in both local and production D1.

---

## PHASE 3 — Secrets & Environment Variables

- [ ] Generate an HMAC secret for key hashing and JWT signing:
      ```
      openssl rand -hex 32
      ```
      Copy the output.
- [ ] Create `.dev.vars` in the project root (gitignored) and paste in:
      ```
      HMAC_SECRET=<paste output from above>
      RESEND_API_KEY=re_placeholder_replace_later
      ADMIN_SECRET=<generate another openssl rand -hex 32>
      ```
- [ ] Create a Resend account at https://resend.com (free tier is fine)
- [ ] Verify your sending domain in Resend (add DNS records for cuecadence.io)
- [ ] Generate a Resend API key and update `RESEND_API_KEY` in `.dev.vars`
- [ ] Set production secrets in Cloudflare dashboard:
      Workers → cuecadence-api → Settings → Variables → Add the same three variables
      (Or use wrangler: `wrangler secret put HMAC_SECRET` etc.)

**✓ Done when:** `.dev.vars` has all three real values and production secrets are set in the Cloudflare dashboard.

---

## PHASE 4 — Local Dev Server

- [ ] Install project dependencies:
      ```
      npm install
      ```
- [ ] Start the local dev server:
      ```
      npm run dev
      ```
      Worker should be running at http://localhost:8787
- [ ] Test the health check endpoint:
      ```
      curl http://localhost:8787/health
      ```
      Should return `{"ok":true}`
- [ ] Confirm D1 local binding works (the dev server uses the local SQLite file):
      ```
      curl -X POST http://localhost:8787/request-trial \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com"}'
      ```
      Should return `{"sent":true}` (email won't actually send in local dev unless Resend is configured)

**✓ Done when:** Dev server runs, health check passes, and /request-trial returns a valid response.

---

## PHASE 5 — Custom Domains

- [ ] In the Cloudflare dashboard, go to Workers & Pages → cuecadence-api → Settings → Triggers
- [ ] Add custom domain: `api.cuecadence.io`
      Cloudflare automatically creates the DNS record if cuecadence.io is on Cloudflare.
      If using external DNS, add a CNAME: `api` → `cuecadence-api.<your-subdomain>.workers.dev`
- [ ] Deploy the Worker to production:
      ```
      npm run deploy
      ```
- [ ] Test the live health check:
      ```
      curl https://api.cuecadence.io/health
      ```

**✓ Done when:** `https://api.cuecadence.io/health` returns `{"ok":true}`.

---

## PHASE 6 — Cloudflare Access (Admin Auth)

- [ ] In the Cloudflare dashboard, go to Zero Trust → Access → Applications
- [ ] Click "Add an application" → choose "Self-hosted"
- [ ] Configure:
      - Application name: `CueCadence Admin`
      - Application domain: `admin.cuecadence.io`
      - Session duration: 24 hours (or your preference)
- [ ] Add an identity provider:
      - Go to Zero Trust → Settings → Authentication
      - Add "Google" as an identity provider
      - Follow the OAuth setup (create Google OAuth app at console.cloud.google.com,
        add authorized redirect URI from Cloudflare, paste client ID + secret)
- [ ] Create an access policy:
      - Policy name: `Admin Only`
      - Action: Allow
      - Rule: Emails → add your email address
- [ ] Save the application

**✓ Done when:** Navigating to https://admin.cuecadence.io redirects to a Google login page (even before the admin UI is built).

---

## PHASE 7 — Admin Dashboard (Cloudflare Pages)

- [ ] In the Cloudflare dashboard, go to Workers & Pages → Create → Pages
- [ ] Connect to Git → select the `cuecadence-api` GitHub repo
- [ ] Configure build settings:
      - Build command: (leave blank — the admin is a static HTML file)
      - Build output directory: `admin`
      - Root directory: (leave blank)
- [ ] Add custom domain: `admin.cuecadence.io`
- [ ] Confirm the Cloudflare Access policy from Phase 6 is protecting this domain
- [ ] Trigger a deployment (push any commit or deploy manually from the dashboard)
- [ ] Navigate to https://admin.cuecadence.io — you should see the admin dashboard
      after logging in with Google

**✓ Done when:** Admin dashboard loads at https://admin.cuecadence.io behind Google SSO.

---

## PHASE 8 — Wire Up cuecadence-web (Vercel)

These changes happen in the `cuecadence-web` repo, not this one.

- [ ] Add a trial request form page (e.g. `/trial`) that POSTs to
      `https://api.cuecadence.io/request-trial`
- [ ] Add a verify landing page (e.g. `/verify`) that reads `?token=` from the URL
      and POSTs to `https://api.cuecadence.io/verify` on page load
- [ ] Test the full web flow:
      - Submit email on /trial → check email → click link → see key displayed on /verify
- [ ] Confirm CORS is working (no browser console errors on the fetch calls)

**✓ Done when:** Full web trial flow works end-to-end from the Vercel site.

---

## PHASE 9 — Wire Up cuecadence (Tauri App)

These changes happen in the `cuecadence` repo, not this one.

- [ ] Add `tauri-plugin-store` to the Tauri app for local key/session storage
- [ ] Generate and persist a stable `device.id` on first launch
- [ ] Build the key entry UI screen (shown when no valid session exists)
- [ ] Implement the `/activate` call on key submission
- [ ] Implement the `/validate` call on every app launch
- [ ] Implement grace period logic (72-hour offline window)
- [ ] Test: activate a key in the app → quit → relaunch → confirm it validates silently

**✓ Done when:** App activates with a real key, survives relaunch, and locks correctly on an expired/revoked key.

---

## PHASE 10 — End-to-End Test

Run through this full scenario manually before calling the system done:

- [ ] Request a trial key via cuecadence-web
- [ ] Verify email — confirm key is shown on the verify page
- [ ] Open the desktop app, enter the key — confirm activation
- [ ] Quit and relaunch the app — confirm silent validation
- [ ] Open the admin dashboard — find the key, confirm all three timestamps
      (requested_at, verified_at, activated_at) are set and the event timeline shows
      key_requested → email_verified → app_activated → app_validated
- [ ] Use the admin expiry editor to extend the expiry by 7 days
- [ ] Relaunch the app — confirm it picks up the new expiry
- [ ] Use the admin dashboard to revoke the key
- [ ] Relaunch the app — confirm it locks and shows the key entry screen
- [ ] Simulate offline: disconnect from internet, relaunch within 72 hours — confirm
      grace period allows launch
- [ ] Reset the key via admin (un-revoke or issue new key) — confirm app recovers

**✓ Done when:** All ten scenarios pass without errors.

---

## POST-MVP (don't do these now)

- [ ] Payment processor integration (Paddle or LemonSqueezy) — webhook updates tier + expires_at
- [ ] Self-serve device reset page on cuecadence-web
- [ ] Subscription renewal reminder emails (Resend sequences)
- [ ] Key resend form ("I lost my key") on cuecadence-web
- [ ] Admin dashboard charts (Chart.js — funnel and status breakdown visualizations)
- [ ] Extend grace period from 72 hours to 7 days (based on support volume post-launch)
- [ ] Rate limiting hardening (Cloudflare WAF rules as a supplement to Worker-level limits)
