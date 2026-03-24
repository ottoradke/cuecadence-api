// Shared helpers for admin route handlers.

import { jwtDecode } from './jwtDecode.js';

// Extracts the admin's email from the Cloudflare Access JWT header.
// Returns 'unknown' if the header is missing or unparseable (e.g. local dev).
export function getAdminEmail(request: Request): string {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return 'unknown';
  try {
    const payload = jwtDecode(token);
    return typeof payload.email === 'string' ? payload.email : 'unknown';
  } catch {
    return 'unknown';
  }
}
