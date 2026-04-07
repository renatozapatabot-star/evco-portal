'use client'

import { FileText } from 'lucide-react'

/* ── Light tokens (DESIGN_SYSTEM.md v6) ── */
const D = {
  card: 'var(--bg-card)',
  gold: 'var(--gold)',
  goldSubtle: 'rgba(196,150,60,0.08)',
  goldBorder: 'rgba(196,150,60,0.35)',
  textSec: 'var(--text-secondary)',
  r: 8,
} as const

interface USMCACertsProps {
  isMobile: boolean
}

export function USMCACerts({ isMobile }: USMCACertsProps) {
  return (
    <div style={{
      background: D.card,
      border: `1px solid ${D.goldBorder}`,
      borderRadius: D.r,
      padding: isMobile ? 20 : 32,
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'flex-start' : 'center',
      gap: 20,
    }}>
      <div style={{
        background: D.goldSubtle,
        borderRadius: D.r,
        padding: 16,
        color: D.gold,
        display: 'flex',
        flexShrink: 0,
      }}>
        <FileText size={28} />
      </div>
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 6px' }}>
          Gestión de certificados USMCA próximamente
        </h3>
        <p style={{ color: D.textSec, fontSize: 14, margin: 0, lineHeight: 1.5 }}>
          Generación, seguimiento y validación de certificados de origen T-MEC.
          Criterios A, B, C, D con análisis automático por fracción arancelaria.
        </p>
      </div>
    </div>
  )
}
