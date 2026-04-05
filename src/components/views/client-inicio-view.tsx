'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { getCompanyIdCookie, getClientNameCookie } from '@/lib/client-config'
import { useRealtimeTrafico } from '@/hooks/use-realtime-trafico'
import { fmtDate, fmtDateShort, fmtUSD, fmtUSDCompact, fmtKg, fmtDesc } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { calculateTmecSavings } from '@/lib/tmec-savings'
import { getSmartGreeting } from '@/lib/greeting'
import { computeStreak } from '@/lib/achievements'
import { anticipate, isDismissed, dismissSuggestion, type Suggestion } from '@/lib/anticipate'
import CountingNumber from '@/components/ui/CountingNumber'
import { Sparkline } from '@/components/sparkline'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorCard } from '@/components/ui/ErrorCard'
import SkeletonBase, { SkeletonKPI } from '@/components/ui/Skeleton'
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton'
import { MorningSummary } from '@/components/morning-summary'
import { SmartAlerts } from '@/components/smart-alerts'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { useSessionCache } from '@/hooks/use-session-cache'
import { StatusStrip } from '@/components/StatusStrip'
import { BridgeTimes } from '@/components/BridgeTimes'
import { averageConfidence } from '@/lib/confidence'

interface TraficoRow {
  trafico: string; estatus: string; fecha_llegada: string | null
  importe_total: number | null; pedimento: string | null
  descripcion_mercancia: string | null; fecha_cruce: string | null
  peso_bruto: number | null; company_id: string | null
  [k: string]: unknown
}

interface EntradaPending {
  id: number; cve_entrada: string; created_at?: string | null
  fecha_llegada_mercancia?: string | null
  descripcion_mercancia?: string | null
}

export default function ClientInicioView() {
  const isMobile = useIsMobile()
  const router = useRouter()
  const [traficos, setTraficos] = useState<TraficoRow[]>([])
  const [pendingEntradas, setPendingEntradas] = useState<EntradaPending[]>([])
  const [sparkData, setSparkData] = useState<number[]>([])
  const [streakDays, setStreakDays] = useState(0)
  const [lastVisit, setLastVisit] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(0) // counter to force re-render on dismiss
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const { lastUpdate, updatedAt: realtimeAt } = useRealtimeTrafico()
  const [realtimeToast, setRealtimeToast] = useState<string | null>(null)

  // Show toast on realtime status change
  useEffect(() => {
    if (lastUpdate) {
      const isCrossed = lastUpdate.estatus.toLowerCase().includes('cruz')
      setRealtimeToast(isCrossed
        ? `${lastUpdate.trafico} acaba de cruzar. Todo en orden. 🦀`
        : `${lastUpdate.trafico}: ${lastUpdate.estatus}`)
      const t = setTimeout(() => setRealtimeToast(null), 5000)
      return () => clearTimeout(t)
    }
  }, [lastUpdate])
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null)
  const { getCached, setCache, refreshing, startRefresh, endRefresh } = useSessionCache()
  const [dataFade, setDataFade] = useState(1)
  const [detailOpen, setDetailOpen] = useState(false)

  function loadData() {
    const companyId = getCompanyIdCookie()
    const name = getClientNameCookie()
    setCompanyName(name || '')

    // Track visit for anticipatory suggestions
    const prevVisit = typeof window !== 'undefined' ? localStorage.getItem('cruz-last-visit') : null
    setLastVisit(prevVisit)

    // Streak fetch (fire-and-forget, lightweight)
    if (companyId) {
      const streakParams = new URLSearchParams({
        table: 'entradas', limit: '50', company_id: companyId,
        order_by: 'fecha_llegada_mercancia', order_dir: 'desc',
      })
      fetch(`/api/data?${streakParams}`).then(r => r.json())
        .then(d => setStreakDays(computeStreak(d.data || []).days))
        .catch(() => {})
    }

    // Try session cache first — show instantly, then refresh in background
    const cached = getCached<{ traficos: TraficoRow[]; entradas: EntradaPending[] }>('dashboard')
    const hasCached = !!cached
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

        // Check if data changed from cache
        const dataChanged = hasCached && (
          allT.length !== traficos.length || ents.length !== pendingEntradas.length
        )

        if (dataChanged) {
          // Fade transition: dim → update → brighten
          setDataFade(0.6)
          setTimeout(() => {
            setTraficos(allT)
            setPendingEntradas(ents)
            setDataFade(1)
          }, 80)
        } else {
          setTraficos(allT)
          setPendingEntradas(ents)
        }

        // Cache for offline / fast reload
        setCache('dashboard', { traficos: allT, entradas: ents })

        // Build 30-day sparkline from tráficos en proceso
        const now = new Date()
        const days: number[] = []
        for (let i = 29; i >= 0; i--) {
          const d = new Date(now)
          d.setDate(d.getDate() - i)
          const dateStr = d.toISOString().split('T')[0]
          const count = allT.filter(t => {
            const s = (t.estatus || '').toLowerCase()
            return !s.includes('cruz') && !s.includes('entreg') &&
              t.fecha_llegada && t.fecha_llegada.split('T')[0] <= dateStr
          }).length
          days.push(count)
        }
        setSparkData(days)
      })
      .catch(() => setError('No se pudo cargar el dashboard. Reintentar →'))
      .finally(() => {
        setLoading(false); endRefresh(); setFetchedAt(new Date())
        if (typeof window !== 'undefined') localStorage.setItem('cruz-last-visit', new Date().toISOString())
      })
  }

  useEffect(() => { loadData() }, [])

  // KPI calculations
  const enProceso = useMemo(() =>
    traficos.filter(t => {
      const s = (t.estatus || '').toLowerCase()
      return !s.includes('cruz') && !s.includes('entreg') && !s.includes('complet')
    }).length, [traficos])

  const cruzado = useMemo(() =>
    traficos.filter(t => (t.estatus || '').toLowerCase().includes('cruz')).length, [traficos])

  const pedimentoPagado = useMemo(() =>
    traficos.filter(t => (t.estatus || '').toLowerCase().includes('pagado')).length, [traficos])

  const entradasHoy = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return pendingEntradas.filter(e =>
      e.fecha_llegada_mercancia?.startsWith(today)
    ).length
  }, [pendingEntradas])

  // Determine which KPI has highest urgency for pulse
  const kpiChanges = [enProceso, cruzado, pedimentoPagado, entradasHoy]
  const maxIdx = kpiChanges.indexOf(Math.max(...kpiChanges))

  // ── Impressive KPIs (5C) ──
  const valorYTD = useMemo(() => {
    const yearStart = `${new Date().getFullYear()}-01-01`
    return traficos
      .filter(t => (t.fecha_llegada || '') >= yearStart)
      .reduce((s, t) => s + (Number(t.importe_total) || 0), 0)
  }, [traficos])

  const sinIncidencia = useMemo(() => {
    if (traficos.length === 0) return 0
    const cruzados = traficos.filter(t => (t.estatus || '').toLowerCase().includes('cruz'))
    return cruzados.length > 0 ? Math.round((cruzados.length / traficos.length) * 100) : 0
  }, [traficos])

  const tiempoDespacho = useMemo(() => {
    const withBoth = traficos.filter(t => t.fecha_llegada && t.fecha_cruce)
    if (withBoth.length === 0) return 0
    const totalDays = withBoth.reduce((s, t) => {
      const d = (new Date(t.fecha_cruce as string).getTime() - new Date(t.fecha_llegada as string).getTime()) / 86400000
      return s + Math.max(0, d)
    }, 0)
    return Math.round((totalDays / withBoth.length) * 10) / 10
  }, [traficos])

  const tmecOps = useMemo(() => {
    return traficos.filter(t => {
      const r = ((t as Record<string, unknown>).regimen as string || '').toUpperCase()
      return r === 'ITE' || r === 'ITR' || r === 'IMD'
    }).length
  }, [traficos])

  const provActivos = useMemo(() => {
    const yearStart = `${new Date().getFullYear()}-01-01`
    const set = new Set<string>()
    traficos.filter(t => (t.fecha_llegada || '') >= yearStart).forEach(t => {
      const p = (t as Record<string, unknown>).proveedores as string
      if (p) p.split(',').map(s => s.trim()).filter(Boolean).forEach(v => set.add(v))
    })
    return set.size
  }, [traficos])

  // Greeting + date — hydration-safe (empty on SSR, populated on client)
  const [greeting, setGreeting] = useState('')
  const [dateStr, setDateStr] = useState('')
  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches')
    const d = new Date()
    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    setDateStr(`${days[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]}, ${d.getFullYear()}`)
  }, [])

  // ── Últimas 24 horas ──
  const last24h = useMemo(() => {
    const cutoff = new Date(Date.now() - 86400000).toISOString()
    const newTraficos = traficos.filter(t => t.fecha_llegada && t.fecha_llegada >= cutoff).length
    const crossed = traficos.filter(t => t.fecha_cruce && t.fecha_cruce >= cutoff).length
    const noPedGt7 = traficos.filter(t => {
      if (t.pedimento) return false
      const s = (t.estatus || '').toLowerCase()
      if (s.includes('cruz') || s.includes('complet')) return false
      if (!t.fecha_llegada) return false
      return (Date.now() - new Date(t.fecha_llegada).getTime()) > 7 * 86400000
    }).length
    return { newTraficos, crossed, noPedGt7 }
  }, [traficos])

  // ── Recent events for feed ──
  const cutoff24h = new Date(Date.now() - 86400000).toISOString()
  const recentCrossed = useMemo(() =>
    traficos.filter(t => t.fecha_cruce && t.fecha_cruce >= cutoff24h)
      .sort((a, b) => (b.fecha_cruce || '').localeCompare(a.fecha_cruce || ''))
  , [traficos, cutoff24h])

  const recentNew = useMemo(() =>
    traficos.filter(t => t.fecha_llegada && t.fecha_llegada >= cutoff24h && !(t.estatus || '').toLowerCase().includes('cruz'))
      .sort((a, b) => (b.fecha_llegada || '').localeCompare(a.fecha_llegada || ''))
  , [traficos, cutoff24h])

  // ── Contextual greeting subtitle ──
  // Average confidence across active traficos
  // T-MEC savings — the retention number
  const tmecSavings = useMemo(() => calculateTmecSavings(traficos), [traficos])

  const avgConf = useMemo(() => {
    const active = traficos.filter(t => !(t.estatus || '').toLowerCase().includes('cruz'))
    return active.length > 0 ? averageConfidence(active) : 0
  }, [traficos])

  const greetingSub = useMemo(() => {
    return getSmartGreeting(companyName || undefined, {
      urgentCount: last24h.noPedGt7,
      enProcesoCount: enProceso,
      crossed24h: last24h.crossed,
      newTraficos24h: last24h.newTraficos,
      noPedGt7: last24h.noPedGt7,
      pendingEntradas: pendingEntradas.length,
      tmecSavings: tmecSavings.totalSavings,
      avgConfidence: avgConf,
      streakDays,
    }).subtitle
  }, [companyName, last24h, enProceso, pendingEntradas, tmecSavings, avgConf, streakDays])

  // Anticipatory suggestion
  const suggestion = useMemo(() => {
    if (loading) return null
    const now = new Date()
    return anticipate({
      traficos,
      tmecSavings: tmecSavings.totalSavings,
      dayOfWeek: now.getDay(),
      hour: now.getHours(),
      lastVisit,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traficos, tmecSavings, lastVisit, loading, dismissed])

  function handleDismiss(id: string) {
    dismissSuggestion(id)
    setDismissed(d => d + 1)
  }

  // Oldest pending entrada age (capped at 2 years to exclude legacy)
  const oldestDays = useMemo(() => {
    if (pendingEntradas.length === 0) return 0
    const twoYearsAgo = Date.now() - (730 * 86400000)
    const recent = pendingEntradas.filter(e => {
      const d = e.fecha_llegada_mercancia || e.created_at
      return d && new Date(d).getTime() >= twoYearsAgo
    })
    if (recent.length === 0) return 0
    const oldest = recent[recent.length - 1]
    const date = oldest.fecha_llegada_mercancia || oldest.created_at
    if (!date) return 0
    return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  }, [pendingEntradas])

  // StatusStrip override — match severity to dashboard data
  const statusOverride = useMemo(() => {
    if (oldestDays > 90) return {
      level: 'danger' as const,
      text: `${pendingEntradas.length} entradas pendientes · La más antigua: ${oldestDays} días — Requiere atención`
    }
    if (oldestDays > 30) return {
      level: 'warning' as const,
      text: `${pendingEntradas.length} entradas sin tráfico asignado · La más antigua: ${oldestDays} días`
    }
    if (pendingEntradas.length > 5) return {
      level: 'warning' as const,
      text: `${pendingEntradas.length} entradas sin tráfico asignado`
    }
    return null // let API status-sentence handle it
  }, [pendingEntradas, oldestDays])

  // Sparkline delta (current vs 30 days ago)
  const sparkDelta = useMemo(() => {
    if (sparkData.length < 2) return null
    const current = sparkData[sparkData.length - 1]
    const past = sparkData[0]
    if (past === 0) return null
    const pct = Math.round(((current - past) / past) * 100)
    return { current, past, pct }
  }, [sparkData])

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

  // Zen mode: "Todo en orden" when nothing needs attention
  const needsAttention = last24h.noPedGt7 > 0 || pendingEntradas.length > 5 || oldestDays > 30
  const zenMode = !needsAttention && !detailOpen

  return (
    <div className="page-shell" style={{ maxWidth: 960 }}>
      {/* Zen state: "Todo en orden" — the 11 PM Executive standard */}
      {zenMode && (
        <div style={{ textAlign: 'center', padding: isMobile ? '60px 20px' : '100px 20px' }}>
          <div style={{ fontSize: isMobile ? 28 : 36, fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.02em' }}>
            Todo en orden.
          </div>
          <p style={{ fontSize: 13, color: '#9B9B9B', margin: '12px 0 0', fontFamily: 'var(--font-mono)' }}>
            {enProceso} en proceso · {cruzado} cruzados{avgConf > 0 ? ` · ${avgConf}% certeza` : ''}
            {tmecSavings.totalSavings >= 100000
              ? ` · Ahorro T-MEC: $${Math.round(tmecSavings.totalSavings / 1000)}K 🦀`
              : tmecSavings.totalSavings >= 10000
                ? ` · Ahorro T-MEC: $${Math.round(tmecSavings.totalSavings / 1000)}K`
                : ''}
          </p>
          {fetchedAt && (
            <p style={{ fontSize: 11, color: '#D4D4D4', margin: '8px 0 0' }}>
              Actualizado: {fetchedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago' })}
            </p>
          )}
          <button onClick={() => setDetailOpen(true)} style={{
            marginTop: 32, background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, color: '#C4963C', fontWeight: 600,
          }}>
            Ver detalle →
          </button>
        </div>
      )}

      {/* Full dashboard — shown when attention needed OR detail expanded */}
      {(!zenMode || detailOpen) && <>

      {/* Status Strip — first thing Ursula sees */}
      <div style={{ marginBottom: 16 }}>
        <StatusStrip override={statusOverride} />
        {/* Realtime toast */}
        {realtimeToast && (
          <div style={{
            marginTop: 8, padding: '8px 16px', borderRadius: 8,
            background: '#0D9488', color: '#FFFFFF', fontSize: 13, fontWeight: 600,
            animation: 'fadeInUp 200ms ease',
          }}>
            {realtimeToast}
          </div>
        )}
        {fetchedAt && (() => {
          const isLive = Date.now() - fetchedAt.getTime() < 5 * 60 * 1000
          return (
            <p style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: isLive ? 'var(--success)' : 'var(--text-muted)',
              }} className={isLive ? 'dot-live' : ''} />
              Actualizado: {fetchedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago' })}
            </p>
          )
        })()}
      </div>

      {/* Greeting — contextual with 24h summary */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="text-display" style={{ color: 'var(--navy-900)', margin: 0, wordBreak: 'break-word' }}>
          {greeting}, {companyName || 'cliente'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          {greetingSub}
        </p>
        <p className="text-caption" style={{ color: 'var(--slate-400)', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="font-mono">{dateStr}</span>
          {refreshing && (
            <span className="badge badge-pendiente" style={{ fontSize: 11, animation: 'cruzPulse 1.5s infinite' }}>
              Actualizando...
            </span>
          )}
        </p>
      </div>

      {/* Anticipatory suggestion bar */}
      {suggestion && !isDismissed(suggestion.id) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 16px', borderRadius: 10,
          background: 'rgba(196,150,60,0.04)',
          border: '1px solid rgba(196,150,60,0.15)',
          marginBottom: 16, animation: 'fadeInUp 200ms ease',
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>{suggestion.icon}</span>
          <span style={{ flex: 1, fontSize: 13, color: '#1A1A1A' }}>{suggestion.text}</span>
          {suggestion.action && (
            <Link href={suggestion.action.href} style={{
              fontSize: 12, fontWeight: 600, color: '#C4963C',
              textDecoration: 'none', whiteSpace: 'nowrap',
            }}>
              {suggestion.action.label}
            </Link>
          )}
          <button onClick={() => handleDismiss(suggestion.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#9B9B9B', fontSize: 16, padding: 4, lineHeight: 1,
          }} aria-label="Cerrar sugerencia">×</button>
        </div>
      )}

      {/* Detalle operativo — collapsed by default */}
      <button
        onClick={() => setDetailOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', marginBottom: detailOpen ? 12 : 0,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--slate-400)' }}>
          Detalle operativo
        </span>
        <ChevronRight size={14} style={{ color: 'var(--slate-400)', transform: detailOpen ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }} />
      </button>

      {detailOpen && (
      <>
      {/* KPI Grid */}
      <div className="kpi-grid" style={{ opacity: dataFade, transition: 'opacity 200ms ease' }}>
        {[
          { label: 'En Proceso', value: enProceso, color: 'var(--info-500)', href: '/traficos?estatus=En Proceso', key: 'en-proceso', stagger: 1 },
          { label: 'Cruzado', value: cruzado, color: 'var(--success-500)', href: '/traficos?estatus=Cruzado', key: 'cruzado', stagger: 2 },
          { label: 'Pedimento Pagado', value: pedimentoPagado, color: 'var(--purple-500)', href: '/traficos?estatus=Pedimento Pagado', key: 'pagado', stagger: 3 },
          { label: 'Entradas hoy', value: entradasHoy, color: 'var(--sand-400)', href: '/entradas', key: 'entradas', stagger: 4 },
        ].map((kpi) => {
          const isZero = kpi.value === 0
          return (
            <Link key={kpi.key} href={kpi.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div
                className={`kpi-card stagger-${kpi.stagger}`}
                role="status"
                aria-live="polite"
                style={{
                  borderTop: `4px solid ${isZero ? 'var(--slate-200)' : kpi.color}`,
                  borderTopStyle: isZero ? 'dashed' : undefined,
                  opacity: isZero ? 0.6 : 1,
                  minHeight: 148,
                  animation: 'fadeInUp 200ms var(--ease-enter) backwards',
                }}
              >
                <div className="kpi-card-label">{kpi.label}</div>
                {isZero && kpi.key === 'entradas' ? (
                  <div className="kpi-card-value" style={{ color: 'var(--slate-300)', fontSize: 13, fontStyle: 'italic' }}>
                    Ninguna hoy
                  </div>
                ) : (
                  <div className="kpi-card-value" style={{ color: isZero ? 'var(--slate-300)' : undefined }}>
                    <CountingNumber value={kpi.value} sessionKey={`dash-${kpi.key}`} />
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {/* Divider between KPI rows */}
      {traficos.length > 0 && (
        <div style={{ borderBottom: '1px solid var(--border-card, #E5E7EB)', marginBottom: 16 }} />
      )}

      {/* ── Impressive KPI Strip (5C) ── */}
      {traficos.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
          gap: 12, marginBottom: 24, opacity: dataFade, transition: 'opacity 200ms ease',
        }}>
          <div className="kpi-card stagger-1" style={{ padding: '14px 16px', borderTop: '4px solid var(--gold)', animation: 'fadeInUp 200ms var(--ease-enter) backwards' }}>
            <div className="kpi-card-label">Valor Importado YTD</div>
            <div className="font-mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy-900)', marginTop: 4 }}>
              {fmtUSDCompact(valorYTD)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--slate-400)', marginTop: 2 }}>{new Date().getFullYear()} — acumulado</div>
          </div>
          <div className="kpi-card stagger-2" style={{ padding: '14px 16px', borderTop: '4px solid var(--success-500)', animation: 'fadeInUp 200ms var(--ease-enter) backwards' }}>
            <div className="kpi-card-label">Operaciones Exitosas</div>
            <div className="font-mono" style={{ fontSize: 22, fontWeight: 800, color: sinIncidencia >= 90 ? 'var(--success)' : 'var(--navy-900)', marginTop: 4, fontFamily: 'var(--font-jetbrains-mono)' }}>
              {sinIncidencia}%
            </div>
            <div style={{ fontSize: 10, color: 'var(--slate-400)', marginTop: 2 }}>Cruzados del total</div>
          </div>
          <div className="kpi-card stagger-3" style={{ padding: '14px 16px', borderTop: '4px solid var(--info-500)', animation: 'fadeInUp 200ms var(--ease-enter) backwards' }}>
            <div className="kpi-card-label">Tiempo Promedio Despacho</div>
            <div className="font-mono" style={{ fontSize: 22, fontWeight: 800, color: tiempoDespacho <= 5 ? 'var(--success)' : tiempoDespacho <= 10 ? 'var(--warning)' : 'var(--danger)', marginTop: 4 }}>
              {tiempoDespacho > 0 ? `${tiempoDespacho} días` : '—'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--slate-400)', marginTop: 2 }}>Llegada a cruce</div>
          </div>
          <div className="kpi-card stagger-4" style={{ padding: '14px 16px', borderTop: '4px solid #16A34A', animation: 'fadeInUp 200ms var(--ease-enter) backwards' }}>
            <div className="kpi-card-label">Operaciones T-MEC</div>
            <div className="font-mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--success)', marginTop: 4 }}>
              {tmecOps}
            </div>
            <div style={{ fontSize: 10, color: 'var(--slate-400)', marginTop: 2 }}>Tasa preferencial aplicada</div>
          </div>
          <div className="kpi-card stagger-5" style={{ padding: '14px 16px', borderTop: '4px solid var(--sand-400)', animation: 'fadeInUp 200ms var(--ease-enter) backwards' }}>
            <div className="kpi-card-label">Proveedores Activos</div>
            <div className="font-mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy-900)', marginTop: 4 }}>
              {provActivos}
            </div>
            <div style={{ fontSize: 10, color: 'var(--slate-400)', marginTop: 2 }}>{new Date().getFullYear()} — distintos</div>
          </div>
          <div className="kpi-card stagger-6" style={{ padding: '14px 16px', borderTop: '4px solid var(--purple-500)', animation: 'fadeInUp 200ms var(--ease-enter) backwards' }}>
            <div className="kpi-card-label">Pedimentos Pagados</div>
            <div className="font-mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy-900)', marginTop: 4 }}>
              {traficos.filter(t => !!t.pedimento).length}
            </div>
            <div style={{ fontSize: 10, color: 'var(--slate-400)', marginTop: 2 }}>Con pedimento transmitido</div>
          </div>
        </div>
      )}

      {/* Sparkline row */}
      {sparkData.length > 0 && (
        <div className="card" style={{ marginBottom: 24, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span className="text-caption" style={{ color: 'var(--slate-500)', display: 'block' }}>
              Tráficos en proceso — últimos 30 días
            </span>
            {sparkDelta && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span className="font-mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy-900)' }}>
                  {sparkDelta.current}
                </span>
                <span className="font-mono" style={{
                  fontSize: 13, fontWeight: 600,
                  color: sparkDelta.pct >= 0 ? 'var(--green-600)' : 'var(--red-600)',
                }}>
                  {sparkDelta.pct >= 0 ? '↑' : '↓'}{Math.abs(sparkDelta.pct)}%
                </span>
                <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>
                  vs {sparkDelta.past} hace 30d
                </span>
              </div>
            )}
          </div>
          <Sparkline data={sparkData} width={200} height={40} color="var(--info-500)" />
        </div>
      )}
      </>
      )}

      {/* ── Últimas 24 horas — event feed ── */}
      {(last24h.newTraficos > 0 || last24h.crossed > 0 || pendingEntradas.length > 0) && (
        <div className="card" style={{ marginBottom: 24, padding: '16px 20px' }}>
          <div className="kpi-card-label" style={{ marginBottom: 10 }}>Últimas 24 horas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {recentCrossed.slice(0, 3).map(t => (
              <Link key={t.trafico} href={`/traficos/${encodeURIComponent(t.trafico)}`}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border-card)', textDecoration: 'none', color: 'inherit' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>
                  <b>{t.trafico}</b> cruzó
                </span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{fmtDateShort(t.fecha_cruce)}</span>
              </Link>
            ))}
            {recentNew.slice(0, 2).map(t => (
              <Link key={t.trafico} href={`/traficos/${encodeURIComponent(t.trafico)}`}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border-card)', textDecoration: 'none', color: 'inherit' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C4963C', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>
                  Nuevo tráfico <b>{t.trafico}</b>
                </span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{fmtDateShort(t.fecha_llegada)}</span>
              </Link>
            ))}
            {pendingEntradas.length > 0 && (
              <Link href="/entradas"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', textDecoration: 'none', color: 'inherit' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#D97706', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                  {pendingEntradas.length} entrada{pendingEntradas.length !== 1 ? 's' : ''} pendiente{pendingEntradas.length !== 1 ? 's' : ''}
                </span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Próximos vencimientos ── */}
      {last24h.noPedGt7 > 0 && (
        <div className="card" style={{
          marginBottom: 24, padding: '16px 20px',
          borderLeft: '4px solid var(--amber-600)',
          background: 'var(--amber-50)',
        }}>
          <div className="kpi-card-label" style={{ marginBottom: 8 }}>Atención requerida</div>
          <Link href="/traficos" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#92400E' }}>
                {last24h.noPedGt7} tráfico{last24h.noPedGt7 !== 1 ? 's' : ''} sin pedimento &gt; 7 días
              </div>
              <div style={{ fontSize: 12, color: 'var(--slate-500)', marginTop: 2 }}>
                Requieren asignación de pedimento o seguimiento
              </div>
            </div>
            <ChevronRight size={16} style={{ color: '#92400E', flexShrink: 0 }} />
          </Link>
        </div>
      )}

      {/* T-MEC Savings — the retention card */}
      {tmecSavings.totalSavings > 0 && (
        <div className="card" style={{
          marginBottom: 24, padding: '20px 24px',
          background: 'linear-gradient(135deg, rgba(196,150,60,0.08), rgba(196,150,60,0.02))',
          border: '1px solid rgba(196,150,60,0.2)',
          borderLeft: '4px solid #C4963C',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8B6914', marginBottom: 8 }}>
            Ahorro T-MEC {new Date().getFullYear()}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 800, color: '#C4963C' }}>
              {fmtUSDCompact(tmecSavings.totalSavings)}
            </span>
            <span style={{ fontSize: 13, color: '#6B6B6B' }}>
              en {tmecSavings.tmecOperations} operaciones con tasa preferencial
            </span>
          </div>
          {tmecSavings.missedOpportunities.length > 0 && (
            <div style={{ fontSize: 12, color: '#92400E', marginTop: 4 }}>
              💡 {tmecSavings.missedOpportunities.length} embarque{tmecSavings.missedOpportunities.length !== 1 ? 's' : ''} de US/CA sin T-MEC —
              ahorro potencial adicional: {fmtUSDCompact(tmecSavings.missedOpportunities.reduce((s, m) => s + m.potentialSavings, 0))}
            </div>
          )}
        </div>
      )}

      {/* Forecast widget — subtle info card */}
      {/* Morning summary — proactive intelligence */}
      <MorningSummary />

      {/* Smart alerts — traficos taking longer than average */}
      <SmartAlerts />

      <ForecastWidget />

      {/* Fleet benchmark comparison */}
      <BenchmarkWidget />

      {/* Bridge Times — hides entirely when no data (returns null) */}
      <BridgeTimes />

      {/* Pending Entradas Card — severity tiers */}
      {pendingEntradas.length > 0 && (() => {
        const severity = oldestDays > 90
          ? { border: 'var(--red-600, #DC2626)', bg: 'var(--red-50, #FEF2F2)', badge: '⚠ Requiere atención inmediata', badgeColor: '#991B1B', badgeBg: 'var(--red-100, #FEE2E2)' }
          : oldestDays > 30
            ? { border: 'var(--amber-600, #D97706)', bg: 'var(--amber-50, #FFFBEB)', badge: 'Revisión recomendada', badgeColor: '#92400E', badgeBg: 'var(--amber-100, #FEF3C7)' }
            : { border: 'var(--warning-500)', bg: undefined, badge: null, badgeColor: '', badgeBg: '' }
        return (
          <div className="card" style={{
            marginBottom: 24, padding: '16px 20px',
            borderLeft: `4px solid ${severity.border}`,
            background: severity.bg,
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div className="text-title" style={{ color: 'var(--navy-900)' }}>
                {pendingEntradas.length} entrada{pendingEntradas.length !== 1 ? 's' : ''} sin tráfico asignado
              </div>
              {severity.badge && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                  background: severity.badgeBg, color: severity.badgeColor, whiteSpace: 'nowrap',
                }}>
                  {severity.badge}
                </span>
              )}
            </div>
            <div className="text-caption" style={{ color: 'var(--slate-400)', marginBottom: 12 }}>
              La más antigua: {oldestDays} día{oldestDays !== 1 ? 's' : ''}
            </div>
            <Link href="/entradas?faltantes=sin-trafico" style={{
              fontSize: 14, fontWeight: 600, color: 'var(--gold-400)',
              textDecoration: 'none',
            }}>
              Ver entradas sin tráfico →
            </Link>
          </div>
        )
      })()}

      {/* Tráficos Table */}
      <div className="table-shell" style={{ marginBottom: 24 }}>
        <div className="table-toolbar">
          <span className="text-title" style={{ color: 'var(--navy-900)' }}>Tráficos recientes</span>
          <Link href="/traficos" style={{
            fontSize: 13, fontWeight: 600, color: 'var(--gold-400)',
            textDecoration: 'none',
          }}>
            Ver todos →
          </Link>
        </div>

        {traficos.length === 0 ? (
          <EmptyState
            icon="📋"
            title="No hay tráficos registrados"
            description="Las operaciones aparecerán aquí cuando se registre un nuevo tráfico de importación."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="cruz-table" aria-label="Tráficos recientes">
              <thead>
                <tr>
                  <th>Tráfico</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  {!isMobile && <th style={{ textAlign: 'right' }}>Importe</th>}
                  <th style={{ width: 28 }}></th>
                </tr>
              </thead>
              <tbody>
                {traficos.slice(0, 50).map((t, idx) => {
                  const isCruzado = (t.estatus || '').toLowerCase().includes('cruz')
                  const badgeClass = isCruzado ? 'badge-cruzado' : 'badge-proceso'
                  const badgeLabel = isCruzado ? 'Cruzado' : 'En Proceso'
                  return (
                    <tr
                      key={t.trafico}
                      className={`clickable-row ${idx % 2 === 0 ? 'row-even' : 'row-odd'}`}
                      onClick={() => router.push(`/traficos/${encodeURIComponent(t.trafico)}`)}
                    >
                      <td><span className="trafico-id">{t.trafico}</span></td>
                      <td><span className={`badge ${badgeClass}`}><span className="badge-dot" />{badgeLabel}</span></td>
                      <td className="timestamp">{fmtDateShort(t.fecha_llegada)}</td>
                      <td className="desc-text">{fmtDesc(t.descripcion_mercancia) || '—'}</td>
                      {!isMobile && <td className="importe currency text-right" title={t.importe_total ? undefined : 'Valor no disponible'}>{t.importe_total ? `${fmtUSD(t.importe_total)} USD` : '—'}</td>}
                      <td style={{ width: 28, textAlign: 'center' }}><ChevronRight size={14} style={{ color: 'var(--slate-300)' }} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Sync timestamp */}
        {traficos.length > 0 && (
          <div style={{
            padding: '8px 20px', fontSize: 11, color: 'var(--slate-400)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 10 }}>🔄</span>
            Sincronizado con GlobalPC · {fmtDate(new Date())}
          </div>
        )}
      </div>

      </>}
    </div>
  )
}

/** Forecast widget — shows predicted next-30-day volume */
function ForecastWidget() {
  const [forecast, setForecast] = useState<{ expected_traficos: number; expected_value_usd: number; confidence_low: number; confidence_high: number; trend_direction: string } | null>(null)

  useEffect(() => {
    fetch('/api/forecast').then(r => r.json())
      .then(d => { if (d.forecast) setForecast(d.forecast) })
      .catch(() => {})
  }, [])

  if (!forecast || forecast.expected_traficos === 0) return null

  const arrow = forecast.trend_direction === 'up' ? '↑' : forecast.trend_direction === 'down' ? '↓' : '→'
  const arrowColor = forecast.trend_direction === 'up' ? '#16A34A' : forecast.trend_direction === 'down' ? '#DC2626' : '#6B6B6B'

  return (
    <div className="card" style={{ marginBottom: 24, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(196,150,60,0.04)', border: '1px solid rgba(196,150,60,0.15)' }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9B9B9B', marginBottom: 4 }}>
          Pronóstico · próximos 30 días
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800, color: '#1A1A1A' }}>
            ~{forecast.expected_traficos} tráficos
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#6B6B6B' }}>
            ({forecast.confidence_low}–{forecast.confidence_high})
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: arrowColor }}>{arrow}</span>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: '#C4963C' }}>
          ~{fmtUSDCompact(forecast.expected_value_usd)}
        </div>
        <div style={{ fontSize: 10, color: '#9B9B9B' }}>valor estimado</div>
      </div>
    </div>
  )
}

/** Benchmark comparison — fleet vs your data */
function BenchmarkWidget() {
  const [data, setData] = useState<{ comparisons: Record<string, { you: string; fleet: string; delta: string; better: boolean }> } | null>(null)

  useEffect(() => {
    fetch('/api/benchmarks').then(r => r.json())
      .then(d => { if (d.comparisons && Object.keys(d.comparisons).length > 0) setData(d) })
      .catch(() => {})
  }, [])

  if (!data) return null
  const items = Object.entries(data.comparisons)
  if (items.length === 0) return null

  const labels: Record<string, string> = { crossing: 'Tiempo de cruce', tmec: 'Uso T-MEC', docs: 'Documentos' }

  return (
    <div className="card" style={{ marginBottom: 24, padding: '16px 20px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9B9B9B', marginBottom: 12 }}>
        Su operación vs promedio Patente 3596
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(([key, comp]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>{labels[key] || key}</div>
              <div style={{ fontSize: 11, color: '#6B6B6B' }}>Usted: <b>{comp.you}</b> · Promedio: {comp.fleet}</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: comp.better ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)', color: comp.better ? '#16A34A' : '#DC2626' }}>
              {comp.delta}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
