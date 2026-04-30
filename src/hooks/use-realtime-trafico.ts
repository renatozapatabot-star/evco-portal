'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { haptic } from '@/hooks/use-haptic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface TraficoUpdate {
  trafico: string
  estatus: string
  previous_estatus?: string
  timestamp: string
}

interface EntradaUpdate {
  cve_entrada: string
  pipeline_status?: string
  timestamp: string
}

/**
 * Subscribe to real-time embarque + entrada status changes for current company.
 * Returns latest updates for both entity types.
 */
export function useRealtimeTrafico() {
  const [lastUpdate, setLastUpdate] = useState<TraficoUpdate | null>(null)
  const [lastEntradaUpdate, setLastEntradaUpdate] = useState<EntradaUpdate | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [channelHealthy, setChannelHealthy] = useState(true)
  const companyIdRef = useRef('')

  const handleTraficoUpdate = useCallback((payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
    const newRow = payload.new
    const oldRow = payload.old
    const newEstatus = String(newRow.estatus || '')
    const oldEstatus = String(oldRow?.estatus || '')

    // Only fire on actual status changes
    if (newEstatus && newEstatus !== oldEstatus) {
      const traficoId = String(newRow.trafico || '')
      setLastUpdate({
        trafico: traficoId,
        estatus: newEstatus,
        previous_estatus: oldEstatus || undefined,
        timestamp: new Date().toISOString(),
      })
      setUpdatedAt(new Date())

      // Slide-in notification for trafico status changes
      if (typeof document !== 'undefined') {
        const isCrossed = newEstatus.toLowerCase().includes('cruz')
        haptic.notify()
        document.dispatchEvent(new CustomEvent('cruz:notification-slide', {
          detail: {
            title: isCrossed ? `${traficoId} cruzado` : `${traficoId}: ${newEstatus}`,
            description: isCrossed ? 'Cruce exitoso — todo en orden' : `Cambio de estatus: ${oldEstatus} → ${newEstatus}`,
            severity: isCrossed ? 'success' : 'info',
            href: `/embarques/${encodeURIComponent(traficoId)}`,
          },
        }))
      }
    }
  }, [])

  const handleEntradaUpdate = useCallback((payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
    const newRow = payload.new
    const entradaId = String(newRow.cve_entrada || '')
    setLastEntradaUpdate({
      cve_entrada: entradaId,
      pipeline_status: String(newRow.pipeline_status || ''),
      timestamp: new Date().toISOString(),
    })
    setUpdatedAt(new Date())

    // Slide-in notification for new entradas
    if (typeof document !== 'undefined' && entradaId) {
      haptic.notify()
      document.dispatchEvent(new CustomEvent('cruz:notification-slide', {
        detail: {
          title: `Nueva entrada: ${entradaId}`,
          description: String(newRow.proveedor || 'Mercancía recibida'),
          severity: 'info',
          href: '/entradas',
        },
      }))
    }
  }, [])

  useEffect(() => {
    // Resolve tenant scope from the signed HMAC session, not a forgeable
    // cookie (baseline-2026-04-20 I20 contract extended to the browser).
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    ;(async () => {
      let companyId = ''
      try {
        const res = await fetch('/api/session/scope', { cache: 'no-store', credentials: 'include' })
        if (res.ok) {
          const body = await res.json()
          companyId = String(body.companyId || '')
        }
      } catch {
        // If the endpoint fails we leave companyId empty — the subscribe
        // below will never fire (filter is required) and channelHealthy
        // stays false, which is the honest signal.
      }
      if (cancelled || !companyId) {
        setChannelHealthy(false)
        return
      }
      companyIdRef.current = companyId

    // supabase-js realtime overload types require the literal cast below;
    // dropping the cast breaks generic inference on .on(). Tracked in supabase-js.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    channel = supabase
      .channel('cruz-realtime')
      .on(
        'postgres_changes' as any, // any-ok: supabase-js realtime event name type lacks string literals
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'traficos',
          filter: `company_id=eq.${companyId}`,
        },
        handleTraficoUpdate
      )
      .on(
        'postgres_changes' as any, // any-ok: supabase-js realtime event name type lacks string literals
        {
          event: '*',
          schema: 'public',
          table: 'entradas',
          filter: `company_id=eq.${companyId}`,
        },
        handleEntradaUpdate
      )
      .subscribe((status: string, err?: Error) => {
        // Surface subscription health so the UI can switch the
        // "En línea" pill to amber instead of silently showing
        // stale data when Realtime drops.
        if (status === 'SUBSCRIBED') {
          setChannelHealthy(true)
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setChannelHealthy(false)
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cruz:realtime-degraded', {
              detail: { source: 'cruz-realtime', reason: status, error: err?.message },
            }))
          }
        }
      })
    /* eslint-enable @typescript-eslint/no-explicit-any */

      setUpdatedAt(new Date())
    })()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [handleTraficoUpdate, handleEntradaUpdate])

  return { lastUpdate, lastEntradaUpdate, updatedAt, channelHealthy }
}
