'use client'

import { useCallback, useState } from 'react'
import { getCookieValue } from '@/lib/client-config'

/**
 * v3 Session Cache — caches fetch responses in sessionStorage.
 * Key format: cruz_cache_{page}_{company_id}
 * TTL: 30 minutes (stale data better than no data).
 *
 * Returns `refreshing` flag for cache-then-refresh pattern:
 *   show cached → show "Actualizando..." → fade in fresh data
 */
export function useSessionCache() {
  const companyId = typeof document !== 'undefined' ? getCookieValue('company_id') || '' : ''
  const [refreshing, setRefreshing] = useState(false)

  const getCached = useCallback(<T>(page: string): T | null => {
    try {
      const key = `cruz_cache_${page}_${companyId}`
      const raw = sessionStorage.getItem(key)
      if (!raw) return null
      const { data, ts } = JSON.parse(raw)
      const age = Date.now() - ts
      if (age > 30 * 60 * 1000) {
        sessionStorage.removeItem(key)
        return null
      }
      return data as T
    } catch {
      return null
    }
  }, [companyId])

  const setCache = useCallback(<T>(page: string, data: T) => {
    try {
      const key = `cruz_cache_${page}_${companyId}`
      sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }))
    } catch {
      // sessionStorage full or unavailable — silent
    }
  }, [companyId])

  const startRefresh = useCallback(() => setRefreshing(true), [])
  const endRefresh = useCallback(() => setRefreshing(false), [])

  return { getCached, setCache, refreshing, startRefresh, endRefresh }
}
