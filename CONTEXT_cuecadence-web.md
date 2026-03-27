# Context for cuecadence-web
## Picking up Phase 8 — API Integration

This document describes what the `cuecadence-api` backend expects from the
`cuecadence-web` marketing site (Vercel). Drop this file into the
`cuecadence-web` repo as context for future development sessions.

---

## API base URL

```
https://api.cuecadence.io
```

CORS is configured to allow `https://cuecadence.io`. All requests must come
from that origin or the browser will block them.

---

## Page 1 — Trial Request Form (`/trial` or similar)

### What it does
User enters their email. On submit, POST to `/request-trial`.

### Request
```
POST https://api.cuecadence.io/request-trial
Content-Type: application/json

{ "email": "user@example.com" }
```

### Response (success)
```json
{ "sent": true }
```

### Response (error)
```json
{ "error": "Valid email required" }   // 400
```

### UI behaviour
- Show a loading state while the request is in flight
- On `{ sent: true }`: show "Check your email — we sent you a verification link"
- On error: show the error message
- If the email already has a key (duplicate), the API still returns `{ sent: true }`
  and resends the email — no special handling needed

### Notes
- The API stores the email as a hash only (privacy). It never returns the email.
- The verify token expires in 24 hours. If the user submits again after expiry,
  a new token is issued automatically.

---

## Page 2 — Email Verify Landing Page (`/verify`)

### What it does
User clicks the magic link in their email, which lands here with `?token=<hex>`.
On page load, POST to `/verify` with the token (and optionally the email if
you stored it from the trial form, e.g. in localStorage or a query param).

The API returns the license key. Display it prominently on this page.

### Request
```
POST https://api.cuecadence.io/verify
Content-Type: application/json

{
  "token": "<hex token from ?token= query param>",
  "email": "user@example.com"   // optional — triggers key confirmation email
}
```

### Response (success)
```json
{
  "verified": true,
  "key": "CCAD-XXXX-XXXX-XXXX"
}
```

### Response (errors)
```json
{ "error": "Token required" }             // 400 — missing token
{ "error": "Invalid or expired token" }   // 400 — bad/expired/already-used token
```

### UI behaviour
- On page load, read `?token=` from the URL
- If no token: show "Invalid link — please request a new trial"
- POST immediately on load (no user action needed)
- While loading: show spinner
- On success: display the key in a large monospace font with a copy button.
  Show instructions: "Open CueCadence and paste this key when prompted."
- On error: show "This link is invalid or has expired.
  [Request a new trial →]"

### Passing the email
The verify URL in the email is:
```
https://cuecadence.io/verify?token=<token>
```

If you want the key confirmation email to send (with the key for safekeeping),
pass the user's email in the POST body. The simplest approach: store the email
in `localStorage` when they submit the trial form, then read it on the verify page.

Alternatively, include it as a query param in the verify URL — but that exposes
it in email logs. The localStorage approach is cleaner.

### Token is single-use
After a successful `/verify` call, the token is cleared from the database.
Hitting the same link again returns `{ "error": "Invalid or expired token" }`.
The page should handle this gracefully (user may bookmark the page).

---

## Key format

All keys look like:
```
CCAD-XXXX-XXXX-XXXX
```
Uppercase A–Z (excluding O and I) plus digits 2–9 (excluding 0 and 1).

---

## CORS

The API is configured with:
```
Access-Control-Allow-Origin: https://cuecadence.io
Access-Control-Allow-Methods: POST, GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

Standard `fetch()` calls with `Content-Type: application/json` work without
any special configuration. No credentials or custom headers needed.

---

## Example fetch calls

### Trial request
```js
const res = await fetch('https://api.cuecadence.io/request-trial', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email }),
});
const data = await res.json();
if (data.sent) {
  // show "check your email"
} else {
  // show data.error
}
```

### Verify
```js
const token = new URLSearchParams(window.location.search).get('token');
const email = localStorage.getItem('trial_email'); // optional

const res = await fetch('https://api.cuecadence.io/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token, email }),
});
const data = await res.json();
if (data.verified) {
  // display data.key
} else {
  // show data.error
}
```

---

## What's NOT needed from cuecadence-web

- No `/activate` or `/validate` calls — those are Tauri app only
- No authentication or session management
- No payment handling (post-MVP)
