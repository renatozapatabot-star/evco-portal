'use client'

import { useEffect, useState } from 'react'
import { PortalKbd } from './PortalText'

export interface PortalAssistantFabProps {
  onClick: () => void
  /** Override the two-line content. Defaults to "EN LÍNEA · CONTEXTO 90D" / "Agente IA". */
  eyebrow?: string
  label?: string
}

/**
 * Fixed bottom-right floating action button. Breathing emerald core +
 * expanding ring (both via requestAnimationFrame phase). Triple-layer
 * shadow: shadow-3 + outer-green-halo + inner-green-rim. Always visible
 * on authenticated surfaces; opens the command palette on click.
 *
 * Port of .planning/design-handoff/cruz-portal/project/src/screen-dashboard.jsx:556-599.
 */
export function PortalAssistantFab({
  onClick,
  eyebrow = 'EN LÍNEA · CONTEXTO 90D',
  label = 'Agente IA',
}: PortalAssistantFabProps) {
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

  const breathe = 1 + Math.sin(phase * 1.6) * 0.06
  const ringR = 14 + ((phase * 1.2) % 1) * 12
  const ringOpacity = 1 - ((phase * 1.2) % 1)

  return (
    <button
      onClick={onClick}
      style={{
        position: 'fixed',
        right: 24,
        bottom: 24,
        zIndex: 40,
        padding: '12px 18px 12px 14px',
        borderRadius: 'var(--portal-r-pill)',
        background: 'var(--portal-ink-3)',
        border: '1px solid color-mix(in oklch, var(--portal-green-2) 30%, var(--portal-line-3))',
        boxShadow:
          'var(--portal-shadow-3), 0 0 0 4px color-mix(in oklch, var(--portal-green-2) 8%, transparent), 0 0 32px color-mix(in oklch, var(--portal-green-2) 15%, transparent)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        color: 'var(--portal-fg-1)',
        fontSize: 'var(--portal-fs-sm)',
        cursor: 'pointer',
      }}
      aria-label={`${label} — ${eyebrow}`}
    >
      <span
        style={{
          position: 'relative',
          width: 20,
          height: 20,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-hidden
      >
        <span
          style={{
            position: 'absolute',
            width: ringR * 2,
            height: ringR * 2,
            borderRadius: 999,
            border: '1px solid var(--portal-green-2)',
            opacity: ringOpacity * 0.6,
            transform: 'translate(-50%,-50%)',
            left: '50%',
            top: '50%',
          }}
        />
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: 'var(--portal-green-2)',
            boxShadow: '0 0 12px var(--portal-green-glow), 0 0 24px var(--portal-green-glow)',
            transform: `scale(${breathe})`,
          }}
        />
      </span>
      <span
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          lineHeight: 1.15,
        }}
      >
        <span
          className="portal-meta"
          style={{ color: 'var(--portal-fg-5)', fontSize: 9, marginBottom: 1 }}
        >
          {eyebrow}
        </span>
        <span style={{ fontFamily: 'var(--portal-font-sans)', fontWeight: 500 }}>
          {label}
        </span>
      </span>
      <PortalKbd>⌘K</PortalKbd>
    </button>
  )
}
