'use client'

import { useEffect, useState, useMemo } from 'react'
import { Search, ChevronLeft, ChevronRight, FileText, FolderOpen, Mail } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { fmtId, fmtDateCompact } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { DocumentViewer } from '@/components/ui/DocumentViewer'
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

/** Human-readable label from raw filename */
function friendlyName(fileName: string | null, docType: string | null): string {
  const raw = (fileName || docType || 'Documento').toUpperCase()
  if (raw.includes('PACKINGLIST') || raw.includes('PACKING_LIST') || raw.includes('LISTA_EMPAQUE') || raw.includes('LISTA EMPAQUE')) return 'Packing List'
  if (raw.includes('COVE') && raw.includes('DETALLE')) return 'COVE Detalle'
  if (raw.includes('COVE') && raw.includes('XML')) return 'COVE XML'
  if (raw.includes('ACUSE') && raw.includes('COVE')) return 'Acuse COVE'
  if (raw.includes('COVE')) return 'COVE'
  if (raw.includes('FACTURA') || raw.includes('INVOICE')) return 'Factura Comercial'
  if (raw.includes('PEDIMENTO') && raw.includes('SIMP')) return 'Pedimento Simplificado'
  if (raw.includes('PEDIMENTO') && raw.includes('TXT')) return 'Pedimento TXT'
  if (raw.includes('PEDIMENTO')) return 'Pedimento'
  if (raw.includes('DODA')) return 'DODA'
  if (raw.includes('CARTA') && raw.includes('PORTE')) return 'Carta Porte'
  if (raw.includes('CUENTA') || raw.includes('GASTOS')) return 'Cuenta de Gastos'
  if (raw.includes('CONOCIMIENTO') || raw.startsWith('BOL') || raw.startsWith('BL')) return 'B/L'
  if (raw.includes('MVE') && raw.includes('ACUSE')) return 'Acuse MVE'
  if (raw.includes('MVE')) return 'MVE'
  if (raw.includes('E_DOC') || raw.includes('EDOC')) return 'e-Document'
  if (raw.includes('HOJADECALCULO') || raw.includes('HOJA_DE_CALCULO') || raw.includes('HOJA DE CALCULO')) return 'Hoja de Cálculo'
  if (raw.includes('VALIDACION') || raw.includes('VALIDACIÓN')) return 'Archivo Validación'
  if (raw.endsWith('.ERR')) return 'Archivo Error'
  return (fileName || 'Documento').replace(/\.pdf$/i, '').replace(/\.xml$/i, '').replace(/\.err$/i, '').slice(0, 40)
}

function parseTrafico(metadata: string | null): string | null {
  if (!metadata) return null
  try {
    const m = JSON.parse(metadata)
    return m.trafico || null
  } catch { return null }
}

const PAGE_SIZE = 50

export default function ExpedientesPage() {
  const isMobile = useIsMobile()
  const [docs, setDocs] = useState<DocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [userRole, setUserRole] = useState('')
  const [cookiesReady, setCookiesReady] = useState(false)
  const [page, setPage] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [viewerDocs, setViewerDocs] = useState<DocRow[]>([])
  const [viewerIndex, setViewerIndex] = useState(-1)
  const [viewerTrafico, setViewerTrafico] = useState('')

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

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(0) }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const filtered = useMemo(() => {
    if (!search.trim()) return docs
    const q = search.toLowerCase()
    return docs.filter(d =>
      (d.pedimento_id || '').toLowerCase().includes(q) ||
      (d.file_name || '').toLowerCase().includes(q) ||
      (parseTrafico(d.metadata) || '').toLowerCase().includes(q) ||
      friendlyName(d.file_name, d.doc_type).toLowerCase().includes(q)
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
    return [...map.entries()]
  }, [filtered])

  const totalPages = Math.ceil(grouped.length / PAGE_SIZE)
  const pageGroups = grouped.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="page-shell">
      {fetchError && (
        <div style={{ marginBottom: 16 }}>
          <ErrorCard message={fetchError} onRetry={() => window.location.reload()} />
        </div>
      )}

      <div className="table-shell">
        <div className="table-toolbar" style={{ justifyContent: 'flex-end' }}>
          <div className="toolbar-search">
            <Search size={12} style={{ color: 'var(--slate-400)', flexShrink: 0 }} />
            <input placeholder="Buscar pedimento..." value={searchInput}
              onChange={e => setSearchInput(e.target.value)} />
          </div>
        </div>

        {/* Pedimento list */}
        <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={`s-${i}`} className="skeleton-shimmer" style={{ height: 48, borderRadius: 6 }} />
              ))}
            </div>
          )}

          {!loading && pageGroups.length === 0 && (
            <div style={{ padding: 20 }}>
              {search.trim() ? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Sin resultados para &ldquo;{search}&rdquo;</div>
                  <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => { setSearchInput(''); setSearch('') }}>Limpiar búsqueda</button>
                </div>
              ) : (
                <EmptyState
                  icon="📂"
                  title="Sin expedientes digitales"
                  description="Los documentos de cada pedimento aparecerán aquí"
                  cta={{ label: 'Ver tráficos', href: '/traficos' }}
                />
              )}
            </div>
          )}

          {pageGroups.map(([pedimentoId, groupDocs]) => {
            const isExpanded = expandedId === pedimentoId
            const trafico = parseTrafico(groupDocs[0]?.metadata)

            return (
              <div key={pedimentoId}>
                {/* Pedimento row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : pedimentoId)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: isMobile ? '14px 16px' : '14px 20px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border-card, #E8E5E0)',
                    background: isExpanded ? 'var(--bg-main, #FAFAF8)' : 'transparent',
                    transition: 'background 150ms',
                    minHeight: 52,
                  }}
                  className="clickable-row"
                >
                  <FolderOpen size={16} style={{ color: isExpanded ? 'var(--gold, #C4963C)' : 'var(--slate-400)', flexShrink: 0, transition: 'color 150ms' }} />
                  <span style={{
                    fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-mono)',
                    color: 'var(--text-primary)',
                    flex: 1,
                  }}>
                    {pedimentoId}
                  </span>
                </div>

                {/* Expanded: documents */}
                {isExpanded && (
                  <div style={{
                    background: 'var(--bg-main, #FAFAF8)',
                    borderBottom: '1px solid var(--border-card, #E8E5E0)',
                    padding: isMobile ? '0 16px 12px' : '0 20px 16px',
                  }}>
                    {/* Tráfico link */}
                    {trafico && (
                      <div style={{ padding: '10px 0 8px', borderBottom: '1px solid var(--border-card, #E8E5E0)', marginBottom: 8 }}>
                        <Link
                          href={`/traficos/${encodeURIComponent(trafico)}`}
                          style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold, #C4963C)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}
                        >
                          Tráfico {fmtId(trafico)} →
                        </Link>
                      </div>
                    )}

                    {/* Document rows */}
                    {groupDocs.map((doc, idx) => (
                      <div
                        key={doc.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 0',
                          borderBottom: idx < groupDocs.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                        }}
                      >
                        <FileText size={14} style={{ color: 'var(--slate-400)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {friendlyName(doc.file_name, doc.doc_type)}
                          </div>
                        </div>
                        {doc.uploaded_at && (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                            {fmtDateCompact(doc.uploaded_at)}
                          </span>
                        )}
                        {doc.file_url && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setViewerDocs(groupDocs); setViewerIndex(idx); setViewerTrafico(pedimentoId) }}
                            style={{
                              fontSize: 12, fontWeight: 600, color: 'var(--gold, #C4963C)',
                              background: 'rgba(196,150,60,0.06)', border: '1px solid rgba(196,150,60,0.15)',
                              borderRadius: 6, cursor: 'pointer', padding: '6px 12px',
                              flexShrink: 0, minHeight: 32,
                            }}
                          >
                            Ver
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open('mailto:ai@renatozapata.com?subject=Solicitud de documento — Pedimento ' + pedimentoId, '_blank')
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #9B9B9B)',
                          background: 'none', border: '1px solid var(--border-card, #E8E5E0)',
                          borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                          minHeight: 40, transition: 'border-color 150ms',
                        }}
                      >
                        <Mail size={13} />
                        Solicitar documento
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <span className="pagination-info">{(page * PAGE_SIZE + 1).toLocaleString()}-{Math.min((page + 1) * PAGE_SIZE, grouped.length).toLocaleString()} de {grouped.length.toLocaleString()}</span>
            <div className="pagination-btns">
              <button className="pagination-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /></button>
              <button className="pagination-btn current">{page + 1}</button>
              <button className="pagination-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Document Viewer Modal */}
      {viewerIndex >= 0 && viewerDocs.length > 0 && (
        <DocumentViewer
          documents={viewerDocs}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(-1)}
          traficoId={viewerTrafico}
        />
      )}
    </div>
  )
}
