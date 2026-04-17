'use client'

import { useEffect, useState } from 'react'

export interface PortalWorldMeshProps {
  opacity?: number
  animate?: boolean
}

/**
 * Animated lat/long SVG background. Breathes slowly (18s cycle).
 * Radial mask focuses attention on the center. Pointer-events:none,
 * position:fixed, z:0 — sits behind everything, interferes with nothing.
 *
 * Ported verbatim from
 * .planning/design-handoff/cruz-portal/project/src/primitives.jsx:200-248.
 */
export function PortalWorldMesh({
  opacity = 0.06,
  animate = true,
}: PortalWorldMeshProps) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    if (!animate) return
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      setPhase((t - t0) / 18000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animate])

  const longs = 24
  const lats = 12

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        maskImage: 'radial-gradient(ellipse at 50% 40%, black 20%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse at 50% 40%, black 20%, transparent 75%)',
        opacity,
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="portal-wm-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--portal-green-2)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--portal-green-2)" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        {/* latitudes */}
        {Array.from({ length: lats }).map((_, i) => {
          const y = (i / (lats - 1)) * 1080
          const ry = 30 + Math.sin(phase * 2 * Math.PI + i * 0.5) * 6
          return (
            <ellipse
              key={`lat-${i}`}
              cx="960"
              cy={y}
              rx="1200"
              ry={ry}
              fill="none"
              stroke="url(#portal-wm-grad)"
              strokeWidth="0.5"
            />
          )
        })}
        {/* longitudes */}
        {Array.from({ length: longs }).map((_, i) => {
          const offset = (i / longs) * 1920
          const phaseShift = phase * 2 * Math.PI + i * 0.3
          const pts = Array.from({ length: 40 })
            .map((__, j) => {
              const t = j / 39
              const y = t * 1080
              const x = offset + Math.sin(t * Math.PI * 2 + phaseShift) * 20
              return `${x},${y}`
            })
            .join(' ')
          return (
            <polyline
              key={`lng-${i}`}
              points={pts}
              fill="none"
              stroke="var(--portal-green-2)"
              strokeOpacity="0.28"
              strokeWidth="0.4"
            />
          )
        })}
      </svg>
    </div>
  )
}
