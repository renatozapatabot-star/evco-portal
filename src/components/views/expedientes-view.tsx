'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { FolderOpen, AlertTriangle, FileText, Send, Eye, Search } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { CLIENT_CLAVE } from '@/lib/client-config'
import { fmtId, fmtDateCompact } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { EmptyState } from '@/components/empty-state'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const PAGE_SIZE = 25

// Must match tráfico detail page — single source of expected docs per expediente
const REQUIRED_DOCS = [
  'FACTURA', 'LISTA DE EMPAQUE', 'PEDIMENTO',
  'ACUSE DE COVE', 'CARTA', 'ACUSE DE E-DOCUMENT',
]

const DOC_LABELS: Record<string, string> = {
  FACTURA: 'Factura',
  'LISTA DE EMPAQUE': 'Lista de Empaque',
  PEDIMENTO: 'Pedimento',
  'ACUSE DE COVE': 'Acuse COVE',
  CARTA: 'Carta',
  'ACUSE DE E-DOCUMENT': 'E-Document',
}

type FilterTab = 'incompletos' | 'completos' | 'todos'

interface TraficoRow {
  trafico: string
  estatus: string
  fecha_llegada: string | null
  pedimento_num: string | null
  docs: string[]
  docCount: number
  pct: number
  missing: string[]
}

function getDocLabel(t: string): string {
  return DOC_LABELS[t] || t.replace(/_/g, ' ')
}

// ── Summary Card ────────────────────────────────────────

function SummaryCard({
  incompletos,
  total,
  globalPct,
  onSolicitarTodos,
}: {
  incompletos: number
  total: number
  globalPct: number
  onSolicitarTodos: () => void
}) {
  return (
    <div className="card" style={{ padding: '20px 24px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
            {incompletos} expediente{incompletos !== 1 ? 's' : ''} incompleto{incompletos !== 1 ? 's' : ''} de {total} activo{total !== 1 ? 's' : ''}
          </p>
          {/* Progress bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <div style={{ flex: 1, height: 8, background: '#E8E5E0', borderRadius: 9999, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${globalPct}%`,
                  height: '100%',
                  background: globalPct >= 80 ? '#2D8540' : globalPct >= 50 ? '#C47F17' : '#C23B22',
                  borderRadius: 9999,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
            <span
              className="c-num"
              style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', minWidth: 48, textAlign: 'right' }}
            >
              {globalPct}%
            </span>
          </div>
          <p style={{ fontSize: 11, color: '#9C9890', margin: '6px 0 0' }}>
            Completitud global de documentos
          </p>
        </div>
        <button
          onClick={onSolicitarTodos}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 20px',
            background: '#B8953F',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: 44,
            fontFamily: 'inherit',
          }}
        >
          <Send size={14} />
          Solicitar Todos los Faltantes
        </button>
      </div>
    </div>
  )
}

// ── Filter Tabs ─────────────────────────────────────────

function FilterTabs({
  active,
  counts,
  onChange,
}: {
  active: FilterTab
  counts: { incompletos: number; completos: number; todos: number }
  onChange: (t: FilterTab) => void
}) {
  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'incompletos', label: 'Incompletos', count: counts.incompletos },
    { key: 'completos', label: 'Completos', count: counts.completos },
    { key: 'todos', label: 'Todos', count: counts.todos },
  ]
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
      {tabs.map((tab) => {
        const isActive = active === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              padding: '8px 16px',
              border: `1px solid ${isActive ? '#B8953F' : '#E8E5E0'}`,
              background: isActive ? '#F5F0E4' : '#FFFFFF',
              color: isActive ? '#B8953F' : '#6B6B6B',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: isActive ? 700 : 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              minHeight: 40,
            }}
          >
            {tab.label}{' '}
            <span
              className="c-num"
              style={{ fontSize: 12, fontWeight: 700 }}
            >
              {tab.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Progress Bar (inline) ───────────────────────────────

function ProgressBar({ pct: p }: { pct: number }) {
  const color = p >= 100 ? '#2D8540' : p >= 50 ? '#C47F17' : '#C23B22'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <div style={{ flex: 1, height: 5, background: '#E8E5E0', borderRadius: 9999, overflow: 'hidden' }}>
        <div style={{ width: `${p}%`, height: '100%', background: color, borderRadius: 9999 }} />
      </div>
      <span className="c-num" style={{ color, fontSize: 11, fontWeight: 700, minWidth: 32 }}>{p}%</span>
    </div>
  )
}

// ── Mobile Card ─────────────────────────────────────────

function MobileCard({ row, onNavigate }: { row: TraficoRow; onNavigate: (id: string) => void }) {
  const noPedimento = !row.pedimento_num
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E5E0',
        borderLeft: noPedimento ? '4px solid #C23B22' : '1px solid #E8E5E0',
        borderRadius: 8,
        padding: 16,
        marginBottom: 8,
      }}
    >
      {/* Header line */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span className="c-id" style={{ fontSize: 14, fontWeight: 700 }}>{fmtId(row.trafico)}</span>
        <span
          className={`badge ${row.estatus === 'Cruzado' ? 'badge-cruzado' : row.estatus === 'Detenido' ? 'badge-hold' : 'badge-proceso'}`}
        >
          <span className="badge-dot" /><span className="sr-only">Estado: </span>
          {row.estatus}
        </span>
      </div>

      {/* Sin pedimento alert */}
      {noPedimento && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#FEF2F2', border: '1px solid #FECACA',
          borderRadius: 6, padding: '4px 10px', marginBottom: 8, width: 'fit-content',
        }}>
          <AlertTriangle size={12} style={{ color: '#C23B22' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#991B1B' }}>Sin pedimento</span>
        </div>
      )}

      {/* Docs + progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span className="c-num" style={{ fontSize: 13 }}>
          {row.docCount}/{REQUIRED_DOCS.length} docs
        </span>
        <div style={{ flex: 1 }}>
          <ProgressBar pct={row.pct} />
        </div>
      </div>

      {/* Missing docs */}
      {row.missing.length > 0 && (
        <p style={{ fontSize: 12, color: '#6B6B6B', margin: '0 0 10px' }}>
          Faltan:{' '}
          {row.missing.slice(0, 3).map(getDocLabel).join(', ')}
          {row.missing.length > 3 && `, +${row.missing.length - 3}`}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {row.missing.length > 0 && (
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '8px 14px', background: '#B8953F', color: '#FFFFFF',
              border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', minHeight: 40, fontFamily: 'inherit',
            }}
          >
            <Send size={12} /> Solicitar
          </button>
        )}
        <button
          onClick={() => onNavigate(row.trafico)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '8px 14px', background: '#FFFFFF',
            border: '1px solid #E8E5E0', color: '#1A1A1A',
            borderRadius: 6, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', minHeight: 40, fontFamily: 'inherit',
          }}
        >
          <Eye size={12} /> Ver
        </button>
      </div>
    </div>
  )
}

// ── Main View ───────────────────────────────────────────

export function ExpedientesView() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [rawTraficos, setRawTraficos] = useState<TraficoRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('incompletos')

  const load = useCallback(async () => {
    setLoading(true)

    // Fetch all tráficos for this client (no pagination on raw — we filter client-side by tab)
    // Paginate the filtered set
    let q = supabase
      .from('traficos')
      .select('trafico, pedimento, estatus, fecha_llegada', { count: 'exact' })
      .ilike('trafico', `${CLIENT_CLAVE}-%`)
      .order('created_at', { ascending: false })

    if (search) q = q.ilike('trafico', `%${search}%`)

    const { data: rawData, count } = await q
    const allRows = rawData || []
    setTotal(count || 0)

    // Batch-load documents for all rows
    const ids = allRows.map((r) => r.trafico)
    let docMap: Record<string, string[]> = {}

    if (ids.length > 0) {
      const [r1, r2] = await Promise.all([
        supabase.from('documents').select('trafico_id, document_type').in('trafico_id', ids),
        supabase.from('expediente_documentos').select('trafico_id, doc_type').in('trafico_id', ids),
      ])

      const map: Record<string, Set<string>> = {}
      ;(r1.data || []).forEach((d: { trafico_id: string; document_type: string }) => {
        if (!map[d.trafico_id]) map[d.trafico_id] = new Set()
        if (d.document_type) map[d.trafico_id].add(d.document_type)
      })
      ;(r2.data || []).forEach((d: { trafico_id: string; doc_type: string }) => {
        if (!map[d.trafico_id]) map[d.trafico_id] = new Set()
        if (d.doc_type) map[d.trafico_id].add(d.doc_type)
      })

      docMap = Object.fromEntries(
        Object.entries(map).map(([k, v]) => [k, Array.from(v)])
      )
    }

    // Build enriched rows
    const enriched: TraficoRow[] = allRows.map((r) => {
      const docs = docMap[r.trafico] || []
      const found = new Set(docs.map((d) => d.toUpperCase()))
      const missing = REQUIRED_DOCS.filter((rd) => !found.has(rd))
      const docCount = REQUIRED_DOCS.length - missing.length
      const p = Math.round((docCount / REQUIRED_DOCS.length) * 100)
      return {
        trafico: r.trafico,
        estatus: r.estatus || 'En Proceso',
        fecha_llegada: r.fecha_llegada,
        pedimento_num: r.pedimento || null,
        docs,
        docCount,
        pct: p,
        missing,
      }
    })

    setRawTraficos(enriched)
    setLoading(false)
  }, [search])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [search, filter])

  // ── Derived data ──────────────────────────────────────

  const counts = useMemo(() => {
    const incompletos = rawTraficos.filter((r) => r.pct < 100).length
    const completos = rawTraficos.filter((r) => r.pct >= 100).length
    return { incompletos, completos, todos: rawTraficos.length }
  }, [rawTraficos])

  const globalPct = useMemo(() => {
    if (rawTraficos.length === 0) return 0
    const totalDocs = rawTraficos.reduce((acc, r) => acc + r.docCount, 0)
    const totalExpected = rawTraficos.length * REQUIRED_DOCS.length
    return Math.round((totalDocs / totalExpected) * 100)
  }, [rawTraficos])

  const filtered = useMemo(() => {
    let rows = rawTraficos
    if (filter === 'incompletos') rows = rows.filter((r) => r.pct < 100)
    if (filter === 'completos') rows = rows.filter((r) => r.pct >= 100)

    // Sort: sin pedimento first, then lowest completion, then by trafico
    return [...rows].sort((a, b) => {
      // Sin pedimento always first
      const aNoPed = a.pedimento_num ? 0 : 1
      const bNoPed = b.pedimento_num ? 0 : 1
      if (aNoPed !== bNoPed) return bNoPed - aNoPed
      // Lowest completion first
      if (a.pct !== b.pct) return a.pct - b.pct
      return 0
    })
  }, [rawTraficos, filter])

  // Paginate the filtered set
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const handleNavigate = (id: string) => router.push(`/traficos/${id}`)

  const handleSolicitarTodos = () => {
    // Future: batch-request all missing docs via solicitar-documentos
    // For now, navigate to first incomplete expediente
    const first = rawTraficos.find((r) => r.pct < 100)
    if (first) router.push(`/traficos/${first.trafico}`)
  }

  return (
    <div style={{ padding: isMobile ? '16px' : '24px 28px', fontFamily: 'var(--font-geist-sans)' }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title" style={{ margin: 0 }}>Expedientes Digitales</h2>
          <p style={{ color: '#9C9890', fontSize: 12, margin: '4px 0 0' }}>
            Control de documentos por tráfico
          </p>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9C9890' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tráfico..."
            style={{
              paddingLeft: 32, paddingRight: 12, height: 36,
              border: '1px solid #E8E5E0', borderRadius: 8,
              background: '#FFFFFF', color: '#1A1A1A', fontSize: 13,
              outline: 'none', width: 200, fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <div
            style={{
              width: 28, height: 28, border: '3px solid #E8E5E0',
              borderTopColor: '#B8953F', borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }}
          />
        </div>
      ) : rawTraficos.length === 0 ? (
        <EmptyState page="expedientes" />
      ) : (
        <>
          {/* Summary card */}
          <SummaryCard
            incompletos={counts.incompletos}
            total={counts.todos}
            globalPct={globalPct}
            onSolicitarTodos={handleSolicitarTodos}
          />

          {/* Filter tabs */}
          <FilterTabs active={filter} counts={counts} onChange={setFilter} />

          {/* Content */}
          {pageRows.length === 0 ? (
            <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <FileText size={28} strokeWidth={1.5} style={{ color: '#9C9890', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>
                {filter === 'completos' ? 'Sin expedientes completos' : 'Todos los expedientes están completos'}
              </p>
              <p style={{ fontSize: 12, color: '#9C9890' }}>
                {filter === 'completos' ? 'Aún no hay tráficos con todos sus documentos.' : 'Todos los documentos están en orden.'}
              </p>
            </div>
          ) : isMobile ? (
            /* ── Mobile card layout ── */
            <div>
              {pageRows.map((row) => (
                <MobileCard key={row.trafico} row={row} onNavigate={handleNavigate} />
              ))}
            </div>
          ) : (
            /* ── Desktop table ── */
            <div className="card" style={{ overflow: 'hidden' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th scope="col">Tráfico</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Docs</th>
                    <th scope="col">Completitud</th>
                    <th scope="col">Faltantes</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => {
                    const noPedimento = !row.pedimento_num
                    return (
                      <tr
                        key={row.trafico}
                        style={{
                          cursor: 'pointer',
                          borderLeft: noPedimento ? '4px solid #C23B22' : undefined,
                        }}
                        className="expediente-row"
                        onClick={() => handleNavigate(row.trafico)}
                      >
                        {/* TRAFICO */}
                        <td>
                          <span className="c-id">{fmtId(row.trafico)}</span>
                          {row.fecha_llegada && (
                            <div style={{ color: '#9C9890', fontSize: 11, marginTop: 2 }}>
                              {fmtDateCompact(row.fecha_llegada)}
                            </div>
                          )}
                        </td>

                        {/* ESTADO */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span
                              className={`badge ${row.estatus === 'Cruzado' ? 'badge-cruzado' : row.estatus === 'Detenido' ? 'badge-hold' : 'badge-proceso'}`}
                            >
                              <span className="badge-dot" /><span className="sr-only">Estado: </span>
                              {row.estatus}
                            </span>
                            {noPedimento && (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                background: '#FEF2F2', border: '1px solid #FECACA',
                                borderRadius: 9999, padding: '2px 10px',
                                fontSize: 10, fontWeight: 700, color: '#991B1B',
                                width: 'fit-content',
                              }}>
                                <AlertTriangle size={10} />
                                Sin pedimento
                              </span>
                            )}
                          </div>
                        </td>

                        {/* DOCS count */}
                        <td>
                          <span className="c-num" style={{ fontSize: 13 }}>
                            {row.docCount}
                            <span style={{ color: '#9C9890', fontWeight: 400 }}>/{REQUIRED_DOCS.length}</span>
                          </span>
                        </td>

                        {/* COMPLETITUD */}
                        <td style={{ minWidth: 140 }}>
                          <ProgressBar pct={row.pct} />
                        </td>

                        {/* FALTANTES */}
                        <td style={{ maxWidth: 220 }}>
                          {row.missing.length > 0 ? (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {row.missing.slice(0, 3).map((m) => (
                                <span
                                  key={m}
                                  style={{
                                    fontSize: 10, fontWeight: 600,
                                    padding: '2px 8px', borderRadius: 4,
                                    background: '#FEF2F2', border: '1px solid #FECACA',
                                    color: '#991B1B', whiteSpace: 'nowrap',
                                  }}
                                >
                                  {getDocLabel(m)}
                                </span>
                              ))}
                              {row.missing.length > 3 && (
                                <span style={{ fontSize: 10, color: '#9C9890', padding: '2px 4px', fontWeight: 600 }}>
                                  +{row.missing.length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: '#2D8540', fontWeight: 600 }}>Completo</span>
                          )}
                        </td>

                        {/* ACCION */}
                        <td style={{ textAlign: 'right' }}>
                          {row.missing.length > 0 ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                // Future: call solicitarDocumentos()
                                handleNavigate(row.trafico)
                              }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '6px 14px', background: '#B8953F', color: '#FFFFFF',
                                border: 'none', borderRadius: 6, fontSize: 12,
                                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                              }}
                            >
                              <Send size={12} /> Solicitar
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleNavigate(row.trafico)
                              }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '6px 14px', background: '#FFFFFF',
                                border: '1px solid #E8E5E0', color: '#1A1A1A',
                                borderRadius: 6, fontSize: 12, fontWeight: 600,
                                cursor: 'pointer', fontFamily: 'inherit',
                              }}
                            >
                              <Eye size={12} /> Ver
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 0', marginTop: 8,
            }}>
              <span style={{ color: '#9C9890', fontSize: 12, fontFamily: 'var(--font-jetbrains-mono)' }}>
                {(page * PAGE_SIZE + 1).toLocaleString()}–{Math.min((page + 1) * PAGE_SIZE, filtered.length).toLocaleString()} de {filtered.length.toLocaleString()}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  style={{
                    border: '1px solid #E8E5E0',
                    background: page === 0 ? '#F5F4F0' : '#FFFFFF',
                    borderRadius: 6, padding: '5px 12px',
                    cursor: page === 0 ? 'default' : 'pointer',
                    color: page === 0 ? '#9C9890' : '#1A1A1A',
                    fontSize: 12, fontFamily: 'inherit',
                  }}
                >
                  ← Ant.
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  style={{
                    border: '1px solid #E8E5E0',
                    background: page >= totalPages - 1 ? '#F5F4F0' : '#FFFFFF',
                    borderRadius: 6, padding: '5px 12px',
                    cursor: page >= totalPages - 1 ? 'default' : 'pointer',
                    color: page >= totalPages - 1 ? '#9C9890' : '#1A1A1A',
                    fontSize: 12, fontFamily: 'inherit',
                  }}
                >
                  Sig. →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .expediente-row { cursor: pointer; transition: background 0.15s ease; }
        .expediente-row:hover { background: #F5F0E4 !important; }
      `}</style>
    </div>
  )
}
