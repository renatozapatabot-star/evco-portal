'use client'

/**
 * Client-side freshness hook — polls /api/freshness once per minute
 * so the inline "Sincronizado hace N min" microcopy (and the stale
 * banner) stay accurate on pages that don't SSR.
 *
 * Server components should call readFreshness() directly from
 * @/lib/cockpit/freshness instead of using this hook.
 */

import { useEffect, useState } from 'react'
import type { FreshnessReading } from '@/lib/cockpit/freshness'

const POLL_INTERVAL_MS = 60_000

export function useFreshness(enabled = true): FreshnessReading | null {
  const [reading, setReading] = useState<FreshnessReading | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const load = (): void => {
      fetch('/api/freshness')
        .then(r => r.ok ? r.json() : null)
        .then(r => { if (!cancelled && r && typeof r === 'object' && 'hasData' in r) setReading(r as FreshnessReading) })
        .catch(() => { /* silent — freshness is soft signal, not load-bearing for the page itself */ })
    }

    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(interval) }
  }, [enabled])

  return reading
}
