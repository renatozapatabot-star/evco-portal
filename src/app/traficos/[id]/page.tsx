'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Upload, Clock, FileText, Truck, BarChart3, Share2 } from 'lucide-react'
import { fmtId, fmtDate, fmtDateTime, fmtUSD, fmtKg, fmtDesc, fmtMXNInt, formatAbsoluteETA } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { GOLD } from '@/lib/design-system'
import { fmtCarrier, countryFlag } from '@/lib/carrier-names'
import { createClient } from '@supabase/supabase-js'
import { getCookieValue } from '@/lib/client-config'
import { SolicitarModal } from '@/components/SolicitarModal'
import { getMissingDocs, REQUIRED_DOC_TYPES } from '@/lib/documents'
import { useToast } from '@/components/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { StickyActionBar } from '@/components/trafico/StickyActionBar'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

type Tab = 'resumen' | 'documentos' | 'entradas' | 'timeline'

interface Solicitud {
  id: string
  doc_types: string[]
  status: string
  solicitado_at: string
  deadline: string | null
  recipient_name: string | null
}

interface Completeness {
  trafico_id: string
  score: number | null
  blocking_count: number
  blocking_docs: string[] | null
  can_file: boolean | null
  can_cross: boolean | null
}

const fmtPedimento = (p: string | null) => {
  if (!p) return null
  const clean = p.replace(/\s/g, '')
  if (clean.length === 15) return `${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 8)} ${clean.slice(8)}`
  return p
}

function ProveedoresCard({ proveedores, pais }: { proveedores: string; pais: string }) {
  const list = proveedores.split(',').map(p => p.trim()).filter(Boolean)
  if (list.length === 0) return null
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--n-400)', marginBottom: 10 }}>
        Proveedores
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {list.map(prov => (
          <span key={prov} style={{
            fontSize: 13, fontWeight: 600, padding: '6px 14px',
            borderRadius: 8, background: 'var(--n-50, #F9F9F8)',
            color: 'var(--n-800)', border: '1px solid var(--n-150, #EDECE8)',
          }}>
            {prov}
            {pais ? <span style={{ marginLeft: 6, fontSize: 12 }}>{countryFlag(pais)}</span> : null}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   TIMELINE TAB — real-time event feed
   ═══════════════════════════════════════════════════════ */

interface TimelineEvent {
  id: string
  trafico_id: string
  event_type: string
  content_es: string | null
  source: string | null
  created_at: string
}

const EVENT_ICONS: Record<string, string> = {
  status_changed: '\uD83D\uDD04',
  doc_uploaded: '\uD83D\uDCCE',
  note: '\uD83D\uDCAC',
}

// fmtRelative removed — relative dates banned by spec. Use fmtDateTime instead.

function sourceBadge(source: string | null) {
  if (!source) return null
  const colors: Record<string, { bg: string; text: string }> = {
    system: { bg: 'rgba(156,152,144,0.15)', text: '#9C9890' },
    mobile: { bg: 'rgba(13,148,136,0.15)', text: '#0D9488' },
    portal: { bg: 'rgba(184,149,63,0.15)', text: '#B8953F' },
  }
  const c = colors[source] ?? colors.system
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
      background: c.bg, color: c.text, textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {source}
    </span>
  )
}

function TimelineTab({ traficoId }: { traficoId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('trafico_timeline')
      .select('id, trafico_id, event_type, content_es, source, created_at')
      .eq('trafico_id', traficoId)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setEvents((data ?? []) as TimelineEvent[])
        setLoading(false)
      })

    // Real-time subscription
    const channel = supabase
      .channel(`timeline-${traficoId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trafico_timeline',
          filter: `trafico_id=eq.${traficoId}`,
        },
        (payload) => {
          setEvents(prev => [payload.new as TimelineEvent, ...prev])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [traficoId])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`tl-skel-${i}`} style={{ height: 48, borderRadius: 8, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: '#252219', borderRadius: 12, padding: '48px 32px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 16 }}>{'\uD83D\uDCC5'}</div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#F5F0E8', margin: '0 0 8px' }}>
          Sin eventos registrados aún
        </h3>
        <p style={{ fontSize: 14, color: '#A09882', margin: 0, maxWidth: 320, lineHeight: 1.5 }}>
          Los eventos aparecerán aquí conforme el tráfico avanza
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {events.map((ev, i) => {
        const icon = EVENT_ICONS[ev.event_type] ?? '\u2022'
        const isLast = i === events.length - 1
        return (
          <div key={ev.id} style={{ display: 'flex', gap: 12, position: 'relative' }}>
            {/* Vertical line + icon */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: '#252219', border: '1px solid #3A3830',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, lineHeight: 1, flexShrink: 0,
              }}>
                {icon}
              </div>
              {!isLast && (
                <div style={{ width: 1, flex: 1, background: '#3A3830', minHeight: 16 }} />
              )}
            </div>
            {/* Content */}
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#F5F0E8', lineHeight: 1.5 }}>
                {ev.content_es || ev.event_type.replace(/_/g, ' ')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 11, color: '#7C7870', fontFamily: 'var(--font-jetbrains-mono)' }}>
                  {fmtDateTime(ev.created_at)}
                </span>
                {sourceBadge(ev.source)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   TRÁFICO HUB — 4-tab detail page
   ═══════════════════════════════════════════════════════ */
export default function TraficoDetailPage() {
  const companyId = getCookieValue('company_id') ?? ''
  const userRole = getCookieValue('user_role') ?? ''
  const isBroker = userRole === 'broker' || userRole === 'admin'
  const { id } = useParams()
  const router = useRouter()
  const isMobile = useIsMobile()
  const { toast } = useToast()

  // ── State ──
  const [trafico, setTrafico] = useState<Record<string, unknown> | null>(null)
  const [documentos, setDocumentos] = useState<Record<string, unknown>[]>([])
  const [entradas, setEntradas] = useState<Record<string, unknown>[]>([])
  const [completeness, setCompleteness] = useState<Completeness | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [activeTab, setActiveTab] = useState<Tab>('resumen')
  const [missingDocs, setMissingDocs] = useState<string[]>([])
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const [showSolicitarModal, setShowSolicitarModal] = useState(false)
  const [solicitadoOk, setSolicitadoOk] = useState(false)
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [rates, setRates] = useState<{ dta: number; iva: number; tc: number } | null>(null)
  const [notifying, setNotifying] = useState(false)

  // ── Upload handler (via /api/upload) ──
  const handleUpload = async (file: File | undefined, docType: string) => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { toast('Máximo 10MB', 'error'); return }
    if (!['application/pdf', 'image/jpeg', 'image/png', 'text/xml', 'application/xml'].includes(file.type)) {
      toast('Solo PDF, JPG, PNG, XML', 'error'); return
    }
    const tId = decodeURIComponent(String(id))
    setUploadingDoc(docType)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('trafico_id', tId)
      form.append('doc_type', docType)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const json = await res.json()
      if (json.error) {
        toast(json.error.message ?? 'Error al subir', 'error')
        return
      }
      // Remove doc from blocking list + missing list
      setCompleteness(prev => prev ? {
        ...prev,
        blocking_docs: (prev.blocking_docs ?? []).filter(d => d !== docType),
        blocking_count: Math.max(0, prev.blocking_count - 1),
      } : prev)
      setMissingDocs(prev => prev.filter(d => d !== docType))
      toast('Documento subido correctamente', 'success')
      // Refresh data
      setRetryKey(k => k + 1)
    } catch { toast('Error al subir. Intenta de nuevo.', 'error') }
    finally { setUploadingDoc(null) }
  }

  // ── Mark solicitud complete ──
  const markSolicitudCompleta = async (solicitudId: string) => {
    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('documento_solicitudes')
      .update({ status: 'completa', completed_at: now })
      .eq('id', solicitudId)
    if (updateError) { toast(`Error: ${updateError.message}`, 'error'); return }
    const tId = decodeURIComponent(String(id))
    await supabase.from('notifications').insert({
      type: 'solicitud_completada',
      title: `Solicitud completada para ${tId}`,
      body: 'Documentos recibidos y marcados como completos',
      company_id: companyId,
      metadata: { trafico_id: tId, solicitud_id: solicitudId },
    })
    if ('vibrate' in navigator) navigator.vibrate(50)
    toast('Solicitud marcada como completa', 'success')
    setSolicitudes(prev => prev.filter(s => s.id !== solicitudId))
    router.refresh()
  }

  // ── Notify client (broker only) ──
  const handleNotifyRojo = async () => {
    const tId = decodeURIComponent(String(id))
    setNotifying(true)
    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Tráfico ${tId} recibió semáforo rojo — revisión en aduana requerida.`,
          trafico_id: tId,
          type: 'semaforo_rojo',
        }),
      })
      const json = await res.json()
      if (json.error) { toast(json.error.message, 'error') }
      else { toast('Notificación enviada por Telegram', 'success') }
    } catch { toast('Error al enviar notificación', 'error') }
    finally { setNotifying(false) }
  }

  // ── Share deep link ──
  const handleShare = async () => {
    const tId = decodeURIComponent(String(id))
    const url = `https://evco-portal.vercel.app/share/${encodeURIComponent(tId)}`
    try {
      await navigator.clipboard.writeText(url)
      toast('Enlace copiado · Funciona aunque el destinatario no haya iniciado sesión', 'success')
    } catch {
      toast('No se pudo copiar el enlace', 'error')
    }
  }

  // ── Data fetch ──
  useEffect(() => {
    if (!id) return
    const tId = decodeURIComponent(String(id))

    Promise.all([
      fetch(`/api/trafico/${encodeURIComponent(tId)}`).then(r => r.json()).catch(() => ({})),
      fetch('/api/rates').then(r => r.json()).catch(() => ({})),
      fetch(`/api/data?table=trafico_completeness&limit=500`).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([tRes, ratesRes, compRes]) => {
      const t = tRes.trafico ?? tRes.data ?? null
      const docs = tRes.documents ?? []
      const ent = tRes.entradas ?? []
      setTrafico(t)
      setDocumentos(docs)
      setMissingDocs(getMissingDocs(docs))
      setEntradas(ent)
      if (!ratesRes.error && ratesRes.dta?.rate && ratesRes.iva?.rate && ratesRes.tc?.rate) {
        setRates({ dta: ratesRes.dta.rate, iva: ratesRes.iva.rate, tc: ratesRes.tc.rate })
      }

      // Match completeness row for this trafico
      const allComp = (compRes.data ?? []) as Completeness[]
      const match = allComp.find(c => c.trafico_id === tId) ?? null
      setCompleteness(match)

      setLoading(false)
    }).catch(() => { setFetchError('No se pudo cargar el tráfico.'); setLoading(false) })

    // Fetch solicitudes
    supabase
      .from('documento_solicitudes')
      .select('id, doc_types, status, solicitado_at, deadline, recipient_name')
      .eq('trafico_id', tId)
      .eq('company_id', companyId)
      .not('status', 'eq', 'completa')
      .order('solicitado_at', { ascending: false })
      .limit(20)
      .then(({ data: solData }) => {
        if (solData && solData.length > 0) setSolicitudes(solData as Solicitud[])
      })
  }, [id, companyId, retryKey])

  // ── Derived ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = trafico as Record<string, any> | null
  const isCruzado = t ? ((t.estatus as string) || '').toLowerCase().includes('cruz') : false
  const isPagado = t ? ((t.estatus as string) || '').toLowerCase().includes('pagado') : false
  const docCompleteness = Math.round((documentos.length / REQUIRED_DOC_TYPES.length) * 100)
  const regimen = t ? ((t.regimen as string) || '').toUpperCase() : ''
  const isTMEC = regimen === 'ITE' || regimen === 'ITR' || regimen === 'IMD'

  // ── Grouped docs ──
  const groupedDocs = useMemo(() => {
    const groups: Record<string, Record<string, unknown>[]> = {}
    for (const doc of documentos) {
      const docType = ((doc.document_type as string) || 'Otro').replace(/_/g, ' ')
      if (!groups[docType]) groups[docType] = []
      groups[docType].push(doc)
    }
    return groups
  }, [documentos])

  // ── Tab config ──
  const TABS: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'resumen', label: 'Resumen', icon: <BarChart3 size={14} /> },
    { key: 'documentos', label: 'Documentos', icon: <FileText size={14} />, badge: documentos.length },
    { key: 'entradas', label: 'Entradas', icon: <Truck size={14} />, badge: entradas.length },
    { key: 'timeline', label: 'Timeline', icon: <Clock size={14} /> },
  ]

  // ── 12-step timeline logic ──
  const getStepState = (stepNum: number): 'completed' | 'current' | 'pending' | 'blocked' => {
    if (!t) return 'pending'
    if (isCruzado) return stepNum <= 10 ? 'completed' : stepNum === 12 ? 'pending' : 'completed'
    if (isPagado) return stepNum <= 7 ? 'completed' : stepNum === 8 ? 'current' : 'pending'
    if (t.fecha_pago) return stepNum <= 7 ? 'completed' : stepNum === 8 ? 'current' : 'pending'
    if (t.pedimento) return stepNum <= 6 ? 'completed' : stepNum === 7 ? 'current' : 'pending'
    if (documentos.length > 0) return stepNum <= 1 ? 'completed' : stepNum === 2 ? 'current' : 'pending'
    return stepNum === 1 ? 'current' : 'pending'
  }

  const steps = t ? [
    { num: 1, label: 'Documentos recibidos', detail: documentos.length > 0 ? `${documentos.length} docs vinculados` : 'Pendiente', date: t.fecha_llegada as string | null },
    { num: 2, label: 'CRUZ procesó', detail: documentos.length > 0 ? `${documentos.length} docs · ${docCompleteness}%` : 'Pendiente', date: null },
    { num: 3, label: 'Revisado y autorizado', detail: t.pedimento ? 'Patente 3596' : 'Pendiente', date: null },
    { num: 4, label: 'COVE generado', detail: t.pedimento ? 'Generado' : 'Pendiente', date: null },
    { num: 5, label: 'Previo', detail: 'No requerido', date: null },
    { num: 6, label: 'Pedimento transmitido', detail: t.pedimento ? `${fmtPedimento(t.pedimento as string)}` : 'Pendiente', date: (t.fecha_transmision as string | null) || null },
    { num: 7, label: 'Pedimento pagado', detail: t.fecha_pago ? formatAbsoluteETA(t.fecha_pago as string) : 'Pendiente', date: (t.fecha_pago as string | null) || null },
    { num: 8, label: 'Semáforo asignado', detail: (t.semaforo as number) === 0 ? 'Verde' : (t.semaforo as number) === 1 ? 'Rojo' : 'Pendiente', date: (t.fecha_modulacion as string | null) || null },
    { num: 9, label: 'En cruce', detail: t.fecha_cruce ? formatAbsoluteETA(t.fecha_cruce as string) : 'Pendiente', date: (t.fecha_cruce as string | null) || null },
    { num: 10, label: 'Cruzado', detail: isCruzado && t.fecha_cruce ? formatAbsoluteETA(t.fecha_cruce as string) : 'Pendiente', date: isCruzado ? (t.fecha_cruce as string | null) : null },
    { num: 11, label: 'En ruta', detail: fmtCarrier(t.transportista_mexicano as string) || 'Por asignar', date: null },
    { num: 12, label: 'Entregado', detail: t.fecha_entrega ? formatAbsoluteETA(t.fecha_entrega as string) : 'Pendiente', date: (t.fecha_entrega as string | null) || null },
  ] : []

  // ── Error ──
  if (fetchError) return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <ErrorCard message={fetchError} onRetry={() => { setFetchError(null); setRetryKey(k => k + 1) }} />
    </div>
  )

  // ── Loading ──
  if (loading) return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div className="skeleton" style={{ height: 32, width: 200, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 120, borderRadius: 12, marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 300, borderRadius: 12 }} />
    </div>
  )

  // ── Not found ──
  if (!t) return (
    <div style={{ padding: 24 }}>
      <button onClick={() => router.push('/traficos')} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}>
        <ArrowLeft size={14} /> Volver a Tráficos
      </button>
      <EmptyState icon="🔍" title="Tráfico no encontrado" description="No se encontró un tráfico con este identificador" cta={{ label: 'Ver todos los tráficos', href: '/traficos' }} />
    </div>
  )

  // ── Semáforo color ──
  const semaforoColor = (t.semaforo as number) === 0 ? '#2D8540' : (t.semaforo as number) === 1 ? '#C23B22' : null

  // ── Completeness data ──
  const compScore = completeness?.score ?? docCompleteness
  const compBlocking = completeness?.blocking_docs ?? missingDocs
  const canFile = completeness?.can_file ?? false
  const canCross = completeness?.can_cross ?? false

  return (
    <div className="page-container" style={{ padding: isMobile ? 16 : 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* ═══ BREADCRUMB ═══ */}
      <button onClick={() => router.push('/traficos')} aria-label="Volver a Tráficos"
        style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--n-400)', fontSize: 12, minHeight: 60 }}>
        <ArrowLeft size={13} /> Tráficos
      </button>

      {/* ═══ STICKY ACTION BAR (v2) ═══ */}
      <StickyActionBar
        traficoNumber={fmtId(String(t.trafico ?? ''))}
        status={String(t.estatus ?? 'En Proceso')}
        valueUSD={t.importe_total ? fmtUSD(Number(t.importe_total)) + ' USD' : null}
        hasMissingDocs={missingDocs.length > 0}
        onSolicitar={missingDocs.length > 0 ? () => setShowSolicitarModal(true) : undefined}
      />

      {/* ═══ SEMÁFORO ROJO ALERT (v2) ═══ */}
      {(t.semaforo as number) === 1 && (
        <div style={{
          background: 'rgba(214, 69, 69, 0.1)',
          borderLeft: '4px solid var(--danger-500)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{ fontSize: 20 }}>🔴</span>
          <span style={{ flex: 1, fontSize: 'var(--text-body)', color: 'var(--danger-500)', fontWeight: 600 }}>
            Semáforo rojo asignado — revisión en aduana
          </span>
          {isBroker && (
            <button
              onClick={handleNotifyRojo}
              disabled={notifying}
              style={{
                padding: '10px 20px',
                minHeight: 60,
                borderRadius: 8,
                background: notifying ? 'var(--n-200)' : 'var(--danger-500, #DC2626)',
                color: '#FFFFFF',
                border: 'none',
                cursor: notifying ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                transition: 'background 150ms',
              }}
            >
              {notifying ? 'Enviando…' : 'Notificar a cliente'}
            </button>
          )}
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Tráfico number — large, gold, JetBrains Mono */}
          <h1 style={{
            fontFamily: 'var(--font-jetbrains-mono, var(--font-data))',
            fontSize: isMobile ? 24 : 32,
            fontWeight: 900,
            color: 'var(--gold-700, #8B6914)',
            letterSpacing: '-0.02em',
            margin: 0,
          }}>
            {fmtId(String(t.trafico ?? ''))}
          </h1>

          {/* Company badge */}
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '4px 10px',
            borderRadius: 9999,
            background: 'var(--gold-50, #FDFAEF)', color: 'var(--gold-700, #8B6914)',
            border: '1px solid rgba(184,149,63,0.2)',
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {String(t.company_id ?? companyId)}
          </span>

          {/* Pedimento badge */}
          {t.pedimento ? (
            <span style={{
              fontSize: 12, fontWeight: 600, padding: '4px 10px',
              borderRadius: 8, background: 'var(--slate-100)', color: 'var(--slate-600)',
              fontFamily: 'var(--font-jetbrains-mono, var(--font-data))',
            }}>
              Ped. {String(t.pedimento)}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--slate-400)', fontStyle: 'italic' }}>
              Pedimento en trámite
            </span>
          )}

          {/* T-MEC badge */}
          {isTMEC && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 12px', borderRadius: 9999,
              background: 'var(--green-50, #F0FDF4)',
              color: '#16A34A', fontSize: 12, fontWeight: 600,
              border: '1px solid var(--green-100, #DCFCE7)',
            }}>
              T-MEC
            </span>
          )}

          {/* Status badge */}
          <span className={`badge ${isCruzado ? 'badge-cruzado' : 'badge-proceso'}`}>
            <span className="badge-dot" />
            {String(t.estatus ?? 'En Proceso')}
          </span>

          {/* Semáforo indicator */}
          {semaforoColor && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 700, color: semaforoColor,
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: semaforoColor,
                boxShadow: `0 0 6px ${semaforoColor}40`,
              }} />
              {(t.semaforo as number) === 0 ? 'Verde' : 'Rojo'}
            </span>
          )}

          {/* Share deep link */}
          <button
            onClick={handleShare}
            aria-label="Compartir enlace al tráfico"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              gap: 6, padding: '8px 14px', minHeight: 60,
              borderRadius: 8, border: '1px solid var(--n-200, #E5E5E0)',
              background: 'transparent', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, color: 'var(--n-500)',
              transition: 'background 150ms',
              marginLeft: 'auto',
            }}
          >
            <Share2 size={14} />
            Compartir
          </button>
        </div>

        {/* Subtitle */}
        {t.descripcion_mercancia ? (
          <p style={{ fontSize: 13, color: 'var(--n-500)', marginTop: 6, margin: '6px 0 0' }}>
            {fmtDesc(String(t.descripcion_mercancia))}
          </p>
        ) : null}
      </div>

      {/* ═══ TABS ═══ */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 20,
        borderBottom: '2px solid var(--n-150, #EDECE8)',
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: isMobile ? '12px 14px' : '12px 20px',
            background: 'none', border: 'none',
            borderBottom: activeTab === tab.key ? `3px solid ${GOLD}` : '3px solid transparent',
            cursor: 'pointer', fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 500,
            color: activeTab === tab.key ? 'var(--n-900)' : 'var(--n-400)',
            whiteSpace: 'nowrap', marginBottom: -2,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            minHeight: 60, transition: 'color 150ms, border-color 150ms',
          }}>
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-jetbrains-mono, var(--font-data))',
                background: activeTab === tab.key ? GOLD : 'var(--n-200)',
                color: activeTab === tab.key ? '#FFFFFF' : 'var(--n-600)',
                borderRadius: 9999, padding: '1px 7px', lineHeight: '16px',
              }}>{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════
          TAB 1 — RESUMEN
         ═══════════════════════════════════════════ */}
      {activeTab === 'resumen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Key Stats Row ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
            gap: 12,
          }}>
            {([
              { label: 'Valor', value: t.importe_total ? fmtUSD(Number(t.importe_total)) + ' USD' : 'Pendiente', mono: true },
              { label: 'Peso Bruto', value: t.peso_bruto ? fmtKg(Number(t.peso_bruto)) + ' kg' : 'Pendiente', mono: true },
              { label: 'Bultos', value: String(t.bultos ?? t.cantidad_bultos ?? 'Pendiente'), mono: true },
              { label: 'Fecha Llegada', value: t.fecha_llegada ? fmtDate(String(t.fecha_llegada)) : 'Pendiente', mono: true },
              { label: 'Aduana', value: String(t.aduana ?? (t.oficina ? t.oficina : '240 · Nuevo Laredo')), mono: false },
              { label: 'Régimen', value: String(t.regimen ?? 'A1 · Definitivo'), mono: false },
            ] as { label: string; value: string; mono: boolean }[]).map(stat => (
              <div key={stat.label} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--n-400)', marginBottom: 4 }}>
                  {stat.label}
                </div>
                <div style={{
                  fontSize: stat.value === 'Pendiente' ? 13 : 15,
                  fontWeight: stat.value === 'Pendiente' ? 500 : 700,
                  color: stat.value === 'Pendiente' ? 'var(--slate-400)' : 'var(--n-900)',
                  fontStyle: stat.value === 'Pendiente' ? 'italic' : undefined,
                  fontFamily: stat.mono && stat.value !== 'Pendiente' ? 'var(--font-jetbrains-mono, var(--font-data))' : undefined,
                }}>
                  {String(stat.value)}
                </div>
              </div>
            ))}
          </div>

          {/* ── Completeness Ring ── */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              {/* Circular progress ring */}
              <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
                <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="32" cy="32" r="28" stroke="#E5E7EB" strokeWidth="4" fill="none" />
                  <circle cx="32" cy="32" r="28"
                    stroke={compScore === 100 ? '#16A34A' : compScore > 50 ? '#C4963C' : '#DC2626'}
                    strokeWidth="4" fill="none"
                    strokeDasharray={`${compScore * 1.759} 175.9`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray 0.6s ease' }}
                  />
                </svg>
                <span style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800, color: 'var(--text-primary, #111)',
                  fontFamily: 'var(--font-jetbrains-mono, var(--font-data))',
                }}>
                  {compScore}%
                </span>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--n-900)' }}>
                  Completitud Documental
                </div>
                <div style={{ fontSize: 12, color: 'var(--slate-500)', marginTop: 2 }}>
                  {documentos.length} de {REQUIRED_DOC_TYPES.length} documentos
                </div>
              </div>
            </div>

            {/* Can file / Can cross indicators */}
            <div style={{ display: 'flex', gap: 16, marginBottom: (compBlocking?.length ?? 0) > 0 ? 16 : 0, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: canFile ? '#ECFDF3' : '#FEF2F2',
                  color: canFile ? '#2D8540' : '#C23B22',
                  border: canFile ? '1px solid #BBF7D0' : '1px solid rgba(194,59,34,0.2)',
                }}>
                  {canFile ? '✓' : '✗'}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--n-700)' }}>
                  Listo para despachar
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: canCross ? '#ECFDF3' : '#FEF2F2',
                  color: canCross ? '#2D8540' : '#C23B22',
                  border: canCross ? '1px solid #BBF7D0' : '1px solid rgba(194,59,34,0.2)',
                }}>
                  {canCross ? '✓' : '✗'}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--n-700)' }}>
                  Listo para cruce
                </span>
              </div>
            </div>

            {/* Blocking docs — tap to upload */}
            {(compBlocking?.length ?? 0) > 0 && (
              <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid rgba(194,59,34,0.15)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  Documentos Bloqueantes ({compBlocking?.length ?? 0}) · Toca para subir
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(compBlocking ?? []).map(doc => (
                    <label key={doc} style={{
                      fontSize: 11, fontWeight: 600, padding: '6px 14px',
                      borderRadius: 9999, background: '#FFFFFF',
                      color: uploadingDoc === doc ? '#B8953F' : '#991B1B',
                      border: '1px solid rgba(194,59,34,0.2)',
                      cursor: uploadingDoc === doc ? 'wait' : 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      minHeight: 32, transition: 'background 150ms',
                    }}>
                      {uploadingDoc === doc ? (
                        'Subiendo…'
                      ) : (
                        <>
                          <Upload size={12} />
                          {doc}
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.xml"
                            style={{ display: 'none' }}
                            onChange={e => handleUpload(e.target.files?.[0], doc)}
                          />
                        </>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Proveedores ── */}
          <ProveedoresCard proveedores={String(t.proveedores ?? '')} pais={String(t.pais_procedencia ?? '')} />

          {/* ── 12-Step Timeline ── */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--n-400)', marginBottom: 16 }}>
              Estado del Tráfico
            </div>
            <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {steps.map((step, i) => {
                const state = getStepState(step.num)
                const isLast = i === steps.length - 1
                const dotColor = state === 'completed' ? 'var(--success-500)' : state === 'current' ? 'var(--sand-400, #C4A96A)' : state === 'blocked' ? 'var(--danger-500)' : 'var(--slate-200)'
                const textColor = state === 'completed' ? 'var(--slate-600)' : state === 'current' ? 'var(--navy-900)' : state === 'blocked' ? 'var(--danger-500)' : 'var(--slate-400)'
                const lineColor = state === 'completed' ? 'var(--success-500)' : 'var(--slate-200)'
                const detailColor = step.num === 8 && step.detail === 'Verde' ? '#2D8540'
                  : step.num === 8 && step.detail === 'Rojo' ? '#C23B22'
                  : step.num === 10 && state === 'completed' ? '#0D9488'
                  : 'var(--n-500)'

                return (
                  <li key={step.num} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: isLast ? 0 : 14, minHeight: 44 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                      <div style={{
                        width: state === 'current' ? 14 : 10, height: state === 'current' ? 14 : 10,
                        borderRadius: '50%', flexShrink: 0,
                        background: state === 'pending' ? 'transparent' : dotColor,
                        border: state === 'pending' ? '2px solid var(--n-200)' : 'none',
                        animation: state === 'current' ? 'cruzActivePulse 2s ease-in-out infinite' : undefined,
                      }} />
                      {!isLast && <div style={{ width: 2, flex: 1, background: lineColor, marginTop: 4 }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: textColor, lineHeight: 1.3 }}>
                        {step.num}. {step.label}
                        {step.num === 10 && state === 'completed' && ' ✅'}
                      </div>
                      <div style={{
                        fontSize: 11, color: detailColor, marginTop: 2,
                        fontFamily: step.num === 6 || step.num === 7 || step.num === 9 ? 'var(--font-jetbrains-mono, var(--font-data))' : undefined,
                      }}>
                        {step.detail}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>

          {/* ── Financiero summary ── */}
          {Number(t.importe_total) > 0 && (() => {
            const val = Number(t.importe_total) || 0
            const tc = Number(t.tipo_cambio) || 0
            const valMXN = val * tc
            const dta = rates ? Math.round(valMXN * rates.dta) : 0
            const igi = 0
            const ivaBase = valMXN + dta + igi
            const iva = rates ? Math.round(ivaBase * rates.iva) : 0
            const total = dta + igi + iva

            return (
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--n-400)', marginBottom: 12 }}>
                  Resumen Financiero
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                  {[
                    { label: 'Valor Factura', value: fmtUSD(val) + ' USD' },
                    { label: 'Tipo de Cambio', value: tc ? `$${tc.toFixed(4)} MXN/USD` : 'Pendiente' },
                    { label: 'DTA', value: val && tc ? fmtMXNInt(dta) + ' MXN' : 'Pendiente' },
                    { label: 'IGI', value: '$0 MXN', tmec: true },
                    { label: 'IVA (16%)', value: val && tc ? fmtMXNInt(iva) + ' MXN' : 'Pendiente' },
                    { label: 'Total Contribuciones', value: val && tc ? fmtMXNInt(total) + ' MXN' : 'Pendiente', highlight: true },
                  ].map(row => (
                    <div key={row.label} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', borderRadius: 6,
                      background: row.highlight ? 'var(--gold-50, #FDFAEF)' : 'var(--n-50, #F9F9F8)',
                    }}>
                      <span style={{ fontSize: 12, color: 'var(--n-600)' }}>{row.label}</span>
                      <span style={{
                        fontSize: 13, fontWeight: 700,
                        fontFamily: 'var(--font-jetbrains-mono, var(--font-data))',
                        color: row.highlight ? 'var(--gold-700, #8B6914)' : 'var(--n-900)',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        {row.value}
                        {'tmec' in row && (row as { tmec?: boolean }).tmec && (
                          <span title="Exento por T-MEC" style={{
                            fontSize: 10, fontWeight: 700, padding: '1px 6px',
                            background: 'var(--green-50, #F0FDF4)', color: 'var(--green-600, #16A34A)',
                            borderRadius: 4, fontFamily: 'var(--font-sans)',
                          }}>✓ T-MEC</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--n-400)' }}>
                  Estimado · Los montos oficiales se confirman tras la transmisión del pedimento
                </div>
              </div>
            )
          })()}

          {/* ── Transportista ── */}
          {(t.transportista_mexicano || t.transportista_extranjero) ? (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--n-400)', marginBottom: 12 }}>
                Transporte
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--n-400)', marginBottom: 2 }}>Transportista MX</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--n-900)' }}>{fmtCarrier(t.transportista_mexicano as string) || 'Por asignar'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--n-400)', marginBottom: 2 }}>Transportista EXT</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--n-900)' }}>{fmtCarrier(t.transportista_extranjero as string) || 'Por asignar'}</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          TAB 2 — DOCUMENTOS
         ═══════════════════════════════════════════ */}
      {activeTab === 'documentos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Solicitar button */}
          {missingDocs.length > 0 && !solicitadoOk && (
            <button
              onClick={() => setShowSolicitarModal(true)}
              style={{
                width: '100%', padding: '14px 16px',
                fontSize: 14, fontWeight: 700,
                border: 'none', borderRadius: 8,
                background: docCompleteness === 0 ? '#C23B22' : '#B8953F',
                color: '#FFFFFF', cursor: 'pointer', minHeight: 60,
              }}
            >
              Solicitar {missingDocs.length} documentos faltantes →
            </button>
          )}
          {solicitadoOk && (
            <div style={{
              width: '100%', padding: '14px 16px', textAlign: 'center',
              fontSize: 14, fontWeight: 700, borderRadius: 8,
              background: '#ECFDF3', color: '#2D8540', border: '1px solid #BBF7D0',
              minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              ✓ Documentos solicitados
            </div>
          )}

          {/* Missing docs upload zone */}
          {missingDocs.length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                Documentos Faltantes
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                {missingDocs.map(doc => (
                  <label key={doc} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 4, padding: '12px 14px', borderRadius: 8,
                    border: '2px dashed rgba(220,38,38,0.3)', borderLeft: '4px solid #C23B22',
                    background: '#FEF2F2', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    color: '#991B1B', minHeight: 60, width: '100%',
                  }}>
                    {uploadingDoc === doc ? <span style={{ color: GOLD }}>Subiendo...</span> : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Upload size={14} />
                          {doc}
                        </div>
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.xml" style={{ display: 'none' }} onChange={e => handleUpload(e.target.files?.[0], doc)} />
                      </>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Grouped existing docs */}
          {Object.keys(groupedDocs).length > 0 ? (
            Object.entries(groupedDocs).map(([docType, docs]) => (
              <div key={docType} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--n-900)' }}>{docType}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-jetbrains-mono, var(--font-data))',
                    background: '#ECFDF3', color: '#2D8540',
                    borderRadius: 9999, padding: '1px 7px',
                  }}>{docs.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {docs.map((doc, i) => {
                    const name = (doc.metadata as Record<string, unknown>)?.original_name as string || (doc.document_type as string) || 'Documento'
                    const uploadDate = doc.created_at ? fmtDate(doc.created_at as string) : null
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', background: 'var(--n-50, #F9F9F8)',
                        borderRadius: 8, border: '1px solid #BBF7D0',
                        minHeight: 48,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span style={{ color: '#2D8540', fontSize: 14, flexShrink: 0 }}>✅</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--n-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {name}
                            </div>
                            {uploadDate && (
                              <div style={{ fontSize: 11, color: 'var(--n-400)', fontFamily: 'var(--font-jetbrains-mono, var(--font-data))' }}>
                                {uploadDate}
                              </div>
                            )}
                          </div>
                        </div>
                        {doc.file_url ? (
                          <a href={String(doc.file_url)} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 11, color: GOLD, fontWeight: 700, textDecoration: 'none', flexShrink: 0, minHeight: 44, display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
                            Ver →
                          </a>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          ) : missingDocs.length === 0 ? (
            <EmptyState icon="📄" title="Sin documentos" description="Los documentos vinculados a este tráfico aparecerán aquí" />
          ) : null}

          {/* Active solicitudes */}
          {solicitudes.length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--n-900)', marginBottom: 12 }}>
                Solicitudes activas ({solicitudes.length})
              </div>
              <div style={{ border: '1px solid var(--n-150)', borderRadius: 8, overflow: 'hidden' }}>
                {solicitudes.map((sol, idx) => {
                  const isPastDeadline = sol.deadline ? new Date(sol.deadline) < new Date() : false
                  const docCount = Array.isArray(sol.doc_types) ? sol.doc_types.length : 0
                  return (
                    <div key={sol.id} style={{
                      padding: '10px 16px',
                      borderBottom: idx < solicitudes.length - 1 ? '1px solid var(--n-150)' : 'none',
                      borderLeft: isPastDeadline ? '3px solid #C23B22' : '3px solid #C47F17',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      minHeight: 60, gap: 12,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--n-900)' }}>
                          {docCount} documento{docCount !== 1 ? 's' : ''}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--n-500)', fontFamily: 'var(--font-jetbrains-mono, var(--font-data))', marginTop: 2 }}>
                          Solicitado {fmtDate(sol.solicitado_at)}
                          {sol.deadline && <> · Plazo: {fmtDate(sol.deadline)}</>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999,
                          background: isPastDeadline ? '#FEF2F2' : '#FFFBEB',
                          color: isPastDeadline ? '#991B1B' : '#92400E',
                          border: isPastDeadline ? '1px solid rgba(220,38,38,0.2)' : '1px solid rgba(196,127,23,0.2)',
                        }}>
                          {isPastDeadline ? 'Vencido' : sol.status === 'solicitado' ? 'Solicitado' : sol.status}
                        </span>
                        <button onClick={() => markSolicitudCompleta(sol.id)} style={{
                          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8,
                          background: '#ECFDF3', color: '#2D8540', border: '1px solid #BBF7D0',
                          cursor: 'pointer', minHeight: 60, whiteSpace: 'nowrap',
                        }}>
                          Marcar recibido ✓
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          TAB 3 — ENTRADAS
         ═══════════════════════════════════════════ */}
      {activeTab === 'entradas' && (
        <div>
          {entradas.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {entradas.map((e: Record<string, unknown>) => {
                const hasDamage = e.mercancia_danada === true
                const hasFaltantes = e.tiene_faltantes === true
                const hasIncidencia = hasDamage || hasFaltantes
                return (
                  <div key={e.cve_entrada as string} className="card" style={{
                    padding: '14px 16px',
                    borderLeft: hasIncidencia ? '4px solid #C23B22' : '4px solid #2D8540',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    minHeight: 60, gap: 12,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-jetbrains-mono, var(--font-data))', color: 'var(--n-900)' }}>
                          {e.cve_entrada as string}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--n-400)', fontFamily: 'var(--font-jetbrains-mono, var(--font-data))' }}>
                          {e.fecha_llegada_mercancia ? fmtDate(e.fecha_llegada_mercancia as string) : '—'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 12, color: 'var(--n-500)' }}>
                        {e.cantidad_bultos != null && (
                          <span><strong>{String(e.cantidad_bultos)}</strong> bultos</span>
                        )}
                        {e.peso_bruto != null && Number(e.peso_bruto) > 0 && (
                          <span style={{ fontFamily: 'var(--font-jetbrains-mono, var(--font-data))' }}>{fmtKg(Number(e.peso_bruto))} kg</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {hasDamage && (
                        <span className="badge badge-hold" style={{ fontSize: 11 }}>
                          <span className="badge-dot" />Dañada
                        </span>
                      )}
                      {hasFaltantes && (
                        <span className="badge badge-hold" style={{ fontSize: 11 }}>
                          <span className="badge-dot" />Faltantes
                        </span>
                      )}
                      {!hasIncidencia && (
                        <span className="badge badge-cruzado" style={{ fontSize: 11 }}>
                          <span className="badge-dot" />OK
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState icon="📦" title="No hay entradas registradas" description="Las entradas vinculadas a este tráfico aparecerán aquí" />
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          TAB 4 — TIMELINE (placeholder)
         ═══════════════════════════════════════════ */}
      {activeTab === 'timeline' && (
        <TimelineTab traficoId={decodeURIComponent(String(id))} />
      )}

      {/* ═══ SOLICITAR MODAL ═══ */}
      {showSolicitarModal && (
        <SolicitarModal
          traficoId={t.trafico as string}
          missingDocs={missingDocs}
          onClose={() => setShowSolicitarModal(false)}
          onSuccess={() => setSolicitadoOk(true)}
        />
      )}

      <style>{`@keyframes pulse-dot { 0%,100% { transform:scale(1); } 50% { transform:scale(1.15); } }`}</style>
    </div>
  )
}
