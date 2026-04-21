'use client'

import type { CandadoRow } from '@/lib/pedimento-types'
import { RepeatingRows, type Column } from '@/components/pedimento/RepeatingRows'
import { usePedimento } from '@/components/pedimento/PedimentoContext'

export interface CandadosTabProps {
  rows: CandadoRow[]
}

const columns: readonly Column<CandadoRow>[] = [
  { field: 'seal_number', label: 'Número de candado', mono: true, placeholder: 'Sello' },
  {
    field: 'verification_status',
    label: 'Verificación',
    variant: 'select',
    options: [
      { code: 'pendiente', label: 'Pendiente' },
      { code: 'verificado', label: 'Verificado' },
      { code: 'violado', label: 'Violado' },
      { code: 'reemplazado', label: 'Reemplazado' },
    ],
  },
]

export function CandadosTab({ rows }: CandadosTabProps) {
  const { pedimentoId } = usePedimento()
  return (
    <RepeatingRows
      title="Candados"
      emptyMessage="Sin candados registrados."
      pedimentoId={pedimentoId}
      table="pedimento_candados"
      rows={rows}
      columns={columns}
      defaultNewRow={{ seal_number: null, verification_status: 'pendiente' }}
    />
  )
}
