'use client'

import { useState, useEffect, useCallback } from 'react'
import { Package, Sparkles, CheckSquare, Square, Loader2 } from 'lucide-react'

// ── Types ──

interface Producto {
  id: string | number
  descripcion: string
  cve_proveedor: string | null
  fraccion: string | null
}

interface ClassificationResult {
  productId: string | number
  fraccion: string
  confianza: number
  descripcion_sugerida?: string
}

// ── Styles ──

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 20,
  padding: 20,
}

const sectionTitle: React.CSSProperties = {
  color: 'var(--portal-fg-1)',
  fontSize: 'var(--aguila-fs-body-lg)',
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  margin: 0,
}

const mutedText: React.CSSProperties = {
  color: 'var(--portal-fg-5)',
  fontSize: 'var(--aguila-fs-meta)',
}

const secondaryText: React.CSSProperties = {
  color: 'var(--portal-fg-4)',
  fontSize: 'var(--aguila-fs-body)',
}

const goldButton: React.CSSProperties = {
  background: 'var(--portal-fg-1)',
  color: 'var(--portal-ink-0)',
  border: 'none',
  borderRadius: 10,
  padding: '10px 20px',
  fontWeight: 700,
  fontSize: 'var(--aguila-fs-body)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 44,
}

const goldButtonDisabled: React.CSSProperties = {
  ...goldButton,
  opacity: 0.5,
  cursor: 'not-allowed',
}

// ── Helpers ──

function confidenceColor(score: number): string {
  if (score >= 80) return 'var(--portal-status-green-fg)'
  if (score >= 50) return 'var(--portal-status-amber-fg)'
  return 'var(--portal-status-red-fg)'
}

function confidenceLabel(score: number): string {
  if (score >= 80) return 'Alta'
  if (score >= 50) return 'Media'
  return 'Baja'
}

// ── Component ──

export function BulkClassifier() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string | number>>(new Set())
  const [classifying, setClassifying] = useState(false)
  const [results, setResults] = useState<Map<string | number, ClassificationResult>>(new Map())

  const fetchProductos = useCallback(async () => {
    try {
      const res = await fetch('/api/data?table=globalpc_productos&limit=200')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as { data?: Producto[] }
      const all = json.data ?? []
      const unclassified = all.filter(p => !p.fraccion)
      setProductos(unclassified)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProductos()
  }, [fetchProductos])

  const toggleSelect = (id: string | number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === productos.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(productos.map(p => p.id)))
    }
  }

  const handleClassify = async () => {
    if (selected.size === 0) return
    setClassifying(true)

    const toClassify = productos.filter(p => selected.has(p.id))
    const descriptions = toClassify.map(p => ({
      id: p.id,
      descripcion: p.descripcion,
    }))

    try {
      const res = await fetch('/api/clasificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productos: descriptions }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as { results?: ClassificationResult[] }
      const newResults = new Map(results)
      for (const r of json.results ?? []) {
        newResults.set(r.productId, r)
      }
      setResults(newResults)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al clasificar')
    } finally {
      setClassifying(false)
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div style={glassCard}>
        <h2 style={sectionTitle}>
          <Package size={16} style={{ color: 'var(--portal-fg-3)' }} />
          Clasificador Masivo
        </h2>
        <div style={{ ...mutedText, marginTop: 16 }}>Cargando productos...</div>
      </div>
    )
  }

  // ── Error without data ──
  if (error && productos.length === 0) {
    return (
      <div style={glassCard}>
        <h2 style={sectionTitle}>
          <Package size={16} style={{ color: 'var(--portal-fg-3)' }} />
          Clasificador Masivo
        </h2>
        <div style={{ ...secondaryText, marginTop: 16 }}>Sin datos de productos disponibles</div>
      </div>
    )
  }

  return (
    <div style={glassCard}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={sectionTitle}>
            <Package size={16} style={{ color: 'var(--portal-fg-3)' }} />
            Clasificador Masivo
          </h2>
          <p style={{ ...secondaryText, marginTop: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--portal-fg-3)', fontWeight: 700 }}>
              {productos.length}
            </span>{' '}
            producto{productos.length !== 1 ? 's' : ''} sin clasificar
          </p>
        </div>

        <button
          onClick={handleClassify}
          disabled={selected.size === 0 || classifying}
          type="button"
          style={selected.size === 0 || classifying ? goldButtonDisabled : goldButton}
        >
          {classifying ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}
          {classifying ? 'Clasificando...' : `Clasificar Seleccionados (${selected.size})`}
        </button>
      </div>

      {/* Empty state */}
      {productos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <Package size={40} style={{ color: 'var(--portal-fg-5)', marginBottom: 12 }} />
          <div style={{ color: 'var(--portal-fg-4)', fontSize: 'var(--aguila-fs-section)' }}>Todos los productos tienen fracción asignada</div>
          <div style={mutedText}>No hay productos pendientes de clasificación</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...mutedText, textAlign: 'left', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)', width: 40 }}>
                  <button
                    onClick={toggleAll}
                    type="button"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                  >
                    {selected.size === productos.length ? (
                      <CheckSquare size={16} style={{ color: 'var(--portal-fg-3)' }} />
                    ) : (
                      <Square size={16} style={{ color: 'var(--portal-fg-5)' }} />
                    )}
                  </button>
                </th>
                {['Producto', 'Proveedor', 'Fracción Sugerida', 'Confianza'].map(h => (
                  <th
                    key={h}
                    style={{
                      ...mutedText,
                      textAlign: 'left',
                      fontWeight: 600,
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.08em',
                      paddingBottom: 8,
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productos.map(p => {
                const result = results.get(p.id)
                return (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: selected.has(p.id) ? 'rgba(192,197,206,0.04)' : 'transparent',
                    }}
                  >
                    {/* Checkbox */}
                    <td style={{ padding: '8px 8px 8px 0' }}>
                      <button
                        onClick={() => toggleSelect(p.id)}
                        type="button"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', minHeight: 44, alignItems: 'center' }}
                      >
                        {selected.has(p.id) ? (
                          <CheckSquare size={16} style={{ color: 'var(--portal-fg-3)' }} />
                        ) : (
                          <Square size={16} style={{ color: 'var(--portal-fg-5)' }} />
                        )}
                      </button>
                    </td>

                    {/* Descripcion */}
                    <td style={{ ...secondaryText, padding: '8px 8px 8px 0', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.descripcion || '—'}
                    </td>

                    {/* Proveedor */}
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-4)', padding: '8px 8px 8px 0' }}>
                      {p.cve_proveedor || '—'}
                    </td>

                    {/* Fraccion sugerida */}
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-body)', padding: '8px 8px 8px 0' }}>
                      {result ? (
                        <span style={{ color: 'var(--portal-fg-1)', fontWeight: 600 }}>{result.fraccion}</span>
                      ) : (
                        <span style={{ color: 'var(--portal-fg-5)' }}>—</span>
                      )}
                    </td>

                    {/* Confianza */}
                    <td style={{ padding: '8px 8px 8px 0' }}>
                      {result ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 48,
                            height: 6,
                            background: 'rgba(255,255,255,0.06)',
                            borderRadius: 3,
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${result.confianza}%`,
                              height: '100%',
                              background: confidenceColor(result.confianza),
                              borderRadius: 3,
                            }} />
                          </div>
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--aguila-fs-meta)',
                            color: confidenceColor(result.confianza),
                            fontWeight: 600,
                          }}>
                            {result.confianza}% {confidenceLabel(result.confianza)}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--portal-fg-5)', fontSize: 'var(--aguila-fs-meta)' }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
