// GET /admin/keys        — list all keys (paginated)
// GET /admin/keys/:hash  — single key + event history

import type { Env } from '../../types/index.js';
import { getKeyByHash, getKeyEvents } from '../../lib/db.js';
import { jsonResponseWithCors } from '../../lib/cors.js';
import { getAdminEmail } from './shared.js';

export async function handleAdminKeys(
  request: Request,
  env: Env
): Promise<Response> {
  const url      = new URL(request.url);
  const pathname = url.pathname;

  // ── Single key detail ───────────────────────────────────────────────────────
  // Matches /admin/keys/:key_hash but not /admin/keys/:key_hash/revoke etc.
  const detailMatch = pathname.match(/^\/admin\/keys\/([^/]+)$/);
  if (detailMatch) {
    const keyHash = detailMatch[1];
    const record  = await getKeyByHash(env.DB, keyHash);
    if (!record) {
      return jsonResponseWithCors({ error: 'Key not found' }, env.ADMIN_ORIGIN, 404);
    }
    const events = await getKeyEvents(env.DB, keyHash);
    return jsonResponseWithCors({ key: record, events }, env.ADMIN_ORIGIN);
  }

  // ── List all keys ───────────────────────────────────────────────────────────
  const page  = Math.max(1, parseInt(url.searchParams.get('page')  ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10)));
  const offset = (page - 1) * limit;

  const status = url.searchParams.get('status') ?? null;
  const tier   = url.searchParams.get('tier')   ?? null;

  let query  = 'SELECT * FROM keys';
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (status) { conditions.push('status = ?'); params.push(status); }
  if (tier)   { conditions.push('tier = ?');   params.push(tier); }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const result = await env.DB.prepare(query).bind(...params).all();

  // Total count for pagination
  let countQuery = 'SELECT COUNT(*) as total FROM keys';
  const countParams: (string | number)[] = [];
  if (conditions.length) {
    countQuery += ' WHERE ' + conditions.join(' AND ');
    if (status) countParams.push(status);
    if (tier)   countParams.push(tier);
  }
  const countResult = await env.DB.prepare(countQuery).bind(...countParams).first<{ total: number }>();

  // Suppress unused variable warning — admin email used for future audit logging
  void getAdminEmail(request);

  return jsonResponseWithCors({
    keys:  result.results,
    total: countResult?.total ?? 0,
    page,
    limit,
  }, env.ADMIN_ORIGIN);
}
