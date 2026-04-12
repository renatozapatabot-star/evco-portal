'use client'

// Block 7 · Corridor Map — right rail that slides in when a pulse is clicked.
// Desktop: 320px pinned. Mobile: full-screen sheet via corridor.css override.

import Link from 'next/link'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_DIM,
  BG_ELEVATED,
  BORDER_HAIRLINE,
  TEXT_TERTIARY,
} from '@/lib/design-system'
import { fmtDateTime } from '@/lib/format-utils'
import type { ActiveTraficoPulse } from '@/types/corridor'

export type SelectedTraficoAction = 'pedimento' | 'expediente' | 'cronologia' | 'close'

export interface SelectedTraficoRailProps {
  pulse: ActiveTraficoPulse | null
  onClose: () => void
  onAction?: (action: SelectedTraficoAction, traficoId: string) => void
}

export function SelectedTraficoRail({ pulse, onClose, onAction }: SelectedTraficoRailProps) {
  if (!pulse) return null

  const handleAction = (action: SelectedTraficoAction) => {
    if (onAction) onAction(action, pulse.traficoId)
  }

  const links: Array<{ action: Exclude<SelectedTraficoAction, 'close'>; label: string; href: string }> = [
    { action: 'pedimento', label: 'Ver pedimento', href: `/traficos/${encodeURIComponent(pulse.traficoId)}/pedimento` },
    { action: 'expediente', label: 'Ver expediente', href: `/traficos/${encodeURIComponent(pulse.traficoId)}#documentos` },
    { action: 'cronologia', label: 'Ver cronología', href: `/traficos/${encodeURIComponent(pulse.traficoId)}#cronologia` },
  ]

  return (
    <aside
      className="aguila-corridor-rail"
      aria-label={`Detalle de tráfico ${pulse.traficoId}`}
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        bottom: 16,
        width: 320,
        padding: 20,
        background: BG_ELEVATED,
        border: `1px solid ${BORDER_HAIRLINE}`,
        borderRadius: 20,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 600,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
            fontSize: 9,
            letterSpacing: '0.18em',
            color: TEXT_TERTIARY,
          }}
        >
          TRÁFICO SELECCIONADO
        </span>
        <button
          onClick={() => {
            handleAction('close')
            onClose()
          }}
          aria-label="Cerrar"
          style={{
            height: 36,
            minWidth: 60,
            padding: '0 12px',
            background: 'transparent',
            border: `1px solid ${BORDER_HAIRLINE}`,
            borderRadius: 10,
            color: ACCENT_SILVER_DIM,
            fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Cerrar
        </button>
      </div>

      <div>
        <div
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 16,
            color: ACCENT_SILVER,
          }}
        >
          {pulse.traficoId}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
            fontSize: 13,
            color: ACCENT_SILVER_DIM,
            marginTop: 2,
          }}
        >
          {pulse.cliente}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 10, letterSpacing: '0.14em', color: TEXT_TERTIARY }}>
          ESTADO
        </span>
        <span
          style={{
            fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
            fontSize: 13,
            color: ACCENT_SILVER,
          }}
        >
          {pulse.position.label}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 11,
            color: TEXT_TERTIARY,
          }}
        >
          {pulse.latestEvent ? fmtDateTime(pulse.latestEvent.created_at) : 'Sin eventos'}
        </span>
      </div>

      {pulse.operatorId && (
        <div>
          <span style={{ fontSize: 10, letterSpacing: '0.14em', color: TEXT_TERTIARY }}>OPERADOR</span>
          <div
            style={{
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: 12,
              color: ACCENT_SILVER_DIM,
              marginTop: 2,
            }}
          >
            {pulse.operatorId}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
        {links.map(l => (
          <Link
            key={l.action}
            href={l.href}
            onClick={() => handleAction(l.action)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 60,
              padding: '0 16px',
              background: 'transparent',
              border: `1px solid ${BORDER_HAIRLINE}`,
              borderRadius: 12,
              color: ACCENT_SILVER,
              fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </aside>
  )
}

export default SelectedTraficoRail
