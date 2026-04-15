'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getCompanyIdCookie } from '@/lib/client-config'
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
    const companyId = getCompanyIdCookie()
    companyIdRef.current = companyId

    // supabase-js realtime overload types require the literal cast below;
    // dropping the cast breaks generic inference on .on(). Tracked in supabase-js.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const channel = supabase
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
      .subscribe()
    /* eslint-enable @typescript-eslint/no-explicit-any */

    setUpdatedAt(new Date())

    return () => {
      supabase.removeChannel(channel)
    }
  }, [handleTraficoUpdate, handleEntradaUpdate])

  return { lastUpdate, lastEntradaUpdate, updatedAt }
}
