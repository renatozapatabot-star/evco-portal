'use client'

import type { DescargaRow } from '@/lib/pedimento-types'
import { RepeatingRows, type Column } from '@/components/pedimento/RepeatingRows'
import { usePedimento } from '@/components/pedimento/PedimentoContext'

export interface DescargasTabProps {
  rows: DescargaRow[]
}

const columns: readonly Column<DescargaRow>[] = [
  { field: 'dock_assignment', label: 'Andén / posición', mono: true, placeholder: 'A1..Z9' },
  {
    field: 'unloaded_at',
    label: 'Descargado (ISO)',
    mono: true,
    placeholder: 'YYYY-MM-DDTHH:mm',
    helpText: 'Formato ISO 8601 · hora local Laredo (America/Chicago)',
  },
  {
    field: 'notes',
    label: 'Notas',
    variant: 'textarea',
    placeholder: 'Observaciones de la descarga',
  },
]

export function DescargasTab({ rows }: DescargasTabProps) {
  const { pedimentoId } = usePedimento()
  return (
    <RepeatingRows
      title="Descargas"
      emptyMessage="Sin descargas registradas."
      pedimentoId={pedimentoId}
      table="pedimento_descargas"
      rows={rows}
      columns={columns}
      defaultNewRow={{ dock_assignment: null, unloaded_at: null, notes: null }}
    />
  )
}
