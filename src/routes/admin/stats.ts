// GET /admin/stats

import type { Env } from '../../types/index.js';
import { jsonResponseWithCors } from '../../lib/cors.js';

export async function handleAdminStats(
  _request: Request,
  env: Env
): Promise<Response> {
  const now       = Math.floor(Date.now() / 1000);
  const in7Days   = now + 60 * 60 * 24 * 7;
  const ago7Days  = now - 60 * 60 * 24 * 7;

  const [
    byStatus,
    byTier,
    totalResult,
    verifiedResult,
    activatedResult,
    expiring7dResult,
    recentEvents,
  ] = await Promise.all([
    env.DB.prepare(`SELECT status, COUNT(*) as count FROM keys GROUP BY status`)
      .all<{ status: string; count: number }>(),

    env.DB.prepare(`SELECT tier, COUNT(*) as count FROM keys GROUP BY tier`)
      .all<{ tier: string; count: number }>(),

    env.DB.prepare(`SELECT COUNT(*) as count FROM keys`)
      .first<{ count: number }>(),

    env.DB.prepare(`SELECT COUNT(*) as count FROM keys WHERE verified_at IS NOT NULL`)
      .first<{ count: number }>(),

    env.DB.prepare(`SELECT COUNT(*) as count FROM keys WHERE activated_at IS NOT NULL`)
      .first<{ count: number }>(),

    env.DB.prepare(`
      SELECT COUNT(*) as count FROM keys
      WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at > ? AND expires_at < ?
    `).bind(now, in7Days).first<{ count: number }>(),

    env.DB.prepare(`
      SELECT
        ke.id, ke.key_hash, ke.event, ke.device_id, ke.platform, ke.metadata, ke.created_at,
        k.first_name, k.last_name, k.company, k.role, k.tier, k.status
      FROM key_events ke
      LEFT JOIN keys k ON ke.key_hash = k.key_hash
      WHERE ke.created_at > ?
      ORDER BY ke.created_at DESC LIMIT 20
    `).bind(ago7Days).all(),
  ]);

  // Flatten status and tier arrays into maps for easy lookup
  const statusMap = Object.fromEntries(byStatus.results.map(r => [r.status, r.count]));
  const tierMap   = Object.fromEntries(byTier.results.map(r => [r.tier, r.count]));

  const paidCount = (tierMap['basic'] ?? 0) + (tierMap['standard'] ?? 0) + (tierMap['pro'] ?? 0);

  return jsonResponseWithCors({
    // Dashboard cards
    total_keys:     totalResult?.count ?? 0,
    active_trials:  statusMap['active'] ?? 0,
    expiring_7d:    expiring7dResult?.count ?? 0,
    paid_keys:      paidCount,
    new_last_7_days: (await env.DB.prepare(`SELECT COUNT(*) as count FROM keys WHERE created_at > ?`)
      .bind(ago7Days).first<{ count: number }>())?.count ?? 0,

    // Funnel
    verified_keys:  verifiedResult?.count ?? 0,
    activated_keys: activatedResult?.count ?? 0,

    // Breakdowns (keyed for easy lookup)
    status_pending_verification: statusMap['pending_verification'] ?? 0,
    status_active:               statusMap['active'] ?? 0,
    status_expired:              statusMap['expired'] ?? 0,
    status_revoked:              statusMap['revoked'] ?? 0,
    tier_trial:                  tierMap['trial'] ?? 0,
    tier_basic:                  tierMap['basic'] ?? 0,
    tier_standard:               tierMap['standard'] ?? 0,
    tier_pro:                    tierMap['pro'] ?? 0,

    // Recent activity feed
    recent_events: recentEvents.results,
  }, env.ADMIN_ORIGIN);
}
