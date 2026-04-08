'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useCommandCenterData } from '@/hooks/use-command-center-data'
import { useActivityPulse } from '@/hooks/use-activity-pulse'
import { useRealtimeTrafico } from '@/hooks/use-realtime-trafico'
import { useIsMobile } from '@/hooks/use-mobile'
import { useStatusSentence } from '@/hooks/use-status-sentence'
import { playSound } from '@/lib/sounds'
import { WorkflowGrid } from './WorkflowGrid'
import { ActivityPulseSection } from './ActivityPulseSection'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton'
import { Celebrate } from '@/components/celebrate'

// ── State mood — drives background atmosphere ──
type SystemMood = 'cleared' | 'calm' | 'busy' | 'critical'

function getSystemMood(enProceso: number, urgentes: number, pendingEntradas: number): SystemMood {
  if (urgentes > 0) return 'critical'
  if (enProceso > 3 || pendingEntradas > 5) return 'busy'
  if (enProceso === 0 && pendingEntradas === 0) return 'cleared'
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

// ── Progress Ring SVG ──
function ProgressRing({ pct, size = 56 }: { pct: number; size?: number }) {
  const stroke = 4
  const radius = (size - stroke) / 2
  const circ = 2 * Math.PI * radius
  const offset = circ - (pct / 100) * circ
  const color = pct === 100 ? '#16A34A' : 'var(--gold, #C9A84C)'
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border, #E8E5E0)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 600ms ease', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }} />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em"
        style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', fill: 'var(--text-primary, #1A1A1A)' }}>
        {pct}%
      </text>
    </svg>
  )
}

export function CommandCenterView({ viewMode = 'client' }: { viewMode?: 'client' | 'operator' }) {
  const isClient = viewMode === 'client'
  const isMobile = useIsMobile()
  const { data, loading, error, reload } = useCommandCenterData()
  const { pulse, loading: pulseLoading, awaySummary, dismissAway } = useActivityPulse()
  const { lastUpdate } = useRealtimeTrafico()
  const status = useStatusSentence()
  const realtimeToast = useRealtimeToast(lastUpdate)
  const [criticosOpen, setCriticosOpen] = useState(false)

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
        {awaySummary.total} accion{awaySummary.total !== 1 ? 'es' : ''} procesada{awaySummary.total !== 1 ? 's' : ''}
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
      className={`mood-${mood}`}
      style={{
        padding: isMobile ? '8px 8px 80px' : '16px 48px 32px',
        overflowX: 'hidden',
        minHeight: 'calc(100vh - 60px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
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

      {/* CRUZ orbit dot — persistent AI indicator (mobile only) */}
      {isMobile && (
        <button
          onClick={() => document.dispatchEvent(new CustomEvent('cruz:open-chat'))}
          aria-label="CRUZ AI"
          className="cruz-orbit-dot"
          style={{ position: 'fixed', top: 16, right: 16 }}
        >
          {criticalCount > 0 && (
            <span className="cruz-orbit-badge">{criticalCount > 99 ? '99+' : criticalCount}</span>
          )}
        </button>
      )}

      {/* Away banner */}
      {awayBanner}

      {/* ── COMMAND STRIP (operator only — hidden from clients) ── */}
      {!isClient && <div style={{
        borderRadius: 10,
        marginBottom: 12,
        borderLeft: criticalCount > 0 ? '3px solid var(--danger-500, #DC2626)' : '3px solid var(--success, #16A34A)',
        background: criticalCount > 0 ? 'rgba(220,38,38,0.06)' : 'rgba(22,163,74,0.06)',
        overflow: 'hidden',
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
          <span style={{ fontSize: 13, fontWeight: 700, color: criticalCount > 0 ? '#DC2626' : '#16A34A' }}>
            {criticalCount > 0
              ? `${criticalCount} pendiente${criticalCount !== 1 ? 's' : ''} critico${criticalCount !== 1 ? 's' : ''}`
              : 'Todo al corriente — sin pendientes criticos'
            }
            {criticalCount > 0 && (
              <span style={{ fontSize: 11, marginLeft: 6, color: 'var(--text-muted)' }}>{criticosOpen ? '▲' : '▼'}</span>
            )}
          </span>
          {criticalCount > 0 && (
            <Link href={criticalHref} onClick={e => e.stopPropagation()} style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700,
              background: '#DC2626', color: '#FFFFFF', textDecoration: 'none',
            }}>
              Resolver ahora
            </Link>
          )}
        </div>
        {/* Expanded critical items */}
        {criticosOpen && criticalCount > 0 && (
          <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.pendingEntradas.slice(0, 3).map(e => (
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
                    {e.descripcion_mercancia || 'Sin descripcion'}
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4,
                  background: 'var(--gold, #C9A84C)', color: '#FFFFFF', flexShrink: 0,
                }}>
                  Resolver
                </span>
              </Link>
            ))}
            {criticalCount > 3 && (
              <Link href={criticalHref} style={{
                fontSize: 11, fontWeight: 600, color: 'var(--gold, #C9A84C)',
                textDecoration: 'none', textAlign: 'center', padding: '4px 0',
              }}>
                Ver {criticalCount - 3} mas →
              </Link>
            )}
          </div>
        )}
      </div>}

      {/* ── Client calm status (replaces critical banner) ── */}
      {isClient && (
        <div style={{
          padding: isMobile ? '10px 12px' : '10px 16px',
          borderRadius: 10, marginBottom: 12,
          borderLeft: '3px solid var(--success, #16A34A)',
          background: 'rgba(22,163,74,0.06)',
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#16A34A' }}>
            {data.enProceso > 0
              ? `Todo en orden · ${data.enProceso} envío${data.enProceso !== 1 ? 's' : ''} en tránsito`
              : 'Sin novedades · todo fluye'
            }
          </span>
        </div>
      )}

      {/* ── DAILY COMPLETION LOOP (operator only) ── */}
      {!isClient && <div style={{
        padding: isMobile ? '10px 12px' : '10px 16px',
        borderRadius: 10,
        marginBottom: 16,
        background: 'var(--bg-card, #FFFFFF)',
        border: '1px solid var(--border, #E8E5E0)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}>
        <ProgressRing pct={completionPct} size={isMobile ? 52 : 56} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #1A1A1A)' }}>
            {totalActions > 0
              ? `Faltan ${totalActions} accion${totalActions !== 1 ? 'es' : ''}`
              : 'Excelente dia'
            }
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted, #9B9B9B)', marginTop: 2 }}>
            {completionPct >= 100 ? 'Todo completado'
              : completionPct >= 80 ? 'Casi listo'
              : completionPct >= 50 ? 'Buen ritmo'
              : `${completedToday} completado${completedToday !== 1 ? 's' : ''} hoy`
            }
          </div>
        </div>
      </div>}

      {/* ── CARD GRID ── */}
      <WorkflowGrid
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
        lastCrossing={data.lastCrossing}
        docsPendientes={data.docsPendientes}
        isMobile={isMobile}
        viewMode={viewMode}
      />

      {/* Activity Pulse — collapsed below cards */}
      <div style={{ marginTop: 16 }}>
        <ActivityPulseSection pulse={pulse} loading={pulseLoading} defaultCollapsed dark={!isMobile} />
      </div>

      <Celebrate trigger={!!lastUpdate && (lastUpdate.estatus || '').toLowerCase().includes('cruz')} />
    </div>
  )
}
