'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Upload, FileText, Share2 } from 'lucide-react'
import { fmtId, fmtDate, fmtDateTime, fmtUSD, fmtKg, fmtDesc, fmtMXNInt, fmtPedimentoShort, formatAbsoluteETA } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { GOLD } from '@/lib/design-system'
import { fmtCarrier, countryFlag } from '@/lib/carrier-names'
import { createClient } from '@supabase/supabase-js'
import { getCookieValue } from '@/lib/client-config'
import { SolicitarModal } from '@/components/SolicitarModal'
import { getMissingDocs, REQUIRED_DOC_TYPES } from '@/lib/documents'
import { useToast } from '@/components/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { DocumentViewer } from '@/components/ui/DocumentViewer'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { StickyActionBar } from '@/components/trafico/StickyActionBar'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

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

function ProveedoresCard({ proveedores, pais, supplierLookup }: { proveedores: string; pais: string; supplierLookup: Map<string, string> }) {
  const list = proveedores.split(',').map(p => p.trim()).filter(Boolean)
  if (list.length === 0) return null
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--slate-400)', marginBottom: 10 }}>
        Proveedores
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {list.map(prov => {
          const name = supplierLookup.get(prov) || prov
          return (
            <Link key={prov} href={`/proveedores?search=${encodeURIComponent(name)}`} style={{
              fontSize: 13, fontWeight: 600, padding: '6px 14px',
              borderRadius: 8, background: 'var(--slate-50)',
              color: 'var(--navy-800)', border: '1px solid var(--border-card)',
              textDecoration: 'none', transition: 'background 150ms',
            }}>
              {name}
              {pais ? <span style={{ marginLeft: 6, fontSize: 12 }}>{countryFlag(pais)}</span> : null}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   TIMELINE — real-time event feed
   ═══════════════════════════════════════════════════════ */

interface TimelineEvent {
  id: string
  trafico_id: string
  event_type: string
  content_es: string | null
  source: string | null
  created_at: string
}

// Event type → color mapping (design system emotional colors)
const EVENT_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  status_changed: { icon: '🔄', color: '#C4963C', bg: 'rgba(196,150,60,0.12)' },
  doc_uploaded:   { icon: '📎', color: '#0D9488', bg: 'rgba(13,148,136,0.12)' },
  doc_received:   { icon: '📥', color: '#0D9488', bg: 'rgba(13,148,136,0.12)' },
  crossed:        { icon: '🟢', color: '#16A34A', bg: 'rgba(22,163,74,0.12)' },
  semaforo:       { icon: '🚦', color: '#7E22CE', bg: 'rgba(126,34,206,0.12)' },
  mve_filed:      { icon: '📋', color: '#7E22CE', bg: 'rgba(126,34,206,0.12)' },
  pedimento:      { icon: '📄', color: '#7E22CE', bg: 'rgba(126,34,206,0.12)' },
  cruz_ai:        { icon: '🦀', color: '#C4963C', bg: 'rgba(196,150,60,0.12)' },
  note:           { icon: '💬', color: '#475569', bg: 'rgba(71,85,105,0.12)' },
  created:        { icon: '📦', color: '#C4963C', bg: 'rgba(196,150,60,0.12)' },
}

function getEventStyle(eventType: string) {
  return EVENT_CONFIG[eventType] ?? { icon: '•', color: '#475569', bg: 'rgba(71,85,105,0.08)' }
}

function sourceBadge(source: string | null) {
  if (!source) return null
  const colors: Record<string, { bg: string; text: string }> = {
    system: { bg: 'rgba(156,152,144,0.15)', text: 'var(--text-muted)' },
    mobile: { bg: 'rgba(13,148,136,0.15)', text: '#0D9488' },
    portal: { bg: 'rgba(184,149,63,0.15)', text: '#C4963C' },
    cruz_ai: { bg: 'rgba(196,150,60,0.15)', text: '#C4963C' },
    telegram: { bg: 'rgba(37,99,235,0.15)', text: '#2563EB' },
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
        background: 'var(--bg-card)', border: '1px solid #E8E5E0', borderRadius: 12, padding: '48px 32px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 16 }}>{'\uD83D\uDCC5'}</div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          Sin eventos registrados aun
        </h3>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, maxWidth: 320, lineHeight: 1.5 }}>
          Los eventos apareceran aqui conforme el trafico avanza
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {events.map((ev, i) => {
        const style = getEventStyle(ev.event_type)
        const isLast = i === events.length - 1
        return (
          <div key={ev.id} style={{ display: 'flex', gap: 12, position: 'relative' }}>
            {/* Vertical line + color-coded dot */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: style.bg, border: `2px solid ${style.color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, lineHeight: 1, flexShrink: 0,
              }}>
                {style.icon}
              </div>
              {!isLast && (
                <div style={{ width: 2, flex: 1, background: '#E8E5E0', minHeight: 16 }} />
              )}
            </div>
            {/* Content */}
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {ev.content_es || ev.event_type.replace(/_/g, ' ')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
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
   TRAFICO HUB — single-page detail view
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
  const [missingDocs, setMissingDocs] = useState<string[]>([])
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const [showSolicitarModal, setShowSolicitarModal] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(-1)
  const [solicitadoOk, setSolicitadoOk] = useState(false)
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [rates, setRates] = useState<{ dta: number; iva: number; tc: number } | null>(null)
  const [notifying, setNotifying] = useState(false)
  const [supplierLookup, setSupplierLookup] = useState<Map<string, string>>(new Map())

  // ── Upload handler (via /api/upload) ──
  const handleUpload = async (file: File | undefined, docType: string) => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { toast('Maximo 10MB', 'error'); return }
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
          message: `Trafico ${tId} recibio semaforo rojo -- revision en aduana requerida.`,
          trafico_id: tId,
          type: 'semaforo_rojo',
        }),
      })
      const json = await res.json()
      if (json.error) { toast(json.error.message, 'error') }
      else { toast('Notificacion enviada por Telegram', 'success') }
    } catch { toast('Error al enviar notificacion', 'error') }
    finally { setNotifying(false) }
  }

  // ── Share deep link ──
  const handleShare = async () => {
    const tId = decodeURIComponent(String(id))
    const url = `${window.location.origin}/share/${encodeURIComponent(tId)}`
    try {
      await navigator.clipboard.writeText(url)
      toast('Enlace copiado - Funciona aunque el destinatario no haya iniciado sesion', 'success')
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
    }).catch(() => { setFetchError('No se pudo cargar el trafico.'); setLoading(false) })

    // Fetch supplier name lookup for PRV_ code resolution
    fetch('/api/data?table=globalpc_proveedores&limit=5000')
      .then(r => r.json())
      .then(d => {
        const provs = (d.data ?? []) as { cve_proveedor?: string; nombre?: string }[]
        const lookup = new Map<string, string>()
        provs.forEach(p => { if (p.cve_proveedor && p.nombre) lookup.set(p.cve_proveedor, p.nombre) })
        setSupplierLookup(lookup)
      })
      .catch(() => { /* best-effort */ })

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
  const regimen = t ? ((t.regimen as string) || '').toUpperCase() : ''
  const isTMEC = regimen === 'ITE' || regimen === 'ITR' || regimen === 'IMD'
  // Compliance score: only count truly required docs, not receipts or artifacts
  const docCompleteness = useMemo(() => {
    const docs = documentos.map(d => ({ doc_type: String(d.document_type || d.doc_type || '') }))
    const { calculateDocCompliance } = require('@/lib/documents')
    const result = calculateDocCompliance(docs, { tmec: isTMEC })
    return result.score
  }, [documentos, isTMEC])

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
    { num: 2, label: 'CRUZ proceso', detail: documentos.length > 0 ? `${documentos.length} docs - ${docCompleteness}%` : 'Pendiente', date: null },
    { num: 3, label: 'Revisado y autorizado', detail: t.pedimento ? 'Patente 3596' : 'Pendiente', date: null },
    { num: 4, label: 'COVE generado', detail: t.pedimento ? 'Generado' : 'Pendiente', date: null },
    { num: 5, label: 'Previo', detail: 'No requerido', date: null },
    { num: 6, label: 'Pedimento transmitido', detail: t.pedimento ? fmtPedimentoShort(t.pedimento as string) : 'Pendiente', date: (t.fecha_transmision as string | null) || null },
    { num: 7, label: 'Pedimento pagado', detail: t.fecha_pago ? formatAbsoluteETA(t.fecha_pago as string) : 'Pendiente', date: (t.fecha_pago as string | null) || null },
    { num: 8, label: 'Semaforo asignado', detail: (t.semaforo as number) === 0 ? 'Verde' : (t.semaforo as number) === 1 ? 'Rojo' : 'Pendiente', date: (t.fecha_modulacion as string | null) || null },
    { num: 9, label: 'En cruce', detail: t.fecha_cruce ? formatAbsoluteETA(t.fecha_cruce as string) : 'Pendiente', date: (t.fecha_cruce as string | null) || null },
    { num: 10, label: 'Cruzado', detail: isCruzado && t.fecha_cruce ? formatAbsoluteETA(t.fecha_cruce as string) : 'Pendiente', date: isCruzado ? (t.fecha_cruce as string | null) : null },
    { num: 11, label: 'En ruta', detail: fmtCarrier(t.transportista_mexicano as string) || 'Por asignar', date: null },
    { num: 12, label: 'Entregado', detail: t.fecha_entrega ? formatAbsoluteETA(t.fecha_entrega as string) : 'Pendiente', date: (t.fecha_entrega as string | null) || null },
  ] : []

  // ── Error ──
  if (fetchError) return (
    <div className="page-shell" style={{ maxWidth: 1200 }}>
      <ErrorCard message={fetchError} onRetry={() => { setFetchError(null); setRetryKey(k => k + 1) }} />
    </div>
  )

  // ── Loading ──
  if (loading) return (
    <div className="page-shell" style={{ maxWidth: 1200 }}>
      <div className="skeleton-shimmer" style={{ height: 32, width: 200, marginBottom: 24 }} />
      <div className="skeleton-shimmer" style={{ height: 120, marginBottom: 16 }} />
      <div className="skeleton-shimmer" style={{ height: 300 }} />
    </div>
  )

  // ── Not found ──
  if (!t) return (
    <div style={{ padding: 24 }}>
      <button onClick={() => router.push('/traficos')} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}>
        <ArrowLeft size={14} /> Volver a Traficos
      </button>
      <EmptyState icon="🔍" title="Trafico no encontrado" description="No se encontro un trafico con este identificador" cta={{ label: 'Ver todos los traficos', href: '/traficos' }} />
    </div>
  )

  // ── Semaforo color ──
  const semaforoColor = (t.semaforo as number) === 0 ? 'var(--success)' : (t.semaforo as number) === 1 ? 'var(--danger)' : null

  // ── Completeness data ──
  const canCross = completeness?.can_cross ?? false

  return (
    <div className="page-shell" style={{ maxWidth: 1200 }}>
      {/* ═══ BREADCRUMB ═══ */}
      <nav aria-label="Navegacion" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 12 }}>
        <Link href="/" style={{ color: 'var(--slate-400)', textDecoration: 'none', padding: '8px 4px' }}>Inicio</Link>
        <span style={{ color: 'var(--slate-300)' }}>&#x203A;</span>
        <Link href="/traficos" style={{ color: 'var(--slate-400)', textDecoration: 'none', padding: '8px 4px' }}>Traficos</Link>
        <span style={{ color: 'var(--slate-300)' }}>&#x203A;</span>
        <span className="font-mono" style={{ color: 'var(--navy-900)', fontWeight: 600 }}>{fmtId(String(t?.trafico ?? decodeURIComponent(String(id))))}</span>
      </nav>

      {/* ═══ STICKY ACTION BAR (v2) ═══ */}
      <StickyActionBar
        traficoNumber={fmtId(String(t.trafico ?? ''))}
        status={String(t.estatus ?? 'En Proceso')}
        valueUSD={t.importe_total ? fmtUSD(Number(t.importe_total)) + ' USD' : null}
        hasMissingDocs={missingDocs.length > 0}
        onSolicitar={missingDocs.length > 0 ? () => setShowSolicitarModal(true) : undefined}
      />

      {/* ═══ CROSSING ESTIMATE ═══ */}
      {t && ((t.estatus as string) || '').toLowerCase().includes('cruc') && !((t.estatus as string) || '').toLowerCase().includes('cruzado') && (
        <div style={{
          background: 'var(--blue-50, #EFF6FF)', borderLeft: '4px solid var(--info-500)',
          borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
        }}>
          <span style={{ fontSize: 18 }}>🌉</span>
          <div>
            <span style={{ fontWeight: 700, color: 'var(--navy-900)' }}>En proceso de cruce</span>
            <span style={{ color: 'var(--slate-500)', marginLeft: 8 }}>Tiempo estimado: consultar tiempos de puente en Inicio</span>
          </div>
        </div>
      )}

      {/* ═══ SEMAFORO ROJO ALERT (v2) ═══ */}
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
            Semaforo rojo asignado -- revision en aduana
          </span>
          {isBroker && (
            <button
              onClick={handleNotifyRojo}
              disabled={notifying}
              style={{
                padding: '10px 20px',
                minHeight: 60,
                borderRadius: 8,
                background: notifying ? 'var(--slate-200)' : 'var(--danger-500, #DC2626)',
                color: 'var(--bg-card)',
                border: 'none',
                cursor: notifying ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                transition: 'background 150ms',
              }}
            >
              {notifying ? 'Enviando...' : 'Notificar a cliente'}
            </button>
          )}
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Trafico number -- large, gold, JetBrains Mono */}
          <h1 style={{
            fontFamily: 'var(--font-mono)',
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
              fontFamily: 'var(--font-mono)',
            }}>
              Ped. {fmtPedimentoShort(t.pedimento as string)}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--slate-400)', fontStyle: 'italic' }}>
              Pedimento en tramite
            </span>
          )}

          {/* T-MEC badge */}
          {isTMEC && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 12px', borderRadius: 9999,
              background: 'var(--green-50, #F0FDF4)',
              color: 'var(--success)', fontSize: 12, fontWeight: 600,
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

          {/* Semaforo indicator */}
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
            title="Copiar enlace para compartir"
            aria-label="Compartir enlace al trafico"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              gap: 6, padding: '8px 14px', minHeight: 60,
              borderRadius: 8, border: '1px solid var(--border-card)',
              background: 'transparent', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, color: 'var(--slate-500)',
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
          <p style={{ fontSize: 13, color: 'var(--slate-500)', marginTop: 6, margin: '6px 0 0' }}>
            {fmtDesc(String(t.descripcion_mercancia))}
          </p>
        ) : null}
      </div>

      {/* ═══ RESUMEN ═══ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Key Stats Row ── */}
        {(() => {
          const valorUSD = Number(t.importe_total) || 0
          const tcVal = Number(t.tipo_cambio) || 0
          const valorMXNStr = valorUSD > 0 && tcVal > 0 ? `(~${fmtMXNInt(Math.round(valorUSD * tcVal))} MXN)` : ''
          return (
        <div className="kpi-grid" style={{ gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 12 }}>
          {((): { label: string; value: string; mono: boolean }[] => {
            // Fall back to linked entradas for bultos/peso if trafico fields are empty
            const entradaBultos = entradas.reduce((sum, e) => sum + (Number((e as Record<string, unknown>).cantidad_bultos) || 0), 0)
            const entradaPeso = entradas.reduce((sum, e) => sum + (Number((e as Record<string, unknown>).peso_bruto) || 0), 0)
            const valor = valorUSD > 0 ? fmtUSD(valorUSD) + ' USD' : 'Pendiente'
            const peso = t.peso_bruto ? fmtKg(Number(t.peso_bruto)) + ' kg' : entradaPeso > 0 ? fmtKg(entradaPeso) + ' kg' : 'Pendiente'
            const bultos = t.bultos ?? t.cantidad_bultos ?? (entradaBultos > 0 ? entradaBultos : null)
            return [
              { label: 'Valor', value: valor, mono: true },
              { label: 'Peso Bruto', value: peso, mono: true },
              { label: 'Bultos', value: String(bultos ?? 'Pendiente'), mono: true },
              { label: 'Fecha Llegada', value: t.fecha_llegada ? fmtDate(String(t.fecha_llegada)) : 'Pendiente', mono: true },
              { label: 'Aduana', value: String(t.aduana ?? (t.oficina ? t.oficina : '240 - Nuevo Laredo')), mono: false },
              { label: 'Regimen', value: String(t.regimen ?? 'A1 - Definitivo'), mono: false },
              ...(t.fraccion_arancelaria ? [{ label: 'Fraccion', value: String(t.fraccion_arancelaria), mono: true }] : []),
            ]
          })().map(stat => (
            <div key={stat.label} className="kpi-card" style={{ padding: '14px 16px' }}>
              <div className="kpi-card-label">{stat.label}</div>
              <div style={{
                fontSize: stat.value === 'Pendiente' ? 13 : 15,
                fontWeight: stat.value === 'Pendiente' ? 500 : 700,
                color: stat.value === 'Pendiente' ? 'var(--slate-400)' : 'var(--navy-900)',
                fontStyle: stat.value === 'Pendiente' ? 'italic' : undefined,
                fontFamily: stat.mono && stat.value !== 'Pendiente' ? 'var(--font-mono)' : undefined,
                marginTop: 4,
              }}>
                {String(stat.value)}
              </div>
              {stat.label === 'Valor' && valorMXNStr && (
                <div style={{ fontSize: 11, color: 'var(--slate-400)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{valorMXNStr}</div>
              )}
              {stat.label === 'Fraccion' && stat.value !== 'Pendiente' && (
                <Link href={`/catalogo?search=${encodeURIComponent(stat.value)}`} style={{ fontSize: 10, color: 'var(--info, #2563EB)', textDecoration: 'none', marginTop: 2, display: 'block' }}>Ver en catalogo &#x2192;</Link>
              )}
            </div>
          ))}
        </div>
          )
        })()}

        {/* ── Ready to Cross Action ── */}
        <div className="card" style={{ padding: 20, textAlign: 'center' }}>
          {isCruzado ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--success)', fontSize: 16, fontWeight: 700 }}>
              <span style={{ fontSize: 20 }}>&#x2713;</span> Cruzado
            </div>
          ) : canCross ? (
            <button style={{
              width: '100%', padding: '16px 24px', minHeight: 60,
              background: 'var(--success)', color: 'white',
              border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700,
              cursor: 'pointer', transition: 'background 150ms',
            }}>
              Listo para Cruzar
            </button>
          ) : (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                {missingDocs.length > 0 ? `${missingDocs.length} documento${missingDocs.length !== 1 ? 's' : ''} pendiente${missingDocs.length !== 1 ? 's' : ''}` : 'En proceso'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {t.pedimento ? 'Pedimento transmitido' : 'Pedimento en tramite'}
              </div>
            </div>
          )}
        </div>

        {/* ── Proveedores ── */}
        <ProveedoresCard proveedores={String(t.proveedores ?? '')} pais={String(t.pais_procedencia ?? '')} supplierLookup={supplierLookup} />

        {/* ── 12-Step Timeline ── */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--slate-400)', marginBottom: 16 }}>
            Estado del Trafico
          </div>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {steps.map((step, i) => {
              const state = getStepState(step.num)
              const isLast = i === steps.length - 1
              const dotColor = state === 'completed' ? 'var(--success-500)' : state === 'current' ? 'var(--sand-400, #C4A96A)' : state === 'blocked' ? 'var(--danger-500)' : 'var(--slate-200)'
              const textColor = state === 'completed' ? 'var(--slate-600)' : state === 'current' ? 'var(--navy-900)' : state === 'blocked' ? 'var(--danger-500)' : 'var(--slate-400)'
              const lineColor = state === 'completed' ? 'var(--success-500)' : 'var(--slate-200)'
              const detailColor = step.num === 8 && step.detail === 'Verde' ? 'var(--success)'
                : step.num === 8 && step.detail === 'Rojo' ? 'var(--danger)'
                : step.num === 10 && state === 'completed' ? 'var(--teal)'
                : 'var(--slate-500)'

              return (
                <li key={step.num} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: isLast ? 0 : 14, minHeight: 60 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                    <div style={{
                      width: state === 'current' ? 14 : 10, height: state === 'current' ? 14 : 10,
                      borderRadius: '50%', flexShrink: 0,
                      background: state === 'pending' ? 'transparent' : dotColor,
                      border: state === 'pending' ? '2px solid var(--slate-200)' : 'none',
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
                      fontFamily: step.num === 6 || step.num === 7 || step.num === 9 ? 'var(--font-mono)' : undefined,
                    }}>
                      {step.detail}
                    </div>
                    {step.date && state === 'completed' && (
                      <div style={{ fontSize: 10, color: 'var(--slate-400)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                        {fmtDateTime(step.date)}
                      </div>
                    )}
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
              <div className="detail-label">
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
                    background: row.highlight ? 'var(--gold-50, #FDFAEF)' : 'var(--slate-50)',
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--slate-600)' }}>{row.label}</span>
                    <span style={{
                      fontSize: 13, fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color: row.highlight ? 'var(--gold-700, #8B6914)' : 'var(--navy-900)',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      {row.value}
                      {'tmec' in row && (row as { tmec?: boolean }).tmec && (
                        <span title="Exento por T-MEC" style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 6px',
                          background: 'var(--green-50, #F0FDF4)', color: 'var(--green-600, #16A34A)',
                          borderRadius: 4, fontFamily: 'var(--font-sans)',
                        }}>&#x2713; T-MEC</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--slate-400)' }}>
                Estimado - Los montos oficiales se confirman tras la transmision del pedimento
              </div>
              {t.pedimento && documentos.some(d => (d.document_type as string)?.includes('pedimento')) && (
                <button onClick={() => {
                  const pedDoc = documentos.find(d => (d.document_type as string)?.includes('pedimento') && d.file_url)
                  if (pedDoc?.file_url) window.open(pedDoc.file_url as string, '_blank')
                  else toast('Pedimento PDF no disponible aun', 'error')
                }}
                  style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--gold-dark, #8B6914)', background: 'rgba(196,150,60,0.08)', border: '1px solid rgba(196,150,60,0.2)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', minHeight: 60 }}>
                  <FileText size={14} /> Descargar Pedimento
                </button>
              )}
            </div>
          )
        })()}

        {/* ── Transporte ── */}
        {entradas.length > 0 && (
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>Transporte</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {fmtCarrier((entradas[0] as Record<string, unknown>).transportista_mexicano as string) || fmtCarrier((entradas[0] as Record<string, unknown>).transportista_americano as string) || 'No registrado'}
            </div>
          </div>
        )}
      </div>

      {/* ═══ DOCUMENTOS ═══ */}
      <div style={{ marginTop: 32 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy-900)', marginBottom: 16 }}>Documentos</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Solicitar button */}
          {missingDocs.length > 0 && !solicitadoOk && (
            <button
              onClick={() => setShowSolicitarModal(true)}
              style={{
                width: '100%', padding: '14px 16px',
                fontSize: 14, fontWeight: 700,
                border: 'none', borderRadius: 8,
                background: docCompleteness === 0 ? 'var(--danger)' : 'var(--gold)',
                color: 'var(--bg-card)', cursor: 'pointer', minHeight: 60,
              }}
            >
              Solicitar {missingDocs.length} documentos faltantes &#x2192;
            </button>
          )}
          {solicitadoOk && (
            <div style={{
              width: '100%', padding: '14px 16px', textAlign: 'center',
              fontSize: 14, fontWeight: 700, borderRadius: 8,
              background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid #BBF7D0',
              minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              &#x2713; Documentos solicitados
            </div>
          )}

          {/* Missing docs upload zone */}
          {missingDocs.length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--danger-text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                Documentos Faltantes
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                {missingDocs.map(doc => (
                  <label key={doc} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 4, padding: '12px 14px', borderRadius: 8,
                    border: '2px dashed rgba(220,38,38,0.3)', borderLeft: '4px solid #C23B22',
                    background: 'var(--danger-bg)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    color: 'var(--danger-text)', minHeight: 60, width: '100%',
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
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{docType}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
                    background: 'var(--success-bg)', color: 'var(--success)',
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
                        padding: '10px 14px', background: 'var(--slate-50)',
                        borderRadius: 8, border: '1px solid #BBF7D0',
                        minHeight: 60,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span style={{ color: 'var(--success)', fontSize: 14, flexShrink: 0 }}>✅</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {name}
                            </div>
                            {uploadDate && (
                              <div style={{ fontSize: 11, color: 'var(--slate-400)', fontFamily: 'var(--font-mono)' }}>
                                {uploadDate}
                              </div>
                            )}
                          </div>
                        </div>
                        {doc.file_url ? (
                          <button
                            onClick={() => {
                              const allDocs = Object.values(groupedDocs).flat()
                              const idx = allDocs.indexOf(doc)
                              setViewerIndex(idx >= 0 ? idx : 0)
                            }}
                            style={{ fontSize: 11, color: GOLD, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, minHeight: 60, display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
                            Ver &#x2192;
                          </button>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          ) : missingDocs.length === 0 ? (
            <EmptyState icon="📄" title="Sin documentos" description="Los documentos vinculados a este trafico apareceran aqui" />
          ) : null}

          {/* Document Viewer Modal */}
          {viewerIndex >= 0 && (() => {
            const allDocs = Object.values(groupedDocs).flat().map(d => ({
              doc_type: String(d.document_type || d.doc_type || ''),
              file_url: d.file_url ? String(d.file_url) : null,
              nombre: (d.metadata as Record<string, unknown>)?.original_name as string || null,
              source: d.source ? String(d.source) : null,
            }))
            return allDocs.length > 0 ? (
              <DocumentViewer
                documents={allDocs}
                initialIndex={viewerIndex}
                onClose={() => setViewerIndex(-1)}
                traficoId={t.trafico}
              />
            ) : null
          })()}

          {/* Active solicitudes */}
          {solicitudes.length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy-900)', marginBottom: 12 }}>
                Solicitudes activas ({solicitudes.length})
              </div>
              <div style={{ border: '1px solid var(--border-card)', borderRadius: 8, overflow: 'hidden' }}>
                {solicitudes.map((sol, idx) => {
                  const isPastDeadline = sol.deadline ? new Date(sol.deadline) < new Date() : false
                  const docCount = Array.isArray(sol.doc_types) ? sol.doc_types.length : 0
                  return (
                    <div key={sol.id} style={{
                      padding: '10px 16px',
                      borderBottom: idx < solicitudes.length - 1 ? '1px solid var(--border-card)' : 'none',
                      borderLeft: isPastDeadline ? '3px solid #C23B22' : '3px solid #C47F17',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      minHeight: 60, gap: 12,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy-900)' }}>
                          {docCount} documento{docCount !== 1 ? 's' : ''}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--slate-500)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                          Solicitado {fmtDate(sol.solicitado_at)}
                          {sol.deadline && <> - Plazo: {fmtDate(sol.deadline)}</>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999,
                          background: isPastDeadline ? 'var(--danger-bg)' : 'var(--warning-bg)',
                          color: isPastDeadline ? 'var(--danger-text)' : 'var(--warning-text)',
                          border: isPastDeadline ? '1px solid rgba(220,38,38,0.2)' : '1px solid rgba(196,127,23,0.2)',
                        }}>
                          {isPastDeadline ? 'Vencido' : sol.status === 'solicitado' ? 'Solicitado' : sol.status}
                        </span>
                        <button onClick={() => markSolicitudCompleta(sol.id)} style={{
                          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8,
                          background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid #BBF7D0',
                          cursor: 'pointer', minHeight: 60, whiteSpace: 'nowrap',
                        }}>
                          Marcar recibido &#x2713;
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ ENTRADAS ═══ */}
      <div style={{ marginTop: 32 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy-900)', marginBottom: 16 }}>Entradas</div>
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
                        <span style={{ fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--navy-900)' }}>
                          {e.cve_entrada as string}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--slate-400)', fontFamily: 'var(--font-mono)' }}>
                          {e.fecha_llegada_mercancia ? fmtDate(e.fecha_llegada_mercancia as string) : '--'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 12, color: 'var(--slate-500)' }}>
                        {e.cantidad_bultos != null && (
                          <span><strong>{String(e.cantidad_bultos)}</strong> bultos</span>
                        )}
                        {e.peso_bruto != null && Number(e.peso_bruto) > 0 && (
                          <span style={{ fontFamily: 'var(--font-mono)' }}>{fmtKg(Number(e.peso_bruto))} kg</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {hasDamage && (
                        <span className="badge badge-hold" style={{ fontSize: 11 }}>
                          <span className="badge-dot" />Danada
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
            <EmptyState icon="📦" title="No hay entradas registradas" description="Las entradas vinculadas a este trafico apareceran aqui" />
          )}
        </div>
      </div>

      {/* ═══ HISTORIAL ═══ */}
      <div style={{ marginTop: 32 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy-900)', marginBottom: 16 }}>Historial</div>
        <TimelineTab traficoId={decodeURIComponent(String(id))} />
      </div>

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
