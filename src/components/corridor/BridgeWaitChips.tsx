'use client'

// ZAPATA AI V1.5 · F18 — BridgeWaitChips
// Silver chip row shown above the LIVE FLOW panel: one chip per Laredo
// bridge with commercial northbound wait minutes (mono), direction arrow
// silver-dim. Fetches /api/bridges/current on mount; that endpoint auto-
// refreshes in place when the latest snapshot is > 6 min old.

import { useEffect, useState } from 'react'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_BRIGHT,
  ACCENT_SILVER_DIM,
  BG_ELEVATED,
  BORDER_HAIRLINE,
} from '@/lib/design-system'

interface BridgeRow {
  bridge_code: string
  bridge_name: string
  direction: 'northbound' | 'southbound'
  lane_type: string
  wait_minutes: number | null
  fetched_at: string
}

interface ApiResponse {
  data: { bridges: BridgeRow[] } | null
  error: { code: string; message: string } | null
}

const LANE_LABEL: Record<string, string> = {
  commercial: 'Comercial',
  passenger: 'Pasajero',
  fast: 'Fast',
  ready: 'Ready',
}

export function BridgeWaitChips() {
  const [rows, setRows] = useState<BridgeRow[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/bridges/current', { cache: 'no-store' })
        if (!res.ok) return
        const json = (await res.json()) as ApiResponse
        if (!cancelled && json.data) setRows(json.data.bridges)
      } catch {
        // silent — corridor shell keeps rendering
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const commNorth = rows
    .filter(r => r.lane_type === 'commercial' && r.direction === 'northbound')
    .slice(0, 4)

  if (!loaded || commNorth.length === 0) return null

  return (
    <div
      className="aguila-bridge-chips"
      style={{
        position: 'absolute',
        left: 16,
        bottom: 260,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        zIndex: 500,
        maxWidth: 320,
      }}
      aria-label="Tiempos de cruce por puente"
    >
      {commNorth.map(r => (
        <div
          key={`${r.bridge_code}-${r.direction}-${r.lane_type}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: BG_ELEVATED,
            border: `1px solid ${BORDER_HAIRLINE}`,
            borderRadius: 999,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            minHeight: 32,
          }}
          title={`${r.bridge_name} · ${LANE_LABEL[r.lane_type] ?? r.lane_type} · ${r.direction === 'northbound' ? 'Norte' : 'Sur'}`}
        >
          <span
            style={{
              fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
              fontSize: 'var(--aguila-fs-label)',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: ACCENT_SILVER_BRIGHT,
            }}
          >
            {r.bridge_name}
          </span>
          <span style={{ color: ACCENT_SILVER_DIM, fontSize: 'var(--aguila-fs-meta)' }} aria-hidden="true">
            {r.direction === 'northbound' ? '↑' : '↓'}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: 'var(--aguila-fs-body)',
              fontWeight: 600,
              color: ACCENT_SILVER,
            }}
          >
            {r.wait_minutes == null ? '—' : `${r.wait_minutes} min`}
          </span>
        </div>
      ))}
    </div>
  )
}

export default BridgeWaitChips
