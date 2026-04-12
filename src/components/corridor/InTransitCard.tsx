'use client'

// Block 7 · Corridor Map — bottom-right IN TRANSIT card.
// Rotates through the 5 most recently-updated traficos every 8 seconds.
// Hidden on <768px via corridor.css.

import { useEffect, useState, useMemo } from 'react'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_DIM,
  BG_ELEVATED,
  BORDER_HAIRLINE,
  TEXT_TERTIARY,
} from '@/lib/design-system'
import { fmtDateTime } from '@/lib/format-utils'
import type { ActiveTraficoPulse } from '@/types/corridor'

export interface InTransitCardProps {
  pulses: ActiveTraficoPulse[]
  onRotate?: (traficoId: string) => void
}

const ROTATE_MS = 8000
const SHOW_COUNT = 5

export function InTransitCard({ pulses, onRotate }: InTransitCardProps) {
  const recent = useMemo(() => {
    return [...pulses]
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, SHOW_COUNT)
  }, [pulses])

  const [idx, setIdx] = useState(0)
  const [nowMs, setNowMs] = useState<number | null>(null)

  // Establish "now" on client mount (avoids SSR mismatch + purity lint).
  // Initial set is deferred via setTimeout(0) so it doesn't fire inside the effect body.
  useEffect(() => {
    const initial = setTimeout(() => setNowMs(Date.now()), 0)
    const tick = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => {
      clearTimeout(initial)
      clearInterval(tick)
    }
  }, [])

  useEffect(() => {
    if (recent.length <= 1) return
    const iv = setInterval(() => {
      setIdx(i => {
        const next = (i + 1) % recent.length
        if (onRotate) onRotate(recent[next].traficoId)
        return next
      })
    }, ROTATE_MS)
    return () => clearInterval(iv)
  }, [recent, onRotate])

  if (recent.length === 0) return null
  const current = recent[Math.min(idx, recent.length - 1)]
  const minutesAgo = nowMs == null
    ? 0
    : Math.max(0, Math.floor((nowMs - new Date(current.updatedAt).getTime()) / 60000))

  return (
    <div
      className="aguila-corridor-in-transit"
      style={{
        position: 'absolute',
        right: 16,
        bottom: 16,
        width: 260,
        padding: 20,
        background: BG_ELEVATED,
        border: `1px solid ${BORDER_HAIRLINE}`,
        borderRadius: 20,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 500,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
          fontSize: 9,
          letterSpacing: '0.18em',
          color: TEXT_TERTIARY,
          marginBottom: 8,
        }}
      >
        IN TRANSIT
      </div>
      <div
        style={{
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: 14,
          color: ACCENT_SILVER,
          marginBottom: 4,
        }}
      >
        {current.traficoId}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
          fontSize: 12,
          color: ACCENT_SILVER_DIM,
          marginBottom: 12,
        }}
      >
        {current.cliente}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: 10,
          letterSpacing: '0.08em',
          color: TEXT_TERTIARY,
        }}
      >
        ACTUALIZADO HACE {minutesAgo} MIN · {fmtDateTime(current.updatedAt)}
      </div>
    </div>
  )
}

export default InTransitCard
