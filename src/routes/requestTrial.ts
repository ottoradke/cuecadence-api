// POST /request-trial
// Accepts an email, generates a license key, sends verification email.
// Stub — implement per TODO.md Phase 4 onwards.

import type { Env } from '../types/index.js';

export async function handleRequestTrial(
  _request: Request,
  _env: Env
): Promise<Response> {
  return new Response(JSON.stringify({ error: 'Not implemented' }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' },
  });
}
