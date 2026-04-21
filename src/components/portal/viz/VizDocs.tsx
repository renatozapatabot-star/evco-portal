'use client'

import { useEffect, useState } from 'react'

export interface VizDocsProps {
  /** Counts displayed under "Firmas electrónicas". Defaults match the reference. */
  ok?: number
  pending?: number
  fresh?: number
}

/**
 * Stacked doc pile — 5 page rectangles slightly shifting vertically via
 * sin(phase + i) motion. Right side shows "Firmas electrónicas" + counts.
 * Used on the Expedientes module card.
 *
 * Ported from screen-dashboard.jsx:205-231.
 */
export function VizDocs({ ok = 412, pending = 24, fresh = 12 }: VizDocsProps) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      setPhase((t - t0) / 1000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, height: 44 }}>
      <svg width="48" height="44" viewBox="0 0 48 44" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => {
          const shift = Math.sin(phase * 0.8 + i * 0.6) * 1.5
          return (
            <rect
              key={i}
              x={4 + i * 2}
              y={6 + i * 5 + shift}
              width="32"
              height="26"
              rx="2"
              fill="var(--portal-ink-3)"
              stroke="var(--portal-green-2)"
              strokeOpacity={0.3 + i * 0.15}
              strokeWidth="0.8"
            />
          )
        })}
        <path
          d="M10 14 L32 14 M10 18 L28 18 M10 22 L30 22"
          stroke="var(--portal-green-2)"
          strokeWidth="0.8"
          opacity="0.9"
        />
      </svg>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: 'var(--portal-fg-2)' }}>Firmas electrónicas</div>
        <div className="portal-meta" style={{ color: 'var(--portal-fg-5)', marginTop: 2 }}>
          {ok.toLocaleString('es-MX')} OK · {pending} PEND · {fresh} NUEVO
        </div>
      </div>
    </div>
  )
}
