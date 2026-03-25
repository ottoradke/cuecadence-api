import type { Env } from './types/index.js';
import { handleOptions, jsonResponse } from './lib/cors.js';

// Route handlers — implement these one at a time per TODO.md
import { handleRequestTrial } from './routes/requestTrial.js';
import { handleVerify }       from './routes/verify.js';
import { handleActivate }     from './routes/activate.js';
import { handleValidate }     from './routes/validate.js';
import { handleAdminKeys }        from './routes/admin/keys.js';
import { handleAdminUpdate }      from './routes/admin/update.js';
import { handleAdminRevoke }      from './routes/admin/revoke.js';
import { handleAdminResetDevice } from './routes/admin/resetDevice.js';
import { handleAdminStats }       from './routes/admin/stats.js';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url      = new URL(request.url);
    const pathname = url.pathname;
    const method   = request.method;

    // ── CORS preflight ──
    const origin = pathname.startsWith('/admin/') ? env.ADMIN_ORIGIN : env.CORS_ORIGIN;
    const preflight = handleOptions(request, origin);
    if (preflight) return preflight;

    // ── Health check ────
    if (pathname === '/health' && method === 'GET') {
      return jsonResponse({ ok: true });
    }

    // ── Public endpoints ─────────────────────────────────────────────────────
    // Uncomment each route as you implement it.

    if (pathname === '/request-trial' && method === 'POST') {
      return handleRequestTrial(request, env);
    }

    if (pathname === '/verify' && method === 'POST') {
      return handleVerify(request, env);
    }

    if (pathname === '/activate' && method === 'POST') {
      return handleActivate(request, env);
    }

    if (pathname === '/validate' && method === 'POST') {
      return handleValidate(request, env);
    }

    // ── Admin endpoints ──────────────────────────────────────────────────────
    // Secondary guard: require X-Admin-Secret header in addition to
    // Cloudflare Access protection on admin.cuecadence.io.

    if (pathname.startsWith('/admin/')) {
      const adminSecret = request.headers.get('X-Admin-Secret');
      if (!adminSecret || adminSecret !== env.ADMIN_SECRET) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }
    }

    if (pathname === '/admin/keys' && method === 'GET') {
      return handleAdminKeys(request, env);
    }

    if (pathname.startsWith('/admin/keys/') && method === 'GET') {
      return handleAdminKeys(request, env);
    }

    if (pathname.startsWith('/admin/keys/') && method === 'PATCH') {
      return handleAdminUpdate(request, env);
    }

    if (pathname.endsWith('/revoke') && method === 'POST') {
      return handleAdminRevoke(request, env);
    }

    if (pathname.endsWith('/reset-device') && method === 'POST') {
      return handleAdminResetDevice(request, env);
    }

    if (pathname === '/admin/stats' && method === 'GET') {
      return handleAdminStats(request, env);
    }

    return jsonResponse({ error: 'Not found' }, 404);
  },
};
