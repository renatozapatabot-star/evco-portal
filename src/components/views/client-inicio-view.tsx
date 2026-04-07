'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { getCompanyIdCookie, getClientNameCookie } from '@/lib/client-config'
import { useRealtimeTrafico } from '@/hooks/use-realtime-trafico'
import { fmtDate, fmtRelativeTime, fmtUSDCompact } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { calculateTmecSavings } from '@/lib/tmec-savings'
import { computeStreak } from '@/lib/achievements'
import { playSound } from '@/lib/sounds'
import { Celebrate } from '@/components/celebrate'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton'
import { useSessionCache } from '@/hooks/use-session-cache'
import { Truck, FolderOpen, DollarSign, ChevronRight } from 'lucide-react'

const sbClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

interface PulseItem {
  id: string
  text: string
  timestamp: string
  href: string
  color: string // dot color
}

function describeWorkflowEvent(workflow: string, eventType: string, payload: Record<string, unknown>): string {
  const docType = (payload?.docType as string) || ''
  const filename = (payload?.filename as string) || ''
  switch (`${workflow}.${eventType}`) {
    case 'intake.email_processed': return `RZ procesó email${filename ? `: ${filename}` : ''}`
    case 'classify.product_needs_classification': return 'Producto pendiente de clasificación'
    case 'docs.completeness_check': return `Revisión de documentos${docType ? `: ${docType.replace(/_/g, ' ')}` : ''}`
    case 'docs.document_received': return `Documento recibido${docType ? `: ${docType.replace(/_/g, ' ')}` : ''}`
    default: return `${workflow}: ${eventType.replace(/_/g, ' ')}`
  }
}

function describeAgentDecision(triggerType: string, decision: string, action: string): string {
  if (triggerType === 'solicitation_overdue' && decision === 'escalation_queued') {
    const match = action.match(/(\d+) docs/)
    return `RZ escaló ${match?.[1] || ''} documentos pendientes`
  }
  return `CRUZ: ${decision.replace(/_/g, ' ')}`
}

interface TraficoRow {
  trafico: string; estatus: string; fecha_llegada: string | null
  importe_total: number | null; pedimento: string | null
  descripcion_mercancia: string | null; fecha_cruce: string | null
  peso_bruto: number | null; company_id: string | null
  updated_at: string | null
  [k: string]: unknown
}

interface EntradaPending {
  id: number; cve_entrada: string; created_at?: string | null
  fecha_llegada_mercancia?: string | null
  descripcion_mercancia?: string | null
}

export default function ClientInicioView() {
  const isMobile = useIsMobile()
  const [traficos, setTraficos] = useState<TraficoRow[]>([])
  const [pendingEntradas, setPendingEntradas] = useState<EntradaPending[]>([])
  const [streakDays, setStreakDays] = useState(0)
  const [streakRecord, setStreakRecord] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const { lastUpdate } = useRealtimeTrafico()
  const [realtimeToast, setRealtimeToast] = useState<string | null>(null)
  const { getCached, setCache, endRefresh, startRefresh } = useSessionCache()
  const [pulse, setPulse] = useState<PulseItem[]>([])
  const [pulseLoading, setPulseLoading] = useState(true)
  const [awaySummary, setAwaySummary] = useState<{ total: number; solicitudes: number; docs: number; events: number } | null>(null)

  // Show toast on realtime status change
  useEffect(() => {
    if (lastUpdate) {
      const isCrossed = lastUpdate.estatus.toLowerCase().includes('cruz')
      setRealtimeToast(isCrossed
        ? `${lastUpdate.trafico} acaba de cruzar. Todo en orden.`
        : `${lastUpdate.trafico}: ${lastUpdate.estatus}`)
      if (isCrossed) playSound('success')
      const t = setTimeout(() => setRealtimeToast(null), 5000)
      return () => clearTimeout(t)
    }
  }, [lastUpdate])

  function loadData() {
    const companyId = getCompanyIdCookie()
    const name = getClientNameCookie()
    setCompanyName(name || '')

    // Streak fetch — try daily_performance first, fallback to entradas
    if (companyId) {
      const perfParams = new URLSearchParams({
        table: 'daily_performance', limit: '1', company_id: companyId,
        order_by: 'date', order_dir: 'desc',
      })
      fetch(`/api/data?${perfParams}`).then(r => r.json())
        .then(d => {
          const row = (d.data || [])[0]
          if (row && row.streak_days != null) {
            setStreakDays(row.streak_days)
            setStreakRecord(row.streak_record || 0)
          } else {
            // Fallback: compute from entradas
            const streakParams = new URLSearchParams({
              table: 'entradas', limit: '50', company_id: companyId,
              order_by: 'fecha_llegada_mercancia', order_dir: 'desc',
            })
            return fetch(`/api/data?${streakParams}`).then(r => r.json())
              .then(d2 => setStreakDays(computeStreak(d2.data || []).days))
          }
        })
        .catch(() => {})
    }

    // Try session cache first
    const cached = getCached<{ traficos: TraficoRow[]; entradas: EntradaPending[] }>('dashboard')
    if (cached) {
      setTraficos(cached.traficos)
      setPendingEntradas(cached.entradas)
      setLoading(false)
      startRefresh()
    } else {
      setLoading(true)
    }
    setError(null)

    const trafParams = new URLSearchParams({
      table: 'traficos', limit: '5000', company_id: companyId || '',
      gte_field: 'fecha_llegada', gte_value: '2024-01-01',
      order_by: 'fecha_llegada', order_dir: 'desc',
    })
    const entParams = new URLSearchParams({
      table: 'entradas', limit: '20', company_id: companyId || '',
      order_by: 'fecha_llegada_mercancia', order_dir: 'desc',
    })

    Promise.all([
      fetch(`/api/data?${trafParams}`).then(r => r.json()),
      fetch(`/api/data?${entParams}`).then(r => r.json()),
    ])
      .then(([trafData, entData]) => {
        const allT: TraficoRow[] = trafData.data ?? []
        const ents: EntradaPending[] = (entData.data ?? []).filter(
          (e: Record<string, unknown>) => !e.trafico
        ).slice(0, 20)

        setTraficos(allT)
        setPendingEntradas(ents)
        setCache('dashboard', { traficos: allT, entradas: ents })
      })
      .catch(() => setError('No se pudo cargar el dashboard. Reintentar.'))
      .finally(() => {
        setLoading(false); endRefresh()
        if (typeof window !== 'undefined') localStorage.setItem('cruz-last-visit', new Date().toISOString())
      })
  }

  useEffect(() => { loadData() }, [])

  // ── Activity Pulse — live workflow engine feed ──
  const loadPulse = useCallback(async () => {
    const companyId = getCompanyIdCookie()
    if (!companyId) return

    const [weRes, adRes, dsRes] = await Promise.all([
      sbClient.from('workflow_events')
        .select('id, workflow, event_type, payload, created_at, trigger_id')
        .eq('company_id', companyId).eq('status', 'completed')
        .order('created_at', { ascending: false }).limit(10),
      sbClient.from('agent_decisions')
        .select('id, trigger_type, decision, action_taken, confidence, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }).limit(5),
      sbClient.from('documento_solicitudes')
        .select('id, trafico_id, doc_type, status, solicitado_at, recibido_at')
        .eq('company_id', companyId)
        .order('solicitado_at', { ascending: false }).limit(5),
    ])

    const items: PulseItem[] = []

    for (const e of (weRes.data || [])) {
      items.push({
        id: `we-${e.id}`,
        text: describeWorkflowEvent(e.workflow, e.event_type, e.payload || {}),
        timestamp: e.created_at,
        href: e.trigger_id ? `/traficos/${encodeURIComponent(e.trigger_id)}` : '/traficos',
        color: 'var(--success)',
      })
    }

    for (const d of (adRes.data || [])) {
      items.push({
        id: `ad-${d.id}`,
        text: describeAgentDecision(d.trigger_type, d.decision, d.action_taken || ''),
        timestamp: d.created_at,
        href: '/traficos',
        color: '#0D9488', // teal — agent
      })
    }

    for (const s of (dsRes.data || [])) {
      const docName = (s.doc_type || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
      if (s.status === 'recibido' && s.recibido_at) {
        items.push({
          id: `ds-r-${s.id}`,
          text: `Recibido: ${docName} de ${s.trafico_id}`,
          timestamp: s.recibido_at,
          href: `/traficos/${encodeURIComponent(s.trafico_id)}`,
          color: 'var(--success)',
        })
      } else {
        items.push({
          id: `ds-${s.id}`,
          text: `RZ solicitó ${docName} para ${s.trafico_id}`,
          timestamp: s.solicitado_at,
          href: `/traficos/${encodeURIComponent(s.trafico_id)}`,
          color: 'var(--gold)',
        })
      }
    }

    // Deduplicate by id, sort by timestamp desc, take top 10
    const seen = new Set<string>()
    const unique = items.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true })
    unique.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    setPulse(unique.slice(0, 10))
    setPulseLoading(false)

    // "While you were away" — count events since last visit
    const lastVisit = localStorage.getItem('cruz-last-visit')
    if (lastVisit) {
      const sinceEvents = (weRes.data || []).filter(e => e.created_at > lastVisit).length
      const sinceDecisions = (adRes.data || []).filter(d => d.created_at > lastVisit).length
      const sinceSolicitudes = (dsRes.data || []).filter(s => s.solicitado_at > lastVisit).length
      const total = sinceEvents + sinceDecisions + sinceSolicitudes
      if (total > 0) {
        setAwaySummary({ total, events: sinceEvents, solicitudes: sinceSolicitudes, docs: sinceDecisions })
      }
    }
  }, [])

  useEffect(() => {
    loadPulse()
    const interval = setInterval(loadPulse, 30000) // Auto-refresh every 30s
    return () => clearInterval(interval)
  }, [loadPulse])

  // ── KPI calculations ──
  const enProceso = useMemo(() =>
    traficos.filter(t => (t.estatus || '').toLowerCase() === 'en proceso').length, [traficos])

  const cruzadoRecent = useMemo(() => {
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString()
    return traficos.filter(t =>
      (t.estatus || '').toLowerCase().includes('cruz') &&
      t.fecha_cruce && t.fecha_cruce >= cutoff
    ).length
  }, [traficos])

  const valorTotal = useMemo(() => {
    const yearStart = `${new Date().getFullYear()}-01-01`
    return traficos
      .filter(t => (t.fecha_llegada || '') >= yearStart)
      .reduce((s, t) => s + (Number(t.importe_total) || 0), 0)
  }, [traficos])

  const incidencias = useMemo(() => {
    return traficos.filter(t => {
      if (t.pedimento) return false
      const s = (t.estatus || '').toLowerCase()
      if (s.includes('cruz') || s.includes('complet')) return false
      if (!t.fecha_llegada) return false
      return (Date.now() - new Date(t.fecha_llegada).getTime()) > 7 * 86400000
    }).length
  }, [traficos])

  const sinIncidencia = useMemo(() => {
    if (traficos.length === 0) return 0
    const cruzados = traficos.filter(t => (t.estatus || '').toLowerCase().includes('cruz'))
    return cruzados.length > 0 ? Math.round((cruzados.length / traficos.length) * 100) : 0
  }, [traficos])

  const tmecSavings = useMemo(() => calculateTmecSavings(traficos), [traficos])

  // ── Pipeline stages (TMS view) ──
  const pipeline = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    const pagadoCount = traficos.filter(t => (t.estatus || '').toLowerCase().includes('pagado')).length
    const cruzadoWeek = traficos.filter(t =>
      (t.estatus || '').toLowerCase().includes('cruz') && t.fecha_cruce && t.fecha_cruce >= weekAgo
    ).length

    return [
      { key: 'proceso', label: 'En Proceso', count: enProceso, color: 'var(--warning-500, #D97706)', href: '/traficos?estatus=En+Proceso' },
      { key: 'pagado', label: 'Pagado', count: pagadoCount, color: 'var(--info, #2563EB)', href: '/traficos?estatus=Pagado' },
      { key: 'cruzado', label: 'Cruzado (7d)', count: cruzadoWeek, color: 'var(--success)', href: '/traficos?estatus=Cruzado' },
    ]
  }, [traficos, enProceso])

  // ── Attention items (only things that need action) ──
  const attentionItems = useMemo(() => {
    const items: { key: string; text: string; href: string; severity: 'red' | 'amber' }[] = []

    // Tráficos without pedimento > 7 days
    if (incidencias > 0) {
      items.push({ key: 'no-ped', text: `${incidencias} sin pedimento > 7 días`, href: '/traficos', severity: 'red' })
    }

    // Pending entradas
    if (pendingEntradas.length > 0) {
      items.push({ key: 'entradas', text: `${pendingEntradas.length} entrada${pendingEntradas.length !== 1 ? 's' : ''} sin tráfico`, href: '/entradas', severity: 'amber' })
    }

    return items.slice(0, 3)
  }, [incidencias, pendingEntradas])

  // ── Recent crossings ──
  const recentCrossings = useMemo(() => {
    return traficos
      .filter(t => (t.estatus || '').toLowerCase().includes('cruz') && t.fecha_cruce)
      .sort((a, b) => (b.fecha_cruce || '').localeCompare(a.fecha_cruce || ''))
      .slice(0, 5)
  }, [traficos])

  // ── Date string (hydration-safe) ──
  const [dateStr, setDateStr] = useState('')
  useEffect(() => {
    setDateStr(fmtDate(new Date()))
  }, [])

  // ── Results cards ──
  const results = useMemo(() => {
    const cards: { key: string; value: string; label: string; color: string; href: string }[] = [
      {
        key: 'cruzados',
        value: String(cruzadoRecent),
        label: 'cruzaron (7d)',
        color: 'var(--success)',
        href: '/traficos?estatus=Cruzado',
      },
      {
        key: 'importado',
        value: fmtUSDCompact(valorTotal),
        label: 'importado YTD',
        color: 'var(--gold-dark)',
        href: '/reportes',
      },
      {
        key: 'incidencias',
        value: String(incidencias),
        label: 'incidencias',
        color: incidencias === 0 ? 'var(--success)' : 'var(--danger-500)',
        href: '/traficos',
      },
    ]
    if (streakDays > 0) {
      cards.push({
        key: 'streak',
        value: `${streakDays}d`,
        label: streakRecord > streakDays ? `racha (récord: ${streakRecord}d)` : 'racha sin incidencia',
        color: 'var(--gold-dark)',
        href: '/logros',
      })
    }
    return cards
  }, [cruzadoRecent, valorTotal, incidencias, streakDays, streakRecord])

  // ── Error / Loading states ──
  if (error) {
    return (
      <div className="page-shell" style={{ maxWidth: 960 }}>
        <ErrorCard message={error} onRetry={loadData} />
      </div>
    )
  }

  if (loading) {
    return <DashboardSkeleton isMobile={isMobile} />
  }

  // Card subtitles — calm, one thing per section
  const opsSubtitle = enProceso === 0 ? 'Todo en orden' : `${enProceso} en proceso`
  const docsSubtitle = 'Todo al día'
  const contaSubtitle = '0 pendientes'

  const navCards = [
    { href: '/traficos', label: 'Tráficos', subtitle: opsSubtitle, Icon: Truck, color: enProceso > 0 ? 'var(--gold)' : 'var(--success)' },
    { href: '/entradas', label: 'Entradas', subtitle: `${pendingEntradas.length} sin asignar`, Icon: Truck, color: pendingEntradas.length > 0 ? 'var(--gold)' : 'var(--success)' },
    { href: '/expedientes', label: 'Expedientes', subtitle: docsSubtitle, Icon: FolderOpen, color: 'var(--success)' },
    { href: '/pedimentos', label: 'Pedimentos', subtitle: 'Declaraciones aduanales', Icon: FolderOpen, color: 'var(--success)' },
    { href: '/financiero', label: 'Contabilidad', subtitle: contaSubtitle, Icon: DollarSign, color: 'var(--success)' },
    { href: '/bodega', label: 'Inventario', subtitle: 'Mercancía en bodega', Icon: Truck, color: 'var(--success)' },
  ]

  return (
    <div className="page-shell" style={{ maxWidth: 700 }}>

      {/* Realtime toast */}
      {realtimeToast && (
        <div style={{
          padding: '10px 16px', borderRadius: 10,
          background: '#0D9488', color: '#FFFFFF', fontSize: 13, fontWeight: 600,
          marginBottom: 16, animation: 'fadeInUp 200ms ease',
        }}>
          {realtimeToast}
        </div>
      )}

      {/* ── DATE HEADER ── */}
      <div style={{ padding: isMobile ? '24px 20px 16px' : '32px 20px 20px' }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, fontFamily: 'var(--font-mono)' }}>
          {dateStr}
        </p>
      </div>

      {/* ── WHILE YOU WERE AWAY ── */}
      {awaySummary && awaySummary.total > 0 && (
        <div style={{
          margin: '0 20px 16px',
          padding: '16px 20px',
          borderRadius: 12,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: '3px solid #0D9488',
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0D9488', marginBottom: 8 }}>
            Mientras estuvo fuera
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>
            Renato Zapata procesó {awaySummary.total} accion{awaySummary.total !== 1 ? 'es' : ''}
            {awaySummary.events > 0 && ` · ${awaySummary.events} verificacion${awaySummary.events !== 1 ? 'es' : ''}`}
            {awaySummary.solicitudes > 0 && ` · ${awaySummary.solicitudes} solicitud${awaySummary.solicitudes !== 1 ? 'es' : ''}`}
            {awaySummary.docs > 0 && ` · ${awaySummary.docs} decision${awaySummary.docs !== 1 ? 'es' : ''} autónoma${awaySummary.docs !== 1 ? 's' : ''}`}
          </div>
          <button
            onClick={() => setAwaySummary(null)}
            style={{
              marginTop: 8, fontSize: 11, fontWeight: 600,
              color: 'var(--text-muted)', background: 'none',
              border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            Entendido
          </button>
        </div>
      )}

      {/* ── NAVIGATION CARDS ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
        gap: 12,
        padding: '0 20px',
      }}>
        {navCards.map(card => (
          <Link key={card.href} href={card.href} style={{ textDecoration: 'none' }}>
            <div style={{
              padding: isMobile ? '24px 28px' : '32px 28px',
              borderRadius: 16,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              transition: 'border-color 150ms, box-shadow 150ms',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: isMobile ? 'row' : 'column',
              alignItems: isMobile ? 'center' : 'flex-start',
              gap: isMobile ? 16 : 12,
              minHeight: isMobile ? 72 : 130,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(196,150,60,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <card.Icon size={32} strokeWidth={1.5} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {card.label}
                </div>
                <div style={{ fontSize: 14, color: card.color, fontWeight: 600, marginTop: 4 }}>
                  {card.subtitle}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── ACTIVITY PULSE — live workflow engine feed ── */}
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--success)',
            boxShadow: '0 0 6px rgba(22,163,74,0.4)',
            animation: 'cruzPulse 2s ease-in-out infinite',
          }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            RZ trabajando
          </div>
        </div>
        {pulseLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1, 2].map(i => (
              <div key={i} className="skel" style={{ height: 40, borderRadius: 8 }} />
            ))}
          </div>
        ) : pulse.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>
            Sistema operativo. Sin eventos recientes.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {pulse.map(item => (
              <Link
                key={item.id}
                href={item.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', borderRadius: 8, textDecoration: 'none',
                  transition: 'background 100ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F5F4F0' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: item.color,
                }} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.text}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                  {fmtRelativeTime(item.timestamp)}
                </span>
              </Link>
            ))}
            <Link
              href="/actividad"
              style={{ fontSize: 13, color: 'var(--gold-dark, #8B6914)', fontWeight: 600, padding: '8px 12px', textDecoration: 'none' }}
            >
              Ver toda la actividad &rarr;
            </Link>
          </div>
        )}
      </div>

      <style>{`
        @keyframes cruzPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* ── FOOTER ── */}
      <div style={{ textAlign: 'center', padding: '40px 20px 60px' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Renato Zapata & Company · Patente 3596
        </div>
      </div>

      <Celebrate trigger={!!lastUpdate && (lastUpdate.estatus || '').toLowerCase().includes('cruz')} />
    </div>
  )
}
