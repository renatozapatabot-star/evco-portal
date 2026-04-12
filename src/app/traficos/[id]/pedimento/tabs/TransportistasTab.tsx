'use client'

import type { TransportistaRow } from '@/lib/pedimento-types'
import { RepeatingRows, type Column } from '@/components/pedimento/RepeatingRows'
import { usePedimento } from '@/components/pedimento/PedimentoContext'

export interface TransportistasTabProps {
  rows: TransportistaRow[]
}

// Block 12 replaces `carrier_name` free-text with CarrierSelector (200+ carriers).
// For B6c we accept free text so the workflow is usable today.
const columns: readonly Column<TransportistaRow>[] = [
  {
    field: 'carrier_type',
    label: 'Tipo',
    variant: 'select',
    options: [
      { code: 'mx', label: 'MX · Transportista mexicano' },
      { code: 'transfer', label: 'Transfer · Puente' },
      { code: 'foreign', label: 'Foreign · Transportista extranjero' },
    ],
  },
  {
    field: 'carrier_name',
    label: 'Nombre',
    placeholder: 'Razón social',
    helpText: 'Bloque 12 sustituye este campo por catálogo (CarrierSelector)',
  },
  { field: 'carrier_id', label: 'Identificador', mono: true, placeholder: 'RFC / DOT / SCT' },
]

export function TransportistasTab({ rows }: TransportistasTabProps) {
  const { pedimentoId } = usePedimento()
  return (
    <RepeatingRows
      title="Transportistas"
      emptyMessage="Sin transportistas registrados."
      pedimentoId={pedimentoId}
      table="pedimento_transportistas"
      rows={rows}
      columns={columns}
      defaultNewRow={{ carrier_type: 'mx', carrier_name: null, carrier_id: null }}
    />
  )
}
