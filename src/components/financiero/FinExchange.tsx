'use client'

import { fmtDate } from '@/lib/format-utils'

/* ── Light tokens (DESIGN_SYSTEM.md v6) ── */
const D = {
  card: 'var(--bg-card)',
  cardBorder: 'var(--border)',
  gold: 'var(--gold)',
  textSec: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  mono: 'var(--font-mono)',
  r: 8,
} as const

export interface TipoCambio {
  tc: number
  fecha: string
  source: string
}

interface FinExchangeProps {
  tc: TipoCambio | null
  isMobile: boolean
}

export function FinExchange({ tc, isMobile }: FinExchangeProps) {
  return (
    <div style={{
      background: D.card,
      border: `1px solid ${D.cardBorder}`,
      borderRadius: D.r,
      padding: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexDirection: isMobile ? 'column' as const : 'row' as const,
      flexWrap: 'wrap',
      gap: 16,
    }}>
      <div>
        <p style={{ color: D.textSec, fontSize: 13, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Tipo de Cambio USD/MXN
        </p>
        <p style={{ fontSize: 32, fontWeight: 700, fontFamily: D.mono, margin: 0, color: D.gold }}>
          {tc ? `$${tc.tc.toFixed(4)}` : '...'}
        </p>
      </div>
      <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
        <p style={{ color: D.textSec, fontSize: 13, margin: '0 0 4px' }}>
          Última actualización
        </p>
        <p style={{ fontFamily: D.mono, fontSize: 14, margin: '0 0 4px' }}>
          {tc?.fecha ? fmtDate(tc.fecha) : '\u2014'}
        </p>
        <p style={{ color: D.textMuted, fontSize: 12, margin: 0 }}>
          Fuente: {tc?.source || '\u2014'}
        </p>
      </div>
    </div>
  )
}
