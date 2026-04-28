'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTrack } from '@/lib/telemetry/useTrack'
import {
  BG_CARD,
  BORDER,
  GLASS_BLUR,
  GLASS_SHADOW,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'
import { fmtDateTime, fmtKg } from '@/lib/format-utils'
import { formatPedimento } from '@/lib/format/pedimento'
import type { TraficoRow } from './types'
import type { SemaforoValue } from '@/components/aguila/SemaforoPill'
import { SemaforoPill } from '@/components/aguila/SemaforoPill'

type SectionId = 'pedimento' | 'peso' | 'cruce' | 'vucem'

interface BelowFoldProps {
  traficoId: string
  trafico: TraficoRow
  partidasCount: number
  /** Session role — client surfaces only show semáforo when verde (0);
   *  rojo/amarillo/null hide the entire row. Operator/admin/broker see
   *  everything regardless of color. Invariant #24. */
  role: string
}

function val(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return 'Sin registro'
  return String(v)
}

interface RowDef {
  label: string
  value: string
  mono?: boolean
  /** When set, renders the value as a button that opens this URL in a new tab. */
  href?: string
  /** V1 — optional ReactNode renderer for complex values (pills, chips, etc.) */
  valueNode?: React.ReactNode
}

/**
 * Four collapsible glass sections stacked under the main grid.
 * State persists to localStorage per-operator (scoped to `traficoId`
 * so switching embarques doesn't bleed expansion state).
 */
export function BelowFold({ traficoId, trafico, partidasCount, role }: BelowFoldProps) {
  const storageKey = `trafico.${traficoId}.belowfold.v1`
  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    pedimento: false,
    peso: false,
    cruce: false,
    vucem: false,
  })
  const track = useTrack()

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<Record<SectionId, boolean>>
      // Defer the setState a tick so React doesn't treat this as a
      // synchronous-effect cascade; idempotent on remount.
      queueMicrotask(() => {
        setOpen((prev) => ({ ...prev, ...parsed }))
      })
    } catch {
      // localStorage unavailable — keep defaults, no throw.
    }
  }, [storageKey])

  const toggle = useCallback(
    (id: SectionId) => {
      setOpen((prev) => {
        const next = { ...prev, [id]: !prev[id] }
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next))
        } catch {
          // ignore
        }
        if (!prev[id]) {
          track('page_view', {
            entityType: 'trafico_belowfold',
            entityId: traficoId,
            metadata: { event: 'below_fold_section_expanded', section: id },
          })
        }
        return next
      })
    },
    [storageKey, track, traficoId],
  )

  const pedimentoRows: RowDef[] = [
    {
      label: 'Pedimento',
      value: trafico.pedimento ? formatPedimento(trafico.pedimento, 'Sin registro') : 'Sin registro',
      mono: true,
      href: trafico.pedimento
        ? `/api/pedimento-pdf?trafico=${encodeURIComponent(traficoId)}`
        : undefined,
    },
    { label: 'Prevalidador', value: val(trafico.prevalidador) },
    {
      label: 'Banco operación #',
      value: val(trafico.banco_operacion_numero),
      mono: true,
    },
    {
      label: 'SAT transacción #',
      value: val(trafico.sat_transaccion_numero),
      mono: true,
    },
    {
      label: 'Tipo de cambio',
      value: trafico.tipo_cambio !== null ? String(trafico.tipo_cambio) : 'Sin registro',
      mono: true,
    },
  ]

  const pesoRows: RowDef[] = [
    {
      label: 'Peso bruto',
      value: trafico.peso_bruto !== null ? fmtKg(trafico.peso_bruto) : 'Sin registro',
      mono: true,
    },
    {
      label: 'Peso volumétrico',
      value:
        trafico.peso_volumetrico !== null ? fmtKg(trafico.peso_volumetrico) : 'Sin registro',
      mono: true,
    },
    {
      label: 'Partidas',
      value: partidasCount > 0 ? String(partidasCount) : 'Sin registro',
      mono: true,
    },
  ]

  // traficos.semaforo can come in as string ("0"|"1"|"2") from sync or
  // number from Supabase typed reads. Coerce defensively.
  const semaforoRaw = trafico.semaforo
  const semaforoInt =
    typeof semaforoRaw === 'number' ? semaforoRaw
    : typeof semaforoRaw === 'string' ? Number.parseInt(semaforoRaw, 10)
    : NaN
  const semaforoValue: SemaforoValue =
    semaforoInt === 0 || semaforoInt === 1 || semaforoInt === 2
      ? (semaforoInt as SemaforoValue)
      : null
  // V1 Clean Visibility (2026-04-24): Semáforo row hidden from client
  // surface entirely. Status is expressed as Cleared / Not cleared on
  // pedimento detail only; the semaforo pill is reserved for operator
  // surfaces. Operator/admin/broker still see all states here.
  const hideSemaforoForClient = role === 'client'

  const cruceRows: RowDef[] = [
    ...(hideSemaforoForClient ? [] : [{
      label: 'Semáforo',
      // V1 — raw int was leaking as "0" on screen. Pill renders colored dot + label.
      valueNode: <SemaforoPill value={semaforoValue} size="compact" />,
      value: '',
    } as RowDef]),
    {
      label: 'Fecha de cruce',
      value: trafico.fecha_cruce ? fmtDateTime(trafico.fecha_cruce) : 'Sin registro',
      mono: true,
    },
    { label: 'Tipo de operación', value: val(trafico.tipo_operacion) },
  ]

  const vucemRows: RowDef[] = [
    { label: 'DODA', value: val(trafico.doda_status) },
    { label: 'Nivel U', value: val(trafico.u_level), mono: true },
    { label: 'COVE', value: 'Sin registro' },
  ]
  // Hide the VUCEM section entirely while every value is "Sin registro" —
  // an empty panel of empties is noise. Reappears as soon as one field syncs.
  const vucemHasContent = vucemRows.some((r) => r.value !== 'Sin registro')

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        marginTop: 16,
      }}
    >
      <Section
        title="Referencia de pedimento"
        open={open.pedimento}
        onToggle={() => toggle('pedimento')}
        rows={pedimentoRows}
      />
      <Section
        title="Peso y volumen"
        open={open.peso}
        onToggle={() => toggle('peso')}
        rows={pesoRows}
      />
      <Section
        title="Cruce"
        open={open.cruce}
        onToggle={() => toggle('cruce')}
        rows={cruceRows}
      />
      {vucemHasContent && (
        <Section
          title="VUCEM"
          open={open.vucem}
          onToggle={() => toggle('vucem')}
          rows={vucemRows}
        />
      )}
    </div>
  )
}

function Section({
  title,
  open,
  onToggle,
  rows,
}: {
  title: string
  open: boolean
  onToggle: () => void
  rows: RowDef[]
}) {
  return (
    <div
      style={{
        background: BG_CARD,
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        border: `1px solid ${BORDER}`,
        borderRadius: 20,
        boxShadow: GLASS_SHADOW,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: '100%',
          minHeight: 60,
          padding: '14px 20px',
          background: 'transparent',
          color: TEXT_PRIMARY,
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          fontSize: 'var(--aguila-fs-body)',
          fontWeight: 700,
          letterSpacing: '0.02em',
        }}
      >
        <span>{title}</span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open && (
        <div style={{ padding: '0 20px 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map((r) => (
              <div
                key={r.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED }}>{r.label}</span>
                {r.href ? (
                  <button
                    type="button"
                    onClick={() => window.open(r.href!, '_blank')}
                    title="Abrir PDF del pedimento"
                    style={{
                      fontSize: 'var(--aguila-fs-body)',
                      color: TEXT_PRIMARY,
                      fontFamily: r.mono ? 'var(--font-mono)' : undefined,
                      fontWeight: 600,
                      textAlign: 'right',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '60%',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      textUnderlineOffset: 3,
                    }}
                  >
                    {r.value}
                  </button>
                ) : r.valueNode ? (
                  <div style={{ maxWidth: '60%', display: 'flex', justifyContent: 'flex-end' }}>
                    {r.valueNode}
                  </div>
                ) : (
                  <span
                    style={{
                      fontSize: 'var(--aguila-fs-body)',
                      color: r.value === 'Sin registro' ? TEXT_MUTED : TEXT_SECONDARY,
                      fontFamily: r.mono ? 'var(--font-mono)' : undefined,
                      fontWeight: 600,
                      textAlign: 'right',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '60%',
                    }}
                  >
                    {r.value}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
