'use client'

/**
 * AGUILA · Block 12 — Transportistas tab backed by the master carrier catalog.
 *
 * Swaps the Block 6c freetext field for `<CarrierSelector>`. Row shape on
 * the server is unchanged (carrier_id + carrier_name); selecting a carrier
 * writes both atomically via `useAutosaveChildRow.flush`.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_DIM,
  TEXT_PRIMARY,
  TEXT_MUTED,
} from '@/lib/design-system'
import type { TransportistaRow, CarrierType } from '@/lib/pedimento-types'
import { useAutosaveChildRow } from '@/lib/hooks/useAutosaveChildRow'
import { AutosaveIndicator } from '@/components/pedimento/AutosaveIndicator'
import { CarrierSelector } from '@/components/carriers/CarrierSelector'
import { usePedimento } from '@/components/pedimento/PedimentoContext'
import type { CarrierSearchResult } from '@/lib/carriers'

const BORDER_SILVER = 'rgba(192,197,206,0.22)'
const RED = '#EF4444'

const TYPE_OPTIONS: readonly { code: CarrierType; label: string }[] = [
  { code: 'mx', label: 'MX · Transportista mexicano' },
  { code: 'transfer', label: 'Transfer · Puente' },
  { code: 'foreign', label: 'Foreign · Transportista extranjero' },
]

export interface TransportistasTabProps {
  rows: TransportistaRow[]
}

export function TransportistasTab({ rows }: TransportistasTabProps) {
  const { pedimentoId } = usePedimento()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function callChildApi(body: Record<string, unknown>): Promise<boolean> {
    setErrorMessage(null)
    const res = await fetch(`/api/pedimento/${pedimentoId}/child`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: string }
      setErrorMessage(b.error ?? `HTTP ${res.status}`)
      return false
    }
    return true
  }

  function addRow() {
    startTransition(async () => {
      const ok = await callChildApi({
        op: 'add',
        table: 'pedimento_transportistas',
        row: { carrier_type: 'mx', carrier_name: null, carrier_id: null },
      })
      if (ok) router.refresh()
    })
  }

  function deleteRow(rowId: string) {
    startTransition(async () => {
      const ok = await callChildApi({
        op: 'delete',
        table: 'pedimento_transportistas',
        rowId,
      })
      if (ok) router.refresh()
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY }}>
            Transportistas
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: TEXT_MUTED }}>
            {rows.length} {rows.length === 1 ? 'fila' : 'filas'} · catálogo v1
          </p>
        </div>
        <button
          type="button"
          onClick={addRow}
          disabled={isPending}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 60,
            padding: '0 16px',
            fontSize: 13,
            fontWeight: 600,
            color: ACCENT_SILVER,
            background: 'rgba(192,197,206,0.08)',
            border: `1px solid ${BORDER_SILVER}`,
            borderRadius: 10,
            cursor: isPending ? 'not-allowed' : 'pointer',
            opacity: isPending ? 0.6 : 1,
          }}
        >
          <Plus size={14} /> Agregar
        </button>
      </div>

      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: '8px 12px',
            borderRadius: 10,
            border: `1px solid ${RED}66`,
            background: 'rgba(239,68,68,0.08)',
            color: RED,
            fontSize: 13,
          }}
        >
          {errorMessage}
        </div>
      )}

      {rows.length === 0 ? (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            borderRadius: 20,
            background: 'rgba(255,255,255,0.045)',
            border: `1px solid ${BORDER_SILVER}`,
            backdropFilter: 'blur(20px)',
            color: TEXT_MUTED,
            fontSize: 13,
          }}
        >
          Sin transportistas registrados.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((row, index) => (
            <TransportistaRowCard
              key={row.id}
              row={row}
              index={index}
              pedimentoId={pedimentoId}
              onDelete={() => deleteRow(row.id)}
              disabled={isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface RowCardProps {
  row: TransportistaRow
  index: number
  pedimentoId: string
  onDelete: () => void
  disabled: boolean
}

function TransportistaRowCard({
  row,
  index,
  pedimentoId,
  onDelete,
  disabled,
}: RowCardProps) {
  const { companyId } = usePedimento()
  const { status, lastSaved, errorMessage, flush } = useAutosaveChildRow({
    pedimentoId,
    table: 'pedimento_transportistas',
    rowId: row.id,
  })
  const [carrierType, setCarrierType] = useState<CarrierType>(row.carrier_type)
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(
    row.carrier_id ? { id: row.carrier_id, name: row.carrier_name ?? '' } : null,
  )

  function onTypeChange(next: CarrierType) {
    setCarrierType(next)
    flush('carrier_type', next)
    // Carrier type changed → clear selection so operator picks one of that type.
    if (selected) {
      setSelected(null)
      flush('carrier_id', null)
      flush('carrier_name', null)
    }
  }

  function onCarrierChange(carrier: CarrierSearchResult) {
    setSelected({ id: carrier.id, name: carrier.name })
    flush('carrier_id', carrier.id)
    flush('carrier_name', carrier.name)
  }

  return (
    <div
      style={{
        padding: 20,
        borderRadius: 20,
        background: 'rgba(255,255,255,0.045)',
        border: `1px solid ${BORDER_SILVER}`,
        backdropFilter: 'blur(20px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: ACCENT_SILVER_DIM,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Fila #{index + 1}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AutosaveIndicator status={status} lastSaved={lastSaved} errorMessage={errorMessage} />
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            aria-label="Eliminar fila"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 60,
              height: 60,
              borderRadius: 10,
              background: 'transparent',
              border: `1px solid ${BORDER_SILVER}`,
              color: RED,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            style={{
              fontSize: 11,
              color: TEXT_MUTED,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Tipo
          </label>
          <select
            value={carrierType}
            onChange={e => onTypeChange(e.target.value as CarrierType)}
            style={{
              minHeight: 60,
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.045)',
              color: TEXT_PRIMARY,
              border: `1px solid ${BORDER_SILVER}`,
              borderRadius: 10,
              fontSize: 14,
              outline: 'none',
            }}
          >
            {TYPE_OPTIONS.map(opt => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            style={{
              fontSize: 11,
              color: TEXT_MUTED,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Transportista
          </label>
          <CarrierSelector
            value={selected}
            onChange={onCarrierChange}
            carrierType={carrierType}
            operatorId={companyId}
            ariaLabel="Seleccionar transportista"
          />
        </div>
      </div>
    </div>
  )
}
