'use client'

import { useMemo, useState } from 'react'
import { Layers } from 'lucide-react'
import {
  BORDER,
  GOLD,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'
import { useTrack } from '@/lib/telemetry/useTrack'
import { fmtCurrency } from '@/lib/format-utils'
import type { PartidaRow } from '../types'

interface PartidasTabProps {
  traficoId: string
  partidas: PartidaRow[]
}

type SortKey = 'fraccion' | 'valor'

export function PartidasTab({ traficoId, partidas }: PartidasTabProps) {
  const [sortKey, setSortKey] = useState<SortKey>('fraccion')
  const [openRowIdx, setOpenRowIdx] = useState<number | null>(null)
  const track = useTrack()

  const sorted = useMemo(() => {
    const copy = [...partidas]
    if (sortKey === 'valor') {
      copy.sort((a, b) => (Number(b.valor_comercial ?? 0) - Number(a.valor_comercial ?? 0)))
    } else {
      copy.sort((a, b) => {
        const fa = a.fraccion_arancelaria ?? a.fraccion ?? ''
        const fb = b.fraccion_arancelaria ?? b.fraccion ?? ''
        return fa.localeCompare(fb)
      })
    }
    return copy
  }, [partidas, sortKey])

  if (partidas.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          padding: '32px 16px',
          color: TEXT_MUTED,
        }}
      >
        <Layers size={24} />
        <div style={{ fontSize: 13, color: TEXT_SECONDARY }}>Sin partidas capturadas</div>
        <div
          style={{
            fontSize: 11,
            color: TEXT_MUTED,
            textAlign: 'center',
            maxWidth: 360,
          }}
        >
          Las partidas aparecerán al generar la hoja de clasificación.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 11, color: TEXT_MUTED }}>
          {partidas.length} partida{partidas.length === 1 ? '' : 's'}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <SortButton
            active={sortKey === 'fraccion'}
            onClick={() => setSortKey('fraccion')}
            label="Fracción"
          />
          <SortButton
            active={sortKey === 'valor'}
            onClick={() => setSortKey('valor')}
            label="Valor"
          />
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {[
                'Nº partida',
                'Fracción',
                'Descripción',
                'Cantidad',
                'País origen',
                'T-MEC',
                'Valor unitario',
                'Valor total',
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 700,
                    color: TEXT_MUTED,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '10px 12px',
                    borderBottom: `1px solid ${BORDER}`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const fraccion = p.fraccion_arancelaria ?? p.fraccion ?? '—'
              const cantidad = p.cantidad ?? p.cantidad_bultos ?? null
              const valorUnitario =
                p.valor_comercial !== null && cantidad && cantidad > 0
                  ? Number(p.valor_comercial) / cantidad
                  : null
              return (
                <tr
                  key={p.id ?? i}
                  onClick={() => {
                    setOpenRowIdx(i)
                    track('page_view', {
                      entityType: 'trafico_partida',
                      entityId: traficoId,
                      metadata: { event: 'partida_opened', fraccion },
                    })
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={cell(true)}>{p.numero_parte ?? '—'}</td>
                  <td style={cell(true)}>{fraccion}</td>
                  <td style={cellDesc}>{p.descripcion ?? '—'}</td>
                  <td style={cell(true, 'right')}>
                    {cantidad !== null ? `${cantidad}${p.umc ? ` ${p.umc}` : ''}` : '—'}
                  </td>
                  <td style={cell(false)}>{p.pais_origen ?? '—'}</td>
                  <td style={cell(false)}>
                    {p.tmec ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: GOLD,
                          padding: '2px 8px',
                          background: 'rgba(192,197,206,0.12)',
                          border: `1px solid ${GOLD}66`,
                          borderRadius: 999,
                        }}
                      >
                        T-MEC
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={cell(true, 'right')}>
                    {valorUnitario !== null ? fmtCurrency(valorUnitario, { currency: 'USD' }) : '—'}
                  </td>
                  <td style={cell(true, 'right')}>
                    {p.valor_comercial !== null ? fmtCurrency(p.valor_comercial, { currency: 'USD' }) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <a
          href={`/embarques/${encodeURIComponent(traficoId)}/clasificacion`}
          style={{
            minHeight: 60,
            padding: '0 20px',
            background: 'rgba(192,197,206,0.16)',
            color: TEXT_PRIMARY,
            border: `1px solid rgba(192,197,206,0.4)`,
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.02em',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          Generar hoja de clasificación
        </a>
        <button
          type="button"
          disabled
          title="Las partidas se capturan desde el sistema de pedimentos"
          style={{
            minHeight: 60,
            padding: '0 20px',
            background: 'rgba(255,255,255,0.03)',
            color: TEXT_MUTED,
            border: `1px dashed ${BORDER}`,
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'not-allowed',
            letterSpacing: '0.02em',
          }}
        >
          + Agregar partida (deshabilitado)
        </button>
      </div>

      {openRowIdx !== null && sorted[openRowIdx] && (
        <PartidaDrawer
          partida={sorted[openRowIdx]}
          onClose={() => setOpenRowIdx(null)}
        />
      )}
    </div>
  )
}

function SortButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 32,
        padding: '0 12px',
        background: active ? 'rgba(192,197,206,0.12)' : 'transparent',
        color: active ? TEXT_PRIMARY : TEXT_MUTED,
        border: `1px solid ${active ? 'rgba(192,197,206,0.4)' : BORDER}`,
        borderRadius: 8,
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </button>
  )
}

function cell(mono: boolean, align: 'left' | 'right' = 'left'): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderBottom: `1px solid ${BORDER}`,
    fontFamily: mono ? 'var(--font-mono)' : undefined,
    fontSize: 13,
    color: TEXT_SECONDARY,
    textAlign: align,
    whiteSpace: 'nowrap',
  }
}

const cellDesc: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: `1px solid ${BORDER}`,
  fontSize: 13,
  color: TEXT_PRIMARY,
  maxWidth: 320,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

function PartidaDrawer({
  partida,
  onClose,
}: {
  partida: PartidaRow
  onClose: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5,7,11,0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(520px, 100vw)',
          height: '100%',
          background: 'rgba(255,255,255,0.045)',
          borderLeft: `1px solid ${BORDER}`,
          padding: 24,
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: TEXT_MUTED,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 14,
          }}
        >
          Detalle de partida
        </div>
        <pre
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: TEXT_SECONDARY,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: 'rgba(0,0,0,0.3)',
            padding: 12,
            borderRadius: 12,
            border: `1px solid ${BORDER}`,
          }}
        >
          {JSON.stringify(partida, null, 2)}
        </pre>
        <button
          type="button"
          onClick={onClose}
          style={{
            minHeight: 60,
            width: '100%',
            marginTop: 16,
            background: 'rgba(255,255,255,0.05)',
            color: TEXT_PRIMARY,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}
