'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

export interface PortalGlobeProps {
  size?: number
  /** Rotation period in seconds (lower = faster). */
  speed?: number
  /** When true, meridians/latitudes use emerald; otherwise fg-3. */
  accent?: boolean
  style?: CSSProperties
}

/**
 * Wireframe globe — 5 meridians phase-shifted for apparent rotation,
 * 5 static latitudes, optional glow halo on accent mode. Pure SVG, no
 * external deps. Ported verbatim from
 * .planning/design-handoff/cruz-portal/project/src/primitives.jsx:152-196.
 */
export function PortalGlobe({
  size = 22,
  speed = 22,
  accent = true,
  style,
}: PortalGlobeProps) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      setPhase(((t - t0) / 1000) * ((2 * Math.PI) / speed))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [speed])

  const r = 10
  const stroke = accent ? 'var(--portal-green-2)' : 'var(--portal-fg-3)'
  const dimStroke = accent
    ? 'color-mix(in oklch, var(--portal-green-2) 45%, transparent)'
    : 'var(--portal-fg-4)'

  const meridians = [0, 1, 2, 3, 4].map((i) => {
    const off = (i * Math.PI) / 5
    const rx = Math.abs(Math.cos(phase + off)) * r
    const back = Math.sin(phase + off) > 0
    return { rx, back, key: i }
  })

  return (
    <svg
      width={size}
      height={size}
      viewBox="-12 -12 24 24"
      style={{ display: 'block', ...style }}
      aria-hidden
    >
      {accent && (
        <circle
          cx="0"
          cy="0"
          r={r + 0.5}
          fill="none"
          stroke={stroke}
          strokeWidth="0.4"
          opacity="0.25"
          filter="drop-shadow(0 0 3px var(--portal-green-glow))"
        />
      )}
      <circle cx="0" cy="0" r={r} fill="none" stroke={stroke} strokeWidth="0.8" />
      {[-6, -3, 0, 3, 6].map((y, i) => {
        const rx = Math.sqrt(Math.max(0, r * r - y * y))
        return (
          <ellipse
            key={i}
            cx="0"
            cy={y}
            rx={rx}
            ry={rx * 0.18}
            fill="none"
            stroke={dimStroke}
            strokeWidth="0.35"
          />
        )
      })}
      {meridians.map((m) => (
        <ellipse
          key={m.key}
          cx="0"
          cy="0"
          rx={m.rx}
          ry={r}
          fill="none"
          stroke={stroke}
          strokeWidth={m.back ? 0.6 : 0.3}
          opacity={m.back ? 0.9 : 0.35}
        />
      ))}
      <line
        x1={-r}
        y1="0"
        x2={r}
        y2="0"
        stroke={stroke}
        strokeWidth="0.5"
        opacity="0.5"
      />
    </svg>
  )
}
