/**
 * Error boundary for /prospect/[token].
 * Renders calm Spanish copy + a "contact Tito" CTA. Never leaks the
 * underlying error message to the prospect.
 */

'use client'

import { useEffect } from 'react'
import { GlassCard } from '@/components/aguila/GlassCard'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_BRIGHT,
  ACCENT_SILVER_DIM,
  BG_DEEP,
  SILVER_GRADIENT,
} from '@/lib/design-system'

export default function ProspectError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface to the runtime so we can correlate with audit_log if needed.
    console.error('[prospect/[token]] render failed:', error.digest || error.message)
  }, [error])

  return (
    <div
      className="aguila-dark aguila-canvas"
      style={{
        minHeight: '100vh',
        padding: '40px 16px',
        color: ACCENT_SILVER,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div className="aguila-aura" aria-hidden="true" />
      <div style={{ maxWidth: 480, width: '100%', position: 'relative', zIndex: 1 }}>
        <GlassCard tier="hero" padding={28}>
          <div style={{ textAlign: 'center' }}>
            <p style={{
              margin: 0, fontSize: 'var(--aguila-fs-meta, 11px)', color: ACCENT_SILVER_DIM,
              letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600,
            }}>
              Renato Zapata &amp; Company
            </p>
            <h1 style={{
              margin: '8px 0 4px', fontSize: 22 /* WHY: between fs-headline (20) and fs-title (24); single-card error page step */, color: ACCENT_SILVER_BRIGHT, fontWeight: 700,
              letterSpacing: '-0.01em',
            }}>
              Vista no disponible por el momento
            </h1>
            <p style={{ margin: '8px 0 20px', fontSize: 'var(--aguila-fs-section, 14px)', color: ACCENT_SILVER, lineHeight: 1.5 }}>
              Esta vista preliminar tuvo un problema al cargarse. Intenta de nuevo
              en unos segundos o contacta a Renato Zapata III directamente.
            </p>
            <button
              onClick={() => reset()}
              style={{
                minHeight: 48,
                padding: '0 24px',
                borderRadius: 12,
                border: '1px solid rgba(192,197,206,0.4)',
                background: SILVER_GRADIENT,
                color: BG_DEEP,
                fontSize: 'var(--aguila-fs-section, 14px)',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Reintentar
            </button>
            <p style={{
              marginTop: 24, fontSize: 9 /* WHY: matches AguilaFooter weight progression */, color: ACCENT_SILVER_DIM,
              letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              Patente 3596 · Aduana 240 · Laredo TX · Est. 1941
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
