'use client'

import type { PagoVirtualRow } from '@/lib/pedimento-types'
import { RepeatingRows, type Column } from '@/components/pedimento/RepeatingRows'
import { usePedimento } from '@/components/pedimento/PedimentoContext'

export interface PagosVirtualesTabProps {
  rows: PagoVirtualRow[]
}

// Block 11 replaces `bank_code` free-text with a real BankSelector (75+ banks).
// For B6c we accept free text so the workflow is usable today.
const columns: readonly Column<PagoVirtualRow>[] = [
  {
    field: 'bank_code',
    label: 'Clave de banco',
    mono: true,
    placeholder: '002 · BBVA',
    helpText: 'Bloque 11 sustituye este campo por selector de bancos',
  },
  {
    field: 'payment_form',
    label: 'Forma de pago',
    variant: 'select',
    options: [
      { code: 'PECE', label: 'PECE · Pago Electrónico' },
      { code: 'DEP', label: 'Depósito en ventanilla' },
      { code: 'REV', label: 'Cheque de caja' },
    ],
  },
  { field: 'amount', label: 'Monto (MXN)', variant: 'number', mono: true, placeholder: '0.00' },
  { field: 'reference', label: 'Referencia de pago', mono: true, placeholder: 'Folio bancario' },
]

export function PagosVirtualesTab({ rows }: PagosVirtualesTabProps) {
  const { pedimentoId } = usePedimento()
  return (
    <RepeatingRows
      title="Formas de Pago Virtuales"
      emptyMessage="Sin pagos virtuales registrados."
      pedimentoId={pedimentoId}
      table="pedimento_pagos_virtuales"
      rows={rows}
      columns={columns}
      defaultNewRow={{
        bank_code: null,
        payment_form: null,
        amount: null,
        reference: null,
      }}
    />
  )
}
