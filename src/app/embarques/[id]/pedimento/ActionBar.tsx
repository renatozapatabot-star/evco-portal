'use client'

import { useState } from 'react'
import { ACCENT_SILVER, ACCENT_SILVER_DIM } from '@/lib/design-system'

export interface ActionBarProps {
  pedimentoId: string
}

export function ActionBar({ pedimentoId }: ActionBarProps) {
  const [status, setStatus] = useState<'idle' | 'validating' | 'done'>('idle')
  const [summary, setSummary] = useState<string>('Autoguardado activo · próximamente')

  async function handleValidate() {
    setStatus('validating')
    try {
      const res = await fetch(`/api/pedimento/${pedimentoId}/validate`, { method: 'GET' })
      if (!res.ok) {
        setSummary('Error al validar pedimento')
        return
      }
      const data = await res.json() as {
        errors_count?: number
        warnings_count?: number
        can_submit?: boolean
      }
      setSummary(
        `${data.errors_count ?? 0} errores · ${data.warnings_count ?? 0} advertencias` +
        (data.can_submit ? ' · listo' : ''),
      )
      setStatus('done')
    } catch {
      setSummary('Error al validar pedimento')
      setStatus('idle')
    }
  }

  return (
    <div
      role="toolbar"
      aria-label="Acciones del pedimento"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'rgba(9,9,11,0.92)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(12px)',
        zIndex: 15,
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {summary}
      </span>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        disabled
        title="Autoguardado — activo en B6b"
        style={{
          minHeight: 60,
          padding: '0 20px',
          fontSize: 13,
          fontWeight: 500,
          background: 'transparent',
          color: ACCENT_SILVER_DIM,
          border: '1px solid rgba(192,197,206,0.18)',
          borderRadius: 12,
          cursor: 'not-allowed',
        }}
      >
        Guardar borrador
      </button>
      <button
        type="button"
        onClick={handleValidate}
        disabled={status === 'validating'}
        style={{
          minHeight: 60,
          padding: '0 20px',
          fontSize: 13,
          fontWeight: 600,
          background: 'transparent',
          color: ACCENT_SILVER,
          border: `1px solid ${ACCENT_SILVER}`,
          borderRadius: 12,
          cursor: status === 'validating' ? 'wait' : 'pointer',
        }}
      >
        {status === 'validating' ? 'Validando…' : 'Validar pedimento'}
      </button>
      <button
        type="button"
        disabled
        title="Próximamente — Block 9 (AduanaNet interface generator)"
        style={{
          minHeight: 60,
          padding: '0 20px',
          fontSize: 13,
          fontWeight: 500,
          background: 'rgba(192,197,206,0.08)',
          color: ACCENT_SILVER_DIM,
          border: '1px solid rgba(192,197,206,0.18)',
          borderRadius: 12,
          cursor: 'not-allowed',
        }}
      >
        Generar interfaz · Próximamente
      </button>
    </div>
  )
}
