'use client'

import Link from 'next/link'
import type { PedimentoFacturaRow } from '@/lib/pedimento-types'
import { RepeatingRows, type Column } from '@/components/pedimento/RepeatingRows'
import { usePedimento } from '@/components/pedimento/PedimentoContext'
import { ACCENT_SILVER, TEXT_MUTED } from '@/lib/design-system'

export interface FacturasProveedoresTabProps {
  facturas: PedimentoFacturaRow[]
}

const columns: readonly Column<PedimentoFacturaRow>[] = [
  { field: 'supplier_name', label: 'Proveedor', placeholder: 'Razón social del proveedor' },
  { field: 'supplier_tax_id', label: 'RFC / Tax ID', mono: true, placeholder: 'RFC o TAX ID' },
  { field: 'invoice_number', label: 'Número de factura', mono: true, placeholder: 'Folio' },
  {
    field: 'invoice_date',
    label: 'Fecha (YYYY-MM-DD)',
    mono: true,
    placeholder: '2026-04-10',
  },
  {
    field: 'currency',
    label: 'Moneda',
    variant: 'select',
    options: [
      { code: 'MXN', label: 'MXN · Pesos mexicanos' },
      { code: 'USD', label: 'USD · Dólares' },
      { code: 'EUR', label: 'EUR · Euros' },
      { code: 'CNY', label: 'CNY · Yuan' },
    ],
  },
  { field: 'amount', label: 'Monto', variant: 'number', mono: true, placeholder: '0.00' },
]

export function FacturasProveedoresTab({ facturas }: FacturasProveedoresTabProps) {
  const { pedimentoId } = usePedimento()

  const bankLink = (
    <div
      style={{
        padding: 16,
        borderRadius: 20,
        background: 'rgba(192,197,206,0.06)',
        border: '1px solid rgba(192,197,206,0.22)',
        fontSize: 'var(--aguila-fs-body)',
        color: TEXT_MUTED,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <span>
        Facturas asignadas a este pedimento. Para asignar desde el banco de facturas,
        abre el banco y usa la acción Asignar.
      </span>
      <Link
        href="/banco-facturas?status=unassigned"
        style={{
          minHeight: 44,
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0 16px',
          fontSize: 'var(--aguila-fs-body)',
          fontWeight: 600,
          color: ACCENT_SILVER,
          background: 'rgba(192,197,206,0.08)',
          border: '1px solid rgba(192,197,206,0.22)',
          borderRadius: 10,
          textDecoration: 'none',
        }}
      >
        Ir al banco de facturas
      </Link>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {bankLink}
      <RepeatingRows
        title="Facturas / Proveedores"
        emptyMessage="Sin facturas asignadas. Agrega manualmente o asigna desde el banco."
        pedimentoId={pedimentoId}
        table="pedimento_facturas"
        rows={facturas}
        columns={columns}
        defaultNewRow={{
          supplier_name: null,
          supplier_tax_id: null,
          invoice_number: null,
          invoice_date: null,
          currency: 'USD',
          amount: null,
        }}
      />
    </div>
  )
}
