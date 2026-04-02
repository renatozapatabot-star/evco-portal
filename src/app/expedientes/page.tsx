'use client'

import { useEffect, useState, useMemo } from 'react'
import { Search, FileText, ExternalLink, CheckCircle, XCircle, ChevronDown, ChevronRight, FolderOpen } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { fmtId, fmtDateCompact, fmtPedimentoShort } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorCard } from '@/components/ui/ErrorCard'
import Link from 'next/link'

interface DocRow {
  id: string
  pedimento_id: string | null
  doc_type: string | null
  file_name: string | null
  file_url: string | null
  uploaded_at: string | null
  uploaded_by: string | null
  company_id: string | null
  metadata: string | null
}

const REQUIRED_DOC_TYPES = [
  'pedimento_detallado',
  'pedimento_simplificado',
  'pedimento_txt',
  'factura_comercial',
  'cuenta_gastos',
  'doda',
  'bol',
  'cove',
  'acuse_cove',
  'e_doc',
  'acuse_e_doc',
  'mve',
  'acuse_mve',
  'carta_porte',
  'lista_empaque',
]

const DOC_LABELS: Record<string, string> = {
  pedimento_detallado: 'Pedimento Detallado',
  pedimento_simplificado: 'Pedimento Simplificado',
  pedimento_txt: 'Pedimento TXT',
  factura_comercial: 'Factura Comercial',
  cuenta_gastos: 'Cuenta de Gastos',
  doda: 'DODA',
  bol: 'B/L',
  cove: 'COVE',
  acuse_cove: 'Acuse COVE',
  e_doc: 'e-Document',
  acuse_e_doc: 'Acuse e-Document',
  mve: 'MVE',
  acuse_mve: 'Acuse MVE',
  carta_porte: 'Carta Porte',
  lista_empaque: 'Lista de Empaque',
  pedimento: 'Pedimento',
  packing_list: 'Lista de Empaque',
  archivos_validacion: 'Archivos Validación',
}

/** Map raw doc_type strings from DB to our canonical keys */
function normalizeDocType(raw: string): string {
  const t = raw.toUpperCase()
  if (t.includes('PEDIMENTO') && t.includes('SIMP')) return 'pedimento_simplificado'
  if (t.includes('PEDIMENTO') && t.includes('TXT')) return 'pedimento_txt'
  if (t.includes('PEDIMENTO')) return 'pedimento_detallado'
  if (t.includes('FACTURA')) return 'factura_comercial'
  if (t.includes('CUENTA') || t.includes('GASTOS')) return 'cuenta_gastos'
  if (t.includes('DODA')) return 'doda'
  if (t.includes('BOL') || t.includes('CONOCIMIENTO')) return 'bol'
  if (t.includes('ACUSE') && t.includes('COVE')) return 'acuse_cove'
  if (t.includes('COVE')) return 'cove'
  if (t.includes('ACUSE') && (t.includes('E_DOC') || t.includes('EDOC'))) return 'acuse_e_doc'
  if (t.includes('E_DOC') || t.includes('EDOC')) return 'e_doc'
  if (t.includes('ACUSE') && t.includes('MVE')) return 'acuse_mve'
  if (t.includes('MVE')) return 'mve'
  if (t.includes('CARTA')) return 'carta_porte'
  if (t.includes('LISTA') || t.includes('PACKING')) return 'lista_empaque'
  return raw
}

function docLabel(t: string | null): string {
  if (!t) return 'Documento'
  return DOC_LABELS[t] || DOC_LABELS[normalizeDocType(t)] || t.replace(/_/g, ' ')
}

function parseTrafico(metadata: string | null): string | null {
  if (!metadata) return null
  try {
    const m = JSON.parse(metadata)
    return m.trafico || null
  } catch { return null }
}

export default function ExpedientesPage() {
  const isMobile = useIsMobile()
  const [docs, setDocs] = useState<DocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [userRole, setUserRole] = useState('')
  const [cookiesReady, setCookiesReady] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    setUserRole(getCookieValue('user_role') ?? '')
    setCookiesReady(true)
  }, [])

  useEffect(() => {
    if (!cookiesReady) return
    const isInternal = userRole === 'broker' || userRole === 'admin'
    const companyId = getCookieValue('company_id') ?? ''
    if (!isInternal && !companyId) { setLoading(false); return }

    const params = new URLSearchParams({ table: 'expediente_documentos', limit: '5000', order_by: 'uploaded_at', order_dir: 'desc' })
    if (!isInternal) params.set('company_id', companyId)

    setFetchError(null)
    fetch(`/api/data?${params}`)
      .then(r => r.json())
      .then(d => setDocs((d.data ?? []) as DocRow[]))
      .catch(() => setFetchError('Error cargando expedientes. Reintentar →'))
      .finally(() => setLoading(false))
  }, [cookiesReady, userRole])

  const filtered = useMemo(() => {
    if (!search.trim()) return docs
    const q = search.toLowerCase()
    return docs.filter(d =>
      (d.pedimento_id || '').toLowerCase().includes(q) ||
      docLabel(d.doc_type).toLowerCase().includes(q) ||
      (d.file_name || '').toLowerCase().includes(q)
    )
  }, [docs, search])

  const grouped = useMemo(() => {
    const map = new Map<string, DocRow[]>()
    for (const d of filtered) {
      const key = d.pedimento_id || 'sin-pedimento'
      const arr = map.get(key)
      if (arr) arr.push(d)
      else map.set(key, [d])
    }
    // Sort by completeness ASC (least complete first = most urgent at top)
    return [...map.entries()].sort((a, b) => {
      const aTypes = new Set(a[1].map(d => d.doc_type ? normalizeDocType(d.doc_type) : '').filter(Boolean))
      const bTypes = new Set(b[1].map(d => d.doc_type ? normalizeDocType(d.doc_type) : '').filter(Boolean))
      const aCount = REQUIRED_DOC_TYPES.filter(t => aTypes.has(t)).length
      const bCount = REQUIRED_DOC_TYPES.filter(t => bTypes.has(t)).length
      return aCount - bCount // least complete first
    })
  }, [filtered])

  return (
    <div className="page-container" style={{ padding: isMobile ? 16 : 24 }}>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: 12, marginBottom: 16 }}>
        <div>
          <h1 className="pg-title">Expediente Digital</h1>
          <p className="pg-meta">{docs.length.toLocaleString('es-MX')} documentos · {grouped.length} tráficos</p>
        </div>
        <div
          className="flex items-center gap-2 rounded-[3px] px-3 py-1.5"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', width: isMobile ? '100%' : 260 }}
        >
          <Search size={13} strokeWidth={2} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Buscar tráfico o tipo de documento..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-[12.5px]"
            style={{ color: 'var(--text-secondary)' }}
          />
        </div>
      </div>

      {/* Error state */}
      {fetchError && (
        <div style={{ marginBottom: 16 }}>
          <ErrorCard message={fetchError} onRetry={() => window.location.reload()} />
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`skel-${i}`} className="h-20 rounded bg-gray-200 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !fetchError && grouped.length === 0 && (
        <div className="flex flex-col items-center py-20 text-center">
          <FolderOpen className="w-12 h-12 text-slate-300 mb-4" />
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Expedientes Digitales
          </h2>
          <p className="text-slate-500 max-w-sm text-sm">
            Los documentos de cada tráfico aparecerán aquí organizados por tipo.
            Puede subir documentos desde el detalle de cualquier tráfico.
          </p>
        </div>
      )}

      {/* Grouped documents */}
      {!loading && grouped.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {grouped.map(([pedimentoId, groupDocs]) => {
            const trafico = parseTrafico(groupDocs[0]?.metadata)
            const normalizedTypes = new Set(groupDocs.map(d => d.doc_type ? normalizeDocType(d.doc_type) : '').filter(Boolean))
            const foundCount = REQUIRED_DOC_TYPES.filter(t => normalizedTypes.has(t)).length
            const totalRequired = REQUIRED_DOC_TYPES.length
            const pct = Math.round((foundCount / totalRequired) * 100)
            const barColor = pct >= 100 ? '#16A34A' : pct >= 67 ? '#2563EB' : pct >= 34 ? '#D97706' : '#DC2626'
            const isExpanded = expanded.has(pedimentoId)

            return (
              <div
                key={pedimentoId}
                style={{
                  background: 'var(--bg-card, #FFFFFF)',
                  border: '1px solid var(--border-card, #E5E7EB)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                {/* Group header — clickable to expand/collapse */}
                <div
                  onClick={() => setExpanded(prev => {
                    const next = new Set(prev)
                    if (next.has(pedimentoId)) next.delete(pedimentoId)
                    else next.add(pedimentoId)
                    return next
                  })}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    background: 'var(--bg-main, #FAFBFC)',
                    borderBottom: isExpanded ? '1px solid var(--border-card, #E5E7EB)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {isExpanded ? <ChevronDown size={16} style={{ color: 'var(--slate-400)' }} /> : <ChevronRight size={16} style={{ color: 'var(--slate-400)' }} />}
                    {trafico ? (
                      <Link
                        href={`/traficos/${encodeURIComponent(trafico)}`}
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold, #C4963C)', textDecoration: 'none', fontFamily: 'var(--font-jetbrains-mono)' }}
                      >
                        {fmtId(trafico)}
                      </Link>
                    ) : (
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold, #C4963C)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                        {fmtPedimentoShort(pedimentoId)}
                      </span>
                    )}
                    {trafico && pedimentoId !== trafico && (
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                        Ped: {fmtPedimentoShort(pedimentoId)}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Completeness bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 60, height: 6, background: 'var(--slate-200)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
                        {foundCount}/{totalRequired}
                      </span>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999,
                      background: 'rgba(196,150,60,0.08)', color: 'var(--gold, #C4963C)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {groupDocs.length} doc{groupDocs.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Expanded: 15-doc checklist */}
                {isExpanded && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                    gap: 8,
                    padding: 16,
                    background: 'var(--bg-main, #FAFBFC)',
                  }}>
                    {REQUIRED_DOC_TYPES.map(reqKey => {
                      const found = groupDocs.find(d => d.doc_type && normalizeDocType(d.doc_type) === reqKey)
                      return (
                        <div key={reqKey} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {found
                            ? <CheckCircle size={16} style={{ color: '#16A34A', flexShrink: 0 }} />
                            : <XCircle size={16} style={{ color: '#DC2626', opacity: 0.5, flexShrink: 0 }} />
                          }
                          <span style={{ fontSize: 13, color: found ? 'var(--text-primary, #111)' : 'var(--slate-500)', flex: 1 }}>
                            {docLabel(reqKey)}
                          </span>
                          {found && found.file_url && (
                            <a
                              href={found.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{ fontSize: 12, color: '#2563EB', textDecoration: 'none', marginLeft: 'auto' }}
                            >
                              Ver
                            </a>
                          )}
                          {!found && (
                            <span style={{ fontSize: 11, color: '#D97706', marginLeft: 'auto' }}>
                              Faltante
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
