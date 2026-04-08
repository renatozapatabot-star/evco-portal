'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
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
  if (enProceso > 0) {
    parts.push(`${enProceso} en ruta`)
  }
  if (urgentes > 0) {
    parts.push(`${urgentes} requiere${urgentes !== 1 ? 'n' : ''} atención`)
  }
  if (cruzadosHoy > 0) {
    parts.push(`${cruzadosHoy} cruzó hoy`)
  }
  if (enProceso > 0 && urgentes === 0) {
    return `Todo en orden — ${parts.join(', ')}.`
  }
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

/**
 * Realtime toast that auto-dismisses. Uses ref + callback to avoid
 * the React Compiler "setState in effect" lint rule.
 */
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
      <div className="page-shell" style={{ maxWidth: 960 }}>
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

  // ── EMPTY STATE — no active operations ──
  const emptyCard = data.traficos.length === 0 ? (
    <Link
      href="/documentos"
      style={{
        display: 'block',
        margin: '0 20px 12px',
        padding: '20px',
        borderRadius: 12,
        background: 'var(--bg-card)',
        border: '2px solid var(--gold, #C9A84C)',
        textDecoration: 'none',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
        Iniciar nueva operación
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Envíe documentos para comenzar &rarr;
      </div>
    </Link>
  ) : null

  // ── DESKTOP TWO-COLUMN / MOBILE SINGLE-COLUMN ──
  if (!isMobile) {
    return (
      <div className="page-shell" style={{ maxWidth: 1100, overflowX: 'hidden' }}>
        {/* Realtime toast */}
        {realtimeToast && (
          <div style={{
            padding: '10px 16px', borderRadius: 10,
            background: '#0D9488', color: '#FFFFFF', fontSize: 13, fontWeight: 600,
            margin: '0 20px 16px', animation: 'fadeInUp 200ms ease',
          }}>
            {realtimeToast}
          </div>
        )}

        {/* Mission Header — full width */}
        <MissionHeader
          mood={mood}
          sentence={sentence}
          quickAction={quickAction}
          onAvatarClick={openChat}
          loading={loading}
        />

        {emptyCard}

        {/* Two-column grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: 24,
          padding: '0 0 40px',
          alignItems: 'start',
        }}>
          {/* Left: Workflow Cards */}
          <WorkflowGrid
            enProceso={data.enProceso}
            urgentes={data.urgentes || status.urgentes}
            pendingEntradas={data.pendingEntradas.length}
          />

          {/* Right: Activity Pulse + Away Banner */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 20 }}>
            {awayBanner && <div style={{ padding: '0 20px' }}>{awayBanner}</div>}
            <ActivityPulseSection pulse={pulse} loading={pulseLoading} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '0 20px 60px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Patente 3596 · Aduana 240
          </div>
        </div>

        <Celebrate trigger={!!lastUpdate && (lastUpdate.estatus || '').toLowerCase().includes('cruz')} />
      </div>
    )
  }

  // ── MOBILE LAYOUT ──
  return (
    <div className="page-shell" style={{ maxWidth: 700, overflowX: 'hidden' }}>
      {/* Realtime toast */}
      {realtimeToast && (
        <div style={{
          padding: '10px 16px', borderRadius: 10,
          background: '#0D9488', color: '#FFFFFF', fontSize: 13, fontWeight: 600,
          margin: '0 20px 16px', animation: 'fadeInUp 200ms ease',
        }}>
          {realtimeToast}
        </div>
      )}

      {/* Mission Header */}
      <MissionHeader
        mood={mood}
        sentence={sentence}
        quickAction={quickAction}
        onAvatarClick={openChat}
        loading={loading}
      />

      {/* While You Were Away */}
      {awayBanner && <div style={{ padding: '0 20px', marginBottom: 12 }}>{awayBanner}</div>}

      {emptyCard}

      {/* Workflow Cards — urgency sorted */}
      <WorkflowGrid
        enProceso={data.enProceso}
        urgentes={data.urgentes || status.urgentes}
        pendingEntradas={data.pendingEntradas.length}
      />

      {/* Activity Pulse — collapsed by default on mobile */}
      <div style={{ marginTop: 20 }}>
        <ActivityPulseSection pulse={pulse} loading={pulseLoading} defaultCollapsed />
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '40px 20px 60px' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Patente 3596 · Aduana 240
        </div>
      </div>

      <Celebrate trigger={!!lastUpdate && (lastUpdate.estatus || '').toLowerCase().includes('cruz')} />
    </div>
  )
}
