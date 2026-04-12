'use client'

/**
 * PartidasTab — reuse shim.
 *
 * Block 1's canonical PartidasTab lives in src/app/traficos/[id]/tabs/PartidasTab.tsx
 * and requires full partida rows plus trafico metadata that this pedimento shell
 * does not yet fetch. For B6a we render a thin placeholder that points to the
 * existing tráfico partidas view; B6b/B6c wire the real component once the
 * shared prop shape is agreed.
 */

import Link from 'next/link'
import { ACCENT_SILVER } from '@/lib/design-system'

export interface PartidasTabProps {
  traficoId: string
}

export function PartidasTab({ traficoId }: PartidasTabProps) {
  return (
    <div
      style={{
        padding: 32,
        borderRadius: 20,
        background: 'rgba(9,9,11,0.75)',
        border: '1px solid rgba(192,197,206,0.18)',
        backdropFilter: 'blur(20px)',
        color: 'var(--text-secondary)',
      }}
    >
      <h2 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)', fontWeight: 600 }}>
        Partidas
      </h2>
      <p style={{ marginTop: 12, fontSize: 13 }}>
        Ver partidas en la vista del tráfico (reuso de Block 1 llega en Slice B6b).
      </p>
      <Link
        href={`/traficos/${encodeURIComponent(traficoId)}#partidas`}
        style={{
          display: 'inline-block',
          marginTop: 16,
          minHeight: 60,
          padding: '18px 20px',
          fontSize: 13,
          fontWeight: 600,
          color: ACCENT_SILVER,
          border: `1px solid ${ACCENT_SILVER}`,
          borderRadius: 12,
          textDecoration: 'none',
        }}
      >
        Abrir partidas del tráfico
      </Link>
    </div>
  )
}
