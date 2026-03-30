'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, FileText, Upload } from 'lucide-react'
import { fmtId, fmtDate, fmtUSD, fmtKg, fmtDesc, fmtMXNInt, fmtCurrency, formatAbsoluteETA, formatAbsoluteDate } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { GOLD } from '@/lib/design-system'
import { fmtCarrier, countryFlag } from '@/lib/carrier-names'
import { CruzScore } from '@/components/cruz-score'
import { calculateCruzScore, calculateCruzScoreDetailed, extractScoreInput, scoreReason } from '@/lib/cruz-score'
import { ScoreBreakdown } from '@/components/ScoreBreakdown'
import { createClient } from '@supabase/supabase-js'
// Link removed — entradas now embedded inline
import { COMPANY_ID, CLIENT_NAME } from '@/lib/client-config'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

type Tab = 'financiero' | 'score' | 'transportista' | 'rectificacion'

const REQUIRED_DOCS = ['FACTURA', 'LISTA DE EMPAQUE', 'PEDIMENTO', 'ACUSE DE COVE', 'CARTA', 'ACUSE DE E-DOCUMENT']

const fmtPedimento = (p: string | null) => {
  if (!p) return '—'
  const clean = p.replace(/\s/g, '')
  if (clean.length === 15) return `${clean.slice(0,2)} ${clean.slice(2,4)} ${clean.slice(4,8)} ${clean.slice(8)}`
  return p
}

export default function TraficoDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const isMobile = useIsMobile()
  const [trafico, setTrafico] = useState<any>(null)
  const [documentos, setDocumentos] = useState<any[]>([])
  const [entradas, setEntradas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('financiero')
  const [missingDocs, setMissingDocs] = useState<string[]>([])
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const [trackingCopied, setTrackingCopied] = useState(false)
  const [porqueOpen, setPorqueOpen] = useState<string | null>(null)
  const [rates, setRates] = useState({ dta: 0.008, iva: 0.16, tc: 17.49 })
  const [solicitando, setSolicitando] = useState(false)
  const [solicitadoOk, setSolicitadoOk] = useState(false)

  const handleUpload = async (file: File | undefined, docType: string) => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { alert('Máximo 10MB'); return }
    if (!['application/pdf', 'image/jpeg', 'image/png', 'text/xml', 'application/xml'].includes(file.type)) {
      alert('Solo PDF, JPG, PNG, XML'); return
    }
    const tId = decodeURIComponent(String(id))
    setUploadingDoc(docType)
    try {
      const path = `${tId}/${docType.replace(/ /g, '_')}_${Date.now()}_${file.name}`
      await supabase.storage.from('expedientes').upload(path, file)
      const { data: urlData } = await supabase.storage.from('expedientes').createSignedUrl(path, 3600)
      await supabase.from('documents').insert({
        trafico_id: tId, document_type: docType,
        file_url: urlData?.signedUrl || path,
        metadata: { trafico: tId, uploaded_by: 'portal', original_name: file.name },
        tenant_slug: COMPANY_ID,
      })
      window.location.reload()
    } catch { alert('Error al subir. Intenta de nuevo.') }
    finally { setUploadingDoc(null) }
  }

  useEffect(() => {
    if (!id) return
    const tId = decodeURIComponent(String(id))
    Promise.all([
      fetch(`/api/trafico/${encodeURIComponent(tId)}`).then(r => r.json()).catch(() => ({ data: null })),
      fetch(`/api/data?table=documents&limit=200`).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([t, d]) => {
      setTrafico(t.trafico ?? t.data ?? null)
      const allDocs = d.data ?? []
      let matched = allDocs.filter((doc: any) => doc.metadata?.trafico === tId)
      if (!matched.length) matched = allDocs.filter((doc: any) => doc.file_url?.includes(tId))
      setDocumentos(matched)
      const found = new Set(matched.map((doc: any) => (doc.document_type || '').toUpperCase()))
      setMissingDocs(REQUIRED_DOCS.filter(r => !found.has(r)))
      setLoading(false)
      fetch(`/api/data?table=entradas&trafico=${encodeURIComponent(tId)}&limit=20&order_by=fecha_llegada_mercancia&order_dir=desc`)
        .then(r => r.json()).then(ed => setEntradas(ed.data ?? [])).catch(() => {})
    }).catch(() => setLoading(false))
    fetch('/api/rates').then(r => r.json()).then(d => {
      if (!d.error) setRates({ dta: d.dta?.rate ?? 0.008, iva: d.iva?.rate ?? 0.16, tc: d.tc?.rate ?? 17.49 })
    }).catch(() => {})
  }, [id])

  if (loading) return (
    <div style={{ padding: 24 }}>
      <div className="skeleton" style={{ height: 32, width: 200, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 300, borderRadius: 12 }} />
    </div>
  )

  if (!trafico) return (
    <div style={{ padding: 24 }}>
      <button onClick={() => router.push('/traficos')} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}>
        <ArrowLeft size={14} /> Volver a Tráficos
      </button>
      <p style={{ color: 'var(--text-muted)' }}>Tráfico no encontrado.</p>
    </div>
  )

  const t = trafico
  const isCruzado = (t.estatus || '').toLowerCase().includes('cruz')
  const isPagado = (t.estatus || '').toLowerCase().includes('pagado')
  const score = calculateCruzScore(extractScoreInput(t))
  const detailed = calculateCruzScoreDetailed(extractScoreInput(t))
  const docCompleteness = Math.round((documentos.length / REQUIRED_DOCS.length) * 100)

  // ── 12-STEP TIMELINE ──
  const getStepState = (stepNum: number): 'completed' | 'current' | 'pending' | 'blocked' => {
    if (isCruzado) return stepNum <= 10 ? 'completed' : stepNum === 12 ? 'pending' : 'completed'
    if (isPagado) return stepNum <= 7 ? 'completed' : stepNum === 8 ? 'current' : 'pending'
    if (t.fecha_pago) return stepNum <= 7 ? 'completed' : stepNum === 8 ? 'current' : 'pending'
    if (t.pedimento) return stepNum <= 6 ? 'completed' : stepNum === 7 ? 'current' : 'pending'
    if (documentos.length > 0) return stepNum <= 1 ? 'completed' : stepNum === 2 ? 'current' : 'pending'
    return stepNum === 1 ? 'current' : 'pending'
  }

  const steps = [
    { num: 1, label: 'Documentos recibidos', detail: documentos.length > 0 ? `${documentos.length} documentos vinculados` : 'Pendiente de documentos' },
    { num: 2, label: 'CRUZ procesó', detail: documentos.length > 0 ? `${documentos.length} docs · Confianza: ${docCompleteness}%` : '—' },
    { num: 3, label: 'Revisado y autorizado', detail: t.pedimento ? 'Autorizado · Patente 3596' : '—' },
    { num: 4, label: 'COVE generado', detail: '—' },
    { num: 5, label: 'Previo', detail: 'No requerido por SAT' },
    { num: 6, label: 'Pedimento transmitido', detail: t.pedimento ? `No. ${fmtPedimento(t.pedimento)} · SAAI` : '—' },
    { num: 7, label: 'Pedimento pagado', detail: t.fecha_pago ? formatAbsoluteETA(t.fecha_pago) : '—' },
    { num: 8, label: 'Semáforo asignado', detail: t.semaforo === 0 ? 'Verde' : t.semaforo === 1 ? 'Rojo' : '—' },
    { num: 9, label: 'En cruce', detail: t.fecha_cruce ? `Ingresó: ${formatAbsoluteETA(t.fecha_cruce)}` : '—' },
    { num: 10, label: 'Cruzado', detail: isCruzado && t.fecha_cruce ? formatAbsoluteETA(t.fecha_cruce) : '—' },
    { num: 11, label: 'En ruta', detail: fmtCarrier(t.transportista_mexicano) || '—' },
    { num: 12, label: 'Entregado', detail: '—' },
  ]

  const currentStepIdx = steps.findIndex(s => getStepState(s.num) === 'current')
  const visibleSteps = steps

  const TABS: { key: Tab; label: string }[] = [
    { key: 'financiero', label: 'Financiero' },
    { key: 'score', label: 'Score' },
    { key: 'transportista', label: 'Transportista' },
    { key: 'rectificacion', label: 'Rectificación' },
  ]

  return (
    <div className="page-container" style={{ padding: isMobile ? 16 : 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <button onClick={() => router.push('/traficos')} aria-label="Volver a Tráficos"
        style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--n-400)', fontSize: 12 }}>
        <ArrowLeft size={13} /> Tráficos → {fmtId(t.trafico)}
      </button>

      {/* ═══ HEADER ═══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontFamily: 'var(--font-data)', fontSize: 28, fontWeight: 900, color: 'var(--n-900)', letterSpacing: '-0.02em', margin: 0 }}>
              {fmtId(t.trafico)}
            </h1>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--n-500)', letterSpacing: '0.02em' }}>US → MX</span>
            <span className={`badge ${isCruzado ? 'badge-green' : 'badge-amber'}`}>
              <span className="badge-dot" /><span className="sr-only">Estado: </span>{t.estatus || 'En Proceso'}
            </span>
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--n-500)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span>{CLIENT_NAME}</span>
            {t.proveedores && <><span>·</span><span>{t.proveedores.split(',')[0]?.trim()}</span></>}
            {t.pais_procedencia && <><span>·</span><span>{countryFlag(t.pais_procedencia)} {t.pais_procedencia}</span></>}
          </div>
          {!isCruzado && t.fecha_llegada && (
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--n-500)', fontFamily: 'var(--font-data)' }}>
              En proceso desde {fmtDate(t.fecha_llegada)}
            </div>
          )}
          {t.importe_total && (
            <div style={{ marginTop: 6, fontFamily: 'var(--font-data)', fontSize: 20, fontWeight: 800, color: 'var(--gold-700)' }}>
              {fmtUSD(Number(t.importe_total))} USD
            </div>
          )}
          <div style={{ marginTop: 10, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 8 }}>
            <button
              disabled={solicitando || solicitadoOk || missingDocs.length === 0}
              onClick={async () => {
                setSolicitando(true)
                try {
                  const res = await fetch('/api/solicitar-documentos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ traficoId: t.trafico, missingDocs }),
                  })
                  const data = await res.json()
                  if (data.success) {
                    setSolicitadoOk(true)
                  } else {
                    alert(data.error || 'Error al solicitar documentos')
                  }
                } catch {
                  alert('Error de conexión')
                } finally {
                  setSolicitando(false)
                }
              }}
              style={{
                padding: isMobile ? '12px 14px' : '6px 14px',
                fontSize: isMobile ? 14 : 12, fontWeight: 700,
                border: 'var(--b-default)', borderRadius: 'var(--r-md)',
                background: solicitadoOk ? '#F0FDF4' : 'var(--bg-card)',
                cursor: solicitando || solicitadoOk || missingDocs.length === 0 ? 'default' : 'pointer',
                color: solicitadoOk ? '#16A34A' : 'var(--n-600)',
                opacity: solicitando ? 0.6 : 1,
                width: isMobile ? '100%' : undefined,
                minHeight: isMobile ? 60 : undefined,
              }}
            >
              {solicitando ? 'Solicitando...' : solicitadoOk ? '✓ Solicitados' : 'Solicitar Docs'}
            </button>
            <button onClick={() => {
              const url = `${window.location.origin}/traficos/${encodeURIComponent(t.trafico)}`
              navigator.clipboard.writeText(url)
              setTrackingCopied(true); setTimeout(() => setTrackingCopied(false), 2000)
            }} style={{
              padding: isMobile ? '12px 14px' : '6px 14px',
              fontSize: isMobile ? 14 : 12, fontWeight: 700,
              border: 'var(--b-default)', borderRadius: 'var(--r-md)',
              background: 'var(--bg-card)', cursor: 'pointer', color: 'var(--n-600)',
              width: isMobile ? '100%' : undefined,
              minHeight: isMobile ? 60 : undefined,
            }}>
              {trackingCopied ? '✓ Copiado' : 'Compartir'}
            </button>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <CruzScore score={score} size="lg" showLabel />
          {scoreReason(t) && <div style={{ fontSize: 11, color: 'var(--n-400)', marginTop: 4, maxWidth: 120 }}>{scoreReason(t)}</div>}
        </div>
      </div>

      {/* ═══ MAIN LAYOUT — Timeline left, Tabs right ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 280px) 1fr', gap: isMobile ? 16 : 24 }}>

        {/* ── 12-STEP TIMELINE ── */}
        <div className="card" style={{ padding: 20, alignSelf: 'start' }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--n-400)', marginBottom: 16 }}>
            Estado del Tráfico
          </div>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {visibleSteps.map((step, i) => {
              const state = getStepState(step.num)
              const isLast = i === visibleSteps.length - 1
              const dotColor = state === 'completed' ? GOLD : state === 'current' ? GOLD : state === 'blocked' ? '#DC2626' : 'var(--n-200)'
              const textColor = state === 'completed' ? 'var(--n-900)' : state === 'current' ? 'var(--n-900)' : state === 'blocked' ? '#DC2626' : 'var(--n-400)'
              const lineColor = state === 'completed' ? GOLD : 'var(--n-150)'

              // Special color for semáforo
              const detailColor = step.num === 8 && step.detail === 'Verde' ? '#16A34A'
                : step.num === 8 && step.detail === 'Rojo' ? '#DC2626'
                : step.num === 10 && state === 'completed' ? '#0D9488' // teal = certainty
                : 'var(--n-500)'

              return (
                <li key={step.num} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: isLast ? 0 : 16, minHeight: 60 }}>
                  {/* Dot + line */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                    <div style={{
                      width: state === 'current' ? 14 : 10, height: state === 'current' ? 14 : 10,
                      borderRadius: '50%', flexShrink: 0,
                      background: state === 'pending' ? 'transparent' : dotColor,
                      border: state === 'pending' ? `2px solid var(--n-200)` : 'none',
                      animation: state === 'current' ? 'pulse-dot 2s ease-in-out infinite' : undefined,
                    }} />
                    {!isLast && <div style={{ width: 2, flex: 1, background: lineColor, marginTop: 4 }} />}
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: textColor, lineHeight: 1.3 }}>
                      {step.num}. {step.label}
                      {step.num === 10 && state === 'completed' && ' ✅'}
                      {step.num === 12 && state === 'completed' && ' ✅'}
                    </div>
                    <div style={{ fontSize: 11, color: detailColor, marginTop: 2, fontFamily: step.num === 6 ? 'var(--font-data)' : undefined }}>
                      {step.detail}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
          {/* Timeline always expanded per V6 spec */}
        </div>

        {/* ── RIGHT PANEL: Documents (always visible) + Tabs ── */}
        <div>
          {/* ── DOCUMENTOS — always visible above tabs ── */}
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--n-900)' }}>
                Documentos ({documentos.length}/{REQUIRED_DOCS.length})
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--n-600)', fontFamily: 'var(--font-data)' }}>{docCompleteness}%</span>
            </div>
            {/* Completeness bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 6, background: 'var(--n-100)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${docCompleteness}%`, height: '100%', background: GOLD, borderRadius: 3, transition: 'width 0.6s ease' }} />
              </div>
            </div>

            {/* Missing docs */}
            {missingDocs.length > 0 && (
              <div style={{ padding: '12px 16px', background: 'var(--danger-bg)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 'var(--r-md)', marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Documentos Faltantes</div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6 }}>
                  {missingDocs.map(doc => (
                    <label key={doc} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 12px', borderRadius: 'var(--r-md)', border: '2px dashed rgba(220,38,38,0.3)', background: 'white', cursor: 'pointer', fontSize: isMobile ? 14 : 12, fontWeight: 600, color: '#991B1B', minHeight: 60, width: '100%' }}>
                      {uploadingDoc === doc ? <span style={{ color: GOLD }}>Subiendo...</span> : (
                        <>
                          <Upload size={isMobile ? 16 : 12} />
                          {doc}
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.xml" style={{ display: 'none' }} onChange={e => handleUpload(e.target.files?.[0], doc)} />
                        </>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Present docs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
              {documentos.map((doc: any, i: number) => (
                <div key={i} style={{ padding: '12px 14px', background: 'var(--bg-card)', border: '1px solid #BBF7D0', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#16A34A', fontSize: 14 }}>✅</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--n-800)' }}>{(doc.document_type || 'Documento').replace(/_/g, ' ')}</span>
                  </div>
                  {doc.file_url && <a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: GOLD, fontWeight: 700, textDecoration: 'none' }}>Ver →</a>}
                </div>
              ))}
            </div>
            {documentos.length === 0 && missingDocs.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--n-400)' }}>Documentos pendientes de sincronización</div>
            )}
          </div>

          {/* ── ENTRADAS — embedded sub-section ── */}
          {entradas.length > 0 && (
            <div className="card" style={{ padding: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--n-900)', marginBottom: 12 }}>
                Entradas ({entradas.length})
              </div>
              <div style={{ border: '1px solid var(--n-150)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                {entradas.map((e: any, idx: number) => {
                  const hasIncidencia = e.incidencia || e.estatus_entrada === 'incidencia'
                  return (
                    <div key={e.cve_entrada}
                      style={{
                        padding: '10px 16px',
                        borderBottom: idx < entradas.length - 1 ? '1px solid var(--n-150)' : 'none',
                        borderLeft: hasIncidencia ? '3px solid #DC2626' : '3px solid transparent',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        minHeight: 60,
                      }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-data)' }}>{e.cve_entrada}</span>
                          <span style={{ fontSize: 12, color: 'var(--n-400)', fontFamily: 'var(--font-data)' }}>{fmtDate(e.fecha_llegada_mercancia)}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--n-500)', marginTop: 2 }}>
                          {fmtDesc(e.descripcion_mercancia || e.descripcion || '') || '—'}
                          {e.peso_bruto && <span style={{ marginLeft: 8, fontFamily: 'var(--font-data)' }}>{fmtKg(e.peso_bruto)}</span>}
                        </div>
                      </div>
                      <div>
                        {hasIncidencia ? (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-full, 9999px)', background: '#FEF2F2', color: '#991B1B', border: '1px solid rgba(220,38,38,0.2)' }}>Incidencia</span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-full, 9999px)', background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>OK</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── TABS — secondary data below documents ── */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 12, borderBottom: '1px solid var(--n-150)', overflow: 'auto' }}>
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                padding: '8px 16px', background: 'none', border: 'none',
                borderBottom: activeTab === tab.key ? `2px solid ${GOLD}` : '2px solid transparent',
                cursor: 'pointer', fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 500,
                color: activeTab === tab.key ? 'var(--n-900)' : 'var(--n-400)',
                whiteSpace: 'nowrap', marginBottom: -1,
              }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 2 — FINANCIERO */}
          {activeTab === 'financiero' && (
            <div>
              {t.pedimento && (t.semaforo === 0 || !t.semaforo) && (
                <div style={{ padding: '10px 16px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--r-md)', marginBottom: 16, fontSize: 13, fontWeight: 700, color: '#14532D' }}>
                  T-MEC APLICADO ✅ · IGI: $0
                </div>
              )}
              <div className="card" style={{ overflow: 'hidden' }}>
                {(() => {
                  const val = Number(t.importe_total) || 0
                  const tc = Number(t.tipo_cambio) || 0
                  const valMXN = val * tc
                  const dta = Math.round(valMXN * rates.dta)
                  const igi = 0 // T-MEC
                  const ivaBase = valMXN + dta + igi
                  const iva = Math.round(ivaBase * rates.iva)
                  const total = dta + igi + iva

                  const rows = [
                    { key: 'valor', label: 'Valor Aduana', value: val ? `${fmtUSD(val)} USD` : '—', porque: val ? `Valor declarado en factura comercial: ${fmtUSD(val)}. Convertido a MXN: ${fmtMXNInt(valMXN)} (TC ${tc.toFixed(4)}).` : null },
                    { key: 'tc', label: 'Tipo de Cambio', value: tc ? `$${tc.toFixed(4)} MXN/USD` : '—', porque: tc ? `Tipo de cambio Banxico vigente al momento de pago del pedimento.` : null },
                    { key: 'dta', label: 'DTA', value: val && tc ? `${fmtMXNInt(dta)} MXN` : '—', porque: val && tc ? `DTA = Valor aduana MXN × 0.8% = ${fmtMXNInt(valMXN)} × 0.008 = ${fmtMXNInt(dta)} MXN. Régimen ${t.regimen || 'A1'}.` : null },
                    { key: 'igi', label: 'IGI', value: '$0 MXN (T-MEC)', porque: `IGI exento porque: proveedor USA · certificado T-MEC vigente. Sin T-MEC: estimado ${fmtMXNInt(Math.round(valMXN * 0.05))} MXN (5%).` },
                    { key: 'iva', label: 'IVA (16%)', value: val && tc ? `${fmtMXNInt(iva)} MXN` : '—', porque: val && tc ? `IVA = 16% × (Valor aduana + DTA + IGI) = 16% × (${fmtMXNInt(valMXN)} + ${fmtMXNInt(dta)} + $0) = ${fmtMXNInt(iva)} MXN. Base ≠ factura.` : null },
                    { key: 'total', label: 'Total Contribuciones', value: val && tc ? `${fmtMXNInt(total)} MXN` : '—', porque: val && tc ? `DTA ${fmtMXNInt(dta)} + IGI $0 + IVA ${fmtMXNInt(iva)} = ${fmtMXNInt(total)} MXN total.` : null },
                  ]

                  return (
                    <table className="data-table" style={{ fontSize: 13 }}>
                      <thead><tr><th scope="col">Concepto</th><th scope="col" style={{ textAlign: 'right' }}>Monto</th><th scope="col" style={{ width: 40 }}></th></tr></thead>
                      <tbody>
                        {rows.map(r => (
                          <React.Fragment key={r.key}>
                            <tr onClick={() => setPorqueOpen(porqueOpen === r.key ? null : r.key)} style={{ cursor: r.porque ? 'pointer' : undefined }}>
                              <td style={{ color: 'var(--n-700)' }}>{r.label}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)', fontWeight: 700, color: r.key === 'total' ? GOLD : 'var(--n-900)' }}>{r.value}</td>
                              <td style={{ textAlign: 'center' }}>
                                {r.porque && <span style={{ fontSize: 11, color: porqueOpen === r.key ? GOLD : 'var(--n-300)', fontWeight: 700 }}>?</span>}
                              </td>
                            </tr>
                            {porqueOpen === r.key && r.porque && (
                              <tr>
                                <td colSpan={3} style={{ background: 'var(--gold-50)', padding: '10px 14px', fontSize: 12, color: 'var(--n-700)', lineHeight: 1.6, borderLeft: `3px solid ${GOLD}` }}>
                                  {r.porque}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  )
                })()}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--n-400)' }}>
                Estimado · Los montos oficiales se confirman tras la transmisión del pedimento
              </div>
            </div>
          )}

          {/* TAB 3 — SCORE */}
          {activeTab === 'score' && (
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <svg width={160} height={160} viewBox="0 0 160 160">
                  <circle cx={80} cy={80} r={68} fill="none" stroke="var(--n-100)" strokeWidth={12} />
                  <circle cx={80} cy={80} r={68} fill="none"
                    stroke={score >= 70 ? '#16A34A' : score >= 40 ? '#D97706' : '#DC2626'}
                    strokeWidth={12} strokeLinecap="round"
                    strokeDasharray={427.26}
                    strokeDashoffset={427.26 * ((100 - score) / 100)}
                    transform="rotate(-90 80 80)"
                    style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
                  />
                  <text x={80} y={80} textAnchor="middle" dominantBaseline="central"
                    fontSize={36} fontWeight={900} fontFamily="var(--font-data)"
                    fill={score >= 70 ? '#16A34A' : score >= 40 ? '#D97706' : '#DC2626'}>
                    {score}
                  </text>
                  <text x={80} y={105} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--n-400)">
                    de 100
                  </text>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 240 }}>
                <ScoreBreakdown breakdown={detailed.breakdown} score={detailed.score} />
                {detailed.reasons.length > 0 && (
                  <div style={{ marginTop: 12, fontSize: 12, color: 'var(--n-500)' }}>
                    {detailed.reasons.join(' · ')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4 — TRANSPORTISTA */}
          {activeTab === 'transportista' && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--n-400)', marginBottom: 4 }}>Transportista MX</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--n-900)' }}>{fmtCarrier(t.transportista_mexicano) || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--n-400)', marginBottom: 4 }}>Transportista EXT</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--n-900)' }}>{fmtCarrier(t.transportista_extranjero) || '—'}</div>
                </div>
                {t.contenedor && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--n-400)', marginBottom: 4 }}>Contenedor</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--n-900)', fontFamily: 'var(--font-data)' }}>{t.contenedor}</div>
                  </div>
                )}
                {t.fecha_cruce && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--n-400)', marginBottom: 4 }}>Cruce</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0D9488', fontFamily: 'var(--font-data)' }}>{formatAbsoluteETA(t.fecha_cruce)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5 — RECTIFICACIÓN */}
          {activeTab === 'rectificacion' && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--n-400)' }}>
              <FileText size={32} strokeWidth={1.5} style={{ color: 'var(--n-300)', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--n-700)', marginBottom: 4 }}>Sin rectificaciones</div>
              <div style={{ fontSize: 13 }}>Este pedimento no tiene correcciones registradas</div>
            </div>
          )}
        </div>
      </div>

      {/* Entradas now embedded in the right panel above tabs */}

      <style>{`@keyframes pulse-dot { 0%,100% { transform:scale(1); } 50% { transform:scale(1.15); } }`}</style>
    </div>
  )
}
