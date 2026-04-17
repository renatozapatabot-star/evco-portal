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

/** Pipeline-health bands expressed in minutes since the last successful
 *  sync. Chosen so the 30-minute intraday cadence leaves headroom for
 *  one missed run before the portal surfaces a warning. */
const HEALTH_GREEN_MAX = 45   // healthy · within 1.5× cadence
const HEALTH_AMBER_MAX = 90   // watch · banner appears on client surfaces
// beyond AMBER_MAX → red · sync-contract.md treats as SEV-2

export type SyncHealth = 'green' | 'amber' | 'red' | 'unknown'

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
 * Classify a freshness reading into the 4 health bands used by
 * monitoring + the UI banner. Keeps the thresholds defined once.
 */
export function classifySyncHealth(r: FreshnessReading): SyncHealth {
  if (!r.hasData || r.minutesAgo == null) return 'unknown'
  if (r.minutesAgo <= HEALTH_GREEN_MAX) return 'green'
  if (r.minutesAgo <= HEALTH_AMBER_MAX) return 'amber'
  return 'red'
}

/**
 * Monitoring-only — read the full pipeline-health picture across every
 * sync_type + tenant in one pass. Used by the admin dashboard and the
 * `scripts/sync-health-check.js` Telegram alerter. Does not surface on
 * client cockpits.
 *
 * Returns per-source rows so a stalled `globalpc` pass shows up even
 * when `econta` is healthy, and vice versa.
 */
export interface SyncHealthRow {
  sync_type: string
  last_success_at: string | null
  minutes_ago: number | null
  health: SyncHealth
  failed_since_last_success: number
}

export async function readPipelineHealth(
  supabase: SupabaseClient,
): Promise<SyncHealthRow[]> {
  try {
    const { data } = await supabase
      .from('sync_log')
      .select('sync_type, status, completed_at, started_at')
      .order('started_at', { ascending: false })
      .limit(500)
    if (!Array.isArray(data) || data.length === 0) return []

    const bySyncType = new Map<string, Array<{ status: string | null; completed_at: string | null; started_at: string | null }>>()
    for (const row of data as Array<{ sync_type: string | null; status: string | null; completed_at: string | null; started_at: string | null }>) {
      const key = row.sync_type ?? 'unknown'
      const arr = bySyncType.get(key) ?? []
      arr.push(row)
      bySyncType.set(key, arr)
    }

    const out: SyncHealthRow[] = []
    for (const [sync_type, rows] of bySyncType) {
      const firstSuccess = rows.find((r) => r.status === 'success' && r.completed_at)
      const lastSuccessAt = firstSuccess?.completed_at ?? null
      const minutesAgo = lastSuccessAt
        ? Math.max(0, Math.floor((Date.now() - new Date(lastSuccessAt).getTime()) / 60_000))
        : null
      // Failed runs between now and the last success — signals a
      // retrying-but-not-recovering pipeline, worth flagging even if
      // the last-success timestamp is still within bounds.
      let failedSinceLastSuccess = 0
      for (const r of rows) {
        if (r.status === 'success') break
        if (r.status === 'failed' || r.status === 'error') failedSinceLastSuccess++
      }
      const reading: FreshnessReading = {
        minutesAgo,
        lastSyncedAt: lastSuccessAt,
        isStale: minutesAgo != null && minutesAgo > STALE_MINUTES,
        hasData: minutesAgo != null,
      }
      out.push({
        sync_type,
        last_success_at: lastSuccessAt,
        minutes_ago: minutesAgo,
        health: classifySyncHealth(reading),
        failed_since_last_success: failedSinceLastSuccess,
      })
    }
    return out.sort((a, b) => a.sync_type.localeCompare(b.sync_type))
  } catch {
    return []
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
