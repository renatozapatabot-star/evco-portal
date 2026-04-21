'use client'

import { AlertTriangle } from 'lucide-react'
import { AMBER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, GOLD } from '@/lib/design-system'
import { GlassCard } from './GlassCard'

interface Props {
  message?: string
  onRetry?: () => void
}

/**
 * Graceful SSR error boundary UI for cockpit surfaces. Renders inside the
 * same glass chrome as the rest of the cockpit so failure states feel
 * native, not like a system crash.
 */
export function CockpitErrorCard({ message, onRetry }: Props) {
  return (
    <GlassCard padding="32px 28px" style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start', maxWidth: 560, margin: '64px auto' }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: 'rgba(251,191,36,0.12)',
        border: '1px solid rgba(251,191,36,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <AlertTriangle size={24} color={AMBER} />
      </div>
      <div>
        <div style={{ fontSize: 'var(--aguila-fs-title, 24px)', fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: 'var(--aguila-ls-tight, -0.03em)' }}>
          El cockpit no cargó completamente
        </div>
        <div style={{ fontSize: 'var(--aguila-fs-body, 13px)', color: TEXT_SECONDARY, marginTop: 6, lineHeight: 1.5 }}>
          Detectamos un problema al traer tus datos. Tu sesión sigue activa — intentá recargar.
        </div>
        {message ? (
          <div style={{
            marginTop: 12,
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 'var(--aguila-fs-meta, 11px)',
            color: TEXT_MUTED,
            padding: '8px 10px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.06)',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {message}
          </div>
        ) : null}
      </div>
      {onRetry ? (
        <button
          onClick={onRetry}
          style={{
            minHeight: 44,
            padding: '10px 20px',
            borderRadius: 12,
            background: GOLD,
            color: '#0D0D0C',
            fontWeight: 700,
            fontSize: 13,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Reintentar
        </button>
      ) : null}
    </GlassCard>
  )
}
