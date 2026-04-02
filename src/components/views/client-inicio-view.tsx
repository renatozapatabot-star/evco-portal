'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { getCompanyIdCookie, getClientNameCookie } from '@/lib/client-config'
import { fmtDate, fmtDateShort, fmtUSD, fmtUSDCompact, fmtKg, fmtDesc } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import CountingNumber from '@/components/ui/CountingNumber'
import { Sparkline } from '@/components/sparkline'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorCard } from '@/components/ui/ErrorCard'
import SkeletonBase, { SkeletonKPI } from '@/components/ui/Skeleton'
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { useSessionCache } from '@/hooks/use-session-cache'
import { StatusStrip } from '@/components/StatusStrip'
import { BridgeTimes } from '@/components/BridgeTimes'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null)
  const { getCached, setCache, refreshing, startRefresh, endRefresh } = useSessionCache()
  const [dataFade, setDataFade] = useState(1)

  function loadData() {
    const companyId = getCompanyIdCookie()
    const name = getClientNameCookie()
    setCompanyName(name || '')

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
      .finally(() => { setLoading(false); endRefresh(); setFetchedAt(new Date()) })
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

  // Greeting
  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 18) return 'Buenas tardes'
    return 'Buenas noches'
  })()

  const dateStr = (() => {
    const d = new Date()
    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    return `${days[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]}, ${d.getFullYear()}`
  })()

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
    return { current, pct }
  }, [sparkData])

  if (error) {
    return (
      <div style={{ padding: 32, maxWidth: 960, margin: '0 auto' }}>
        <ErrorCard message={error} onRetry={loadData} />
      </div>
    )
  }

  if (loading) {
    return <DashboardSkeleton isMobile={isMobile} />
  }

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 960, margin: '0 auto' }}>
      {/* Status Strip — first thing Ursula sees */}
      <div style={{ marginBottom: 16 }}>
        <StatusStrip override={statusOverride} />
        {fetchedAt && (() => {
          const isLive = Date.now() - fetchedAt.getTime() < 5 * 60 * 1000
          return (
            <p style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: isLive ? '#16A34A' : '#94A3B8',
              }} className={isLive ? 'dot-live' : ''} />
              Actualizado: {fetchedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago' })}
            </p>
          )
        })()}
      </div>

      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="text-display" style={{ color: 'var(--navy-900)', margin: 0 }}>
          {greeting}, {companyName || 'cliente'}
        </h1>
        <p className="text-caption" style={{ color: 'var(--slate-400)', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          Resumen de su operación — {dateStr}
          {refreshing && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: 'var(--slate-400)',
              background: 'var(--slate-100, #F1F5F9)', padding: '2px 8px',
              borderRadius: 4, animation: 'pulse 1.5s infinite',
            }}>
              Actualizando...
            </span>
          )}
        </p>
      </div>

      {/* KPI Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: 16, marginBottom: 24,
        opacity: dataFade,
        transition: 'opacity 200ms ease',
      }}>
        {[
          { label: 'En Proceso', value: enProceso, color: 'var(--info-500)', href: '/traficos?estatus=En Proceso', key: 'en-proceso' },
          { label: 'Cruzado', value: cruzado, color: 'var(--success-500)', href: '/traficos?estatus=Cruzado', key: 'cruzado' },
          { label: 'Pedimento Pagado', value: pedimentoPagado, color: 'var(--purple-500)', href: '/traficos?estatus=Pedimento Pagado', key: 'pagado' },
          { label: 'Entradas hoy', value: entradasHoy, color: 'var(--sand-400)', href: '/entradas', key: 'entradas' },
        ].map((kpi) => {
          const isZero = kpi.value === 0
          return (
            <Link key={kpi.key} href={kpi.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="stat-card" role="status" aria-live="polite" style={{
                borderTop: `4px solid ${isZero ? 'var(--slate-200)' : kpi.color}`,
                borderStyle: isZero ? 'dashed' : undefined,
                opacity: isZero ? 0.6 : 1,
                minHeight: 148,
              }}>
                <div className="stat-label">{kpi.label}</div>
                <div className="stat-value" style={{ color: isZero ? 'var(--slate-300)' : undefined }}>
                  <CountingNumber value={kpi.value} sessionKey={`dash-${kpi.key}`} />
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Sparkline row */}
      {sparkData.length > 0 && (
        <div className="card" style={{ marginBottom: 24, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span className="text-caption" style={{ color: 'var(--slate-500)', display: 'block' }}>
              Tráficos en proceso — últimos 30 días
            </span>
            {sparkDelta && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--navy-900)' }}>
                  {sparkDelta.current}
                </span>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: sparkDelta.pct >= 0 ? 'var(--green-600)' : 'var(--red-600)',
                }}>
                  {sparkDelta.pct >= 0 ? '↑' : '↓'}{Math.abs(sparkDelta.pct)}%
                </span>
              </div>
            )}
          </div>
          <Sparkline data={sparkData} width={200} height={40} color="var(--info-500)" />
        </div>
      )}

      {/* Bridge Times */}
      <div className="card" style={{ marginBottom: 24, padding: '16px 20px' }}>
        <BridgeTimes />
      </div>

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
            <Link href="/entradas" style={{
              fontSize: 14, fontWeight: 600, color: 'var(--gold-400)',
              textDecoration: 'none',
            }}>
              Ver entradas →
            </Link>
          </div>
        )
      })()}

      {/* Tráficos Table */}
      <div className="card-flush" style={{ marginBottom: 24 }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--slate-200)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
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
                {traficos.slice(0, 50).map(t => {
                  const isCruzado = (t.estatus || '').toLowerCase().includes('cruz')
                  const badgeClass = isCruzado ? 'badge-cruzado' : 'badge-proceso'
                  const badgeLabel = isCruzado ? 'Cruzado' : 'En Proceso'
                  return (
                    <tr key={t.trafico} onClick={() => router.push(`/traficos/${encodeURIComponent(t.trafico)}`)} style={{ cursor: 'pointer' }}>
                      <td><span className="trafico-id">{t.trafico}</span></td>
                      <td><span className={`badge ${badgeClass}`}><span className="badge-dot" />{badgeLabel}</span></td>
                      <td style={{ fontSize: 12.5, color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>{fmtDateShort(t.fecha_llegada)}</td>
                      <td className="desc-text">{fmtDesc(t.descripcion_mercancia) || '—'}</td>
                      {!isMobile && <td className="importe" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{t.importe_total ? fmtUSD(t.importe_total) : '—'}</td>}
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
    </div>
  )
}
