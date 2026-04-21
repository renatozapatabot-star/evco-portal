'use client'

import type { CuentaGarantiaRow } from '@/lib/pedimento-types'
import { RepeatingRows, type Column } from '@/components/pedimento/RepeatingRows'
import { usePedimento } from '@/components/pedimento/PedimentoContext'

export interface CuentasGarantiaTabProps {
  rows: CuentaGarantiaRow[]
}

const columns: readonly Column<CuentaGarantiaRow>[] = [
  {
    field: 'account_reference',
    label: 'Referencia de cuenta',
    mono: true,
    placeholder: 'Folio de cuenta de garantía',
  },
  { field: 'amount', label: 'Monto (MXN)', variant: 'number', mono: true, placeholder: '0.00' },
]

export function CuentasGarantiaTab({ rows }: CuentasGarantiaTabProps) {
  const { pedimentoId } = usePedimento()
  return (
    <RepeatingRows
      title="Cuentas de Garantía"
      emptyMessage="Sin cuentas de garantía registradas."
      pedimentoId={pedimentoId}
      table="pedimento_cuentas_garantia"
      rows={rows}
      columns={columns}
      defaultNewRow={{ account_reference: null, amount: null }}
    />
  )
}
