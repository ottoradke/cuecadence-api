# Context for cuecadence (Tauri App)
## Picking up Phase 9 — License Key Integration

This document describes what the `cuecadence-api` backend expects from the
Tauri desktop app. Drop this file into the `cuecadence` repo as context for
future development sessions.

---

## API base URL

```
https://api.cuecadence.io
```

The Tauri app uses `reqwest` (Rust HTTP client), which does not enforce CORS.
No CORS headers are needed from the app side.

---

## What the app needs to store (tauri-plugin-store)

The app must persist the following across launches:

| Key | Type | Description |
|-----|------|-------------|
| `device.id` | string | Stable UUID generated once on first launch |
| `session.token` | string | JWT returned by `/activate` or cached from last `/validate` |
| `session.tier` | string | `trial` \| `basic` \| `standard` \| `pro` |
| `session.expires_at` | number | Unix timestamp — always overwrite with server value |
| `session.last_validated_at` | number | Unix timestamp of last successful `/validate` |

---

## Device ID

Generate a stable UUID on first launch and persist it in `tauri-plugin-store`.
This is used to bind the license key to a device (one seat per platform).

```rust
// pseudocode
let device_id = store.get("device.id").unwrap_or_else(|| {
    let id = uuid::Uuid::new_v4().to_string();
    store.set("device.id", id.clone());
    id
});
```

The platform value must be `"windows"` or `"mac"` (lowercase string).

---

## App launch flow

```
App launches
    │
    ├─ session.token exists in store?
    │       │
    │       NO ──► Show key entry screen
    │               User enters CCAD-XXXX-XXXX-XXXX
    │               POST /activate
    │               On success → store session, launch app
    │               On error → show error message
    │
    YES
    │
    ├─ Can reach api.cuecadence.io?
    │       │
    │       NO ──► Check last_validated_at
    │               Within 72 hours? → launch normally (grace period)
    │               Over 72 hours?   → show offline warning + lock
    │
    YES
    │
    POST /validate
    │
    ├─ { valid: true }  → update stored tier + expires_at, launch app
    └─ { valid: false } → show key entry screen, clear stored session
```

---

## POST /activate

Called when the user enters their license key for the first time on this device.

### Request
```
POST https://api.cuecadence.io/activate
Content-Type: application/json

{
  "key":       "CCAD-XXXX-XXXX-XXXX",
  "device_id": "<stable UUID>",
  "platform":  "windows"    // or "mac"
}
```

### Response (success — HTTP 200)
```json
{
  "activated":     true,
  "session_token": "<JWT>",
  "tier":          "trial",
  "expires_at":    1234567890
}
```

Store `session_token`, `tier`, `expires_at`, and set `last_validated_at` to now.

### Response (errors)

| HTTP | `error` field | What to show the user |
|------|--------------|----------------------|
| 403 | `"Invalid key"` | "That key wasn't found. Check for typos." |
| 403 | `"Key has been revoked"` | "This key has been revoked. Contact support." |
| 403 | `"Email not verified"` | "Please verify your email first — check your inbox." |
| 403 | `"Key has expired"` | "Your trial has expired." |
| 403 | `"Key is already activated on another device"` | "This key is already in use on another device. Contact support to reset." |

---

## POST /validate

Called on every app launch (when a session token already exists in the store).

### Request
```
POST https://api.cuecadence.io/validate
Content-Type: application/json

{
  "session_token": "<stored JWT>",
  "device_id":     "<stable UUID>",
  "platform":      "windows"    // or "mac"
}
```

### Response (success — HTTP 200)
```json
{
  "valid":      true,
  "tier":       "trial",
  "expires_at": 1234567890
}
```

**Always overwrite the stored `tier` and `expires_at` with the values from this
response.** The server is the source of truth — the admin can change expiry or
tier at any time.

Set `last_validated_at` to now (Unix timestamp).

### Response (failure — HTTP 401 or 403)
```json
{ "valid": false, "error": "..." }
```

On any `valid: false` response:
- Clear the stored session token
- Show the key entry screen
- Do NOT show a scary error — just "Enter your license key to continue"

---

## Grace period (offline behaviour)

This is enforced entirely in the app. The server has no knowledge of offline state.

```
if cannot reach api.cuecadence.io:
    age = now - last_validated_at
    if age <= 72 hours:
        launch normally using stored tier + expires_at
    else:
        show offline warning UI
        lock the app
```

The 72-hour window starts from `last_validated_at`, not from when the device
went offline. A user who validates at 9am and goes offline at 10am has until
9am + 72h = 9am three days later.

---

## JWT session token

The JWT payload contains:

```json
{
  "key_hash":   "...",
  "device_id":  "...",
  "platform":   "windows",
  "tier":       "trial",
  "expires_at": 1234567890,
  "issued_at":  1234567890
}
```

The app does NOT need to parse or verify the JWT — just store it opaquely and
send it back on `/validate`. The server verifies it.

The `expires_at` in the JWT is a cache only. The server returns the current
`expires_at` on every `/validate` response. Always use the server's value.

---

## Key entry UI

- Accept `CCAD-XXXX-XXXX-XXXX` format
- Auto-uppercase as the user types
- Strip spaces/dashes before sending (the API normalises with `.trim().toUpperCase()`)
- Show a clear loading state during the API call
- Map error responses to user-friendly messages (see table above)

---

## Sequence diagram

```
First launch (no stored token):
  App → /activate → { session_token, tier, expires_at }
  Store all three + set last_validated_at = now
  Launch app

Subsequent launches (token exists, online):
  App → /validate → { valid: true, tier, expires_at }
  Overwrite stored tier + expires_at
  Set last_validated_at = now
  Launch app

Subsequent launches (token exists, offline):
  Network error
  Check last_validated_at
  If within 72h → launch with cached tier/expires_at
  If over 72h   → lock

Session invalidated (revoked/expired):
  App → /validate → { valid: false }
  Clear stored session
  Show key entry screen
```

---

## Error handling checklist

- [ ] Network timeout / unreachable → grace period logic, not an error screen
- [ ] `valid: false` from /validate → clear session, show key entry (not error)
- [ ] `"Invalid key"` from /activate → inline form error, do not clear anything
- [ ] `"Key is already activated on another device"` → specific message pointing to support
- [ ] `"Email not verified"` → point user to their inbox
