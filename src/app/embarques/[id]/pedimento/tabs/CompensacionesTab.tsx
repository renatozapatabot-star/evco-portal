'use client'

import type { CompensacionRow } from '@/lib/pedimento-types'
import { RepeatingRows, type Column } from '@/components/pedimento/RepeatingRows'
import { usePedimento } from '@/components/pedimento/PedimentoContext'

export interface CompensacionesTabProps {
  rows: CompensacionRow[]
}

const COMPENSACION_TYPES = [
  { code: 'DTA', label: 'DTA · Derecho Trámite Aduanero' },
  { code: 'IGI', label: 'IGI · Impuesto General Importación' },
  { code: 'IVA', label: 'IVA' },
  { code: 'CC', label: 'Cuenta Corriente' },
  { code: 'OTRO', label: 'Otro' },
] as const

const columns: readonly Column<CompensacionRow>[] = [
  {
    field: 'compensacion_type',
    label: 'Tipo',
    variant: 'select',
    options: COMPENSACION_TYPES,
  },
  { field: 'amount', label: 'Monto (MXN)', variant: 'number', mono: true, placeholder: '0.00' },
  { field: 'reference', label: 'Referencia', mono: true, placeholder: 'Folio / clave' },
]

export function CompensacionesTab({ rows }: CompensacionesTabProps) {
  const { pedimentoId } = usePedimento()
  return (
    <RepeatingRows
      title="Compensaciones"
      emptyMessage="Sin compensaciones registradas."
      pedimentoId={pedimentoId}
      table="pedimento_compensaciones"
      rows={rows}
      columns={columns}
      defaultNewRow={{ compensacion_type: null, amount: null, reference: null }}
    />
  )
}
