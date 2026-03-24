// ── Environment ───────────────────────────────────────────────────────────────
// Matches wrangler.toml [vars] + secrets set via wrangler secret put

export interface Env {
  DB: D1Database;
  HMAC_SECRET: string;
  RESEND_API_KEY: string;
  ADMIN_SECRET: string;
  ENVIRONMENT: string;
  CORS_ORIGIN: string;
  ADMIN_ORIGIN: string;
}

// ── Database row types ────────────────────────────────────────────────────────

export type KeyStatus = 'pending_verification' | 'active' | 'expired' | 'revoked';
export type KeyTier   = 'trial' | 'basic' | 'standard' | 'pro';
export type Platform  = 'windows' | 'mac';

export interface KeyRecord {
  id:                 number;
  key:                string;
  key_hash:           string;
  email_hash:         string;
  status:             KeyStatus;
  tier:               KeyTier;
  verify_token:       string | null;
  verify_token_exp:   number | null;
  requested_at:       number;
  verified_at:        number | null;
  activated_at:       number | null;
  expires_at:         number | null;
  windows_device_id:  string | null;
  mac_device_id:      string | null;
  last_validated_at:  number | null;
  created_at:         number;
}

export type KeyEventType =
  | 'key_requested'
  | 'email_verified'
  | 'app_activated'
  | 'app_validated'
  | 'expiry_changed'
  | 'tier_changed'
  | 'key_revoked'
  | 'device_reset'
  | 'validation_failed';

export interface KeyEvent {
  id:         number;
  key_hash:   string;
  event:      KeyEventType;
  device_id:  string | null;
  platform:   string | null;
  metadata:   string | null; // JSON string
  ip_hash:    string | null;
  created_at: number;
}

// ── API request/response types ────────────────────────────────────────────────

export interface RequestTrialBody {
  email: string;
}

export interface VerifyBody {
  token: string;
}

export interface ActivateBody {
  key:       string;
  device_id: string;
  platform:  Platform;
}

export interface ValidateBody {
  session_token: string;
  device_id:     string;
  platform:      Platform;
}

export interface JwtPayload {
  key_hash:   string;
  device_id:  string;
  platform:   Platform;
  tier:       KeyTier;
  expires_at: number;
  issued_at:  number;
}

export interface ValidateResponse {
  valid:      boolean;
  tier?:      KeyTier;
  expires_at?: number;
  error?:     string;
}

// ── Admin types ───────────────────────────────────────────────────────────────

export interface AdminUpdateBody {
  expires_at?: number;
  tier?:       KeyTier;
  changed_by:  string;
}

export interface AdminResetDeviceBody {
  platform: Platform;
}
