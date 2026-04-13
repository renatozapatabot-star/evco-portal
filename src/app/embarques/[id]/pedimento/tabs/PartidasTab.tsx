'use client'

/**
 * AGUILA · Block 6b — Partidas tab wrapper.
 * Reuses Block 1's canonical PartidasTab from the embarque detail view.
 * Partidas are managed at the embarque level; no autosave here.
 */

import Link from 'next/link'
import { PartidasTab as TraficoPartidasTab } from '@/app/embarques/[id]/tabs/PartidasTab'
import type { PartidaRow } from '@/app/embarques/[id]/types'
import { ACCENT_SILVER_DIM } from '@/lib/design-system'

export interface PartidasTabProps {
  traficoId: string
  partidas: PartidaRow[]
}

export function PartidasTab({ traficoId, partidas }: PartidasTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          padding: 20,
          borderRadius: 20,
          background: 'rgba(9,9,11,0.75)',
          border: '1px solid rgba(192,197,206,0.18)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <TraficoPartidasTab traficoId={traficoId} partidas={partidas} />
      </div>
      <div style={{ fontSize: 11, color: ACCENT_SILVER_DIM }}>
        Las partidas se gestionan al nivel del embarque.{' '}
        <Link
          href={`/embarques/${encodeURIComponent(traficoId)}#partidas`}
          style={{ color: ACCENT_SILVER_DIM, textDecoration: 'underline' }}
        >
          Ir a edición de partidas
        </Link>
      </div>
    </div>
  )
}
