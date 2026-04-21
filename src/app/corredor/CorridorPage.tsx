'use client'

// Block 7 · Corridor Map — client shell. Owns the dynamic-imported Leaflet
// map, the active-traficos fetch + Realtime subscription, and the
// selected-trafico rail state.

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient, type RealtimeChannel } from '@supabase/supabase-js'
import { useTrack } from '@/lib/telemetry/useTrack'
import { BG_DEEP } from '@/lib/design-system'
import { LiveFlowPanel } from '@/components/corridor/LiveFlowPanel'
import { BridgeWaitChips } from '@/components/corridor/BridgeWaitChips'
import { InTransitCard } from '@/components/corridor/InTransitCard'
import { SelectedTraficoRail } from '@/components/corridor/SelectedTraficoRail'
import { CoordinatesHeader } from '@/components/corridor/CoordinatesHeader'
import type { PortalRole } from '@/lib/session'
import type { ActiveTraficoPulse, Landmark } from '@/types/corridor'

const CorridorMap = dynamic(
  () => import('@/components/corridor/CorridorMap').then(m => m.CorridorMap),
  { ssr: false },
)

interface ActiveResponse {
  data: { traficos: ActiveTraficoPulse[] } | null
  error: { code: string; message: string } | null
}

const REFETCH_DEBOUNCE_MS = 1000

export interface CorridorPageProps {
  landmarks: Landmark[]
  companyId: string
  role: PortalRole
}

export function CorridorPage({ landmarks, companyId, role }: CorridorPageProps) {
  const track = useTrack()
  const [pulses, setPulses] = useState<ActiveTraficoPulse[]>([])
  const [selected, setSelected] = useState<ActiveTraficoPulse | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const refetch = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const res = await fetch('/api/corridor/active-traficos', {
        cache: 'no-store',
        signal: ac.signal,
      })
      if (!res.ok) return
      const json = (await res.json()) as ActiveResponse
      if (json.data) setPulses(json.data.traficos)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[corridor] refetch failed', err)
      }
    }
  }, [])

  const scheduleRefetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void refetch()
    }, REFETCH_DEBOUNCE_MS)
  }, [refetch])

  // Telemetry: page_view once.
  useEffect(() => {
    track('page_view', { metadata: { event: 'corridor_viewed', role } })
  }, [track, role])

  // Initial fetch. Deferred via microtask so React isn't setting state
  // synchronously inside the effect body.
  useEffect(() => {
    const id = setTimeout(() => { void refetch() }, 0)
    return () => {
      clearTimeout(id)
      if (abortRef.current) abortRef.current.abort()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [refetch])

  // Realtime on workflow_events filtered by company_id (clients only);
  // internal roles subscribe without filter.
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anon) return

    const supabase = createClient(url, anon)
    const filter = role === 'client' ? `company_id=eq.${companyId}` : undefined
    let channel: RealtimeChannel | null = null
    try {
      const base = supabase.channel(`corridor-events:${companyId}`)
      channel = base
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase-js type lag on postgres_changes payload
          'postgres_changes' as any, // any-ok: supabase-js realtime event name type lacks string literals
          {
            event: 'INSERT',
            schema: 'public',
            table: 'workflow_events',
            ...(filter ? { filter } : {}),
          },
          (payload: { new?: { trigger_id?: string; event_type?: string } }) => {
            const triggerId = payload?.new?.trigger_id
            const eventType = payload?.new?.event_type
            track('page_view', {
              metadata: {
                event: 'corridor_realtime_update_received',
                traficoId: triggerId,
                event_type: eventType,
              },
            })
            scheduleRefetch()
          },
        )
        .subscribe((status: string, err?: Error) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('cruz:realtime-degraded', {
                detail: { source: 'corredor', reason: status, error: err?.message },
              }))
            }
          }
        })
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[corridor] realtime subscribe setup failed', err)
      }
    }

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [companyId, role, scheduleRefetch, track])

  const handlePulseClick = useCallback(
    (pulse: ActiveTraficoPulse) => {
      setSelected(pulse)
      track('page_view', {
        metadata: {
          event: 'corridor_pulse_clicked',
          traficoId: pulse.traficoId,
          landmarkId: pulse.position.landmark_id,
          severity: pulse.position.severity,
        },
      })
    },
    [track],
  )

  const handleLandmarkHover = useCallback(
    (id: string) => {
      track('page_view', { metadata: { event: 'corridor_landmark_hovered', landmarkId: id } })
    },
    [track],
  )

  const handleRotate = useCallback(
    (traficoId: string) => {
      track('page_view', { metadata: { event: 'corridor_liveflow_rotated', traficoId } })
    },
    [track],
  )

  const handleAction = useCallback(
    (action: 'pedimento' | 'expediente' | 'cronologia' | 'close', traficoId: string) => {
      if (action === 'close') return
      track('page_view', {
        metadata: { event: 'corridor_selected_trafico_action', action, traficoId },
      })
    },
    [track],
  )

  const stats = useMemo(() => {
    const total = pulses.length
    const known = pulses.filter(p => p.latestEvent !== null).length
    return { total, known }
  }, [pulses])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: BG_DEEP,
        overflow: 'hidden',
      }}
    >
      <CorridorMap
        landmarks={landmarks}
        pulses={pulses}
        onPulseClick={handlePulseClick}
        onLandmarkHover={handleLandmarkHover}
      />
      <CoordinatesHeader />
      <BridgeWaitChips />
      <LiveFlowPanel
        shipments={stats.total}
        knownPositions={stats.known}
        totalPositions={Math.max(stats.total, 1)}
      />
      <InTransitCard pulses={pulses} onRotate={handleRotate} />
      <SelectedTraficoRail
        pulse={selected}
        onClose={() => setSelected(null)}
        onAction={handleAction}
      />
    </div>
  )
}

export default CorridorPage
