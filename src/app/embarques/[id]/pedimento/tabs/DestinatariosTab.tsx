'use client'

import type { DestinatarioRow } from '@/lib/pedimento-types'
import { RepeatingRows, type Column } from '@/components/pedimento/RepeatingRows'
import { usePedimento } from '@/components/pedimento/PedimentoContext'

export interface DestinatariosTabProps {
  rows: DestinatarioRow[]
}

function addrToString(addr: Record<string, unknown> | null | undefined): string {
  if (!addr || typeof addr !== 'object') return ''
  const full = (addr as Record<string, unknown>).full
  if (typeof full === 'string' && full.length > 0) return full
  const parts = ['street', 'city', 'state', 'zip']
    .map((k) => (addr as Record<string, unknown>)[k])
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
  return parts.join(', ')
}

const columns: readonly Column<DestinatarioRow>[] = [
  {
    field: 'razon_social',
    label: 'Razón social',
    placeholder: 'Nombre del destinatario',
  },
  {
    field: 'rfc',
    label: 'RFC',
    mono: true,
    placeholder: 'RFC del destinatario',
    helpText: 'Formato SAT: 3-4 letras + 6 dígitos + 3 alfanuméricos',
  },
  {
    field: 'address',
    label: 'Domicilio',
    variant: 'textarea',
    placeholder: 'Calle, ciudad, estado, C.P.',
    getValue: (r) => addrToString(r.address as Record<string, unknown>),
    serialize: (raw) => {
      const t = raw.trim()
      if (t.length === 0) return {}
      // Store the free-form address as `full` key. Block 15 client master
      // will expand into structured street/city/state/zip.
      return { full: t }
    },
  },
]

export function DestinatariosTab({ rows }: DestinatariosTabProps) {
  const { pedimentoId } = usePedimento()
  return (
    <RepeatingRows
      title="Destinatarios"
      emptyMessage="Sin destinatarios registrados. Agrega uno para continuar."
      pedimentoId={pedimentoId}
      table="pedimento_destinatarios"
      rows={rows}
      columns={columns}
      defaultNewRow={{ razon_social: null, rfc: null, address: {} }}
    />
  )
}
