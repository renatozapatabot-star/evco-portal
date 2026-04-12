'use client'

import type { ContribucionRow } from '@/lib/pedimento-types'
import { RepeatingRows, type Column } from '@/components/pedimento/RepeatingRows'
import { usePedimento } from '@/components/pedimento/PedimentoContext'
import { ACCENT_SILVER, TEXT_PRIMARY, TEXT_MUTED } from '@/lib/design-system'

export interface ContribucionesTabProps {
  rows: ContribucionRow[]
}

const CONTRIBUTION_TYPES = [
  { code: 'DTA', label: 'DTA · Derecho Trámite Aduanero' },
  { code: 'IGI', label: 'IGI · Impuesto General Importación' },
  { code: 'IVA', label: 'IVA' },
  { code: 'IEPS', label: 'IEPS' },
  { code: 'CC', label: 'Cuenta Corriente' },
  { code: 'PRV', label: 'Prevalidación' },
  { code: 'TMEC', label: 'T-MEC · Crédito' },
] as const

const columns: readonly Column<ContribucionRow>[] = [
  { field: 'contribution_type', label: 'Contribución', variant: 'select', options: CONTRIBUTION_TYPES },
  { field: 'rate', label: 'Tasa', variant: 'number', mono: true, placeholder: '0.0000' },
  { field: 'base', label: 'Base (MXN)', variant: 'number', mono: true, placeholder: '0.00' },
  { field: 'amount', label: 'Monto (MXN)', variant: 'number', mono: true, placeholder: '0.00' },
]

function fmtMxn(n: number): string {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function ContribucionesTab({ rows }: ContribucionesTabProps) {
  const { pedimentoId } = usePedimento()

  const subtotals = new Map<string, number>()
  let grandTotal = 0
  let tmecCreditFlagged = false
  for (const r of rows) {
    const key = (r.contribution_type ?? 'OTRO').toUpperCase()
    const amt = r.amount ?? 0
    subtotals.set(key, (subtotals.get(key) ?? 0) + amt)
    if (key === 'TMEC' && (r.amount ?? 0) !== 0) tmecCreditFlagged = true
    grandTotal += amt
  }

  const footer = rows.length > 0 ? (
    <div
      style={{
        padding: 20,
        borderRadius: 20,
        background: 'rgba(9,9,11,0.75)',
        border: '1px solid rgba(192,197,206,0.22)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: TEXT_MUTED,
        }}
      >
        Subtotales
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginTop: 12,
        }}
      >
        {Array.from(subtotals.entries()).map(([key, sum]) => (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {key}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 16,
                fontWeight: 700,
                color: TEXT_PRIMARY,
              }}
            >
              {fmtMxn(sum)} MXN
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 16,
          paddingTop: 16,
          borderTop: '1px solid rgba(192,197,206,0.18)',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 11, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Total de contribuciones
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 22,
            fontWeight: 800,
            color: ACCENT_SILVER,
          }}
        >
          {fmtMxn(grandTotal)} MXN
        </span>
      </div>
      {tmecCreditFlagged && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            borderRadius: 10,
            background: 'rgba(192,197,206,0.08)',
            border: '1px solid rgba(192,197,206,0.22)',
            fontSize: 12,
            color: ACCENT_SILVER,
          }}
        >
          T-MEC · Crédito aplicado. Verifica certificado de origen antes de firmar.
        </div>
      )}
    </div>
  ) : null

  return (
    <RepeatingRows
      title="Contribuciones"
      emptyMessage="Sin contribuciones registradas."
      pedimentoId={pedimentoId}
      table="pedimento_contribuciones"
      rows={rows}
      columns={columns}
      defaultNewRow={{ contribution_type: null, rate: null, base: null, amount: null }}
      footer={footer}
    />
  )
}
