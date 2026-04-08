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

export function CommandCenterView() {
  const isMobile = useIsMobile()
  const { data, loading, error, reload } = useCommandCenterData()
  const { pulse, loading: pulseLoading, awaySummary, dismissAway } = useActivityPulse()
  const { lastUpdate } = useRealtimeTrafico()
  const status = useStatusSentence()
  const realtimeToast = useRealtimeToast(lastUpdate)

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

      {/* Away banner */}
      {awayBanner}

      {/* ── COMMAND STRIP ── */}
      <div style={{
        padding: isMobile ? '10px 12px' : '10px 16px',
        borderRadius: 10,
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        borderLeft: criticalCount > 0 ? '3px solid var(--danger-500, #DC2626)' : '3px solid var(--success, #16A34A)',
        background: criticalCount > 0 ? 'rgba(220,38,38,0.06)' : 'rgba(22,163,74,0.06)',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: criticalCount > 0 ? '#DC2626' : '#16A34A' }}>
          {criticalCount > 0
            ? `${criticalCount} pendiente${criticalCount !== 1 ? 's' : ''} critico${criticalCount !== 1 ? 's' : ''}`
            : 'Todo al corriente — sin pendientes criticos'
          }
        </span>
        {criticalCount > 0 && (
          <Link href={criticalHref} style={{
            padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700,
            background: '#DC2626', color: '#FFFFFF', textDecoration: 'none',
          }}>
            Resolver ahora
          </Link>
        )}
      </div>

      {/* ── DAILY COMPLETION LOOP ── */}
      <div style={{
        padding: isMobile ? '8px 12px' : '8px 16px',
        borderRadius: 8,
        marginBottom: 16,
        background: 'rgba(255,255,255,0.03)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: completionPct === 100 ? '#16A34A' : 'rgba(255,255,255,0.6)' }}>
          Hoy: {completionPct}%{totalActions > 0 ? ` · Faltan ${totalActions} acciones` : ' — excelente dia'}
        </span>
        <div style={{
          flex: 1, minWidth: 100, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.08)',
        }}>
          <div style={{
            width: `${completionPct}%`, height: '100%', borderRadius: 2,
            background: completionPct === 100 ? '#16A34A' : 'var(--gold, #C9A84C)',
            transition: 'width 500ms ease',
          }} />
        </div>
      </div>

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
        bridgeWaitMinutes={data.bridgeWaitMinutes}
        exchangeRate={data.exchangeRate}
        exchangeRateDate={data.exchangeRateDate}
        lastCrossing={data.lastCrossing}
        docsPendientes={data.docsPendientes}
        isMobile={isMobile}
      />

      {/* Activity Pulse — collapsed below cards */}
      <div style={{ marginTop: 16 }}>
        <ActivityPulseSection pulse={pulse} loading={pulseLoading} defaultCollapsed dark={!isMobile} />
      </div>

      <Celebrate trigger={!!lastUpdate && (lastUpdate.estatus || '').toLowerCase().includes('cruz')} />
    </div>
  )
}
