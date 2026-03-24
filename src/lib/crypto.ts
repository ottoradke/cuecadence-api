// All crypto uses the Web Crypto API (crypto.subtle).
// Do NOT use Node's crypto module — this runs on Cloudflare Workers (V8 isolate).

import type { JwtPayload } from '../types/index.js';

// Characters used in key generation.
// Excludes O, 0, I, 1 to prevent visual confusion.
const KEY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ── Key generation ────────────────────────────────────────────────────────────

export function generateKey(): string {
  const bytes = new Uint8Array(15);
  crypto.getRandomValues(bytes);

  // Convert 15 random bytes to 12 characters across 3 groups of 4
  let chars = '';
  for (const byte of bytes) {
    chars += KEY_CHARS[byte % KEY_CHARS.length];
  }

  // Trim to 12 characters and format as CCAD-XXXX-XXXX-XXXX
  const part1 = chars.slice(0, 4);
  const part2 = chars.slice(4, 8);
  const part3 = chars.slice(8, 12);

  return `CCAD-${part1}-${part2}-${part3}`;
}

export function generateVerifyToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Hashing ───────────────────────────────────────────────────────────────────

// Returns a hex string. Used for key hashing, email hashing, IP hashing.
async function hmacSign(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(data: string): Promise<string> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(data));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashKey(key: string, secret: string): Promise<string> {
  return hmacSign(secret, key);
}

export async function hashEmail(email: string): Promise<string> {
  return sha256(email.toLowerCase().trim());
}

export async function hashIp(ip: string): Promise<string> {
  return sha256(ip);
}

// ── JWT ───────────────────────────────────────────────────────────────────────
// Minimal JWT implementation (HS256) using Web Crypto.
// Not a full JWT library — only signs and verifies our own tokens.

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

// Encodes raw bytes (ArrayBuffer) to base64url — used for JWT signatures.
function base64UrlEncodeBytes(buf: ArrayBuffer): string {
  let str = '';
  for (const b of new Uint8Array(buf)) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Decodes base64url string to raw bytes — used for JWT signature verification.
function base64UrlDecodeBytes(str: string): ArrayBuffer {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// Imports an HMAC-SHA256 key for both sign and verify operations.
async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signJwt(payload: JwtPayload, secret: string): Promise<string> {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body   = base64UrlEncode(JSON.stringify(payload));
  const key    = await importHmacKey(secret);
  const sigRaw = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${body}`));
  return `${header}.${body}.${base64UrlEncodeBytes(sigRaw)}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, sigEncoded] = parts;
    const sigBytes = base64UrlDecodeBytes(sigEncoded);
    const key      = await importHmacKey(secret);

    // crypto.subtle.verify performs a constant-time comparison — no timing attack.
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(`${header}.${body}`)
    );
    if (!valid) return null;

    return JSON.parse(base64UrlDecode(body)) as JwtPayload;
  } catch {
    return null;
  }
}
