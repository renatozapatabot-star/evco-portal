'use client'

import { useEffect, useState } from 'react'

interface StatusSummary {
  enProceso: number
  urgentes: number
  cruzadosHoy: number
  total: number
}

const CACHE_KEY = 'cruz_status_summary'
const CACHE_TTL = 7_200_000 // 2 hours

let inFlight: Promise<StatusSummary> | null = null

function getCached(): StatusSummary | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(CACHE_KEY)
  if (!raw) return null
  const { data, ts } = JSON.parse(raw) as { data: StatusSummary; ts: number }
  if (Date.now() - ts > CACHE_TTL) return null
  return data
}

function setCache(data: StatusSummary) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }))
}

async function fetchSummary(): Promise<StatusSummary> {
  const res = await fetch('/api/status-summary')
  if (!res.ok) throw new Error('status-summary fetch failed')
  return res.json()
}

/**
 * Single source of truth for urgency counts across the portal.
 * Calls /api/status-summary (server-side canonical calculation)
 * with sessionStorage cache to avoid redundant fetches.
 */
export function useStatusSentence() {
  const [data, setData] = useState<StatusSummary>({ enProceso: 0, urgentes: 0, cruzadosHoy: 0, total: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cached = getCached()
    if (cached) {
      setData(cached)
      setLoading(false)
    }

    // Deduplicate concurrent fetches
    if (!inFlight) {
      inFlight = fetchSummary().finally(() => { inFlight = null })
    }

    inFlight
      .then(fresh => {
        setData(fresh)
        setCache(fresh)
      })
      .catch((err: unknown) => { console.error("[CRUZ]", (err as Error)?.message || err) })
      .finally(() => setLoading(false))
  }, [])

  return { ...data, loading }
}
