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

export async function signJwt(payload: JwtPayload, secret: string): Promise<string> {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body   = base64UrlEncode(JSON.stringify(payload));
  const sig    = await hmacSign(secret, `${header}.${body}`);
  return `${header}.${body}.${base64UrlEncode(sig)}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, sigEncoded] = parts;
    const expectedSig = await hmacSign(secret, `${header}.${body}`);

    if (base64UrlDecode(sigEncoded) !== expectedSig) return null;

    const payload = JSON.parse(base64UrlDecode(body)) as JwtPayload;
    return payload;
  } catch {
    return null;
  }
}
