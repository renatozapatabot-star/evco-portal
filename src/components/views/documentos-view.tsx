'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { createClient } from '@supabase/supabase-js'
import { Upload, CheckCircle, ChevronDown, Download, Trash2 } from 'lucide-react'
import { getClientNameCookie, getCompanyIdCookie } from '@/lib/client-config'
import { ErrorCard } from '@/components/ui/ErrorCard'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const LEGAL_DOCS = [
  { id: 'poder_notarial', label: 'Poder Notarial', desc: 'Autorización ante agente aduanal', required: true },
  { id: 'encargo_conferido', label: 'Encargo Conferido', desc: 'Autorización VUCEM', required: true },
  { id: 'rfc_constancia', label: 'RFC Constancia de Situación', desc: 'SAT situación fiscal actualizada', required: true },
  { id: 'efirma', label: 'e.Firma (SAT)', desc: 'Firma electrónica avanzada', required: true },
  { id: 'immex', label: 'Autorización IMMEX', desc: 'Programa de importación temporal', required: true },
  { id: 'padron_importadores', label: 'Padrón de Importadores', desc: 'Registro activo SAT', required: true },
  { id: 'acta_constitutiva', label: 'Acta Constitutiva', desc: 'Escritura de constitución', required: true },
  { id: 'vucem_acceso', label: 'Acceso VUCEM', desc: 'Portal ventanilla única', required: true },
  { id: 'nom_plasticos', label: 'NOM Plásticos', desc: 'Normas aplicables Cap. 39', required: false },
  { id: 'contrato_agencia', label: 'Contrato de Agencia', desc: 'Contrato con Renato Zapata & Company', required: true },
  { id: 'seguro_mercancias', label: 'Seguro de Mercancías', desc: 'Póliza de seguro de carga', required: false },
  { id: 'certificado_origen', label: 'Certificados T-MEC', desc: 'USMCA certificates on file', required: true },
]

export function DocumentosView() {
  const isMobile = useIsMobile()
  const [companyDocs, setCompanyDocs] = useState<{ tipo_documento?: string; [key: string]: unknown }[]>([])
  const [loading, setLoading] = useState(true)
  const [docError, setDocError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState<Record<string, { name: string; time: string }>>({})

  // Upload zone state
  const [dragOver, setDragOver] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadDocType, setUploadDocType] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function loadDocs() {
    setLoading(true)
    setDocError(null)
    supabase.from('company_documents').select('*').limit(100)
      .then(({ data, error }) => {
        if (error) { setDocError('No se pudieron cargar los documentos.') }
        else { setCompanyDocs(data || []) }
        setLoading(false)
      }, () => {
        setDocError('No se pudieron cargar los documentos.')
        setLoading(false)
      })
  }

  useEffect(() => { loadDocs() }, [])

  const handleUploadFile = useCallback((file: File) => {
    setUploadFile(file)
    setUploadDocType('')
  }, [])

  const confirmUpload = useCallback(async () => {
    if (!uploadFile || !uploadDocType) return
    setUploading(true)
    setUploadProgress(10)

    try {
      const companyId = getCompanyIdCookie() || 'unknown'
      const ext = uploadFile.name.split('.').pop() || 'pdf'
      const storagePath = `${companyId}/legal/${uploadDocType}_${Date.now()}.${ext}`

      setUploadProgress(30)

      // Upload to Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('company-documents')
        .upload(storagePath, uploadFile, { upsert: true })

      if (storageError) throw storageError
      setUploadProgress(70)

      // Insert record into company_documents table
      const { error: dbError } = await supabase.from('company_documents').insert({
        company_id: companyId,
        tipo_documento: uploadDocType,
        filename: uploadFile.name,
        storage_path: storagePath,
        uploaded_at: new Date().toISOString(),
      })

      if (dbError) throw dbError
      setUploadProgress(100)

      // Update local state
      setUploaded(prev => ({ ...prev, [uploadDocType]: { name: uploadFile.name, time: new Date().toLocaleString('es-MX') } }))
      setUploadFile(null)
      setUploadDocType('')
      loadDocs()
    } catch (err) {
      setDocError(`Error al subir documento: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }, [uploadFile, uploadDocType])

  const isDocComplete = (docId: string) =>
    companyDocs.some(cd => cd.tipo_documento?.toLowerCase().includes(docId.toLowerCase())) || !!uploaded[docId]

  const requiredDocs = LEGAL_DOCS.filter(d => d.required)
  const completedRequired = requiredDocs.filter(d => isDocComplete(d.id)).length
  const pendingRequired = requiredDocs.length - completedRequired

  // Sort: pending first, then complete
  const sortedDocs = [...LEGAL_DOCS].sort((a, b) => {
    const aComplete = isDocComplete(a.id) ? 1 : 0
    const bComplete = isDocComplete(b.id) ? 1 : 0
    if (aComplete !== bComplete) return aComplete - bComplete
    // Within same status, required first
    if (a.required !== b.required) return a.required ? -1 : 1
    return 0
  })

  if (docError) {
    return (
      <div style={{ padding: 32, maxWidth: 700, margin: '0 auto' }}>
        <ErrorCard message={docError} onRetry={loadDocs} />
      </div>
    )
  }

  return (
    <div className="page-shell" style={{ maxWidth: 900 }}>
      <div style={{ height: 20 }} />

      {/* Progress banner */}
      {!loading && (
        <div style={{
          margin: '0 20px 16px',
          background: completedRequired === requiredDocs.length ? 'rgba(22,163,74,0.06)' : 'rgba(217,119,6,0.06)',
          border: `1px solid ${completedRequired === requiredDocs.length ? 'rgba(22,163,74,0.25)' : 'rgba(217,119,6,0.25)'}`,
          borderRadius: 10, padding: '14px 16px',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: completedRequired === requiredDocs.length ? 'var(--success, #16A34A)' : 'var(--gold-dark, #8B6914)' }}>
            {completedRequired} de {requiredDocs.length} documentos completos
          </div>
          {/* Progress bar */}
          <div style={{ height: 6, background: 'var(--border, #E8E5E0)', borderRadius: 9999, overflow: 'hidden', marginTop: 8 }}>
            <div style={{
              width: `${Math.round((completedRequired / requiredDocs.length) * 100)}%`,
              height: '100%',
              background: completedRequired === requiredDocs.length ? 'var(--success, #16A34A)' : 'var(--gold, #C9A84C)',
              borderRadius: 9999,
              transition: 'width 0.4s ease',
            }} />
          </div>
          {pendingRequired > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
              Documentos requeridos pendientes para cumplimiento SAT
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 260px', gap: 20, padding: '0 20px 40px', alignItems: 'start' }}>

      {/* Document checklist — LEFT */}
      <div>
        {!loading && companyDocs.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '32px 20px', marginBottom: 16,
            background: 'var(--bg-card)', border: '1px solid var(--border, #E8E5E0)',
            borderRadius: 10,
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Sin documentos</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Suba sus documentos para comenzar.</div>
          </div>
        )}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer" style={{ height: 56, borderRadius: 8 }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sortedDocs.map(doc => {
              const complete = isDocComplete(doc.id)
              const up = uploaded[doc.id]

              return (
                <div
                  key={doc.id}
                  id={`doc-${doc.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px', borderRadius: 10,
                    background: 'var(--bg-card)',
                    border: `1px solid ${complete ? 'var(--border, #E8E5E0)' : 'var(--border, #E8E5E0)'}`,
                    borderLeft: complete ? '3px solid var(--success, #16A34A)' : '3px solid var(--border, #E8E5E0)',
                    transition: 'background 100ms',
                  }}
                >
                  {/* Status icon */}
                  {complete ? (
                    <CheckCircle size={20} style={{ color: 'var(--success, #16A34A)', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--border, #E8E5E0)', flexShrink: 0 }} />
                  )}

                  {/* Doc info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontSize: 14, fontWeight: 600,
                        color: complete ? 'var(--text-secondary)' : 'var(--text-primary)',
                      }}>
                        {doc.label}
                      </span>
                      {doc.required && !complete && (
                        <span
                          aria-label="Documento requerido"
                          style={{
                          background: 'rgba(0,0,0,0.05)', color: 'var(--text-muted, #9B9B9B)',
                          borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 700,
                        }}>
                          REQ
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {up ? `Recibido: ${up.name}` : doc.desc}
                    </div>
                  </div>

                  {/* Actions + Status badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {complete && (() => {
                      const companyDoc = companyDocs.find(cd => cd.tipo_documento?.toLowerCase().includes(doc.id.toLowerCase()))
                      const fileUrl = (companyDoc as Record<string, unknown>)?.file_url as string | undefined
                      return fileUrl ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); window.open(fileUrl, '_blank') }}
                          title="Descargar"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                            color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                          }}
                        >
                          <Download size={16} />
                        </button>
                      ) : null
                    })()}
                    {complete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          // TODO: Implement actual Supabase delete logic
                          // 1. Show confirmation dialog
                          // 2. Delete from company_documents table
                          // 3. Delete file from Supabase Storage
                          // 4. Refresh document list
                          if (window.confirm(`Eliminar documento: ${doc.label}?`)) {
                            // Delete from local uploaded state if applicable
                            if (uploaded[doc.id]) {
                              setUploaded(prev => {
                                const next = { ...prev }
                                delete next[doc.id]
                                return next
                              })
                            }
                          }
                        }}
                        title="Eliminar"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                          color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: complete ? 'var(--success, #16A34A)' : 'var(--text-muted, #9B9B9B)',
                    }}>
                      {complete ? (up ? 'Recibido' : 'Vigente') : 'Pendiente'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Upload zone — RIGHT column */}
      <div style={{ position: isMobile ? 'relative' : 'sticky', top: isMobile ? undefined : 80 }}>
        {!uploadFile ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleUploadFile(e.dataTransfer.files[0]) }}
            style={{
              border: `2px dashed ${dragOver ? 'var(--gold, #C9A84C)' : 'var(--border, #E8E5E0)'}`,
              borderRadius: 12, padding: '24px 16px', textAlign: 'center', cursor: 'pointer',
              background: dragOver ? 'rgba(196,150,60,0.04)' : 'var(--bg-card)',
              transition: 'all 150ms',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Upload size={24} style={{ color: 'var(--text-muted)' }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Subir documento</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>PDF, imagen o Word</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) handleUploadFile(e.target.files[0]) }}
            />
          </div>
        ) : (
          <div style={{
            border: '1px solid var(--border, #E8E5E0)',
            borderRadius: 12, padding: '16px',
            background: 'var(--bg-card)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {uploadFile.name}
            </div>
            {uploading ? (
              <div>
                <div style={{ height: 6, background: 'var(--border, #E8E5E0)', borderRadius: 3 }}>
                  <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--gold, #C9A84C)', borderRadius: 3, transition: 'width 80ms linear' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: 'center' }}>{uploadProgress}%</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ position: 'relative' }}>
                  <select value={uploadDocType} onChange={e => setUploadDocType(e.target.value)}
                    style={{ width: '100%', padding: '10px 28px 10px 10px', fontSize: 12, fontFamily: 'var(--font-mono)', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)', color: 'var(--text-primary)', appearance: 'none', cursor: 'pointer', minHeight: 60 }}>
                    <option value="">Tipo...</option>
                    {LEGAL_DOCS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                    <option value="otro">Otro</option>
                  </select>
                  <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={confirmUpload} disabled={!uploadDocType}
                    style={{ flex: 1, background: uploadDocType ? 'var(--gold)' : 'var(--border)', color: uploadDocType ? '#FFF' : 'var(--text-muted)', border: 'none', borderRadius: 8, padding: '10px', fontSize: 12, fontWeight: 700, cursor: uploadDocType ? 'pointer' : 'default', minHeight: 60 }}>
                    Subir
                  </button>
                  <button onClick={() => { setUploadFile(null); setUploadDocType('') }}
                    style={{ background: 'transparent', border: 'none', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', padding: '10px 6px', minHeight: 60 }}>
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      </div>
    </div>
  )
}
