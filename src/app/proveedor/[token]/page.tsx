'use client'

/**
 * Portal · Phase 4 commit 1 — supplier mini-cockpit.
 *
 * Token-gated 4-card glass cockpit for proveedores. No session, ever.
 * Matches ClientHome's cinematic glass aesthetic: rgba(255,255,255,0.04)
 * cards, cyan accents, 20px radius, 60px touch targets. Spanish primary.
 *
 * Tiles:
 *   1. Documentos solicitados — checklist of missing / received docs.
 *   2. Subir documento — drag/pick uploader routed to /api/upload-token.
 *   3. Ver embarque — read-only summary panel.
 *   4. Confirmar embarque — POSTs to /api/supplier/confirm-shipment,
 *      emits workflow_event. 5-second undo window would belong on the
 *      operator side; here the supplier needs a hard click + visible
 *      confirmation — the commit is logged on the broker's side.
 *
 * Positive-completion banner appears when all required docs are received.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  CheckSquare,
  Upload,
  Eye,
  Truck,
  FileText,
  Loader2,
  CheckCircle2,
  X,
} from 'lucide-react'
import { fmtDate, fmtDateTime } from '@/lib/format-utils'
import { AguilaMark } from '@/components/brand/AguilaMark'
import { AguilaWordmark } from '@/components/brand/AguilaWordmark'
import { categoryForDocCode, type DocCategory } from '@/lib/document-types'
import { track } from '@/lib/telemetry/useTrack'

const CATEGORY_LABELS: Record<DocCategory, string> = {
  COMERCIAL: 'Comercial',
  TRANSPORTE: 'Transporte',
  ORIGEN: 'Origen',
  REGULATORIO: 'Regulatorio',
  TECNICO: 'Técnico',
  FISCAL: 'Fiscal',
  ADUANAL: 'Aduanal',
  FINANCIERO: 'Financiero',
  OTROS: 'Otros',
}

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]
const MAX_SIZE = 25 * 1024 * 1024

/**
 * Label map covers both legacy upload_tokens payloads (FACTURA, COVE, …)
 * and the canonical slugs from src/lib/doc-requirements.ts (factura, cove,
 * …). Fall through returns a prettified version of the raw value.
 */
const DOC_LABELS: Record<string, string> = {
  // Legacy uppercase (current upload_tokens.required_docs)
  FACTURA: 'Factura comercial',
  COVE: 'COVE',
  PEDIMENTO: 'Pedimento',
  LISTA_EMPAQUE: 'Lista de empaque',
  CERTIFICADO_ORIGEN: 'Certificado de origen (T-MEC)',
  CARTA_PORTE: 'Carta porte',
  BILL_OF_LADING: 'Conocimiento de embarque',
  PACKING_LIST: 'Lista de empaque',
  RFC_CONSTANCIA: 'Constancia RFC',
  ENCARGO_CONFERIDO: 'Encargo conferido',
  MVE: 'Manifestación de valor (MVE)',
  // Canonical slugs (doc-requirements.ts)
  factura: 'Factura comercial',
  packing_list: 'Lista de empaque',
  bill_of_lading: 'Conocimiento de embarque',
  carta_porte: 'Carta porte',
  certificado_origen: 'Certificado de origen (T-MEC)',
  pedimento: 'Pedimento',
  rfc_constancia: 'Constancia RFC',
  encargo_conferido: 'Encargo conferido',
  cove: 'COVE',
  mve: 'Manifestación de valor (MVE)',
}

function labelForDoc(key: string): string {
  if (DOC_LABELS[key]) return DOC_LABELS[key]
  return key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

interface UploadInfo {
  trafico_id: string
  company_id: string
  company_name: string | null
  required_docs: string[]
  docs_received: string[]
  expires_at: string | null
  last_activity_at: string | null
  shipment_confirmed: boolean
  shipment_confirmed_at: string | null
}

type PanelId = 'docs' | 'upload' | 'trafico' | 'confirm' | null

export default function ProveedorPage() {
  const { token } = useParams<{ token: string }>()
  const [info, setInfo] = useState<UploadInfo | null>(null)
  const [error, setError] = useState('')
  const [panel, setPanel] = useState<PanelId>(null)

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState<string[]>([])
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const [rowSuccess, setRowSuccess] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const perDocFileRef = useRef<HTMLInputElement>(null)
  const pendingDocCodeRef = useRef<string | null>(null)

  // Confirm state
  const [confirming, setConfirming] = useState(false)
  const [confirmNote, setConfirmNote] = useState('')
  const [confirmResult, setConfirmResult] = useState<string | null>(null)
  const [qrLabel, setQrLabel] = useState<{ code: string; dataUrl: string } | null>(null)

  const load = async () => {
    try {
      const r = await fetch(`/api/upload-token?token=${token}`)
      const data = await r.json()
      if (data.error) setError(data.error)
      else setInfo(data as UploadInfo)
    } catch (err) {
      setError('load_failed')
      console.error('[proveedor] load:', err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    void load()
    // Telemetry: supplier_portal_opened (routed through checklist_item_viewed
    // with metadata.event — TelemetryEvent union stays locked).
    const isMobile =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(max-width: 600px)')?.matches
    track('checklist_item_viewed', {
      entityType: 'supplier_portal',
      entityId: String(token ?? ''),
      metadata: {
        event: 'supplier_portal_opened',
        device: isMobile ? 'mobile' : 'desktop',
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const missing: string[] = useMemo(() => {
    if (!info) return []
    const received = new Set((info.docs_received || []).map((d) => d.toUpperCase()))
    const uploadedNorm = uploaded.map((u) => u.toUpperCase())
    return (info.required_docs || []).filter((d) => {
      const up = d.toUpperCase()
      if (received.has(up)) return false
      // Treat an uploaded filename containing the doc key as received (optimistic).
      if (uploadedNorm.some((u) => u.includes(up))) return false
      return true
    })
  }, [info, uploaded])

  const allReceived = Boolean(
    info && (info.required_docs || []).length > 0 && missing.length === 0
  )

  // ------ Handlers ------
  function triggerUploadForDoc(docCode: string) {
    pendingDocCodeRef.current = docCode
    setUploadingDoc(docCode)
    setRowError(null)
    setRowSuccess(null)
    const start = performance.now()
    track('doc_uploaded', {
      entityType: 'doc_type',
      entityId: docCode,
      metadata: { event: 'supplier_upload_started', doc_code: docCode, start_ms: start },
    })
    perDocFileRef.current?.click()
  }

  async function handlePerDocFiles(files: FileList | null) {
    const docCode = pendingDocCodeRef.current
    if (!files || files.length === 0 || !info || !docCode) {
      setUploadingDoc(null)
      return
    }
    const start = performance.now()
    setRowError(null)
    setRowSuccess(null)
    let bytes = 0
    const ok: string[] = []
    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setRowError(`Tipo no permitido: ${file.name}`)
        continue
      }
      if (file.size > MAX_SIZE) {
        setRowError(`${file.name} excede 25 MB`)
        continue
      }
      bytes += file.size
      const fd = new FormData()
      fd.append('file', file)
      fd.append('token', token)
      fd.append('trafico_id', info.trafico_id)
      fd.append('company_id', info.company_id)
      fd.append('doc_type_code', docCode)
      try {
        const res = await fetch('/api/upload-token', { method: 'POST', body: fd })
        const data = await res.json()
        if (data.success) ok.push(file.name)
        else setRowError(data.error || 'Error al subir')
      } catch (err) {
        setRowError('Error de conexión')
        console.error('[proveedor] upload:', err instanceof Error ? err.message : String(err))
      }
    }
    setUploadingDoc(null)
    pendingDocCodeRef.current = null
    if (ok.length > 0) {
      setUploaded((prev) => [...prev, ...ok])
      setRowSuccess(docCode)
      track('doc_uploaded', {
        entityType: 'doc_type',
        entityId: docCode,
        metadata: {
          event: 'supplier_upload_completed',
          doc_code: docCode,
          file_count: ok.length,
          bytes,
          duration_ms: Math.round(performance.now() - start),
        },
      })
      void load()
      window.setTimeout(() => setRowSuccess(null), 2000)
    } else {
      track('doc_uploaded', {
        entityType: 'doc_type',
        entityId: docCode,
        metadata: {
          event: 'supplier_upload_failed',
          doc_code: docCode,
          error_code: 'no_files_accepted',
        },
      })
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !info) return
    setError('')
    setUploading(true)
    const ok: string[] = []
    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(`Tipo no permitido: ${file.name}. Use PDF, JPG, PNG o XLSX.`)
        continue
      }
      if (file.size > MAX_SIZE) {
        setError(`${file.name} excede 25 MB.`)
        continue
      }
      const fd = new FormData()
      fd.append('file', file)
      fd.append('token', token)
      fd.append('trafico_id', info.trafico_id)
      fd.append('company_id', info.company_id)
      try {
        const res = await fetch('/api/upload-token', { method: 'POST', body: fd })
        const data = await res.json()
        if (data.success) ok.push(file.name)
        else setError(data.error || 'Error al subir.')
      } catch (err) {
        setError('Error de conexión.')
        console.error('[proveedor] upload:', err instanceof Error ? err.message : String(err))
      }
    }
    setUploaded((prev) => [...prev, ...ok])
    setUploading(false)
    if (ok.length > 0) void load()
  }

  async function handleConfirm() {
    if (!info || confirming) return
    setConfirming(true)
    setConfirmResult(null)
    try {
      const res = await fetch('/api/supplier/confirm-shipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, note: confirmNote.trim() || undefined }),
      })
      const data = await res.json()
      if (res.ok && data?.data?.ok) {
        setConfirmResult('Embarque confirmado. Renato Zapata & Co. ha sido notificado.')
        if (data?.data?.qr?.code && data?.data?.qr?.qrDataUrl) {
          setQrLabel({ code: data.data.qr.code, dataUrl: data.data.qr.qrDataUrl })
        }
        track('checklist_item_viewed', {
          entityType: 'supplier_portal',
          entityId: String(token ?? ''),
          metadata: {
            event: 'supplier_shipment_confirmed',
            has_note: confirmNote.trim().length > 0,
          },
        })
        void load()
      } else {
        setConfirmResult(data?.error?.message || 'No se pudo confirmar. Intente de nuevo.')
      }
    } catch (err) {
      setConfirmResult('Error de conexión. Intente de nuevo.')
      console.error('[proveedor] confirm:', err instanceof Error ? err.message : String(err))
    } finally {
      setConfirming(false)
    }
  }

  // ------ Error state ------
  if (error && !info) {
    const msg =
      error === 'not_found' || error === 'expired'
        ? 'Enlace no válido o expirado. Solicite un enlace nuevo al agente aduanal: ai@renatozapata.com'
        : 'No se pudo cargar la información. Intente de nuevo.'
    return (
      <div style={styles.page}>
        <div style={{ ...styles.cockpitCard, maxWidth: 420, padding: 28 }}>
          <div style={styles.logo}>AGUILA</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#EF4444', margin: '12px 0 8px' }}>
            Enlace no válido
          </div>
          <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6 }}>{msg}</p>
        </div>
      </div>
    )
  }

  // ------ Loading ------
  if (!info) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.cockpitCard, maxWidth: 520, padding: 28 }}>
          <div style={styles.logo}>AGUILA</div>
          <div
            style={{
              height: 120,
              borderRadius: 12,
              marginTop: 12,
              background:
                'linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.4s infinite',
            }}
          />
          <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
        </div>
      </div>
    )
  }

  const dueLabel = info.expires_at ? fmtDate(info.expires_at) : '—'
  const clientName = info.company_name || info.company_id
  const lastActivity = info.last_activity_at ? fmtDateTime(info.last_activity_at) : null

  return (
    <div style={styles.page}>
      <div style={{ width: '100%', maxWidth: 780 }}>
        {/* AGUILA brand header */}
        <div style={{ textAlign: 'center', marginBottom: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <AguilaMark size={72} tone="silver" />
          <AguilaWordmark size={28} tone="silver" />
          <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#7A7E86', textTransform: 'uppercase' }}>
            TOTAL VISIBILIDAD. SIN FRONTERAS.
          </div>
          <div style={styles.chromeSubtitle}>Portal de proveedores</div>
        </div>

        {/* Header block */}
        <div style={{ ...styles.cockpitCard, padding: '20px 24px', marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#C0C5CE',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 8,
            }}
          >
            Solicitud de documentos
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#E6EDF3',
              lineHeight: 1.2,
              marginBottom: 8,
              fontFamily: 'var(--font-jetbrains-mono), var(--font-mono), monospace',
            }}
          >
            Embarque {info.trafico_id}
          </div>
          <div style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.5 }}>
            Cliente: <strong style={{ color: '#E6EDF3' }}>{clientName}</strong>
            {' · '}
            Vencimiento:{' '}
            <strong
              style={{
                color: '#E6EDF3',
                fontFamily: 'var(--font-jetbrains-mono), var(--font-mono), monospace',
              }}
            >
              {dueLabel}
            </strong>
          </div>
          {lastActivity && (
            <div
              style={{
                fontSize: 11,
                color: '#64748b',
                marginTop: 8,
                fontFamily: 'var(--font-jetbrains-mono), var(--font-mono), monospace',
              }}
            >
              Última actividad: {lastActivity}
            </div>
          )}
        </div>

        {/* Positive completion banner */}
        {allReceived && (
          <div
            role="status"
            style={{
              background: 'rgba(34,197,94,0.08)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: 20,
              padding: '16px 20px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <CheckCircle2 size={28} color="#22C55E" strokeWidth={2} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#22C55E',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 2,
                }}
              >
                Expediente completo
              </div>
              <div style={{ fontSize: 14, color: '#E6EDF3', fontWeight: 500, lineHeight: 1.35 }}>
                ¡Listo! Los {info.required_docs.length} documentos fueron recibidos. Gracias.
              </div>
            </div>
          </div>
        )}

        {/* 4-card glass grid */}
        <div className="supplier-grid" style={{ display: 'grid', gap: 12 }}>
          <ActionCard
            icon={CheckSquare}
            label="Documentos solicitados"
            description="Lista de lo que necesitas enviar"
            count={missing.length}
            countTone={missing.length === 0 ? 'ok' : 'warn'}
            onClick={() => setPanel(panel === 'docs' ? null : 'docs')}
            active={panel === 'docs'}
          />
          <ActionCard
            icon={Upload}
            label="Subir documento"
            description="Arrastra archivos aquí"
            count={uploaded.length || null}
            onClick={() => setPanel(panel === 'upload' ? null : 'upload')}
            active={panel === 'upload'}
          />
          <ActionCard
            icon={Eye}
            label="Ver embarque"
            description="Detalles del embarque"
            count={null}
            onClick={() => setPanel(panel === 'trafico' ? null : 'trafico')}
            active={panel === 'trafico'}
          />
          <ActionCard
            icon={Truck}
            label={info.shipment_confirmed ? 'Embarque confirmado' : 'Confirmar embarque'}
            description={
              info.shipment_confirmed
                ? 'Marcado "Mercancía lista"'
                : 'Marcar "Mercancía lista"'
            }
            count={null}
            confirmed={info.shipment_confirmed}
            onClick={() => setPanel(panel === 'confirm' ? null : 'confirm')}
            active={panel === 'confirm'}
          />
        </div>

        {/* Active panel */}
        {panel === 'docs' && (
          <Panel title="Documentos solicitados" onClose={() => setPanel(null)}>
            <input
              ref={perDocFileRef}
              type="file"
              accept=".pdf,image/*,.xlsx"
              capture="environment"
              multiple
              onChange={(e) => handlePerDocFiles(e.target.files)}
              style={{ display: 'none' }}
            />
            {(info.required_docs || []).length === 0 ? (
              <EmptyLine>No hay documentos pendientes en esta solicitud.</EmptyLine>
            ) : (
              (() => {
                // Group requested docs by category for mobile-first upload cards.
                const groups = new Map<DocCategory, string[]>()
                for (const doc of info.required_docs) {
                  const cat = categoryForDocCode(doc)
                  const bucket = groups.get(cat) ?? []
                  bucket.push(doc)
                  groups.set(cat, bucket)
                }
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {Array.from(groups.entries()).map(([cat, codes]) => (
                      <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: '#94a3b8',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                          }}
                        >
                          {CATEGORY_LABELS[cat]}
                        </div>
                        {codes.map((doc) => {
                          const received =
                            info.docs_received?.map((d) => d.toUpperCase()).includes(doc.toUpperCase()) ||
                            uploaded.some((u) => u.toUpperCase().includes(doc.toUpperCase()))
                          const isUploading = uploadingDoc === doc
                          const justSucceeded = rowSuccess === doc
                          return (
                            <div
                              key={doc}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                                padding: '12px 14px',
                                borderRadius: 12,
                                background: justSucceeded
                                  ? 'rgba(34,197,94,0.14)'
                                  : received
                                    ? 'rgba(34,197,94,0.08)'
                                    : 'rgba(255,255,255,0.03)',
                                border: received
                                  ? '1px solid rgba(34,197,94,0.25)'
                                  : '1px solid rgba(255,255,255,0.08)',
                                animation: justSucceeded ? 'pulseGreen 1s ease-out' : undefined,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {received ? (
                                  <CheckCircle2 size={18} color="#22C55E" />
                                ) : (
                                  <FileText size={18} color="#94a3b8" />
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 14, color: '#E6EDF3', fontWeight: 600 }}>
                                    {labelForDoc(doc)}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 11,
                                      color: received ? '#22C55E' : '#64748b',
                                      marginTop: 2,
                                    }}
                                  >
                                    {received ? 'Recibido' : 'Pendiente'}
                                  </div>
                                </div>
                              </div>
                              {!received && (
                                <button
                                  type="button"
                                  onClick={() => triggerUploadForDoc(doc)}
                                  disabled={isUploading}
                                  aria-label={`Subir ${labelForDoc(doc)}`}
                                  style={{
                                    width: '100%',
                                    minHeight: 44,
                                    padding: '10px 16px',
                                    borderRadius: 12,
                                    background: isUploading ? 'rgba(192,197,206,0.4)' : '#E8EAED',
                                    color: '#0B1220',
                                    border: 'none',
                                    fontSize: 14,
                                    fontWeight: 700,
                                    cursor: isUploading ? 'wait' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                  }}
                                >
                                  {isUploading ? (
                                    <>
                                      <Loader2 size={14} style={{ animation: 'spin 1.2s linear infinite' }} />
                                      Subiendo…
                                    </>
                                  ) : (
                                    <>
                                      <Upload size={14} /> Subir
                                    </>
                                  )}
                                </button>
                              )}
                              {rowError && uploadingDoc === null && isUploading === false && (
                                <div
                                  role="alert"
                                  style={{
                                    fontSize: 12,
                                    color: '#EF4444',
                                    padding: 6,
                                  }}
                                >
                                  {rowError}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )
              })()
            )}
            <style>{`@keyframes pulseGreen { 0%{box-shadow:0 0 0 0 rgba(34,197,94,0.6)}100%{box-shadow:0 0 0 12px rgba(34,197,94,0)} }`}</style>
          </Panel>
        )}

        {panel === 'upload' && (
          <Panel title="Subir documento" onClose={() => setPanel(null)}>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,image/*,.xlsx"
              capture="environment"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{
                width: '100%',
                minHeight: 60,
                padding: '18px 24px',
                borderRadius: 16,
                background: uploading ? 'rgba(192,197,206,0.4)' : '#E8EAED',
                color: '#0B1220',
                border: 'none',
                fontSize: 16,
                fontWeight: 800,
                cursor: uploading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              {uploading ? (
                <>
                  <Loader2 size={18} style={{ animation: 'spin 1.2s linear infinite' }} />
                  Subiendo…
                </>
              ) : (
                <>
                  <Upload size={18} />
                  Seleccionar archivos
                </>
              )}
            </button>
            <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
            <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 10 }}>
              PDF, JPG, PNG o XLSX · máximo 25 MB
            </p>
            {uploaded.length > 0 && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {uploaded.map((f) => (
                  <div
                    key={f}
                    style={{
                      fontSize: 13,
                      color: '#22C55E',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <CheckCircle2 size={14} /> {f}
                  </div>
                ))}
              </div>
            )}
            {error && (
              <div
                role="alert"
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  color: '#EF4444',
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)',
                }}
              >
                {error}
              </div>
            )}
          </Panel>
        )}

        {panel === 'trafico' && (
          <Panel title="Detalles del embarque" onClose={() => setPanel(null)}>
            <Row label="Embarque" value={info.trafico_id} mono />
            <Row label="Cliente" value={clientName} />
            <Row label="Documentos requeridos" value={String(info.required_docs?.length ?? 0)} mono />
            <Row
              label="Documentos recibidos"
              value={String(info.docs_received?.length ?? 0)}
              mono
            />
            <Row label="Vencimiento" value={dueLabel} mono />
            {info.shipment_confirmed_at && (
              <Row
                label="Embarque confirmado"
                value={fmtDateTime(info.shipment_confirmed_at)}
                mono
              />
            )}
            <p
              style={{
                fontSize: 12,
                color: '#64748b',
                marginTop: 14,
                lineHeight: 1.5,
              }}
            >
              Esta vista es solo lectura. Para cambios en el embarque, contacte al agente
              aduanal.
            </p>
          </Panel>
        )}

        {panel === 'confirm' && (
          <Panel title="Confirmar embarque" onClose={() => setPanel(null)}>
            {info.shipment_confirmed ? (
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: 'rgba(34,197,94,0.08)',
                  border: '1px solid rgba(34,197,94,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <CheckCircle2 size={24} color="#22C55E" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#E6EDF3' }}>
                    Embarque ya confirmado
                  </div>
                  {info.shipment_confirmed_at && (
                    <div
                      style={{
                        fontSize: 12,
                        color: '#94a3b8',
                        marginTop: 2,
                        fontFamily: 'var(--font-jetbrains-mono), var(--font-mono), monospace',
                      }}
                    >
                      {fmtDateTime(info.shipment_confirmed_at)}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5, marginBottom: 12 }}>
                  Al confirmar, el agente aduanal recibe aviso de que la mercancía está
                  lista para recoger.
                </p>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 6,
                  }}
                >
                  Nota (opcional)
                </label>
                <textarea
                  value={confirmNote}
                  onChange={(e) => setConfirmNote(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Ej. Listo para recoger mañana 8 AM en bodega Norte"
                  style={{
                    width: '100%',
                    minHeight: 72,
                    padding: 12,
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#E6EDF3',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    marginBottom: 12,
                  }}
                />
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={confirming}
                  style={{
                    width: '100%',
                    minHeight: 60,
                    padding: '18px 24px',
                    borderRadius: 16,
                    background: confirming ? 'rgba(34,197,94,0.4)' : '#22C55E',
                    color: '#0B1220',
                    border: 'none',
                    fontSize: 16,
                    fontWeight: 800,
                    cursor: confirming ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                  }}
                >
                  {confirming ? (
                    <>
                      <Loader2 size={18} style={{ animation: 'spin 1.2s linear infinite' }} />
                      Confirmando…
                    </>
                  ) : (
                    <>
                      <Truck size={18} />
                      Confirmar &ldquo;Mercancía lista&rdquo;
                    </>
                  )}
                </button>
              </>
            )}
            {confirmResult && (
              <div
                role="status"
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'rgba(192,197,206,0.06)',
                  border: '1px solid rgba(192,197,206,0.25)',
                  color: '#E6EDF3',
                }}
              >
                {confirmResult}
              </div>
            )}
            {qrLabel && (
              <div
                className="qr-label-print"
                style={{
                  marginTop: 16,
                  padding: 16,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(192,197,206,0.18)',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#94a3b8',
                    marginBottom: 8,
                  }}
                >
                  Etiqueta de caja — imprimir y colocar en el remolque
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrLabel.dataUrl}
                  alt={`Código QR ${qrLabel.code}`}
                  style={{ width: 180, height: 180, background: '#FFFFFF', padding: 8, borderRadius: 8 }}
                />
                <div
                  style={{
                    fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                    fontSize: 14,
                    letterSpacing: '0.12em',
                    color: '#E6EDF3',
                    marginTop: 8,
                  }}
                >
                  {qrLabel.code}
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    marginTop: 12,
                    minHeight: 44,
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: '1px solid rgba(192,197,206,0.35)',
                    background: 'transparent',
                    color: '#E6EDF3',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Imprimir etiqueta
                </button>
              </div>
            )}
          </Panel>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 28, padding: '0 8px' }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>Renato Zapata & Co.</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
            Patente 3596 · Aduana 240 · Est. 1941
          </div>
        </div>
      </div>

      <style>{`
        .supplier-grid {
          grid-template-columns: repeat(2, 1fr);
        }
        @media (max-width: 640px) {
          .supplier-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
        }
      `}</style>
    </div>
  )
}

// ------ Subcomponents ------

interface ActionCardProps {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
  label: string
  description: string
  count: number | null
  countTone?: 'ok' | 'warn'
  active?: boolean
  confirmed?: boolean
  onClick: () => void
}

function ActionCard({
  icon: Icon,
  label,
  description,
  count,
  countTone,
  active,
  confirmed,
  onClick,
}: ActionCardProps) {
  const border = active
    ? '1px solid rgba(192,197,206,0.45)'
    : confirmed
      ? '1px solid rgba(34,197,94,0.3)'
      : '1px solid rgba(255,255,255,0.08)'

  const iconBg = confirmed
    ? 'rgba(34,197,94,0.1)'
    : active
      ? 'rgba(192,197,206,0.15)'
      : 'rgba(192,197,206,0.08)'
  const iconColor = confirmed ? '#22C55E' : '#C0C5CE'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        all: 'unset',
        cursor: 'pointer',
        background: active ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border,
        borderRadius: 20,
        padding: '16px 20px',
        minHeight: 80,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: active
          ? '0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 30px rgba(192,197,206,0.18)'
          : '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        transition: 'all 150ms ease',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: iconBg,
          border: `1px solid ${confirmed ? 'rgba(34,197,94,0.25)' : 'rgba(192,197,206,0.15)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={20} color={iconColor} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#E6EDF3', lineHeight: 1.3 }}>
          {label}
        </div>
        <div style={{ fontSize: 12, color: '#8b9ab5', marginTop: 2, lineHeight: 1.4 }}>
          {description}
        </div>
      </div>
      {count !== null && (
        <div
          style={{
            fontFamily: 'var(--font-jetbrains-mono), var(--font-mono), monospace',
            fontSize: 24,
            fontWeight: 800,
            color:
              count === 0
                ? '#475569'
                : countTone === 'warn'
                  ? '#FBBF24'
                  : countTone === 'ok'
                    ? '#22C55E'
                    : '#E6EDF3',
            flexShrink: 0,
          }}
        >
          {count}
        </div>
      )}
    </button>
  )
}

function Panel({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        ...styles.cockpitCard,
        padding: 20,
        marginTop: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#C0C5CE',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {title}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            all: 'unset',
            cursor: 'pointer',
            width: 60,
            height: 60,
            marginRight: -16,
            marginTop: -16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
          }}
        >
          <X size={18} />
        </button>
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '10px 0',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        gap: 12,
      }}
    >
      <div style={{ fontSize: 12, color: '#94a3b8' }}>{label}</div>
      <div
        style={{
          fontSize: 14,
          color: '#E6EDF3',
          fontWeight: 600,
          textAlign: 'right',
          fontFamily: mono
            ? 'var(--font-jetbrains-mono), var(--font-mono), monospace'
            : 'inherit',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        background: 'rgba(255,255,255,0.02)',
        border: '1px dashed rgba(255,255,255,0.08)',
        color: '#94a3b8',
        fontSize: 13,
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  )
}

// ------ Styles ------

const styles = {
  page: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at 50% 20%, rgba(192,197,206,0.08), transparent 55%), linear-gradient(180deg, #05070B 0%, #0B1220 100%)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '28px 16px 60px',
  } as React.CSSProperties,
  cockpitCard: {
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20,
    boxShadow:
      '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 1px rgba(192,197,206,0.12)',
  } as React.CSSProperties,
  logo: {
    fontSize: 24,
    fontWeight: 800,
    color: '#E8EAED',
    letterSpacing: '0.1em',
  } as React.CSSProperties,
  chromeSubtitle: {
    fontSize: 11,
    color: '#64748b',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    marginTop: 4,
  },
}
