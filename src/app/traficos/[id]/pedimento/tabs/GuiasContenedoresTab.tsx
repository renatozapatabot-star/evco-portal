'use client'

import type { GuiaRow } from '@/lib/pedimento-types'
import { RepeatingRows, type Column } from '@/components/pedimento/RepeatingRows'
import { usePedimento } from '@/components/pedimento/PedimentoContext'

export interface GuiasContenedoresTabProps {
  rows: GuiaRow[]
}

const columns: readonly Column<GuiaRow>[] = [
  {
    field: 'guia_type',
    label: 'Tipo',
    variant: 'select',
    options: [
      { code: 'MASTER', label: 'Master' },
      { code: 'HOUSE', label: 'House' },
      { code: 'BL', label: 'Bill of Lading' },
      { code: 'AWB', label: 'Air Waybill' },
      { code: 'CARTA', label: 'Carta porte' },
    ],
  },
  { field: 'guia_number', label: 'Número de guía', mono: true, placeholder: 'Folio' },
  { field: 'carrier', label: 'Transportista', placeholder: 'Nombre del transportista' },
  {
    field: 'container_number',
    label: 'Contenedor',
    mono: true,
    placeholder: 'XXXX0000000',
    helpText: 'Formato ISO 6346: 4 letras + 7 dígitos',
  },
]

export function GuiasContenedoresTab({ rows }: GuiasContenedoresTabProps) {
  const { pedimentoId } = usePedimento()
  return (
    <RepeatingRows
      title="Guías / Contenedores"
      emptyMessage="Sin guías o contenedores registrados."
      pedimentoId={pedimentoId}
      table="pedimento_guias"
      rows={rows}
      columns={columns}
      defaultNewRow={{
        guia_type: null,
        guia_number: null,
        carrier: null,
        container_number: null,
      }}
    />
  )
}
