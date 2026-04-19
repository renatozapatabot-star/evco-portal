'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTrack } from '@/lib/telemetry/useTrack'
import {
  ADVANCED_SEARCH_FIELDS,
  ZAPATA,
  validateAdvancedCriteria,
} from '@/lib/search-registry'
import type {
  AdvancedSearchCriteria,
  AdvancedSearchResponse,
  AdvancedSearchResultRow,
} from '@/types/search'

interface Props {
  open: boolean
  onClose: () => void
}

type ApiResponse = {
  data: AdvancedSearchResponse | null
  error: { code: string; message: string } | null
}

const EMPTY: AdvancedSearchCriteria = {}

/**
 * Block 2 · AdvancedSearchModal — 13 structured fields + hard blank-submit
 * guard (button disabled and server-side guard as belt-and-suspenders).
 */
export function AdvancedSearchModal({ open, onClose }: Props) {
  const router = useRouter()
  const track = useTrack()
  const [criteria, setCriteria] = useState<AdvancedSearchCriteria>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<AdvancedSearchResponse | null>(null)

  const guard = useMemo(() => validateAdvancedCriteria(criteria), [criteria])
  const canSubmit = guard.valid && !loading

  const update = useCallback(<K extends keyof AdvancedSearchCriteria>(
    key: K, value: AdvancedSearchCriteria[K],
  ) => {
    setCriteria((prev) => ({ ...prev, [key]: value }))
  }, [])

  const onClear = useCallback(() => {
    setCriteria(EMPTY)
    setResponse(null)
  }, [])

  const onSubmit = useCallback(async () => {
    if (!guard.valid) {
      track('page_view', { metadata: { event: 'search_advanced_blank_blocked' } })
      setResponse({ ok: true, results: [], count: 0, truncated: false, message: guard.message })
      return
    }
    const fieldNames = Object.entries(criteria)
      .filter(([, v]) => {
        if (v == null) return false
        if (typeof v === 'string') return v.trim().length > 0
        if (Array.isArray(v)) return v.length > 0
        return true
      })
      .map(([k]) => k)
    track('page_view', {
      metadata: {
        event: 'search_advanced_submitted',
        field_count: fieldNames.length,
        field_names: fieldNames,
      },
    })
    setLoading(true)
    try {
      const r = await fetch('/api/search/advanced', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(criteria),
      })
      const j = (await r.json()) as ApiResponse
      setResponse(j.data)
    } catch {
      setResponse({ ok: false, results: [], count: 0, truncated: false, message: 'Error de red' })
    } finally {
      setLoading(false)
    }
  }, [criteria, guard, track])

  if (!open) return null

  const openRow = (row: AdvancedSearchResultRow) => {
    onClose()
    router.push(`/embarques/${encodeURIComponent(row.trafico)}`)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Búsqueda avanzada"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10001,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 'max(6vh, 24px)',
        background: 'rgba(3, 5, 8, 0.7)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(640px, calc(100vw - 24px))',
          maxHeight: 'min(84vh, 720px)',
          display: 'flex', flexDirection: 'column',
          background: ZAPATA.BG_ELEVATED,
          border: `1px solid ${ZAPATA.BORDER_HAIRLINE}`,
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          overflow: 'hidden',
          color: 'var(--portal-fg-1)',
          fontFamily: 'var(--font-geist-sans), Inter, system-ui, sans-serif',
        }}
      >
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: `1px solid ${ZAPATA.BORDER_HAIRLINE}`,
        }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Búsqueda avanzada</span>
          <kbd style={{
            fontFamily: 'var(--font-jetbrains-mono), JetBrains Mono, monospace', fontSize: 'var(--aguila-fs-meta)',
            color: ZAPATA.TEXT_TERTIARY, border: `1px solid ${ZAPATA.BORDER_HAIRLINE}`,
            borderRadius: 6, padding: '2px 8px',
          }}>Esc</kbd>
        </header>

        <div style={{ overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 12,
          }}>
            {ADVANCED_SEARCH_FIELDS.map((f) => {
              if (f.kind === 'multi_select' || f.kind === 'select') {
                // Simplified: render as text input for v1 — select dropdowns
                // require populated source data which lands in a follow-up block.
                return (
                  <label key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 'var(--aguila-fs-meta)', color: ZAPATA.TEXT_TERTIARY }}>
                      {f.labelEs}{f.flag ? ` · ${f.flag}` : ''}
                    </span>
                    <input
                      type="text"
                      placeholder={f.placeholder ?? ''}
                      value={String((criteria[f.id] as unknown) ?? '')}
                      onChange={(e) => {
                        if (f.kind === 'multi_select') {
                          update(f.id, e.target.value ? [e.target.value] : [])
                        } else {
                          update(f.id, e.target.value)
                        }
                      }}
                      style={inputStyle}
                    />
                  </label>
                )
              }
              const kind = f.kind === 'date_from' || f.kind === 'date_to' ? 'date' : 'text'
              return (
                <label key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 'var(--aguila-fs-meta)', color: ZAPATA.TEXT_TERTIARY }}>
                    {f.labelEs}{f.flag ? ` · ${f.flag}` : ''}
                  </span>
                  <input
                    type={kind}
                    placeholder={f.placeholder ?? ''}
                    value={String((criteria[f.id] as string | undefined) ?? '')}
                    onChange={(e) => update(f.id, e.target.value)}
                    style={inputStyle}
                  />
                </label>
              )
            })}
          </div>

          {response && (
            <div style={{ marginTop: 20 }}>
              {response.message && (
                <div style={{
                  padding: '12px', marginBottom: 12,
                  background: 'var(--portal-status-amber-bg)',
                  border: '1px solid var(--portal-status-amber-ring)',
                  borderRadius: 12, color: 'var(--portal-status-amber-fg)', fontSize: 'var(--aguila-fs-body)',
                }}>
                  {response.message}
                </div>
              )}
              {response.results.length > 0 && (
                <div>
                  <div style={{
                    fontSize: 'var(--aguila-fs-meta)', color: ZAPATA.TEXT_TERTIARY,
                    padding: '6px 0', fontWeight: 600, letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}>
                    {response.count} resultado{response.count === 1 ? '' : 's'}
                    {response.truncated ? ' (truncado)' : ''}
                  </div>
                  {response.results.slice(0, 50).map((row) => (
                    <button
                      key={row.trafico}
                      type="button"
                      onClick={() => openRow(row)}
                      style={{
                        display: 'flex', flexDirection: 'column', gap: 2,
                        width: '100%', textAlign: 'left',
                        minHeight: 60, padding: '10px 12px',
                        background: 'transparent', border: `1px solid ${ZAPATA.BORDER_HAIRLINE}`,
                        borderRadius: 12, marginBottom: 6,
                        color: 'var(--portal-fg-1)', cursor: 'pointer',
                      }}
                    >
                      <span style={{
                        fontFamily: 'var(--font-jetbrains-mono), JetBrains Mono, monospace',
                        fontSize: 'var(--aguila-fs-body)', fontWeight: 600,
                      }}>{row.trafico}</span>
                      <span style={{ fontSize: 'var(--aguila-fs-compact)', color: ZAPATA.TEXT_TERTIARY }}>
                        {[row.estatus, row.pedimento].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <footer style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px',
          borderTop: `1px solid ${ZAPATA.BORDER_HAIRLINE}`,
        }}>
          <button
            type="button"
            onClick={onClear}
            style={{
              minHeight: 44, padding: '8px 16px',
              background: 'transparent', border: `1px solid ${ZAPATA.BORDER_HAIRLINE}`,
              borderRadius: 10, color: 'var(--portal-fg-1)', fontSize: 'var(--aguila-fs-body)', cursor: 'pointer',
            }}
          >
            Limpiar
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={onSubmit}
            style={{
              minHeight: 44, padding: '8px 20px',
              background: canSubmit ? 'var(--portal-fg-1)' : 'rgba(192,197,206,0.3)',
              border: 'none', borderRadius: 10,
              color: canSubmit ? '#05070B' : 'var(--portal-fg-4)',
              fontSize: 'var(--aguila-fs-body)', fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? 'Buscando…' : 'Buscar'}
          </button>
        </footer>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  minHeight: 44,
  padding: '8px 12px',
  background: 'rgba(255,255,255,0.04)',
  border: `1px solid ${ZAPATA.BORDER_HAIRLINE}`,
  borderRadius: 10,
  color: 'var(--portal-fg-1)',
  fontSize: 'var(--aguila-fs-body)',
  outline: 'none',
  fontFamily: 'var(--font-geist-sans), Inter, system-ui, sans-serif',
}

export default AdvancedSearchModal
