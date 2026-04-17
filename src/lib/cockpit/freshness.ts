/**
 * Sync freshness — the server-side helper that powers FreshnessBanner.
 *
 * Contract: `.claude/rules/sync-contract.md` — the portal guarantees
 * Ursula that active-tráfico data is at most 30 minutes behind upstream.
 * If it drifts past 90 minutes, she sees a calm banner instead of a
 * silently stale number.
 *
 * Reads `sync_log`, picks the most-recent successful run whose
 * `company_id` matches the tenant OR is null (null = global sync
 * pass that covers every tenant).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface FreshnessReading {
  /** Minutes since the last successful sync touched this tenant. */
  minutesAgo: number | null
  /** ISO timestamp of that sync's `completed_at`, for display. */
  lastSyncedAt: string | null
  /** Convenience: freshness > 90 minutes. */
  isStale: boolean
  /** Convenience: we have any reading at all. */
  hasData: boolean
}

const STALE_MINUTES = 90

export async function readFreshness(
  supabase: SupabaseClient,
  companyId: string | null | undefined,
): Promise<FreshnessReading> {
  const base: FreshnessReading = {
    minutesAgo: null,
    lastSyncedAt: null,
    isStale: false,
    hasData: false,
  }
  if (!companyId) return base

  try {
    const { data } = await supabase
      .from('sync_log')
      .select('completed_at, company_id, status')
      .eq('status', 'success')
      .or(`company_id.eq.${companyId},company_id.is.null`)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)

    const row = Array.isArray(data) && data.length > 0 ? data[0] : null
    if (!row?.completed_at) return base

    const ms = Date.now() - new Date(row.completed_at).getTime()
    const minutesAgo = Math.max(0, Math.floor(ms / 60_000))
    return {
      minutesAgo,
      lastSyncedAt: row.completed_at,
      isStale: minutesAgo > STALE_MINUTES,
      hasData: true,
    }
  } catch {
    return base
  }
}

/**
 * Format a freshness reading as Spanish microcopy. Returns null when
 * there's no data to show (pre-activation or query failure) so the
 * caller can omit the signal entirely rather than render a misleading
 * "—".
 */
export function formatFreshness(r: FreshnessReading): string | null {
  if (!r.hasData || r.minutesAgo == null) return null
  if (r.minutesAgo < 1) return 'Sincronizado ahora'
  if (r.minutesAgo === 1) return 'Sincronizado hace 1 min'
  if (r.minutesAgo < 60) return `Sincronizado hace ${r.minutesAgo} min`
  const h = Math.floor(r.minutesAgo / 60)
  if (h === 1) return 'Sincronizado hace 1 h'
  if (h < 24) return `Sincronizado hace ${h} h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'Sincronizado hace 1 día'
  return `Sincronizado hace ${d} días`
}
