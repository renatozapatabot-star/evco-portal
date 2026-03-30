'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Share2, Copy, Check } from 'lucide-react'
import { fmtId, fmtDate, fmtDateTime, fmtUSD, fmtKg, fmtDesc } from '@/lib/format-utils'
import { GOLD } from '@/lib/design-system'
import { fmtCarrier, countryFlag } from '@/lib/carrier-names'
import { EventTimeline } from '@/components/EventTimeline'
import { DocumentGuard } from '@/components/DocumentGuard'
import { StatusTimeline } from '@/components/status-timeline'
import { TraficoTimeline } from '@/components/TraficoTimeline'
import { CruzScore } from '@/components/cruz-score'
import { calculateCruzScore, calculateCruzScoreDetailed, extractScoreInput, scoreReason } from '@/lib/cruz-score'
import { DualCurrency } from '@/components/dual-currency'
import { ScoreBreakdown } from '@/components/ScoreBreakdown'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function TraficoDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [trafico, setTrafico] = useState<any>(null)
  const [eventos, setEventos] = useState<any[]>([])
  const [documentos, setDocumentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'documentos' | 'historial'>('overview')
  const [redLight, setRedLight] = useState<{ probability: number; factors: string[] } | null>(null)
  const [entradas, setEntradas] = useState<any[]>([])
  const [missingDocs, setMissingDocs] = useState<string[]>([])
  const [trackingUrl, setTrackingUrl] = useState<string | null>(null)
  const [trackingCopied, setTrackingCopied] = useState(false)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)

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
      const { error } = await supabase.storage.from('expedientes').upload(path, file)
      if (error) throw error
      const { data: urlData } = await supabase.storage.from('expedientes').createSignedUrl(path, 3600)
      await supabase.from('documents').insert({
        trafico_id: tId,
        document_type: docType,
        file_url: urlData?.signedUrl || path,
        metadata: { trafico: tId, uploaded_by: 'portal', original_name: file.name },
        tenant_slug: 'evco',
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
      fetch(`/api/data?table=globalpc_eventos&cve_trafico=${encodeURIComponent(tId)}&limit=50&order_by=fecha&order_dir=desc`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`/api/data?table=documents&limit=200`).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([t, e, d]) => {
      setTrafico(t.trafico ?? t.data ?? null)
      setEventos(e.data ?? [])
      // Filter docs — try metadata.trafico first, then file_url fallback
      const allDocs = d.data ?? []
      let matched = allDocs.filter((doc: any) => doc.metadata?.trafico === tId)
      if (!matched.length) matched = allDocs.filter((doc: any) => doc.file_url?.includes(tId))
      setDocumentos(matched)

      // Missing docs
      const REQUIRED = ['FACTURA', 'LISTA DE EMPAQUE', 'PEDIMENTO', 'ACUSE DE COVE', 'CARTA']
      const found = new Set(matched.map((doc: any) => (doc.document_type || '').toUpperCase()))
      setMissingDocs(REQUIRED.filter(r => !found.has(r)))

      setLoading(false)

      // Entradas linked to this tráfico
      fetch(`/api/data?table=entradas&trafico=${encodeURIComponent(tId)}&limit=20&order_by=fecha_llegada_mercancia&order_dir=desc`)
        .then(r => r.json()).then(ed => setEntradas(ed.data ?? [])).catch(() => {})

      fetch(`/api/red-light?trafico=${encodeURIComponent(tId)}`).then(r => r.json()).then(d => {
        if (d.probability !== null) setRedLight(d)
      }).catch(() => {})
    }).catch(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="page-enter" style={{ padding: 24 }}>
      <div className="skeleton" style={{ height: 32, width: 200, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
    </div>
  )

  if (!trafico) return (
    <div style={{ padding: 24 }}>
      <button onClick={() => router.push('/traficos')} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>
        <ArrowLeft size={14} /> Volver a Tráficos
      </button>
      <p style={{ color: 'var(--text-muted)' }}>Tráfico no encontrado.</p>
    </div>
  )

  const tabs = ['overview', 'documentos', 'historial'] as const

  return (
    <div className="page-enter" style={{ padding: 24 }}>
      <button onClick={() => router.push('/traficos')}
        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12.5 }}>
        <ArrowLeft size={13} />
        EVCO Plastics &rarr; Tráficos &rarr; {fmtId(trafico.trafico)}
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <h1 className="page-title" style={{ fontFamily: 'var(--font-data)' }}>{fmtId(trafico.trafico)}</h1>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`badge ${(trafico.estatus ?? '').toLowerCase().includes('cruz') ? 'badge-green' : 'badge-amber'}`}>
              <span className="badge-dot" />{trafico.estatus || 'En Proceso'}
            </span>
            {trafico.pedimento && <span className="ped-pill">{trafico.pedimento}</span>}
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{fmtDate(trafico.fecha_llegada)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={async () => {
              setGeneratingLink(true)
              try {
                const res = await fetch('/api/tracking/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ trafico_id: trafico.trafico }),
                })
                const data = await res.json()
                if (data.url) {
                  setTrackingUrl(data.url)
                  navigator.clipboard.writeText(data.url)
                  setTrackingCopied(true)
                  setTimeout(() => setTrackingCopied(false), 3000)
                }
              } catch {} finally { setGeneratingLink(false) }
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)',
              borderRadius: 8, cursor: 'pointer', color: GOLD, fontSize: 12, fontWeight: 600,
            }}
          >
            {trackingCopied ? <Check size={14} /> : <Share2 size={14} />}
            {generatingLink ? 'Generando...' : trackingCopied ? 'Copiado' : 'Compartir tracking'}
          </button>
          <div style={{ textAlign: 'center' }}>
            <CruzScore score={calculateCruzScore(extractScoreInput(trafico))} size="lg" showLabel />
            {scoreReason(trafico) && (
              <div style={{ fontSize: 11, color: 'var(--n-400)', marginTop: 4, maxWidth: 120 }}>{scoreReason(trafico)}</div>
            )}
            <button onClick={() => setShowBreakdown(!showBreakdown)}
              style={{ fontSize: 11, color: 'var(--gold-600)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}>
              {showBreakdown ? 'Ocultar ▲' : 'Ver score ▼'}
            </button>
          </div>
        </div>
      </div>
      {trackingUrl && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Share2 size={14} style={{ color: GOLD, flexShrink: 0 }} />
          <code style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{trackingUrl}</code>
          <button onClick={() => { navigator.clipboard.writeText(trackingUrl); setTrackingCopied(true); setTimeout(() => setTrackingCopied(false), 2000) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: GOLD, fontSize: 11 }}>
            {trackingCopied ? 'Copiado' : 'Copiar'}
          </button>
          <a href={`https://wa.me/?text=${encodeURIComponent(`Seguimiento de embarque: ${trackingUrl}\n— Renato Zapata & Company`)}`}
            target="_blank" rel="noopener" style={{ fontSize: 11, color: '#25D366', fontWeight: 600, textDecoration: 'none' }}>
            WhatsApp
          </a>
        </div>
      )}

      {/* Score Breakdown */}
      {showBreakdown && (() => {
        const detailed = calculateCruzScoreDetailed(extractScoreInput(trafico))
        return (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">Cruz Score — Desglose</span></div>
            <div style={{ padding: '8px 16px' }}>
              <ScoreBreakdown breakdown={detailed.breakdown} score={detailed.score} />
            </div>
          </div>
        )
      })()}

      {/* FedEx-style Timeline */}
      <TraficoTimeline trafico={trafico} eventos={eventos} />

      {/* Status Timeline */}
      <StatusTimeline trafico={trafico} />

      {/* Pre-transmission guards */}
      <DocumentGuard traficoId={id as string} />

      {redLight && redLight.probability !== null && (
        <div style={{
          padding: '10px 14px', marginBottom: 16, borderRadius: 8,
          background: redLight.probability > 0.4 ? 'var(--status-red-bg, rgba(239,68,68,0.06))' :
                      redLight.probability > 0.2 ? 'var(--status-yellow-bg, rgba(234,179,8,0.06))' :
                      'var(--status-green-bg, rgba(34,197,94,0.06))',
          border: `1px solid ${redLight.probability > 0.4 ? 'rgba(239,68,68,0.2)' :
                   redLight.probability > 0.2 ? 'rgba(234,179,8,0.2)' : 'rgba(34,197,94,0.2)'}`,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            color: redLight.probability > 0.4 ? 'var(--status-red)' :
                   redLight.probability > 0.2 ? 'var(--status-yellow, #eab308)' : 'var(--status-green)' }}>
            Probabilidad Semáforo Rojo
          </div>
          <div className="mono" style={{ fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
            {Math.round(redLight.probability * 100)}%
          </div>
          {redLight.factors.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {redLight.factors.join(' · ')}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid var(--border-light)', paddingBottom: 0 }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px', background: 'none', border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--gold)' : '2px solid transparent',
              cursor: 'pointer', fontSize: 13.5, fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
              textTransform: 'capitalize', marginBottom: -1,
            }}>
            {tab === 'overview' ? 'Información' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'documentos' && documentos.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11, background: 'var(--amber-bg)', color: 'var(--amber)', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>{documentos.length}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Tráfico', value: fmtId(trafico.trafico) },
            { label: 'Pedimento', value: trafico.pedimento || '' },
            { label: 'Fecha Llegada', value: fmtDate(trafico.fecha_llegada) },
            { label: 'Fecha Pago', value: fmtDate(trafico.fecha_pago) },
            { label: 'Peso Bruto', value: (fmtKg(trafico.peso_bruto)) + ' kg' },
            { label: 'Importe', value: fmtUSD(trafico.importe_total || trafico.valor), isDual: true, rawValue: Number(trafico.importe_total || trafico.valor || 0) },
            { label: 'Régimen', value: trafico.regimen || '' },
            { label: 'Aduana', value: trafico.aduana || '240' },
            { label: 'Transportista', value: fmtCarrier(trafico.transportista_mexicano) },
            { label: 'País Origen', value: trafico.pais_procedencia ? `${countryFlag(trafico.pais_procedencia)} ${trafico.pais_procedencia}` : '' },
            { label: 'Descripción', value: fmtDesc(trafico.descripcion_mercancia) },
            { label: 'Estado', value: trafico.estatus || 'En Proceso' },
          ].map((item: any) => (
            <div key={item.label} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: '10px 14px', border: '1px solid var(--border-light)' }}>
              <div className="section-label" style={{ marginBottom: 4 }}>{item.label}</div>
              {item.isDual && item.rawValue > 0 ? (
                <DualCurrency usd={item.rawValue} />
              ) : (
                <div style={{ fontFamily: 'var(--font-data)', fontSize: 13, fontWeight: 500, color: !item.value ? 'var(--text-disabled)' : 'var(--text-primary)' }}>{item.value}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'documentos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {missingDocs.length > 0 && (
            <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 'var(--r-md)', marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Documentos Faltantes</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {missingDocs.map(doc => (
                  <label key={doc} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 'var(--r-md)', border: '1px solid rgba(220,38,38,0.2)', background: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--danger-t)' }}>
                    {uploadingDoc === doc ? (
                      <span style={{ fontSize: 11, color: 'var(--gold-500)' }}>Subiendo...</span>
                    ) : (
                      <>
                        {doc}
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.xml" style={{ display: 'none' }}
                          onChange={e => handleUpload(e.target.files?.[0], doc)} />
                        <span style={{ fontSize: 10, color: 'var(--gold-600)', fontWeight: 800 }}>+ Subir</span>
                      </>
                    )}
                  </label>
                ))}
              </div>
              <button onClick={() => {
                const body = `Para tráfico ${decodeURIComponent(String(id))}, necesitamos:\n\n${missingDocs.map(d => `• ${d}`).join('\n')}\n\nSaludos,\nRenato Zapata & Company`
                navigator.clipboard.writeText(body)
              }} style={{ marginTop: 8, fontSize: 11, color: 'var(--gold-600)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>
                📋 Copiar solicitud para WhatsApp
              </button>
            </div>
          )}
          {documentos.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--n-400)' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Documentos pendientes de sincronización</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Los documentos se vincularán automáticamente durante el próximo ciclo de sync</div>
            </div>
          ) : documentos.map((doc: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', border: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{(doc.document_type || doc.doc_type || 'Documento').replace(/_/g, ' ')}</span>
              {doc.file_url ? (
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 500, textDecoration: 'none' }}>Ver PDF &rarr;</a>
              ) : (
                <span className="badge badge-amber">Pendiente</span>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'historial' && (
        <EventTimeline traficoId={id as string} />
      )}

      {/* Entradas section */}
      {entradas.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <span className="card-title">Entradas ({entradas.length})</span>
          </div>
          {entradas.map((e: any) => (
            <Link href={`/entradas/${e.cve_entrada}`} key={e.cve_entrada}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: 'var(--b-default)', textDecoration: 'none', color: 'inherit' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-mono)' }}>{e.cve_entrada}</span>
                <span style={{ fontSize: 12, color: 'var(--n-400)', marginLeft: 8 }}>{fmtDate(e.fecha_llegada_mercancia)}</span>
              </div>
              <span style={{ fontSize: 13, color: 'var(--n-600)' }}>{e.peso_bruto ? `${Number(e.peso_bruto).toLocaleString()} kg` : ''}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
