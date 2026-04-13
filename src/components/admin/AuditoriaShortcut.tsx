'use client'

import Link from 'next/link'
import { FileDown, ChevronRight } from 'lucide-react'
import { GlassCard } from '@/components/aguila'
import { TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ACCENT_SILVER } from '@/lib/design-system'

export function AuditoriaShortcut() {
  return (
    <Link
      href="/admin/auditoria/generar"
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <GlassCard size="compact" hover>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            aria-hidden
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              flexShrink: 0,
            }}
          >
            <FileDown size={18} color={ACCENT_SILVER} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: '0.01em' }}>
              Generar auditoría semanal
            </div>
            <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 }}>
              Elige cliente + semana · descarga el PDF dark-theme
            </div>
          </div>
          <ChevronRight size={18} color={TEXT_MUTED} aria-hidden />
        </div>
      </GlassCard>
    </Link>
  )
}
