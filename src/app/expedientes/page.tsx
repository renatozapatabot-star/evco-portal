'use client'

import { useEffect, useState, useMemo } from 'react'
import { Search, ChevronLeft, ChevronRight, FileText, FolderOpen, Mail } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { fmtId, fmtDate, fmtDateCompact, fmtPedimentoShort } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { DocumentViewer } from '@/components/ui/DocumentViewer'

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

interface AduanetInfo {
  fecha_pago: string | null
  proveedor: string | null
}

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
  try { return JSON.parse(metadata).trafico || null } catch { return null }
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
  const [aduanetMap, setAduanetMap] = useState<Map<string, AduanetInfo>>(new Map())
  const [partidaDescMap, setPartidaDescMap] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    setUserRole(getCookieValue('user_role') ?? '')
    setCookiesReady(true)
  }, [])

  useEffect(() => {
    if (!cookiesReady) return
    const isInternal = userRole === 'broker' || userRole === 'admin'
    const companyId = getCookieValue('company_id') ?? ''
    if (!isInternal && !companyId) { setLoading(false); return }

    const companyFilter = !isInternal && companyId ? `&company_id=${companyId}` : ''

    setFetchError(null)
    Promise.all([
      fetch(`/api/data?table=expediente_documentos&limit=5000&order_by=uploaded_at&order_dir=desc${companyFilter}`).then(r => r.json()),
      fetch(`/api/data?table=aduanet_facturas&select=pedimento,fecha_pago,proveedor&limit=5000${companyFilter}`).then(r => r.json()),
      fetch(`/api/data?table=globalpc_partidas&select=cve_trafico,descripcion&limit=5000`).then(r => r.json()),
    ])
      .then(([docData, aduanetData, partidaData]) => {
        setDocs((docData.data ?? []) as DocRow[])

        const aMap = new Map<string, AduanetInfo>()
        const aArr = Array.isArray(aduanetData.data) ? aduanetData.data : []
        aArr.forEach((f: { pedimento?: string; fecha_pago?: string; proveedor?: string }) => {
          if (f.pedimento && !aMap.has(f.pedimento)) {
            aMap.set(f.pedimento, { fecha_pago: f.fecha_pago || null, proveedor: f.proveedor || null })
          }
        })
        setAduanetMap(aMap)

        const pMap = new Map<string, string>()
        const pArr = Array.isArray(partidaData.data) ? partidaData.data : []
        pArr.forEach((p: { cve_trafico?: string; descripcion?: string }) => {
          if (p.cve_trafico && p.descripcion && !pMap.has(p.cve_trafico)) pMap.set(p.cve_trafico, p.descripcion)
        })
        setPartidaDescMap(pMap)
      })
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
            <input placeholder="Pedimento, documento..." value={searchInput}
              onChange={e => setSearchInput(e.target.value)} />
          </div>
        </div>

        {/* Table */}
        {!isMobile && (
          <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'auto' }}>
            <table className="cruz-table" aria-label="Expedientes digitales" style={{ minWidth: 600 }}>
              <thead>
                <tr>
                  <th scope="col" style={{ width: 28 }}></th>
                  <th scope="col">Pedimento</th>
                  <th scope="col" style={{ width: 120 }}>Fecha</th>
                  <th scope="col">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`s-${i}`}>
                    <td><div className="skeleton-shimmer" style={{ width: 7, height: 7, borderRadius: '50%' }} /></td>
                    <td><div className="skeleton-shimmer" style={{ width: 110, height: 13 }} /></td>
                    <td><div className="skeleton-shimmer" style={{ width: 80, height: 13 }} /></td>
                    <td><div className="skeleton-shimmer" style={{ width: 140, height: 13 }} /></td>
                  </tr>
                ))}
                {!loading && pageGroups.length === 0 && (
                  <tr><td colSpan={4}>
                    {search.trim() ? (
                      <div className="empty-state">
                        <div className="empty-state-icon">🔍</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--slate-600)' }}>Sin resultados para &ldquo;{search}&rdquo;</div>
                        <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => { setSearchInput(''); setSearch('') }}>Limpiar búsqueda</button>
                      </div>
                    ) : (
                      <EmptyState icon="📂" title="Sin expedientes digitales" description="Los documentos de cada pedimento aparecerán aquí" cta={{ label: 'Ver tráficos', href: '/traficos' }} />
                    )}
                  </td></tr>
                )}
                {pageGroups.map(([pedimentoId, groupDocs], idx) => {
                  const trafico = parseTrafico(groupDocs[0]?.metadata)
                  const isExpanded = expandedId === pedimentoId
                  const aduanet = aduanetMap.get(pedimentoId)
                  const desc = trafico ? partidaDescMap.get(trafico) : null

                  return (
                    <tr
                      key={pedimentoId}
                      className={`clickable-row ${idx % 2 === 0 ? 'row-even' : 'row-odd'}${isExpanded ? ' row-even' : ''}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setExpandedId(isExpanded ? null : pedimentoId)}
                    >
                      <td style={{ width: 28, paddingRight: 0 }}>
                        <FolderOpen size={13} style={{ color: isExpanded ? 'var(--gold, #C4963C)' : 'var(--slate-400)', opacity: 0.7 }} />
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13 }}>
                          {fmtPedimentoShort(pedimentoId)}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {aduanet?.fecha_pago ? fmtDate(aduanet.fecha_pago) : '—'}
                      </td>
                      <td className="desc-text" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {desc || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile cards */}
        {isMobile && (
          <div style={{ padding: '8px 12px' }}>
            <div className="m-card-list">
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <div key={`skel-${i}`} className="h-20 rounded-lg bg-gray-200 animate-pulse" />
              ))}
              {!loading && pageGroups.length === 0 && (
                <EmptyState icon="📂" title="Sin expedientes digitales" description="Los documentos de cada pedimento aparecerán aquí" cta={{ label: 'Ver tráficos', href: '/traficos' }} />
              )}
              {pageGroups.map(([pedimentoId, groupDocs]) => (
                <div key={pedimentoId} onClick={() => setExpandedId(expandedId === pedimentoId ? null : pedimentoId)} className="m-card" style={{ cursor: 'pointer' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13 }}>{fmtPedimentoShort(pedimentoId)}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{groupDocs.length} doc{groupDocs.length !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <span className="pagination-info">Página {page + 1} de {totalPages}</span>
            <div className="pagination-btns">
              <button className="pagination-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /></button>
              <button className="pagination-btn current">{page + 1}</button>
              <button className="pagination-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Expanded document panel */}
      {expandedId && (() => {
        const groupDocs = grouped.find(([id]) => id === expandedId)?.[1] || []
        const trafico = parseTrafico(groupDocs[0]?.metadata)
        return (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card, #E8E5E0)', borderRadius: 12, marginTop: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'var(--bg-main, #FAFAF8)', borderBottom: '1px solid var(--border-card, #E8E5E0)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FolderOpen size={16} style={{ color: 'var(--gold, #C4963C)' }} />
                <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{fmtPedimentoShort(expandedId)}</span>
                {trafico && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>· Tráfico {fmtId(trafico)}</span>
                )}
              </div>
              <button onClick={() => setExpandedId(null)} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>Cerrar ✕</button>
            </div>
            <div style={{ padding: 0 }}>
              {groupDocs.map((doc, idx) => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: idx < groupDocs.length - 1 ? '1px solid var(--border-card, #E8E5E0)' : 'none' }} className="clickable-row">
                  <FileText size={14} style={{ color: 'var(--slate-400)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{friendlyName(doc.file_name, doc.doc_type)}</div>
                  </div>
                  {doc.uploaded_at && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{fmtDateCompact(doc.uploaded_at)}</span>}
                  {doc.file_url && (
                    <button onClick={(e) => { e.stopPropagation(); setViewerDocs(groupDocs); setViewerIndex(idx); setViewerTrafico(expandedId) }}
                      style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold, #C4963C)', background: 'rgba(196,150,60,0.06)', border: '1px solid rgba(196,150,60,0.15)', borderRadius: 6, cursor: 'pointer', padding: '6px 12px', flexShrink: 0, minHeight: 32 }}>
                      Ver
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border-card, #E8E5E0)', display: 'flex', gap: 8 }}>
              <button onClick={(e) => { e.stopPropagation(); window.open('mailto:ai@renatozapata.com?subject=Solicitud de documento — Pedimento ' + expandedId, '_blank') }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border-card, #E8E5E0)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', minHeight: 40 }}>
                <Mail size={13} /> Solicitar documento
              </button>
            </div>
          </div>
        )
      })()}

      {viewerIndex >= 0 && viewerDocs.length > 0 && (
        <DocumentViewer documents={viewerDocs} initialIndex={viewerIndex} onClose={() => setViewerIndex(-1)} traficoId={viewerTrafico} />
      )}
    </div>
  )
}
