'use client'

import { useEffect, useState } from 'react'

export interface VizDonutProps {
  /** Portion filled in --portal-green-2 (0-100). */
  greenPct?: number
  /** Portion filled in soft red (0-100). Remaining arc is silver track. */
  redPct?: number
  size?: number
  /** Optional label rendered to the right of the donut. */
  label?: string
}

/**
 * Two-segment animated donut. Stroke-dasharray transitions from empty
 * to target on mount. Replaces the single-fill VizRing on surfaces
 * that need a verde / rojo split (Clasificación, Anexo 24 audit).
 */
export function VizDonut({
  greenPct = 98.8,
  redPct = 1.2,
  size = 72,
  label,
}: VizDonutProps) {
  const strokeWidth = 8
  const r = (size - strokeWidth) / 2
  const c = 2 * Math.PI * r
  const greenArc = (greenPct / 100) * c
  const redArc = (redPct / 100) * c
  const redRotation = (greenPct / 100) * 360

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const cx = size / 2
  const cy = size / 2
  const transition = 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
        role="img"
        aria-label={label ?? `${greenPct.toFixed(1)}% clasificado`}
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--portal-line-2)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--portal-green-2)"
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
          strokeDasharray={`${greenArc} ${c}`}
          strokeDashoffset={mounted ? 0 : greenArc}
          style={{ transition }}
        />
        <g transform={`rotate(${redRotation} ${cx} ${cy})`}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--portal-status-red-fg)"
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            strokeDasharray={`${redArc} ${c}`}
            strokeDashoffset={mounted ? 0 : redArc}
            style={{ transition: `${transition} 200ms` }}
          />
        </g>
      </svg>
      {label && (
        <div style={{ fontSize: 12, color: 'var(--portal-fg-2)', lineHeight: 1.35 }}>
          <span className="portal-num">{label}</span>
        </div>
      )}
    </div>
  )
}
