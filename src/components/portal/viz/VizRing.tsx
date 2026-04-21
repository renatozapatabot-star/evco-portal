'use client'

import { useEffect, useState } from 'react'

export interface VizRingProps {
  /** Percentage filled (0-100). */
  pct: number
  size?: number
}

/**
 * Circular progress ring. Stroke-dasharray drives the fill amount;
 * drop-shadow breathes via sin(phase) so the emerald glow pulses.
 * Used on the Anexo 24 module card.
 *
 * Ported from screen-dashboard.jsx:137-155.
 */
export function VizRing({ pct, size = 44 }: VizRingProps) {
  const r = 18
  const c = 2 * Math.PI * r
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

  const glowOpacity = 0.5 + Math.sin(phase * 1.5) * 0.25

  return (
    <svg
      width={size}
      height={size}
      viewBox="-22 -22 44 44"
      style={{ transform: 'rotate(-90deg)' }}
      aria-hidden
    >
      <circle r={r} fill="none" stroke="var(--portal-line-2)" strokeWidth="2" />
      <circle
        r={r}
        fill="none"
        stroke="var(--portal-green-2)"
        strokeWidth="2"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
        strokeLinecap="round"
        style={{
          filter: `drop-shadow(0 0 ${4 * glowOpacity}px var(--portal-green-glow))`,
          transition: 'stroke-dashoffset 800ms',
        }}
      />
    </svg>
  )
}
