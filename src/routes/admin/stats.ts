// GET /admin/stats

import type { Env } from '../../types/index.js';
import { jsonResponseWithCors } from '../../lib/cors.js';

export async function handleAdminStats(
  _request: Request,
  env: Env
): Promise<Response> {
  const now        = Math.floor(Date.now() / 1000);
  const in7Days    = now + 60 * 60 * 24 * 7;
  const ago7Days   = now - 60 * 60 * 24 * 7;
  const weeksAgo8  = now - 8 * 7 * 86400;

  const [
    byStatus,
    byTier,
    totalResult,
    verifiedResult,
    activatedResult,
    expiring7dResult,
    recentEvents,
    weeklySignups,
    platformBreakdown,
    expiringToday,
    expiring3d,
    trialMetrics,
    duplicateRequests,
    adminActions,
    manualVerifies,
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
        k.key, k.first_name, k.last_name, k.company, k.role, k.tier, k.status
      FROM key_events ke
      LEFT JOIN keys k ON ke.key_hash = k.key_hash
      WHERE ke.created_at > ?
      ORDER BY ke.created_at DESC LIMIT 20
    `).bind(ago7Days).all(),

    env.DB.prepare(`
      SELECT CAST((created_at - ?) / (7 * 86400) AS INTEGER) as week_idx, COUNT(*) as count
      FROM keys WHERE created_at >= ?
      GROUP BY week_idx ORDER BY week_idx ASC
    `).bind(weeksAgo8, weeksAgo8).all<{ week_idx: number; count: number }>(),

    env.DB.prepare(`
      SELECT
        SUM(CASE WHEN windows_device_id IS NOT NULL AND mac_device_id IS NOT NULL THEN 1 ELSE 0 END) as both_platforms,
        SUM(CASE WHEN windows_device_id IS NOT NULL AND mac_device_id IS NULL     THEN 1 ELSE 0 END) as windows_only,
        SUM(CASE WHEN mac_device_id IS NOT NULL AND windows_device_id IS NULL     THEN 1 ELSE 0 END) as mac_only,
        SUM(CASE WHEN windows_device_id IS NULL AND mac_device_id IS NULL         THEN 1 ELSE 0 END) as not_activated
      FROM keys
    `).first<{ both_platforms: number; windows_only: number; mac_only: number; not_activated: number }>(),

    env.DB.prepare(`SELECT COUNT(*) as count FROM keys WHERE status='active' AND expires_at > ? AND expires_at <= ?`)
      .bind(now, now + 86400).first<{ count: number }>(),

    env.DB.prepare(`SELECT COUNT(*) as count FROM keys WHERE status='active' AND expires_at > ? AND expires_at <= ?`)
      .bind(now, now + 3 * 86400).first<{ count: number }>(),

    env.DB.prepare(`
      SELECT
        AVG(CAST(expires_at - activated_at AS REAL) / 86400.0) as avg_days,
        MIN(CAST(expires_at - activated_at AS REAL) / 86400.0) as min_days,
        MAX(CAST(expires_at - activated_at AS REAL) / 86400.0) as max_days
      FROM keys WHERE tier = 'trial' AND activated_at IS NOT NULL AND expires_at IS NOT NULL
    `).first<{ avg_days: number; min_days: number; max_days: number }>(),

    env.DB.prepare(`SELECT COUNT(*) as count FROM key_events WHERE event='key_requested' AND metadata LIKE '%"duplicate":true%'`)
      .first<{ count: number }>(),

    env.DB.prepare(`
      SELECT event, COUNT(*) as count FROM key_events
      WHERE event IN ('expiry_changed','tier_changed','key_revoked','device_reset')
      GROUP BY event
    `).all<{ event: string; count: number }>(),

    env.DB.prepare(`SELECT COUNT(*) as count FROM key_events WHERE event='email_verified' AND metadata LIKE '%"manual":true%'`)
      .first<{ count: number }>(),
  ]);

  // Flatten status and tier arrays into maps for easy lookup
  const statusMap  = Object.fromEntries(byStatus.results.map(r => [r.status, r.count]));
  const tierMap    = Object.fromEntries(byTier.results.map(r => [r.tier, r.count]));
  const actionMap  = Object.fromEntries(adminActions.results.map(r => [r.event, r.count]));

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

    // Weekly signups (last 8 weeks, index 0 = oldest)
    weekly_signups:      weeklySignups.results,
    weeks_ago_8_epoch:   weeksAgo8,

    // Platform breakdown
    platform_windows_only:  platformBreakdown?.windows_only  ?? 0,
    platform_mac_only:      platformBreakdown?.mac_only      ?? 0,
    platform_both:          platformBreakdown?.both_platforms ?? 0,
    platform_not_activated: platformBreakdown?.not_activated  ?? 0,

    // Expiring soon
    expiring_today: expiringToday?.count ?? 0,
    expiring_3d:    expiring3d?.count    ?? 0,

    // Key metrics
    avg_trial_days: trialMetrics?.avg_days ?? null,
    min_trial_days: trialMetrics?.min_days ?? null,
    max_trial_days: trialMetrics?.max_days ?? null,
    duplicate_requests: duplicateRequests?.count ?? 0,

    // Admin actions (all-time)
    admin_extensions:     actionMap['expiry_changed'] ?? 0,
    admin_tier_changes:   actionMap['tier_changed']   ?? 0,
    admin_revocations:    actionMap['key_revoked']    ?? 0,
    admin_device_resets:  actionMap['device_reset']   ?? 0,
    admin_manual_verifies: manualVerifies?.count      ?? 0,

    // Recent activity feed
    recent_events: recentEvents.results,
  }, env.ADMIN_ORIGIN);
}
