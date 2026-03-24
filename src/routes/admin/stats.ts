// GET /admin/stats

import type { Env } from '../../types/index.js';
import { jsonResponse } from '../../lib/cors.js';

export async function handleAdminStats(
  _request: Request,
  env: Env
): Promise<Response> {
  const [byStatus, byTier, recent] = await Promise.all([
    env.DB.prepare(`
      SELECT status, COUNT(*) as count
      FROM keys
      GROUP BY status
    `).all<{ status: string; count: number }>(),

    env.DB.prepare(`
      SELECT tier, COUNT(*) as count
      FROM keys
      GROUP BY tier
    `).all<{ tier: string; count: number }>(),

    env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM keys
      WHERE created_at > ?
    `).bind(Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 7).first<{ count: number }>(),
  ]);

  return jsonResponse({
    by_status:        byStatus.results,
    by_tier:          byTier.results,
    new_last_7_days:  recent?.count ?? 0,
  });
}
