'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useCommandCenterData } from '@/hooks/use-command-center-data'
import { useActivityPulse } from '@/hooks/use-activity-pulse'
import { useRealtimeTrafico } from '@/hooks/use-realtime-trafico'
import { useIsMobile } from '@/hooks/use-mobile'
import { useStatusSentence } from '@/hooks/use-status-sentence'
import { playSound } from '@/lib/sounds'
import { MissionHeader, getMoodFromCounts } from './MissionHeader'
import { WorkflowGrid } from './WorkflowGrid'
import { ActivityPulseSection } from './ActivityPulseSection'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton'
import { Celebrate } from '@/components/celebrate'

function buildStatusSentence(enProceso: number, urgentes: number, cruzadosHoy: number): string {
  if (enProceso === 0 && cruzadosHoy === 0) {
    return 'Sin operaciones activas. Estamos listos.'
  }
  const parts: string[] = []
  if (enProceso > 0) parts.push(`${enProceso} en ruta`)
  if (urgentes > 0) parts.push(`${urgentes} requiere${urgentes !== 1 ? 'n' : ''} atención`)
  if (cruzadosHoy > 0) parts.push(`${cruzadosHoy} cruzó hoy`)
  if (enProceso > 0 && urgentes === 0) return `Todo en orden — ${parts.join(', ')}.`
  return parts.join(' · ')
}

function buildQuickAction(urgentes: number, pendingEntradas: number): { label: string; href: string } | null {
  if (urgentes > 0) {
    return { label: `Ver ${urgentes} urgente${urgentes !== 1 ? 's' : ''}`, href: '/traficos?estatus=En+Proceso' }
  }
  if (pendingEntradas > 0) {
    return { label: `${pendingEntradas} entrada${pendingEntradas !== 1 ? 's' : ''} sin asignar`, href: '/entradas' }
  }
  return null
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
    const msg = isCrossed
      ? `${lastUpdate.trafico} acaba de cruzar. Todo en orden.`
      : `${lastUpdate.trafico}: ${lastUpdate.estatus}`
    show(msg)
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

  const mood = getMoodFromCounts(data.enProceso, data.urgentes || status.urgentes)
  const sentence = loading ? '' : buildStatusSentence(data.enProceso, data.urgentes || status.urgentes, data.cruzadosHoy || status.cruzadosHoy)
  const quickAction = buildQuickAction(data.urgentes || status.urgentes, data.pendingEntradas.length)

  const openChat = () => {
    document.dispatchEvent(new CustomEvent('cruz:open-chat'))
  }

  if (error) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
        <ErrorCard message={error} onRetry={reload} />
      </div>
    )
  }

  if (loading) {
    return <DashboardSkeleton isMobile={isMobile} />
  }

  // ── WHILE YOU WERE AWAY ──
  const awayBanner = awaySummary && awaySummary.total > 0 ? (
    <div style={{
      padding: '16px 20px',
      borderRadius: 12,
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderLeft: '3px solid #0D9488',
      margin: '0 24px 16px',
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
        onClick={dismissAway}
        style={{
          marginTop: 8, fontSize: 11, fontWeight: 600,
          color: 'var(--text-muted)', background: 'none',
          border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        Entendido
      </button>
    </div>
  ) : null

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', overflowX: 'hidden', paddingBottom: 60 }}>
      {/* Realtime toast */}
      {realtimeToast && (
        <div style={{
          padding: '10px 16px', borderRadius: 10,
          background: '#0D9488', color: '#FFFFFF', fontSize: 13, fontWeight: 600,
          margin: '0 24px 8px', animation: 'fadeInUp 200ms ease',
        }}>
          {realtimeToast}
        </div>
      )}

      {/* Dark Hero Header */}
      <MissionHeader
        mood={mood}
        sentence={sentence}
        quickAction={quickAction}
        onAvatarClick={openChat}
        loading={loading}
      />

      {/* While You Were Away */}
      {awayBanner}

      {/* Workflow Cards — two-tier layout */}
      <WorkflowGrid
        enProceso={data.enProceso}
        urgentes={data.urgentes || status.urgentes}
        pendingEntradas={data.pendingEntradas.length}
        inventarioBultos={data.inventarioBultos}
      />

      {/* Activity Pulse */}
      <div style={{ marginTop: 24 }}>
        <ActivityPulseSection pulse={pulse} loading={pulseLoading} defaultCollapsed={isMobile} />
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '32px 24px 0' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Patente 3596 · Aduana 240
        </div>
      </div>

      <Celebrate trigger={!!lastUpdate && (lastUpdate.estatus || '').toLowerCase().includes('cruz')} />
    </div>
  )
}
