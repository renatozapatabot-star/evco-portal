'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'

interface CockpitAction {
  id: string
  operator_id: string
  action_type: string
  payload: Record<string, unknown> | null
  created_at: string
}

interface UseCockpitRealtimeReturn {
  latestAction: CockpitAction | null
  actionCountSinceMount: number
  isLive: boolean
}

/**
 * Subscribe to operator_actions table for live team activity.
 * Debounces at 1 update/second to prevent storms on bulk operations.
 *
 * Tenant scope resolved from the signed HMAC session via
 * `/api/session/scope` before the subscription installs.
 * Cross-tenant events are filtered server-side via
 * `company_id=eq.${companyId}` — defense-in-depth beyond RLS.
 */
export function useCockpitRealtime(enabled = true): UseCockpitRealtimeReturn {
  const [latestAction, setLatestAction] = useState<CockpitAction | null>(null)
  const [actionCount, setActionCount] = useState(0)
  const [isLive, setIsLive] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    type ChannelType = ReturnType<ReturnType<typeof createBrowserSupabaseClient>['channel']>
    let channel: ChannelType | null = null
    const sb = createBrowserSupabaseClient()

    ;(async () => {
      let companyId = ''
      try {
        const res = await fetch('/api/session/scope', { cache: 'no-store', credentials: 'include' })
        if (res.ok) {
          const body = await res.json()
          companyId = String(body.companyId || '')
        }
      } catch { /* keep empty — skip subscription */ }
      if (cancelled || !companyId) {
        setIsLive(false)
        return
      }

      channel = sb.channel(`cockpit-realtime:${companyId}`)
      channel
        .on(
          'postgres_changes' as 'system',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'operator_actions',
            filter: `company_id=eq.${companyId}`,
          },
          (payload: { new: Record<string, unknown> }) => {
            // Debounce: only process 1 update per second
            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => {
              const action = payload.new as unknown as CockpitAction
              setLatestAction(action)
              setActionCount(c => c + 1)
            }, 200)
          },
        )
        .subscribe((status: string, err?: Error) => {
          setIsLive(status === 'SUBSCRIBED')
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('cruz:realtime-degraded', {
                detail: { source: 'cockpit-realtime', reason: status, error: err?.message },
              }))
            }
          }
        })
    })()

    return () => {
      cancelled = true
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (channel) sb.removeChannel(channel)
    }
  }, [enabled])

  return { latestAction, actionCountSinceMount: actionCount, isLive }
}

/**
 * Subscribe to traficos status changes for live crossing alerts.
 */
export function useTraficoRealtime(companyId?: string, enabled = true) {
  const [lastCrossing, setLastCrossing] = useState<{ trafico: string; estatus: string } | null>(null)

  useEffect(() => {
    if (!enabled) return

    const sb = createBrowserSupabaseClient()
    const filter = companyId ? `company_id=eq.${companyId}` : undefined
    const channel = sb.channel('traficos-live')

    channel
      .on(
        'postgres_changes' as 'system',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'traficos',
          ...(filter ? { filter } : {}),
        },
        (payload: { new: Record<string, unknown> }) => {
          const t = payload.new
          if (String(t.estatus || '').toLowerCase().includes('cruz')) {
            setLastCrossing({
              trafico: String(t.trafico || ''),
              estatus: String(t.estatus || ''),
            })
          }
        },
      )
      .subscribe((status: string, err?: Error) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cruz:realtime-degraded', {
              detail: { source: 'traficos-live', reason: status, error: err?.message },
            }))
          }
        }
      })

    return () => { sb.removeChannel(channel) }
  }, [companyId, enabled])

  return lastCrossing
}
