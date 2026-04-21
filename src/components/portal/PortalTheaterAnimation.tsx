'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Five-act pedimento workflow theater. Each act represents a SAT
 * customs lifecycle state. The active act glows emerald, prior acts
 * dim to silver, upcoming acts ghost.
 *
 * Data source: pedimento.status_enum or equivalent string. The component
 * maps common Spanish customs statuses to act indices, with a fallback
 * to act 0 when the status is unknown.
 *
 * Respects prefers-reduced-motion via [data-motion="off"] and the
 * global CSS media query — animations collapse to static step indicator.
 */

export type PedimentoAct = 'filing' | 'acceptance' | 'clearance' | 'exit' | 'archived'

export interface PortalTheaterAnimationProps {
  /** Canonical act state. */
  act: PedimentoAct
  /** Optional sub-labels per act (localized). */
  labels?: Partial<Record<PedimentoAct, ReactNode>>
  /** Optional timestamps rendered below each completed act. */
  timestamps?: Partial<Record<PedimentoAct, ReactNode>>
  /** When true, animates the current act's emerald halo breath. */
  animate?: boolean
  className?: string
}

const ACT_ORDER: PedimentoAct[] = ['filing', 'acceptance', 'clearance', 'exit', 'archived']

const DEFAULT_LABELS: Record<PedimentoAct, ReactNode> = {
  filing: 'Presentado',
  acceptance: 'Aceptado',
  clearance: 'Semáforo',
  exit: 'Cruce',
  archived: 'Archivado',
}

const ACT_ICON: Record<PedimentoAct, ReactNode> = {
  filing: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
  ),
  acceptance: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 4 6v6c0 4.5 3.5 8 8 9 4.5-1 8-4.5 8-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  clearance: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="8" r="1.25" fill="currentColor" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" />
      <circle cx="12" cy="16" r="1.25" fill="currentColor" />
    </svg>
  ),
  exit: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 10h20" />
      <path d="M2 10v8" />
      <path d="M22 10v8" />
      <path d="M7 10V7" />
      <path d="M12 10V5" />
      <path d="M17 10V7" />
      <path d="M2 18h20" />
    </svg>
  ),
  archived: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="13" rx="1" />
      <path d="M3 10h18" />
      <path d="M10 14h4" />
    </svg>
  ),
}

export function PortalTheaterAnimation({
  act,
  labels,
  timestamps,
  animate = true,
  className,
}: PortalTheaterAnimationProps) {
  const activeIndex = useMemo(() => {
    const idx = ACT_ORDER.indexOf(act)
    return idx < 0 ? 0 : idx
  }, [act])

  const [phase, setPhase] = useState(0)
  useEffect(() => {
    if (!animate) return
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      setPhase((t - start) / 2400)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animate])

  const breath = animate ? (Math.sin(phase * 2 * Math.PI) + 1) / 2 : 0

  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${ACT_ORDER.length}, 1fr)`,
        gap: 'var(--portal-s-3)',
        padding: 'var(--portal-s-5) 0',
        position: 'relative',
      }}
      aria-label="Trazabilidad del pedimento"
    >
      {/* rail */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 26,
          left: `${100 / (ACT_ORDER.length * 2)}%`,
          right: `${100 / (ACT_ORDER.length * 2)}%`,
          height: 1,
          background: 'var(--portal-line-1)',
        }}
      />
      {/* progressed rail */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 26,
          left: `${100 / (ACT_ORDER.length * 2)}%`,
          width: `calc(${(activeIndex / (ACT_ORDER.length - 1)) * 100}% - ${100 / ACT_ORDER.length}%)`,
          height: 1,
          background: 'linear-gradient(90deg, var(--portal-green-3), var(--portal-green-2))',
          boxShadow: '0 0 10px var(--portal-green-glow)',
          transition: 'width var(--portal-dur-3) var(--portal-ease-out)',
        }}
      />
      {ACT_ORDER.map((k, i) => {
        const status: 'done' | 'active' | 'ghost' =
          i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'ghost'
        const ringShadow =
          status === 'active'
            ? `0 0 ${8 + breath * 12}px var(--portal-green-glow), 0 0 0 1px var(--portal-green-3)`
            : status === 'done'
              ? '0 0 0 1px var(--portal-green-5)'
              : '0 0 0 1px var(--portal-line-2)'
        const iconColor =
          status === 'active'
            ? 'var(--portal-green-1)'
            : status === 'done'
              ? 'var(--portal-green-3)'
              : 'var(--portal-fg-5)'
        const labelColor =
          status === 'active'
            ? 'var(--portal-fg-1)'
            : status === 'done'
              ? 'var(--portal-fg-3)'
              : 'var(--portal-fg-5)'
        return (
          <div
            key={k}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 'var(--portal-r-pill)',
                background: status === 'active' ? 'var(--portal-ink-1)' : 'var(--portal-ink-0)',
                boxShadow: ringShadow,
                color: iconColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'box-shadow var(--portal-dur-3) var(--portal-ease-out), color var(--portal-dur-3) var(--portal-ease-out)',
              }}
            >
              {ACT_ICON[k]}
            </div>
            <span
              className="portal-eyebrow"
              style={{
                color: labelColor,
                letterSpacing: '0.2em',
                textAlign: 'center',
              }}
            >
              {labels?.[k] ?? DEFAULT_LABELS[k]}
            </span>
            {timestamps?.[k] != null && (
              <span
                className="portal-meta"
                style={{ color: 'var(--portal-fg-5)', textAlign: 'center' }}
              >
                {timestamps[k]}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Maps common Spanish customs status strings to a theater act. */
export function actFromStatus(status: string | null | undefined): PedimentoAct {
  if (!status) return 'filing'
  const s = status.toLowerCase().trim()
  if (s.includes('archiv')) return 'archived'
  if (s.includes('cruz') || s.includes('salid')) return 'exit'
  if (s.includes('semáfor') || s.includes('semafor') || s.includes('liberad')) return 'clearance'
  if (s.includes('acept') || s.includes('valid')) return 'acceptance'
  return 'filing'
}
