'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import { fmtDate, fmtDateTime } from '@/lib/format-utils'
import { GOLD_GRADIENT, TEXT_PRIMARY, TEXT_MUTED, BG_CARD, BORDER, TEXT_SECONDARY, GREEN, ACCENT_CYAN } from '@/lib/design-system'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { OperatorHeroStrip } from './OperatorHeroStrip'
import { FlowCard } from './FlowCard'
import { OperatorRightRail } from './OperatorRightRail'
import type { TeamMember } from '@/types/cockpit'
import type { WorkflowEvent } from '@/app/operador/cola/ExceptionCard'

interface OperatorCockpitProps {
  operatorName: string
  operatorId: string
  // Hero
  urgentCount: number
  normalCount: number
  completedToday: number
  streak: number
  // Flow
  topException: WorkflowEvent | null
  queuePreview: WorkflowEvent[]
  // Rail
  team: TeamMember[]
  // Below fold
  assignedCount: number
  completedCount: number
  recentClassifications: Array<Record<string, string | null>>
  recentEntradas: Array<Record<string, string | number | null>>
}

export function OperatorCockpit(props: OperatorCockpitProps) {
  const [heroData, setHeroData] = useState({
    urgentCount: props.urgentCount,
    normalCount: props.normalCount,
    completedToday: props.completedToday,
    streak: props.streak,
  })
  const [topException, setTopException] = useState(props.topException)
  const [queuePreview, setQueuePreview] = useState(props.queuePreview)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshData = useCallback(async () => {
    const sb = createBrowserSupabaseClient()
    const now = new Date()
    const twoHoursAgo = new Date(now.getTime() - 2 * 3600000).toISOString()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

    const [queueRes, completedRes] = await Promise.all([
      sb.from('workflow_events')
        .select('id, workflow, event_type, trigger_id, company_id, payload, status, created_at, error_message, attempt_count')
        .in('status', ['pending', 'failed', 'dead_letter'])
        .order('created_at', { ascending: true })
        .limit(50),
      sb.from('workflow_events')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('created_at', todayStart),
    ])

    const events = (queueRes.data || []) as WorkflowEvent[]
    let urg = 0, norm = 0
    for (const e of events) {
      const ageH = (now.getTime() - new Date(e.created_at).getTime()) / 3600000
      if (ageH > 2) urg++
      else norm++
    }

    setHeroData(prev => ({
      ...prev,
      urgentCount: urg,
      normalCount: norm,
      completedToday: completedRes.count || prev.completedToday,
    }))

    setTopException(events[0] || null)
    setQueuePreview(events.slice(1, 6))
  }, [])

  // Realtime subscription
  useEffect(() => {
    const sb = createBrowserSupabaseClient()
    const channel = sb.channel('operator-cockpit')

    channel
      .on('postgres_changes' as 'system', { event: '*', schema: 'public', table: 'workflow_events' }, () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => refreshData(), 1000)
      })
      .subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      sb.removeChannel(channel)
    }
  }, [refreshData])

  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: TEXT_PRIMARY, minHeight: '100vh' }} className="p-4 md:px-7 md:py-6">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={{
            width: 36, height: 36, background: GOLD_GRADIENT,
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 900, color: '#0D0D0C', fontFamily: 'Georgia, serif',
          }}>Z</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            {props.operatorName}
          </h1>
        </div>
        <p style={{ color: TEXT_MUTED, fontSize: 13, margin: '4px 0 0 48px' }}>
          Operaciones · <span style={{ fontFamily: 'var(--font-mono)' }}>{fmtDate(new Date())}</span>
        </p>
      </div>

      {/* Hero strip */}
      <OperatorHeroStrip
        urgentes={heroData.urgentCount}
        normales={heroData.normalCount}
        completadasHoy={heroData.completedToday}
        racha={heroData.streak}
      />

      {/* Main: Flow Card + Right Rail */}
      <div style={{ marginBottom: 20 }}>
        <style>{`
          @media (max-width: 1024px) {
            .op-main-layout { flex-direction: column !important; }
            .op-main-layout > * { flex: 1 1 100% !important; }
          }
        `}</style>
        <div className="op-main-layout" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ flex: '3 1 0' }}>
            <FlowCard
              event={topException}
              operatorName={props.operatorName}
              onResolved={refreshData}
            />
          </div>
          <div style={{ flex: '2 1 0', minWidth: 280 }}>
            <OperatorRightRail
              queuePreview={queuePreview}
              team={props.team}
            />
          </div>
        </div>
      </div>

      {/* Below fold */}
      <CollapsibleSection title="Mi dia" badge={`${props.assignedCount} asignados · ${props.completedCount} completados`}>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Asignados</div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-mono)', color: TEXT_PRIMARY }}>{props.assignedCount}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Completados</div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-mono)', color: GREEN }}>{props.completedCount}</div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Clasificaciones recientes" badge={props.recentClassifications.length} hidden={props.recentClassifications.length === 0}>
        <div style={{ padding: '8px 16px' }}>
          {props.recentClassifications.map((c, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 0',
              borderBottom: i < props.recentClassifications.length - 1 ? `1px solid ${BORDER}` : 'none',
              fontSize: 12,
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: ACCENT_CYAN, fontWeight: 700, flexShrink: 0 }}>
                {c.fraccion || '\u2014'}
              </span>
              <span style={{ color: TEXT_SECONDARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {c.descripcion || c.description || '\u2014'}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', color: TEXT_MUTED, fontSize: 10, flexShrink: 0 }}>
                {c.fraccion_classified_at ? fmtDateTime(c.fraccion_classified_at) : ''}
              </span>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Entradas recientes" badge={props.recentEntradas.length} hidden={props.recentEntradas.length === 0}>
        <div style={{ padding: '8px 16px' }}>
          {props.recentEntradas.map((e, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 0',
              borderBottom: i < props.recentEntradas.length - 1 ? `1px solid ${BORDER}` : 'none',
              fontSize: 12,
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: TEXT_PRIMARY, flexShrink: 0 }}>
                {String(e.cve_entrada || '')}
              </span>
              <span style={{ color: TEXT_SECONDARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {String(e.descripcion_mercancia || '').substring(0, 50)}
              </span>
              <span style={{ color: TEXT_MUTED, fontSize: 10, flexShrink: 0 }}>
                {e.cantidad_bultos ? `${e.cantidad_bultos} bultos` : ''}
              </span>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  )
}
