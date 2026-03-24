// Minimal JWT payload decoder — does NOT verify signature.
// Used only for reading the admin email from the Cloudflare Access JWT,
// which Cloudflare has already verified before the request reaches the Worker.

export function jwtDecode(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded  = payload + '=='.slice(0, (4 - payload.length % 4) % 4);
  return JSON.parse(atob(padded)) as Record<string, unknown>;
}
