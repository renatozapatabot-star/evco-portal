'use client'

import { useEffect, useRef, useState } from 'react'

export type PortalSparklineTone = 'neutral' | 'live' | 'warn' | 'alert'

export interface PortalSparklineProps {
  data: number[]
  tone?: PortalSparklineTone
  height?: number
  /** When true, adds a pulsing head-dot + ring. Defaults true. */
  dot?: boolean
  /** When false, disables the breath animation. */
  animate?: boolean
  ariaLabel?: string
  className?: string
}

function colorForTone(tone: PortalSparklineTone) {
  if (tone === 'live') return 'var(--portal-green-2)'
  if (tone === 'warn') return 'var(--portal-amber)'
  if (tone === 'alert') return 'var(--portal-red)'
  return 'var(--portal-fg-3)'
}

/**
 * Sparkline — deterministic path + optional breath on the head dot.
 * Matches the agency reference primitive (live-breathing dot + faint ring).
 * Respects prefers-reduced-motion via `[data-motion="off"]` + media query.
 */
export function PortalSparkline({
  data,
  tone = 'neutral',
  height = 40,
  dot = true,
  animate = true,
  ariaLabel,
  className,
}: PortalSparklineProps) {
  const gradId = useRef(`psg-${Math.random().toString(36).slice(2, 8)}`).current
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    if (!animate) return
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      setPhase(((t - start) / 2200))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animate])

  if (!data || data.length < 2) {
    return <div className={className} style={{ height }} aria-hidden />
  }

  const w = 300
  const h = height
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const points: Array<[number, number]> = data.map((v, i) => {
    const breathe = animate ? Math.sin(phase + i * 0.4) * 0.5 : 0
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / span) * (h - 6) - 3 + breathe
    return [x, y]
  })
  const path = points.reduce(
    (s, [x, y], i) => s + (i === 0 ? `M${x},${y}` : ` L${x},${y}`),
    '',
  )
  const fillPath = `${path} L${w},${h} L0,${h} Z`
  const color = colorForTone(tone)
  const accent = tone !== 'neutral'
  const [lastX, lastY] = points[points.length - 1]
  const pulseR = 2.2 + (animate ? (Math.sin(phase * 2) + 1) * 1.1 : 0)
  const ringR = 3 + (animate ? ((phase * 1.5) % 1) * 8 : 0)
  const ringOpacity = animate ? 1 - ((phase * 1.5) % 1) : 0.6

  return (
    <svg
      className={['portal-spark', className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
      style={{
        overflow: 'visible',
        filter: accent ? 'drop-shadow(0 0 6px var(--portal-green-glow))' : 'none',
      }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradId})`} />
      <path
        d={path}
        className={accent ? 'portal-spark__path portal-spark__path--accent' : 'portal-spark__path'}
        stroke={color}
        vectorEffect="non-scaling-stroke"
      />
      {dot && (
        <g>
          <circle
            cx={lastX}
            cy={lastY}
            r={ringR}
            fill="none"
            stroke={color}
            strokeWidth="0.8"
            opacity={ringOpacity}
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={lastX} cy={lastY} r={pulseR} fill={color} />
        </g>
      )}
    </svg>
  )
}
