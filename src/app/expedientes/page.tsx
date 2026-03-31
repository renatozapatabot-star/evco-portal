'use client'

import { useEffect, useState, useMemo } from 'react'
import { Search, FileText, ExternalLink } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { fmtId, fmtDateCompact } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { EmptyState } from '@/components/ui/EmptyState'
import Link from 'next/link'

interface DocRow {
  id: string
  trafico_id: string
  document_type: string
  file_url: string | null
  created_at: string | null
  company_id: string | null
}

const DOC_LABELS: Record<string, string> = {
  factura_comercial: 'Factura Comercial',
  packing_list: 'Lista de Empaque',
  pedimento_detallado: 'Pedimento',
  cove: 'COVE',
  acuse_cove: 'Acuse COVE',
  doda: 'DODA',
  mve: 'MVE',
  archivos_validacion: 'Archivos Validación',
  pedimento_simplificado: 'Pedimento Simplificado',
  bol: 'B/L',
  carta_porte: 'Carta Porte',
}

function docLabel(t: string): string {
  return DOC_LABELS[t] || t.replace(/_/g, ' ')
}

export default function ExpedientesPage() {
  const isMobile = useIsMobile()
  const [docs, setDocs] = useState<DocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [userRole, setUserRole] = useState('')
  const [cookiesReady, setCookiesReady] = useState(false)

  useEffect(() => {
    setUserRole(getCookieValue('user_role') ?? '')
    setCookiesReady(true)
  }, [])

  useEffect(() => {
    if (!cookiesReady) return
    const isInternal = userRole === 'broker' || userRole === 'admin'
    const companyId = getCookieValue('company_id') ?? ''
    if (!isInternal && !companyId) { setLoading(false); return }

    const params = new URLSearchParams({ table: 'documents', limit: '5000', order_by: 'created_at', order_dir: 'desc' })
    if (!isInternal) params.set('company_id', companyId)

    fetch(`/api/data?${params}`)
      .then(r => r.json())
      .then(d => setDocs((d.data ?? []) as DocRow[]))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false))
  }, [cookiesReady, userRole])

  const filtered = useMemo(() => {
    if (!search.trim()) return docs
    const q = search.toLowerCase()
    return docs.filter(d =>
      (d.trafico_id || '').toLowerCase().includes(q) ||
      docLabel(d.document_type).toLowerCase().includes(q) ||
      (d.document_type || '').toLowerCase().includes(q)
    )
  }, [docs, search])

  const grouped = useMemo(() => {
    const map = new Map<string, DocRow[]>()
    for (const d of filtered) {
      const key = d.trafico_id || 'sin-trafico'
      const arr = map.get(key)
      if (arr) arr.push(d)
      else map.set(key, [d])
    }
    return [...map.entries()].sort((a, b) => {
      const aDate = a[1][0]?.created_at ?? ''
      const bDate = b[1][0]?.created_at ?? ''
      return bDate.localeCompare(aDate)
    })
  }, [filtered])

  return (
    <div className="page-container" style={{ padding: isMobile ? 16 : 24 }}>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: 12, marginBottom: 16 }}>
        <div>
          <h1 className="pg-title">Expedientes</h1>
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

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`skel-${i}`} className="h-20 rounded bg-gray-200 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && grouped.length === 0 && (
        <EmptyState
          icon="📁"
          title="No hay expedientes"
          description="Los expedientes de sus tráficos aparecerán aquí"
          cta={{ label: "Ver tráficos", href: "/traficos" }}
        />
      )}

      {/* Grouped documents */}
      {!loading && grouped.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {grouped.map(([traficoId, groupDocs]) => (
            <div
              key={traficoId}
              style={{
                background: 'var(--bg-surface, #FFFFFF)',
                border: '1px solid var(--border, #E8E5E0)',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              {/* Group header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: '1px solid var(--border, #E8E5E0)',
                background: 'var(--bg-elevated, #FAFAF8)',
              }}>
                <Link
                  href={`/traficos/${encodeURIComponent(traficoId)}`}
                  style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold, #B8953F)', textDecoration: 'none', fontFamily: 'var(--font-jetbrains-mono)' }}
                >
                  {fmtId(traficoId)}
                </Link>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999,
                  background: 'rgba(184,149,63,0.1)', color: 'var(--gold, #B8953F)',
                  fontFamily: 'var(--font-jetbrains-mono)',
                }}>
                  {groupDocs.length} doc{groupDocs.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Document list */}
              <div>
                {groupDocs.map(doc => (
                  <div
                    key={doc.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--border, #E8E5E0)',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                      <FileText size={14} style={{ color: 'var(--text-muted, #9C9890)', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary, #1A1A1A)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {docLabel(doc.document_type)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      {doc.created_at && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted, #9C9890)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                          {fmtDateCompact(doc.created_at)}
                        </span>
                      )}
                      {doc.file_url ? (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--gold, #B8953F)', display: 'flex', alignItems: 'center' }}
                          title="Abrir documento"
                        >
                          <ExternalLink size={14} />
                        </a>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted, #9C9890)', fontStyle: 'italic' }}>Sin archivo</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
