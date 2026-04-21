'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Upload, FileText, CheckCircle, AlertTriangle, ChevronRight, Loader2 } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { fmtId } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'

/* ═══════════════════════════════════════════════
   Types
═══════════════════════════════════════════════ */

interface TraficoOption {
  trafico: string
  descripcion_mercancia?: string | null
}

interface UploadResult {
  fileName: string
  size: number
  status: 'uploading' | 'classified' | 'unclassified' | 'error'
  docType?: string
  confidence?: number
  errorMsg?: string
}

interface BlockingDoc {
  doc_type: string
  label: string
  present: boolean
}

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
const ACCEPTED_EXT = '.pdf,.jpg,.jpeg,.png,.docx'

/* Simple client-side doc classification by filename patterns */
function classifyFileName(name: string): { docType: string; confidence: number } | null {
  const lower = name.toLowerCase()
  if (lower.includes('factura') || lower.includes('invoice') || lower.includes('commercial'))
    return { docType: 'Factura Comercial', confidence: 94 }
  if (lower.includes('packing') || lower.includes('empaque') || lower.includes('lista'))
    return { docType: 'Lista de Empaque', confidence: 91 }
  if (lower.includes('pedimento'))
    return { docType: 'Pedimento', confidence: 96 }
  if (lower.includes('bl') || lower.includes('conocimiento') || lower.includes('bill'))
    return { docType: 'Bill of Lading', confidence: 88 }
  if (lower.includes('certificado') || lower.includes('cert') || lower.includes('origen'))
    return { docType: 'Certificado de Origen', confidence: 85 }
  if (lower.includes('carta') || lower.includes('porte'))
    return { docType: 'Carta Porte', confidence: 90 }
  return null
}

const REQUIRED_DOCS: BlockingDoc[] = [
  { doc_type: 'factura_comercial', label: 'Factura Comercial', present: false },
  { doc_type: 'lista_empaque', label: 'Lista de Empaque', present: false },
  { doc_type: 'bill_of_lading', label: 'Bill of Lading', present: false },
  { doc_type: 'pedimento', label: 'Pedimento', present: false },
  { doc_type: 'certificado_origen', label: 'Certificado de Origen', present: false },
  { doc_type: 'carta_porte', label: 'Carta Porte', present: false },
]

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

/* ═══════════════════════════════════════════════
   Page Component
═══════════════════════════════════════════════ */

export default function SubirDocumentosPage() {
  const [companyId, setCompanyId] = useState('')
  const [cookiesReady, setCookiesReady] = useState(false)
  const [traficos, setTraficos] = useState<TraficoOption[]>([])
  const [loadingTraficos, setLoadingTraficos] = useState(true)
  const [selectedTrafico, setSelectedTrafico] = useState('')
  const [uploads, setUploads] = useState<UploadResult[]>([])
  const [dragging, setDragging] = useState(false)
  const [blockingDocs, setBlockingDocs] = useState<BlockingDoc[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  // Read cookies on mount
  useEffect(() => {
    setCompanyId(getCookieValue('company_id') ?? '')
    setCookiesReady(true)
  }, [])

  // Fetch active embarques
  useEffect(() => {
    if (!cookiesReady) return
    const params = new URLSearchParams({ table: 'traficos', limit: '100', order_by: 'fecha_llegada', order_dir: 'desc' })
    if (companyId) params.set('company_id', companyId)
    setLoadingTraficos(true)
    fetch(`/api/data?${params}`)
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []
        setTraficos(arr)
      })
      .catch(() => setTraficos([]))
      .finally(() => setLoadingTraficos(false))
  }, [cookiesReady, companyId])

  // Fetch completeness when embarque changes
  useEffect(() => {
    if (!selectedTrafico) { setBlockingDocs([]); return }
    const params = new URLSearchParams({ table: 'trafico_completeness', limit: '1' })
    if (companyId) params.set('company_id', companyId)
    fetch(`/api/data?${params}`)
      .then(r => r.json())
      .then(d => {
        const rows = Array.isArray(d.data) ? d.data : []
        const match = rows.find((r: Record<string, unknown>) => r.trafico_id === selectedTrafico || r.trafico === selectedTrafico)
        if (match && Array.isArray(match.blocking_docs)) {
          const blocking = match.blocking_docs as string[]
          setBlockingDocs(REQUIRED_DOCS.map(doc => ({
            ...doc,
            present: !blocking.includes(doc.doc_type),
          })))
        } else {
          setBlockingDocs(REQUIRED_DOCS.map(doc => ({ ...doc, present: false })))
        }
      })
      .catch(() => setBlockingDocs([]))
  }, [selectedTrafico, companyId])

  // Upload a single file
  const uploadFile = useCallback(async (file: File) => {
    if (!selectedTrafico) return

    const idx = uploads.length
    const entry: UploadResult = { fileName: file.name, size: file.size, status: 'uploading' }
    setUploads(prev => [...prev, entry])

    try {
      const classification = classifyFileName(file.name)
      const docType = classification?.docType ?? 'pendiente'

      const form = new FormData()
      form.append('file', file)
      form.append('trafico_id', selectedTrafico)
      form.append('doc_type', docType)

      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok || data.error) {
        setUploads(prev => prev.map((u, i) => i === idx ? { ...u, status: 'error', errorMsg: data.error || 'Error al subir' } : u))
        return
      }

      if (classification) {
        setUploads(prev => prev.map((u, i) => i === idx ? { ...u, status: 'classified', docType: classification.docType, confidence: classification.confidence } : u))
      } else {
        setUploads(prev => prev.map((u, i) => i === idx ? { ...u, status: 'unclassified' } : u))
      }
    } catch {
      setUploads(prev => prev.map((u, i) => i === idx ? { ...u, status: 'error', errorMsg: 'Error de conexión' } : u))
    }
  }, [selectedTrafico, uploads.length])

  // Handle file selection
  const handleFiles = useCallback((files: FileList | File[]) => {
    const valid = Array.from(files).filter(f => ACCEPTED_TYPES.includes(f.type))
    valid.forEach(f => uploadFile(f))
  }, [uploadFile])

  // Drag handlers
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(true) }, [])
  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDragging(false)
  }, [])
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  return (
    <div className="page-shell" style={{ maxWidth: 720 }}>

      {/* ── HEADER ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title" style={{ color: 'var(--cruz-text)', marginBottom: 6 }}>
          Subir Documentos
        </h1>
        <p style={{ fontSize: 'var(--aguila-fs-section)', color: 'var(--cruz-text-muted)', lineHeight: 1.5 }}>
          Sus documentos serán clasificados automáticamente por PORTAL
        </p>
      </div>

      {/* ── SECTION 1: Embarque Selector ── */}
      <div style={{ marginBottom: 24 }}>
        <label style={{
          display: 'block', fontSize: 'var(--aguila-fs-meta)', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.06em',
          color: 'var(--cruz-text-muted)', marginBottom: 8,
        }}>
          Seleccionar Embarque
        </label>
        <select
          value={selectedTrafico}
          onChange={e => setSelectedTrafico(e.target.value)}
          style={{
            width: '100%', minHeight: 60,
            padding: '12px 16px', fontSize: 15,
            background: 'var(--cruz-surface)',
            border: '1px solid var(--cruz-border)',
            borderRadius: 10, color: 'var(--cruz-text)',
            fontFamily: 'var(--font-sans)',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B6560' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 16px center',
          }}
          disabled={loadingTraficos}
        >
          <option value="">{loadingTraficos ? 'Cargando embarques...' : 'Seleccionar embarque...'}</option>
          {traficos.map(t => (
            <option key={t.trafico} value={t.trafico}>
              {fmtId(t.trafico)} — {t.descripcion_mercancia || 'Sin descripción'}
            </option>
          ))}
        </select>
      </div>

      {/* ── SECTION 2: Upload Zone ── */}
      <div
        ref={dropRef}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => selectedTrafico && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--cruz-gold)' : 'var(--cruz-border)'}`,
          borderRadius: 12,
          padding: '48px 24px',
          textAlign: 'center',
          cursor: selectedTrafico ? 'pointer' : 'not-allowed',
          opacity: selectedTrafico ? 1 : 0.4,
          background: dragging ? 'rgba(196,162,78,0.06)' : 'transparent',
          transition: 'all 0.15s ease',
          marginBottom: 24,
        }}
      >
        <Upload size={32} style={{ color: dragging ? 'var(--cruz-gold)' : 'var(--cruz-text-muted)', marginBottom: 12 }} />
        <p style={{ fontSize: 15, color: 'var(--cruz-text-secondary)', fontWeight: 500, marginBottom: 4 }}>
          Arrastra documentos aquí o haz clic para seleccionar
        </p>
        <p style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--cruz-text-ghost)' }}>
          PDF, JPG, PNG, DOCX
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXT}
          multiple
          onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }}
          style={{ display: 'none' }}
        />
      </div>

      {/* ── SECTION 3: Recent Uploads (this session) ── */}
      {uploads.length > 0 && (
        <div style={{
          background: 'var(--cruz-surface)',
          border: '1px solid var(--cruz-border)',
          borderRadius: 12,
          overflow: 'hidden',
          marginBottom: 24,
        }}>
          <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--cruz-border)',
            fontSize: 'var(--aguila-fs-body)', fontWeight: 700,
            color: 'var(--cruz-text)',
          }}>
            Documentos subidos esta sesión
          </div>
          {uploads.map((u, i) => (
            <div key={`${u.fileName}-${i}`} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 20px',
              borderBottom: i < uploads.length - 1 ? '1px solid var(--cruz-border-subtle, rgba(255,255,255,0.045))' : 'none',
            }}>
              {/* Status icon */}
              {u.status === 'uploading' && <Loader2 size={18} style={{ color: 'var(--cruz-amber)', animation: 'spin 1s linear infinite' }} />}
              {u.status === 'classified' && <CheckCircle size={18} style={{ color: 'var(--cruz-green)' }} />}
              {u.status === 'unclassified' && <AlertTriangle size={18} style={{ color: 'var(--cruz-amber)' }} />}
              {u.status === 'error' && <AlertTriangle size={18} style={{ color: 'var(--cruz-red)' }} />}

              {/* File info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 'var(--aguila-fs-body)', fontWeight: 600, color: 'var(--cruz-text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {u.fileName}
                </div>
                <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--cruz-text-ghost)', marginTop: 2 }}>
                  {fmtBytes(u.size)}
                  {u.status === 'uploading' && ' · Subiendo...'}
                  {u.status === 'error' && ` · ${u.errorMsg}`}
                </div>
              </div>

              {/* Classification badge */}
              {u.status === 'classified' && (
                <span style={{
                  fontSize: 'var(--aguila-fs-meta)', fontWeight: 600,
                  padding: '4px 10px', borderRadius: 6,
                  background: 'var(--cruz-green-dim)',
                  color: 'var(--cruz-green)',
                  border: '1px solid rgba(62,166,107,0.15)',
                  whiteSpace: 'nowrap',
                }}>
                  {u.docType} ({u.confidence}%)
                </span>
              )}
              {u.status === 'unclassified' && (
                <span style={{
                  fontSize: 'var(--aguila-fs-meta)', fontWeight: 600,
                  padding: '4px 10px', borderRadius: 6,
                  background: 'var(--cruz-amber-dim)',
                  color: 'var(--cruz-amber)',
                  border: '1px solid rgba(212,148,58,0.15)',
                  whiteSpace: 'nowrap',
                }}>
                  Revisar manualmente
                </span>
              )}
              {u.status === 'error' && (
                <span style={{
                  fontSize: 'var(--aguila-fs-meta)', fontWeight: 600,
                  padding: '4px 10px', borderRadius: 6,
                  background: 'var(--cruz-red-dim)',
                  color: 'var(--cruz-red)',
                  border: '1px solid rgba(224,62,74,0.15)',
                  whiteSpace: 'nowrap',
                }}>
                  Error
                </span>
              )}
            </div>
          ))}

          {/* Link to full expediente */}
          {selectedTrafico && (
            <a
              href={`/expedientes?trafico=${encodeURIComponent(selectedTrafico)}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '14px 20px',
                borderTop: '1px solid var(--cruz-border)',
                fontSize: 'var(--aguila-fs-body)', fontWeight: 600,
                color: 'var(--cruz-gold)',
                textDecoration: 'none',
                transition: 'background 0.1s ease',
                minHeight: 60,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(196,162,78,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Ver todos en expediente <ChevronRight size={14} />
            </a>
          )}
        </div>
      )}

      {/* ── SECTION 4: Missing Docs Reminder ── */}
      {selectedTrafico && blockingDocs.length > 0 && (
        <div style={{
          background: 'var(--cruz-surface)',
          border: '1px solid var(--cruz-border)',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--cruz-border)',
            fontSize: 'var(--aguila-fs-body)', fontWeight: 700,
            color: 'var(--cruz-text)',
          }}>
            Documentos requeridos
          </div>
          {blockingDocs.map(doc => (
            <div key={doc.doc_type} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 20px',
              borderBottom: '1px solid var(--cruz-border-subtle, rgba(255,255,255,0.045))',
            }}>
              {doc.present
                ? <CheckCircle size={16} style={{ color: 'var(--cruz-green)', flexShrink: 0 }} />
                : <div style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px solid var(--cruz-text-ghost)', flexShrink: 0 }} />
              }
              <span style={{
                flex: 1, fontSize: 'var(--aguila-fs-section)', fontWeight: 500,
                color: doc.present ? 'var(--cruz-text-muted)' : 'var(--cruz-text)',
                textDecoration: doc.present ? 'line-through' : 'none',
              }}>
                {doc.label}
              </span>
              {!doc.present && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', minHeight: 60,
                    fontSize: 'var(--aguila-fs-compact)', fontWeight: 600,
                    background: 'rgba(196,162,78,0.10)',
                    color: 'var(--cruz-gold)',
                    border: '1px solid var(--cruz-border-gold)',
                    borderRadius: 8, cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(196,162,78,0.18)'
                    e.currentTarget.style.borderColor = 'rgba(196,162,78,0.4)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(196,162,78,0.10)'
                    e.currentTarget.style.borderColor = 'var(--cruz-border-gold)'
                  }}
                >
                  <Upload size={12} /> Subir
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state when no embarque selected */}
      {!selectedTrafico && !loadingTraficos && (
        <div style={{ marginTop: 24 }}>
          <EmptyState
            icon="📄"
            title="Selecciona un embarque"
            description="Elige un embarque activo para subir documentos"
          />
        </div>
      )}

      {/* Spin keyframe for loader */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
