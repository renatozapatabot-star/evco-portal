'use client'

import { useEffect, useState } from 'react'

export interface VizCatalogProps {
  /** Fraction currently being analyzed. Default matches the reference. */
  fraccion?: string
  /** Spanish description under the fraccion. */
  descripcion?: string
}

/**
 * Mini-screen showing "FRACCIÓN IA · ANALIZANDO" with a confidence bar
 * filling from 40% → 98% over time. Scanline animates top-to-bottom.
 * Used on the Catálogo module card.
 *
 * Ported from screen-dashboard.jsx:234-288.
 */
// Default preview shows a polymer fracción (3907.40.04 — policarbonato),
// matching EVCO's IMMEX domain (plastics injection). Audit 2026-04-19
// flagged the prior default (8471.30.01 = laptops, "Máquinas automáticas")
// as tonally wrong for a plastics-shop dashboard — Ursula reads it as
// either demo data or a leak from another tenant.
//
// Callers can override via props for tenant-specific samples.
export function VizCatalog({
  fraccion = '3907.40.04',
  descripcion = 'Policarbonato en formas primarias',
}: VizCatalogProps) {
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

  const conf = Math.min(98, Math.floor(40 + (phase * 20) % 60))

  return (
    <div
      style={{
        height: 88,
        background: 'var(--portal-ink-0)',
        border: '1px solid var(--portal-line-1)',
        borderRadius: 'var(--portal-r-2)',
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontFamily: 'var(--portal-font-mono)',
        fontSize: 9,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* scan line */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: 1,
          background: 'linear-gradient(90deg, transparent, var(--portal-green-2), transparent)',
          opacity: 0.6,
          top: `${(phase * 40) % 100}%`,
          transition: 'top 100ms linear',
        }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          color: 'var(--portal-fg-5)',
          letterSpacing: '0.12em',
        }}
      >
        <span>FRACCIÓN IA</span>
        <span style={{ color: 'var(--portal-green-2)' }}>● ANALIZANDO</span>
      </div>
      <div
        style={{
          color: 'var(--portal-fg-1)',
          fontSize: 13,
          letterSpacing: '0.02em',
        }}
      >
        {fraccion}
      </div>
      <div
        style={{
          color: 'var(--portal-fg-4)',
          fontSize: 9,
          letterSpacing: '0.08em',
          lineHeight: 1.3,
        }}
      >
        {descripcion}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto' }}>
        <div
          style={{
            flex: 1,
            height: 3,
            background: 'var(--portal-ink-3)',
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${conf}%`,
              background: 'var(--portal-green-2)',
              boxShadow: '0 0 8px var(--portal-green-glow)',
              transition: 'width 300ms var(--portal-ease-out)',
            }}
          />
        </div>
        <span style={{ color: 'var(--portal-green-2)', fontSize: 10 }}>{conf}%</span>
      </div>
    </div>
  )
}
