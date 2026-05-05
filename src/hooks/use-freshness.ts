'use client'

/**
 * Client-side freshness hook — polls /api/freshness once per minute
 * so the inline "Sincronizado hace N min" microcopy (and the stale
 * banner) stay accurate on pages that don't SSR.
 *
 * Server components should call readFreshness() directly from
 * @/lib/cockpit/freshness instead of using this hook.
 *
 * Optional `syncTypes`: scope freshness to the sync(s) that actually
 * power this page's data (audit Cluster B3 2026-05-05). E.g.,
 * /pedimentos passes ['globalpc_delta','globalpc_full'] so the banner
 * reflects whether the customs-data sync is fresh, not whether some
 * unrelated sync happened to succeed.
 */

import { useEffect, useState } from 'react'
import type { FreshnessReading } from '@/lib/cockpit/freshness'

const POLL_INTERVAL_MS = 60_000

export function useFreshness(
  enabled = true,
  syncTypes?: readonly string[],
): FreshnessReading | null {
  const [reading, setReading] = useState<FreshnessReading | null>(null)
  // Stable key for the effect dep — array identity changes per render but
  // the content is what we care about.
  const syncTypesKey = syncTypes && syncTypes.length > 0 ? syncTypes.join(',') : ''

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const url = syncTypesKey
      ? `/api/freshness?sync_types=${encodeURIComponent(syncTypesKey)}`
      : '/api/freshness'

    const load = (): void => {
      fetch(url)
        .then(r => r.ok ? r.json() : null)
        .then(r => { if (!cancelled && r && typeof r === 'object' && 'hasData' in r) setReading(r as FreshnessReading) })
        .catch(() => { /* silent — freshness is soft signal, not load-bearing for the page itself */ })
    }

    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(interval) }
  }, [enabled, syncTypesKey])

  return reading
}
