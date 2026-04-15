'use client'

// Bulk classification tab.
//
// CLICK COUNT: list → select → classify → approve = 3 clicks
//   1. "Cargar sin clasificar" (auto-loads up to 50)
//   2. "Clasificar N seleccionados" (Haiku × CONCURRENCY)
//   3. Per-row "Aplicar" on high-confidence results (or "Editar" for low)
// GLOBALPC EQUIVALENT: 5+ clicks per product (open → edit → type fracción → save × N)
// ZAPATA AI ADVANTAGE: parallel classify across entire batch

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FallbackLink } from '@/components/aguila'

interface ProductoRow {
  id: number | string
  cve_producto: string | null
  cve_proveedor: string | null
  cve_trafico: string | null
  descripcion: string | null
  descripcion_ingles: string | null
  cantidad: number | null
  unidad: string | null
  valor_total: number | null
  pais_origen: string | null
  company_id: string | null
}

interface BulkResultRow {
  producto_id: number | string | null
  classification_log_id: string | null
  fraccion: string | null
  tmec_eligible: boolean | null
  nom_required: string[]
  confidence: number
  justificacion: string | null
  alternatives: { fraccion: string; descripcion: string; confidence: number }[]
  error_code?: string
  error_message?: string
}

type RowUiState = 'pending' | 'classified' | 'applied' | 'rejected' | 'editing' | 'error'

interface RowState {
  producto: ProductoRow
  selected: boolean
  ui: RowUiState
  result?: BulkResultRow
  edited?: string
}

const STATUS_LABEL: Record<RowUiState, string> = {
  pending: 'Sin clasificar',
  classified: 'Propuesta',
  applied: 'Aplicada',
  rejected: 'Rechazada',
  editing: 'Editando',
  error: 'Error',
}

function confidenceColor(pct: number): { bg: string; fg: string } {
  if (pct >= 85) return { bg: 'rgba(34,197,94,0.14)', fg: '#86EFAC' }
  if (pct >= 70) return { bg: 'rgba(192,197,206,0.12)', fg: '#C0C5CE' }
  return { bg: 'rgba(239,68,68,0.14)', fg: '#FCA5A5' }
}

export function BulkTab({ canInsert }: { canInsert: boolean }) {
  const [rows, setRows] = useState<RowState[]>([])
  const [loading, setLoading] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = query.trim().length > 0 ? `?q=${encodeURIComponent(query.trim())}&limit=50` : '?limit=50'
      const res = await fetch(`/api/clasificar/unclassified${qs}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
      const productos: ProductoRow[] = json.data ?? []
      setRows(productos.map((p) => ({ producto: p, selected: false, ui: 'pending' })))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    void load()
  }, [load])

  const selectedCount = useMemo(() => rows.filter((r) => r.selected).length, [rows])
  const summary = useMemo(() => {
    const counts = { pending: 0, classified: 0, applied: 0, error: 0 }
    for (const r of rows) {
      if (r.ui === 'pending') counts.pending++
      else if (r.ui === 'classified' || r.ui === 'editing') counts.classified++
      else if (r.ui === 'applied') counts.applied++
      else if (r.ui === 'error') counts.error++
    }
    return counts
  }, [rows])

  const toggleAll = (checked: boolean) => {
    setRows((prev) => prev.map((r) => (r.ui === 'applied' ? r : { ...r, selected: checked })))
  }

  const toggleOne = (id: ProductoRow['id']) => {
    setRows((prev) => prev.map((r) => (r.producto.id === id ? { ...r, selected: !r.selected } : r)))
  }

  const classifySelected = async () => {
    const batch = rows.filter((r) => r.selected && r.ui !== 'applied').slice(0, 20)
    if (batch.length === 0) return
    setClassifying(true)
    setError(null)
    try {
      const payload = {
        items: batch.map((r) => ({
          producto_id: r.producto.id,
          description: (r.producto.descripcion ?? r.producto.descripcion_ingles ?? r.producto.cve_producto ?? '').slice(0, 2000),
        })),
      }
      const res = await fetch('/api/clasificar/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
      const results: BulkResultRow[] = json.data?.results ?? []
      const byId = new Map<string | number, BulkResultRow>()
      for (const r of results) {
        if (r.producto_id != null) byId.set(r.producto_id, r)
      }
      setRows((prev) =>
        prev.map((row) => {
          const hit = byId.get(row.producto.id)
          if (!hit) return row
          if (hit.error_code) return { ...row, ui: 'error', result: hit }
          return { ...row, ui: 'classified', result: hit, edited: hit.fraccion ?? '' }
        }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setClassifying(false)
    }
  }

  const applyOne = async (row: RowState) => {
    const fraccion = (row.edited ?? row.result?.fraccion ?? '').trim()
    if (!/^\d{4}\.\d{2}\.\d{2}$/.test(fraccion)) {
      setError('Fracción debe tener formato XXXX.XX.XX')
      return
    }
    try {
      const res = await fetch('/api/clasificar/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producto_id: row.producto.id,
          fraccion,
          classification_log_id: row.result?.classification_log_id ?? undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
      setRows((prev) =>
        prev.map((r) => (r.producto.id === row.producto.id ? { ...r, ui: 'applied', selected: false } : r)),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const rejectOne = (row: RowState) => {
    setRows((prev) =>
      prev.map((r) => (r.producto.id === row.producto.id ? { ...r, ui: 'rejected', selected: false } : r)),
    )
  }

  if (!canInsert) {
    return (
      <div style={{ padding: 24, color: 'rgba(255,255,255,0.6)' }}>
        Solo los operadores pueden usar clasificación en bloque.
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Filtrar descripción…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void load() }}
          style={{
            flex: '1 1 240px',
            minWidth: 200,
            padding: '10px 14px',
            fontSize: 'var(--aguila-fs-body)',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.92)',
          }}
        />
        <button
          onClick={() => void load()}
          disabled={loading}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'transparent',
            color: 'rgba(255,255,255,0.92)',
            fontSize: 'var(--aguila-fs-body)',
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'Cargando…' : 'Recargar'}
        </button>
        <button
          onClick={() => void classifySelected()}
          disabled={classifying || selectedCount === 0}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            border: 'none',
            background: selectedCount === 0 || classifying ? 'rgba(148,163,184,0.2)' : '#eab308',
            color: selectedCount === 0 || classifying ? 'rgba(255,255,255,0.5)' : '#0D0D0C',
            fontSize: 'var(--aguila-fs-body)',
            fontWeight: 700,
            cursor: selectedCount === 0 || classifying ? 'not-allowed' : 'pointer',
            minHeight: 44,
          }}
        >
          {classifying ? 'Clasificando…' : `Clasificar ${selectedCount > 0 ? selectedCount : ''} seleccionado${selectedCount === 1 ? '' : 's'}`.trim()}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 'var(--aguila-fs-meta)', color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
        <span>Sin clasificar: {summary.pending}</span>
        <span>Con propuesta: {summary.classified}</span>
        <span style={{ color: '#86EFAC' }}>Aplicadas: {summary.applied}</span>
        {summary.error > 0 && <span style={{ color: '#FCA5A5' }}>Error: {summary.error}</span>}
      </div>

      {error && (
        <div style={{
          padding: 12, marginBottom: 12, borderRadius: 10,
          background: 'rgba(239,68,68,0.12)', color: '#FCA5A5',
          border: '1px solid rgba(239,68,68,0.24)', fontSize: 'var(--aguila-fs-body)',
        }}>
          {error}
        </div>
      )}

      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          fontSize: 'var(--aguila-fs-meta)', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)',
        }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              onChange={(e) => toggleAll(e.target.checked)}
              checked={rows.length > 0 && rows.every((r) => r.selected || r.ui === 'applied')}
            />
            <span>Todo</span>
          </label>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: 24, color: 'rgba(255,255,255,0.5)', fontSize: 'var(--aguila-fs-body)', textAlign: 'center' }}>
            {loading ? 'Cargando…' : 'Sin productos pendientes de clasificar.'}
          </div>
        ) : (
          rows.map((row) => {
            const r = row.result
            const conf = r?.confidence ?? 0
            const col = confidenceColor(conf)
            return (
              <div
                key={String(row.producto.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '24px minmax(0, 2fr) minmax(0, 1fr) 70px 140px',
                  gap: 12,
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  alignItems: 'center',
                  opacity: row.ui === 'applied' || row.ui === 'rejected' ? 0.55 : 1,
                }}
              >
                <input
                  type="checkbox"
                  disabled={row.ui === 'applied'}
                  checked={row.selected}
                  onChange={() => toggleOne(row.producto.id)}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'rgba(255,255,255,0.92)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.producto.descripcion ?? row.producto.descripcion_ingles ?? row.producto.cve_producto ?? '—'}
                  </div>
                  <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                    {row.producto.cve_trafico ?? '—'} · {row.producto.pais_origen ?? '—'}
                  </div>
                  {r?.justificacion && row.ui !== 'applied' && (
                    <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'rgba(255,255,255,0.6)', marginTop: 4, fontStyle: 'italic' }}>
                      {r.justificacion}
                    </div>
                  )}
                </div>
                <div>
                  {row.ui === 'classified' || row.ui === 'editing' ? (
                    <input
                      type="text"
                      value={row.edited ?? ''}
                      onChange={(e) =>
                        setRows((prev) => prev.map((x) =>
                          x.producto.id === row.producto.id ? { ...x, edited: e.target.value, ui: 'editing' } : x,
                        ))
                      }
                      placeholder="XXXX.XX.XX"
                      style={{
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                        fontSize: 'var(--aguila-fs-body)',
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.15)',
                        background: 'rgba(255,255,255,0.04)',
                        color: 'rgba(255,255,255,0.92)',
                      }}
                    />
                  ) : r?.fraccion ? (
                    <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: 'var(--aguila-fs-body)', color: 'rgba(255,255,255,0.92)' }}>
                      {r.fraccion}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>—</span>
                  )}
                  {r?.tmec_eligible === true && (
                    <span style={{
                      display: 'inline-block', marginLeft: 6,
                      padding: '1px 6px', borderRadius: 6,
                      background: 'rgba(201,168,76,0.16)', color: '#FDE68A',
                      fontSize: 'var(--aguila-fs-label)', fontWeight: 700,
                    }}>
                      T-MEC
                    </span>
                  )}
                  {r?.nom_required && r.nom_required.length > 0 && (
                    <span style={{
                      display: 'inline-block', marginLeft: 6,
                      padding: '1px 6px', borderRadius: 6,
                      background: 'rgba(251,191,36,0.12)', color: '#FDE68A',
                      fontSize: 'var(--aguila-fs-label)', fontWeight: 700,
                    }}>
                      NOM ({r.nom_required.length})
                    </span>
                  )}
                </div>
                <div>
                  {r && r.confidence > 0 ? (
                    <span style={{
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                      padding: '2px 8px', borderRadius: 12,
                      fontSize: 'var(--aguila-fs-meta)', fontWeight: 700,
                      background: col.bg, color: col.fg,
                    }}>
                      {conf}%
                    </span>
                  ) : (
                    <span style={{ fontSize: 'var(--aguila-fs-meta)', color: 'rgba(255,255,255,0.4)' }}>
                      {STATUS_LABEL[row.ui]}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  {(row.ui === 'classified' || row.ui === 'editing') && (
                    <>
                      <button
                        onClick={() => void applyOne(row)}
                        style={{
                          padding: '6px 12px', borderRadius: 8,
                          border: 'none', background: '#22C55E',
                          color: '#0D0D0C', fontSize: 12, fontWeight: 700,
                          cursor: 'pointer', minHeight: 32,
                        }}
                      >
                        Aplicar
                      </button>
                      <button
                        onClick={() => rejectOne(row)}
                        style={{
                          padding: '6px 10px', borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.15)',
                          background: 'transparent', color: 'rgba(255,255,255,0.7)',
                          fontSize: 12, cursor: 'pointer', minHeight: 32,
                        }}
                      >
                        ✕
                      </button>
                    </>
                  )}
                  {row.ui === 'applied' && (
                    <span style={{ fontSize: 'var(--aguila-fs-meta)', color: '#86EFAC', fontWeight: 600 }}>✓ Aplicada</span>
                  )}
                  {row.ui === 'rejected' && (
                    <span style={{ fontSize: 'var(--aguila-fs-meta)', color: 'rgba(255,255,255,0.4)' }}>Rechazada</span>
                  )}
                  {row.ui === 'error' && (
                    <span style={{ fontSize: 'var(--aguila-fs-meta)', color: '#FCA5A5' }}>{r?.error_code ?? 'error'}</span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      <FallbackLink
        href="https://trafico1web.globalpc.net/clasificacion"
        label="Clasificación"
        isIncomplete={rows.length === 0 && !loading}
        message="Sin productos pendientes en ZAPATA AI — clasifica histórico en GlobalPC."
      />
    </div>
  )
}
