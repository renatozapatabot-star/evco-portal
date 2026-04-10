'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { useCommandCenterData } from '@/hooks/use-command-center-data'
import { useActivityPulse } from '@/hooks/use-activity-pulse'
import { useRealtimeTrafico } from '@/hooks/use-realtime-trafico'
import { useIsMobile } from '@/hooks/use-mobile'
import { useStatusSentence } from '@/hooks/use-status-sentence'
import { usePullRefreshV2 } from '@/hooks/use-pull-refresh-v2'
import { playSound } from '@/lib/sounds'
import { haptic } from '@/hooks/use-haptic'
import { useNetworkStatus } from '@/hooks/use-network-status'
import { getCookieValue } from '@/lib/client-config'
import { WorkflowGrid } from './WorkflowGrid'
import { ActivityPulseSection } from './ActivityPulseSection'
import { NewsBanner, buildClientItems } from '@/components/cockpit/shared/NewsBanner'
import { PullRefreshIndicator } from '@/components/broker/PullRefreshIndicator'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton'
import { Celebrate } from '@/components/celebrate'

// ── Live status indicator ──
function LiveIndicator({ lastFetchTime }: { lastFetchTime: number | null }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10000)
    return () => clearInterval(t)
  }, [])
  if (!lastFetchTime) return null
  const secsAgo = Math.round((now - lastFetchTime) / 1000)
  const minsAgo = Math.round(secsAgo / 60)
  const color = secsAgo < 300 ? '#16A34A' : secsAgo < 1800 ? '#D97706' : '#DC2626'
  const label = secsAgo < 60 ? `${secsAgo}s` : `${minsAgo}m`
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 0', marginBottom: 8,
      fontSize: 11, fontWeight: 600, color: '#6E7681',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: color,
        boxShadow: `0 0 6px ${color}`,
        animation: secsAgo < 300 ? 'livePulse 2s ease-in-out infinite' : 'none',
      }} />
      Sistema en vivo · Actualizado hace {label}
    </div>
  )
}

// ── State mood — drives background atmosphere ──
type SystemMood = 'cleared' | 'calm' | 'busy' | 'critical' | 'allgreen'

function getSystemMood(enProceso: number, urgentes: number, pendingEntradas: number): SystemMood {
  if (urgentes > 0) return 'critical'
  if (enProceso > 3 || pendingEntradas > 5) return 'busy'
  if (enProceso === 0 && pendingEntradas === 0) return 'allgreen'
  if (enProceso <= 3 && urgentes === 0) return 'cleared'
  return 'calm'
}

function useRealtimeToast(lastUpdate: { trafico: string; estatus: string } | null): string | null {
  const [toast, setToast] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const show = useCallback((msg: string) => {
    setToast(msg)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setToast(null), 5000)
  }, [])
  useEffect(() => {
    if (!lastUpdate) return
    const isCrossed = lastUpdate.estatus.toLowerCase().includes('cruz')
    if (isCrossed) playSound('success')
    show(isCrossed ? `${lastUpdate.trafico} acaba de cruzar. Todo en orden.` : `${lastUpdate.trafico}: ${lastUpdate.estatus}`)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [lastUpdate, show])
  return toast
}

// ── Progress Ring SVG with animated count-up ──
function ProgressRing({ pct, size = 56, animate = false }: { pct: number; size?: number; animate?: boolean }) {
  const stroke = 4
  const radius = (size - stroke) / 2
  const circ = 2 * Math.PI * radius
  const [displayPct, setDisplayPct] = useState(animate ? 0 : pct)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!animate || pct === 0) { setDisplayPct(pct); return }
    const start = performance.now()
    const duration = 800
    const step = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayPct(Math.round(eased * pct))
      if (progress < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [pct, animate])

  const offset = circ - (displayPct / 100) * circ
  const color = displayPct === 100 ? '#16A34A' : 'var(--gold, #eab308)'
  const approaching = pct >= 95 && pct < 100
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }} className={approaching ? 'ring-approaching' : undefined}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border, rgba(255,255,255,0.08))" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: animate ? 'none' : 'stroke-dashoffset 600ms ease', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }} />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em"
        style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', fill: 'var(--text-primary, #E6EDF3)' }}>
        {displayPct}%
      </text>
    </svg>
  )
}

// ── Command Strip (extracted to avoid IIFE-in-JSX) ──
function CommandStrip({ urgentes, criticalCount, mood, isMobile, criticosOpen, setCriticosOpen, criticalHref, pendingEntradas }: {
  urgentes: number; criticalCount: number; mood: SystemMood; isMobile: boolean
  criticosOpen: boolean; setCriticosOpen: (fn: (v: boolean) => boolean) => void
  criticalHref: string; pendingEntradas: { cve_entrada: string; descripcion_mercancia?: string | null }[]
}) {
  const bannerLevel = urgentes > 0 ? 'red' : criticalCount > 0 ? 'amber' : 'green' as const
  const bannerColors = {
    red:   { border: '#DC2626', bg: 'rgba(220,38,38,0.06)', text: '#DC2626', btn: '#DC2626' },
    amber: { border: '#D97706', bg: 'rgba(217,119,6,0.06)', text: '#D97706', btn: '#D97706' },
    green: { border: '#16A34A', bg: 'rgba(22,163,74,0.06)', text: '#16A34A', btn: '#16A34A' },
  }
  const bc = bannerColors[bannerLevel]
  const bannerText = bannerLevel === 'red'
    ? `${urgentes} urgente${urgentes !== 1 ? 's' : ''} — resolver ahora`
    : bannerLevel === 'amber'
      ? `${criticalCount} pendiente${criticalCount !== 1 ? 's' : ''} — monitorear`
      : mood === 'allgreen' ? 'Todo completado — excelente día' : 'Todo al corriente — sin pendientes'

  return (
    <div style={{
      borderRadius: 10, marginBottom: 12,
      borderLeft: `3px solid ${bc.border}`, background: bc.bg, overflow: 'hidden',
    }}>
      <div
        onClick={() => criticalCount > 0 && setCriticosOpen(v => !v)}
        style={{
          padding: isMobile ? '10px 12px' : '10px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 8,
          cursor: criticalCount > 0 ? 'pointer' : 'default',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: bc.text }}>
          {bannerText}
          {criticalCount > 0 && (
            <span style={{ fontSize: 11, marginLeft: 6, color: 'var(--text-muted)' }}>{criticosOpen ? '▲' : '▼'}</span>
          )}
        </span>
        {criticalCount > 0 && (
          <Link href={criticalHref} onClick={e => e.stopPropagation()} style={{
            padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700,
            background: bc.btn, color: '#FFFFFF', textDecoration: 'none',
          }}>
            {bannerLevel === 'red' ? 'Resolver ahora' : 'Ver pendientes'}
          </Link>
        )}
      </div>
      {criticosOpen && criticalCount > 0 && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pendingEntradas.slice(0, 3).map(e => (
            <Link key={e.cve_entrada} href={`/entradas/${e.cve_entrada}`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              padding: '8px 10px', borderRadius: 6,
              background: 'rgba(255,255,255,0.5)', border: '1px solid var(--border)',
              textDecoration: 'none', color: 'inherit',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {e.cve_entrada}
                </span>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.descripcion_mercancia || 'Sin descripción'}
                </div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4,
                background: 'var(--gold, #eab308)', color: '#FFFFFF', flexShrink: 0,
              }}>
                Resolver
              </span>
            </Link>
          ))}
          {criticalCount > 3 && (
            <Link href={criticalHref} style={{
              fontSize: 11, fontWeight: 600, color: 'var(--gold, #eab308)',
              textDecoration: 'none', textAlign: 'center', padding: '4px 0',
            }}>
              Ver {criticalCount - 3} más →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function CeremonyEffect({ active }: { active: boolean }) {
  const firedRef = useRef(false)
  useEffect(() => {
    if (!active || firedRef.current) return
    const key = `cruz_ceremony_${new Date().toISOString().split('T')[0]}`
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) return
    firedRef.current = true
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, '1')
    playSound('achievement')
    haptic.celebrate()
    const companyName = typeof document !== 'undefined' ? getCookieValue('company_name') || '' : ''
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('cruz:notification-slide', {
        detail: {
          title: 'Día perfecto',
          description: companyName ? `Excelente día, ${companyName} — todo al corriente` : 'Todo completado — excelente día',
          severity: 'success',
        },
      }))
    }
  }, [active])
  return null
}

function PasswordResetBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <div style={{
      padding: '10px 16px', borderRadius: 10, marginBottom: 12,
      borderLeft: '3px solid var(--gold, #eab308)',
      background: 'rgba(201,168,76,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 8,
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #1A1A1A)' }}>
        Te recomendamos cambiar tu contraseña temporal
      </span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Link href="/cambiar-contrasena" style={{
          padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700,
          background: 'var(--gold, #eab308)', color: '#FFFFFF', textDecoration: 'none',
          minHeight: 44, display: 'inline-flex', alignItems: 'center',
        }}>
          Cambiar ahora
        </Link>
        <button
          onClick={() => { setDismissed(true); sessionStorage.setItem('cruz-pw-banner-dismissed', '1') }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
            color: 'var(--text-muted, #9B9B9B)', padding: 8, minHeight: 44, minWidth: 44,
          }}
          aria-label="Descartar"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export function CommandCenterView({ viewMode = 'client' }: { viewMode?: 'client' | 'operator' }) {
  const isClient = viewMode === 'client'
  const isMobile = useIsMobile()
  const prefersReduced = useReducedMotion()
  const { data, loading, error, reload } = useCommandCenterData()
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null)
  useEffect(() => { if (!loading && data.totalTraficos > 0) setLastFetchTime(Date.now()) }, [loading, data.totalTraficos])
  const { pulse, loading: pulseLoading, awaySummary, dismissAway } = useActivityPulse()
  const { lastUpdate } = useRealtimeTrafico()
  const { pullDistance, isRefreshing, progress: pullProgress } = usePullRefreshV2({
    onRefresh: async () => { reload() },
  })
  const status = useStatusSentence()
  const realtimeToast = useRealtimeToast(lastUpdate)
  const network = useNetworkStatus()
  const [criticosOpen, setCriticosOpen] = useState(false)

  // Auto-reload when coming back online
  useEffect(() => {
    if (network.wasOffline && network.isOnline) reload()
  }, [network.wasOffline, network.isOnline, reload])

  if (error) {
    return (
      <div style={{ padding: 48 }}>
        <ErrorCard message={error} onRetry={reload} />
      </div>
    )
  }

  if (loading) return <DashboardSkeleton isMobile={isMobile} />

  const urgentes = data.urgentes || status.urgentes
  const pendingEntradas = data.pendingEntradas.length
  const criticalCount = urgentes + pendingEntradas + (data.docsPendientes > 0 ? data.docsPendientes : 0)
  const mood = getSystemMood(data.enProceso, urgentes, pendingEntradas)

  // Daily completion loop
  const totalActions = pendingEntradas + data.enProceso + data.docsPendientes
  const completedToday = data.cruzadosHoy
  const completionPct = totalActions + completedToday > 0
    ? Math.round((completedToday / (totalActions + completedToday)) * 100)
    : 100

  // Critical CTA href
  const criticalHref = urgentes > 0
    ? '/traficos?estatus=En+Proceso'
    : pendingEntradas > 0
      ? '/entradas'
      : '/expedientes'

  // Away banner
  const awayBanner = awaySummary && awaySummary.total > 0 ? (
    <div style={{
      padding: '12px 16px', borderRadius: 10,
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderLeft: '3px solid #0D9488', marginBottom: 12,
    }}>
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0D9488', marginBottom: 4 }}>
        Mientras estuvo fuera
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
        {awaySummary.total} acción{awaySummary.total !== 1 ? 'es' : ''} procesada{awaySummary.total !== 1 ? 's' : ''}
      </div>
      <button onClick={dismissAway} style={{
        marginTop: 4, fontSize: 11, fontWeight: 600,
        color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      }}>
        Entendido
      </button>
    </div>
  ) : null

  return (
    <div
      className={`mood-${mood}${completionPct >= 100 ? ' mood-ceremony' : ''}`}
      style={{
        padding: isMobile ? '8px 8px 16px' : '16px 48px 32px',
        overflowX: 'hidden',
        minHeight: 'calc(100vh - 60px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Pull-to-refresh indicator */}
      <PullRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} progress={pullProgress} />

      {/* Time-of-day greeting */}
      {!loading && (() => {
        const hour = new Date().getHours()
        const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'
        const name = typeof document !== 'undefined' ? getCookieValue('company_name') || getCookieValue('operator_name') || '' : ''
        return (
          <div style={{ fontSize: 14, fontWeight: 600, color: '#E6EDF3', marginBottom: 8, opacity: 0.8 }}>
            {greeting}{name ? `, ${name}` : ''}
          </div>
        )
      })()}

      {/* Static top strip — facturado + live indicator */}
      {!loading && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isMobile ? '8px 12px' : '10px 16px',
          marginBottom: 12, borderRadius: 12,
          background: 'var(--bg-elevated, #1a2338)',
          border: '1px solid var(--border-card, #334155)',
          flexWrap: 'wrap', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {data.facturacionMes > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-secondary, #94a3b8)' }}>
                Facturado este mes: <strong style={{ color: '#eab308', fontFamily: 'var(--font-mono)' }}>
                  ${data.facturacionMes > 1000 ? `${Math.round(data.facturacionMes / 1000)}K` : data.facturacionMes.toFixed(0)} MXN
                </strong>
              </span>
            )}
          </div>
          <LiveIndicator lastFetchTime={lastFetchTime} />
        </div>
      )}

      {/* Offline/online status */}
      {!network.isOnline && (
        <div className="cc-offline-banner">
          Sin conexión · Datos de hace {network.lastOnlineAt ? Math.max(1, Math.round((Date.now() - network.lastOnlineAt.getTime()) / 60000)) : '?'} min
        </div>
      )}
      {network.wasOffline && network.isOnline && (
        <div className="cc-online-banner">
          Conectado · Sincronizado
        </div>
      )}

      {/* Toast */}
      {realtimeToast && (
        <div className="cc-toast-fixed" style={{
          padding: '10px 16px', borderRadius: 10,
          background: '#0D9488', color: '#FFFFFF', fontSize: 13, fontWeight: 600,
          animation: 'fadeInUp 200ms ease',
        }}>
          {realtimeToast}
        </div>
      )}

      {/* Mobile AI indicator removed — TopBar has ADUANA AI link + chat bubble covers desktop */}

      {/* Away banner */}
      {awayBanner}

      {/* Password reset banner for clients with temporary passwords */}
      {isClient && typeof window !== 'undefined' && sessionStorage.getItem('cruz-pw-banner-dismissed') !== '1' && (
        <PasswordResetBanner />
      )}

      {/* ── COMMAND STRIP (operator only — hidden from clients) ── */}
      {!isClient && <div className={prefersReduced ? undefined : 'cc-entrance-strip'}><CommandStrip
        urgentes={urgentes}
        criticalCount={criticalCount}
        mood={mood}
        isMobile={isMobile}
        criticosOpen={criticosOpen}
        setCriticosOpen={setCriticosOpen}
        criticalHref={criticalHref}
        pendingEntradas={data.pendingEntradas}
      /></div>}

      {/* Client status and KPI strip removed — cards provide all the information */}

      {/* ── DAILY COMPLETION LOOP (operator only) ── */}
      {!isClient && <div style={{
        padding: isMobile ? '10px 12px' : '10px 16px',
        borderRadius: 10,
        marginBottom: 16,
        background: completionPct >= 100 ? 'linear-gradient(135deg, rgba(22,163,74,0.06), var(--bg-card, #FFFFFF))' : 'var(--bg-card, #FFFFFF)',
        border: completionPct >= 100 ? '1px solid rgba(22,163,74,0.15)' : '1px solid var(--border, #E8E5E0)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}>
        <div className={completionPct >= 100 ? 'ring-complete' : ''}>
          <ProgressRing pct={completionPct} size={isMobile ? 52 : 56} animate={!prefersReduced} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: completionPct >= 100 ? '#16A34A' : 'var(--text-primary, #1A1A1A)' }}>
            {totalActions > 0
              ? `Faltan ${totalActions} acción${totalActions !== 1 ? 'es' : ''}`
              : 'Día perfecto'
            }
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted, #9B9B9B)', marginTop: 2 }}>
            {completionPct >= 100 ? 'Todo completado — sin pendientes'
              : completionPct >= 80 ? 'Casi listo'
              : completionPct >= 50 ? 'Buen ritmo'
              : `${completedToday} completado${completedToday !== 1 ? 's' : ''} hoy`
            }
          </div>
        </div>
      </div>}
      <Celebrate trigger={completionPct >= 100} id="operator-allgreen" />
      <CeremonyEffect active={completionPct >= 100} />

      {/* ── CARD GRID ── */}
      <WorkflowGrid
        oldestUrgentDate={(() => {
          const urgent = data.traficos.filter(t => (t.estatus || '').toLowerCase() === 'en proceso' && !t.pedimento)
          if (urgent.length === 0) return null
          const oldest = urgent.reduce((a, b) => ((a.updated_at || '') < (b.updated_at || '') ? a : b))
          return oldest.updated_at || null
        })()}
        enProceso={data.enProceso}
        urgentes={urgentes}
        pendingEntradas={pendingEntradas}
        inventarioBultos={data.inventarioBultos}
        inventarioPeso={data.inventarioPeso}
        pedimentosThisMonth={data.pedimentosThisMonth}
        expedientesTotal={data.expedientesTotal}
        facturacionMes={data.facturacionMes}
        cruzadosEsteMes={data.cruzadosEsteMes}
        cruzadosHoy={data.cruzadosHoy}
        exchangeRate={data.exchangeRate}
        exchangeRateDate={data.exchangeRateDate}
        bridgeWaitMinutes={data.bridgeWaitMinutes}
        lastCrossing={data.lastCrossing}
        docsPendientes={data.docsPendientes}
        isMobile={isMobile}
        viewMode={viewMode}
        sparklines={data.sparklines}
        trends={data.trends}
        activeTraficosList={data.activeTraficosList}
        totalTraficos={data.totalTraficos}
        totalCruzados={data.totalCruzados}
        facturacionYTD={data.facturacionYTD}
        newThisWeek={data.newThisWeek}
        daysSinceRojo={data.daysSinceRojo}
      />

      {/* Activity Pulse — collapsed below cards */}
      <div style={{ marginTop: 16 }}>
        <ActivityPulseSection pulse={pulse} loading={pulseLoading} defaultCollapsed={!isClient} dark={!isMobile} />
      </div>

      <Celebrate trigger={!!lastUpdate && (lastUpdate.estatus || '').toLowerCase().includes('cruz')} />
    </div>
  )
}
