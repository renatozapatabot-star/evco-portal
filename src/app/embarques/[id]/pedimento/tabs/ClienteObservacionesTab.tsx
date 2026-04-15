'use client'

/**
 * ZAPATA AI · Block 6b — Cliente / Observaciones / Identificadores tab.
 */

import { useState } from 'react'
import type { PedimentoRow } from '@/lib/pedimento-types'
import { AutosaveField } from '@/components/pedimento/AutosaveField'
import { AutosaveIndicator } from '@/components/pedimento/AutosaveIndicator'
import { usePedimento, errorFor } from '@/components/pedimento/PedimentoContext'
import { useAutosaveField } from '@/lib/hooks/useAutosaveField'
import { ACCENT_SILVER, ACCENT_SILVER_DIM } from '@/lib/design-system'
import { useTrack } from '@/lib/telemetry/useTrack'

const RED = '#EF4444'

export interface ClienteObservacionesTabProps {
  pedimento: PedimentoRow
  clienteName: string | null
}

export function ClienteObservacionesTab({ pedimento, clienteName }: ClienteObservacionesTabProps) {
  const { pedimentoId, validationErrors, requestValidation } = usePedimento()
  const track = useTrack()

  const onFocus = (field: string) =>
    track('page_view', { metadata: { event: 'pedimento_field_focused', pedimentoId, field } })
  const onSaved = (field: string) => {
    track('page_view', { metadata: { event: 'pedimento_field_saved', pedimentoId, field } })
    requestValidation()
  }
  const onError = (field: string, msg: string) =>
    track('page_view', { metadata: { event: 'pedimento_field_save_failed', pedimentoId, field, msg } })

  const e = (field: string): string | undefined =>
    errorFor(validationErrors, 'cliente_observaciones', field)?.message

  // Identifiers are a single jsonb column. We autosave the whole object whenever
  // the user adds/removes/edits a row by funneling through `useAutosaveField`
  // with serializer=JSON passthrough.
  const [rows, setRows] = useState<{ key: string; value: string }[]>(() => {
    const entries = Object.entries(pedimento.identifiers ?? {})
    return entries.map(([k, v]) => ({ key: k, value: String(v) }))
  })

  const idAutosave = useAutosaveField<string>({
    pedimentoId,
    tab: 'cliente_observaciones',
    field: 'identifiers',
    initialValue: JSON.stringify(pedimento.identifiers ?? {}),
    serializer: (v) => {
      try {
        return JSON.parse(v) as Record<string, string>
      } catch {
        return {}
      }
    },
    onSaved: () => onSaved('identifiers'),
    onError: (m) => onError('identifiers', m),
  })

  const commit = (next: { key: string; value: string }[]) => {
    setRows(next)
    const obj: Record<string, string> = {}
    for (const r of next) {
      if (r.key.trim().length > 0) obj[r.key] = r.value
    }
    idAutosave.onChange(JSON.stringify(obj))
  }

  const identifiersError = e('identifiers')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          padding: 20,
          borderRadius: 20,
          background: 'rgba(255,255,255,0.045)',
          border: '1px solid rgba(192,197,206,0.18)',
          backdropFilter: 'blur(20px)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
        }}
      >
        <AutosaveField
          pedimentoId={pedimentoId}
          tab="cliente_observaciones"
          field="cliente_rfc"
          label="RFC cliente"
          mono
          initialValue={pedimento.cliente_rfc ?? ''}
          placeholder="XAXX010101000"
          helpText="Formato SAT: 3-4 letras + 6 dígitos + 3 alfanum."
          nullableString
          onFocus={() => onFocus('cliente_rfc')}
          onSaved={() => onSaved('cliente_rfc')}
          onError={(m) => onError('cliente_rfc', m)}
          validationError={e('cliente_rfc')}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            style={{
              fontSize: 'var(--aguila-fs-meta)',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Razón social
          </div>
          <div
            style={{
              minHeight: 60,
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.045)',
              border: '1px solid rgba(192,197,206,0.12)',
              borderRadius: 10,
              color: 'var(--text-primary)',
              fontSize: 'var(--aguila-fs-section)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {clienteName ?? 'Sin resolver'}
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted)' }}>
            Resuelto desde <code style={{ fontFamily: 'var(--font-mono)' }}>companies.name</code>.
          </div>
        </div>
      </div>

      <div
        style={{
          padding: 20,
          borderRadius: 20,
          background: 'rgba(255,255,255,0.045)',
          border: '1px solid rgba(192,197,206,0.18)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <AutosaveField
          pedimentoId={pedimentoId}
          tab="cliente_observaciones"
          field="observations"
          label="Observaciones"
          variant="textarea"
          initialValue={pedimento.observations ?? ''}
          placeholder="Notas internas, instrucciones especiales…"
          nullableString
          onFocus={() => onFocus('observations')}
          onSaved={() => onSaved('observations')}
          onError={(m) => onError('observations', m)}
          validationError={e('observations')}
        />
      </div>

      <div
        style={{
          padding: 20,
          borderRadius: 20,
          background: 'rgba(255,255,255,0.045)',
          border: '1px solid rgba(192,197,206,0.18)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span
            style={{
              fontSize: 'var(--aguila-fs-meta)',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Identificadores
          </span>
          <div style={{ flex: 1 }} />
          <AutosaveIndicator
            status={idAutosave.status}
            lastSaved={idAutosave.lastSaved}
            errorMessage={idAutosave.errorMessage}
          />
        </div>
        <p style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted)', marginTop: 6 }}>
          Pares clave:valor libres (referencias SAT, números internos, etc.).
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {rows.map((row, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <input
                type="text"
                value={row.key}
                placeholder="clave"
                onChange={(ev) => {
                  const next = rows.slice()
                  next[idx] = { ...row, key: ev.target.value }
                  commit(next)
                }}
                style={inputStyle(true, Boolean(identifiersError) && row.key.trim().length === 0)}
              />
              <input
                type="text"
                value={row.value}
                placeholder="valor"
                onChange={(ev) => {
                  const next = rows.slice()
                  next[idx] = { ...row, value: ev.target.value }
                  commit(next)
                }}
                style={inputStyle(false, false)}
              />
              <button
                type="button"
                aria-label="Eliminar identificador"
                onClick={() => {
                  track('page_view', { metadata: { event: 'pedimento_child_row_removed', field: 'identifiers' } })
                  commit(rows.filter((_, i) => i !== idx))
                }}
                style={{
                  minWidth: 60,
                  minHeight: 60,
                  background: 'transparent',
                  border: '1px solid rgba(192,197,206,0.22)',
                  borderRadius: 10,
                  color: ACCENT_SILVER_DIM,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              track('page_view', { metadata: { event: 'pedimento_child_row_added', field: 'identifiers' } })
              commit([...rows, { key: '', value: '' }])
            }}
            style={{
              alignSelf: 'flex-start',
              minHeight: 60,
              padding: '0 20px',
              background: 'transparent',
              color: ACCENT_SILVER,
              border: `1px solid ${ACCENT_SILVER}`,
              borderRadius: 10,
              fontSize: 'var(--aguila-fs-body)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Agregar identificador
          </button>
        </div>

        {identifiersError && (
          <div role="alert" style={{ marginTop: 10, fontSize: 'var(--aguila-fs-meta)', color: RED }}>
            {identifiersError}
          </div>
        )}
      </div>
    </div>
  )
}

function inputStyle(mono: boolean, error: boolean): React.CSSProperties {
  return {
    flex: 1,
    minHeight: 60,
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.045)',
    color: 'var(--text-primary)',
    border: `1px solid ${error ? RED : 'rgba(192,197,206,0.22)'}`,
    borderRadius: 10,
    fontSize: 'var(--aguila-fs-section)',
    fontFamily: mono ? 'var(--font-mono)' : 'inherit',
    outline: 'none',
  }
}
