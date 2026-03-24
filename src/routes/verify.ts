// Stub — implement per TODO.md
import type { Env } from '../types/index.js';
export async function handleStub(_request: Request, _env: Env): Promise<Response> {
  return new Response(JSON.stringify({ error: 'Not implemented' }), {
    status: 501, headers: { 'Content-Type': 'application/json' },
  });
}
