'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getCompanyIdCookie } from '@/lib/client-config'

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
 * Subscribe to real-time tráfico + entrada status changes for current company.
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
      setLastUpdate({
        trafico: String(newRow.trafico || ''),
        estatus: newEstatus,
        previous_estatus: oldEstatus || undefined,
        timestamp: new Date().toISOString(),
      })
      setUpdatedAt(new Date())
    }
  }, [])

  const handleEntradaUpdate = useCallback((payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
    const newRow = payload.new
    setLastEntradaUpdate({
      cve_entrada: String(newRow.cve_entrada || ''),
      pipeline_status: String(newRow.pipeline_status || ''),
      timestamp: new Date().toISOString(),
    })
    setUpdatedAt(new Date())
  }, [])

  useEffect(() => {
    const companyId = getCompanyIdCookie()
    companyIdRef.current = companyId

    const channel = supabase
      .channel('cruz-realtime')
      .on(
        'postgres_changes' as any,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'traficos',
          filter: `company_id=eq.${companyId}`,
        },
        handleTraficoUpdate
      )
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'entradas',
          filter: `company_id=eq.${companyId}`,
        },
        handleEntradaUpdate
      )
      .subscribe()

    setUpdatedAt(new Date())

    return () => {
      supabase.removeChannel(channel)
    }
  }, [handleTraficoUpdate, handleEntradaUpdate])

  return { lastUpdate, lastEntradaUpdate, updatedAt }
}
