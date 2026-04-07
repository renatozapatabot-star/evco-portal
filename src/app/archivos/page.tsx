'use client'

import { useState, useCallback, useRef } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { fmtDateTime } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'
import Link from 'next/link'
import { Search, FileText, Upload, ExternalLink, Loader2 } from 'lucide-react'

interface DocResult {
  id: string
  source: 'expediente' | 'classification'
  fileName: string | null
  docType: string | null
  traficoId: string | null
  fileUrl: string | null
  uploadedAt: string | null
  companyId: string | null
}

const DOC_TYPE_LABELS: Record<string, string> = {
  FACTURA_COMERCIAL: 'Factura Comercial',
  LISTA_EMPAQUE: 'Lista de Empaque',
  CONOCIMIENTO_EMBARQUE: 'Conocimiento de Embarque',
  CERTIFICADO_ORIGEN: 'Certificado de Origen',
  CARTA_PORTE: 'Carta Porte',
  MANIFESTACION_VALOR: 'Manifestación de Valor',
  PEDIMENTO: 'Pedimento',
  NOM: 'NOM',
  COA: 'Certificado de Análisis',
  ORDEN_COMPRA: 'Orden de Compra',
  ENTRADA_BODEGA: 'Entrada de Bodega',
  GUIA_EMBARQUE: 'Guía de Embarque',
  PERMISO: 'Permiso',
  PROFORMA: 'Proforma',
  DODA_PREVIO: 'DODA Previo',
  OTRO: 'Otro',
  'whatsapp-upload': 'WhatsApp',
}

function formatDocType(raw: string | null): string {
  if (!raw) return '—'
  return DOC_TYPE_LABELS[raw] || raw.replace(/_/g, ' ')
}

export default function ArchivosPage() {
  const isMobile = useIsMobile()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DocResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      setSearched(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search/documents?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      setResults(json.data || [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
      setSearched(true)
    }
  }, [])

  function handleInput(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 300)
  }

  // Quick filter buttons
  const quickFilters = ['Factura', 'BL', 'COVE', 'Pedimento', 'Carta Porte', 'NOM']

  return (
    <div style={{ padding: isMobile ? '16px 12px' : '24px 16px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
            Archivos
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            Busca cualquier documento por nombre, tipo, tráfico o contenido
          </p>
        </div>
        <Link
          href="/documentos/subir"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'var(--gold)', border: 'none', color: 'var(--bg-card)',
            textDecoration: 'none', minHeight: 40,
          }}
        >
          <Upload size={14} /> Subir documento
        </Link>
      </div>

      {/* Search input */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={16} style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-muted)',
        }} />
        <input
          value={query}
          onChange={e => handleInput(e.target.value)}
          placeholder="Buscar: factura Milacron, BL Y4511, pedimento 6500441..."
          style={{
            width: '100%', padding: '12px 12px 12px 36px',
            border: '1px solid var(--border)', borderRadius: 8,
            fontSize: 14, color: 'var(--text-primary)',
            background: 'var(--bg-card)', outline: 'none',
            fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
        {loading && (
          <Loader2 size={16} style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', animation: 'spin 1s linear infinite',
          }} />
        )}
      </div>

      {/* Quick filters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {quickFilters.map(f => (
          <button
            key={f}
            onClick={() => { setQuery(f); doSearch(f) }}
            style={{
              padding: '6px 14px', borderRadius: 16,
              border: '1px solid var(--border)', background: query === f ? 'rgba(196,150,60,0.1)' : 'var(--bg-card)',
              fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer',
              minHeight: 32,
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Results */}
      {!searched && results.length === 0 && (
        <EmptyState
          icon="📂"
          title="Busca documentos"
          description="Escribe el nombre, tipo o tráfico del documento que necesitas"
        />
      )}

      {searched && results.length === 0 && (
        <EmptyState
          icon="🔍"
          title="Sin resultados"
          description={`No encontramos documentos para "${query}"`}
          cta={{ label: 'Subir documento', href: '/documentos/subir' }}
        />
      )}

      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            {results.length} resultado{results.length !== 1 ? 's' : ''}
          </div>
          {results.map(doc => (
            <div
              key={doc.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 8,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                minHeight: 60,
              }}
            >
              <FileText size={18} style={{ color: 'var(--gold)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.fileName || 'Sin nombre'}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 11, padding: '1px 8px', borderRadius: 9999,
                    background: 'rgba(196,150,60,0.1)', color: 'var(--gold-dark)',
                  }}>
                    {formatDocType(doc.docType)}
                  </span>
                  {doc.traficoId && (
                    <Link
                      href={`/traficos/${encodeURIComponent(doc.traficoId)}`}
                      style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--gold-dark)', textDecoration: 'none' }}
                    >
                      {doc.traficoId}
                    </Link>
                  )}
                  {doc.uploadedAt && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {fmtDateTime(doc.uploadedAt)}
                    </span>
                  )}
                </div>
              </div>
              {doc.fileUrl && (
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 36, height: 36, borderRadius: 8,
                    background: 'var(--slate-100)', flexShrink: 0,
                  }}
                >
                  <ExternalLink size={14} style={{ color: 'var(--text-secondary)' }} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          to { transform: translateY(-50%) rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
