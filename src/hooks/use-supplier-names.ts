'use client'

import { useEffect, useState, useCallback } from 'react'
import { getCompanyIdCookie } from '@/lib/client-config'

/**
 * Fetches globalpc_proveedores once per session.
 * Returns a resolve() function: PRV_526 → "ENTEC POLYMERS LLC"
 */

interface SupplierMap {
  resolve: (raw: string) => string
  resolveAll: (proveedores: string) => string
  loaded: boolean
}

export function useSupplierNames(): SupplierMap {
  const [lookup, setLookup] = useState<Map<string, string>>(new Map())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // Check session cache first
    const cached = sessionStorage.getItem('cruz-supplier-lookup')
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as Array<[string, string]>
        setLookup(new Map(parsed))
        setLoaded(true)
        return
      } catch { /* fall through */ }
    }

    const companyId = getCompanyIdCookie()
    if (!companyId) { setLoaded(true); return }

    fetch(`/api/data?table=globalpc_proveedores&company_id=${companyId}&limit=1000`)
      .then(r => r.json())
      .then(d => {
        const map = new Map<string, string>()
        for (const p of (d.data || [])) {
          if (p.cve_proveedor && p.nombre) {
            map.set(p.cve_proveedor, p.nombre)
          }
        }
        setLookup(map)
        // Cache for session
        try {
          sessionStorage.setItem('cruz-supplier-lookup', JSON.stringify([...map.entries()]))
        } catch { /* storage full */ }
      })
      .catch((err) => console.error('[use-supplier-names] fetch failed:', err.message))
      .finally(() => setLoaded(true))
  }, [])

  const resolve = useCallback((raw: string): string => {
    if (!raw) return '—'
    const trimmed = raw.trim()
    // Cluster K · 2026-04-28: GlobalPC stores placeholder proveedores
    // with nombre like "PROVEEDOR DE <tenant legal name>" — never
    // surface that to a client. Suppress at this resolve site so the
    // entradas table, embarques detail, and any other supplier-name
    // surface get a calm "—" instead of leaking the legal-name string.
    const isPlaceholder = (s: string) => /^\s*PROVEEDOR\s+DE\s+/i.test(s)
    // Already a real name (not a code)
    if (!trimmed.startsWith('PRV_') && trimmed.length > 5 && !/^\d+$/.test(trimmed)) {
      return isPlaceholder(trimmed) ? '—' : trimmed
    }
    // Look up in map
    const name = lookup.get(trimmed)
    if (name) return isPlaceholder(name) ? '—' : name
    // Try without PRV_ prefix then with
    if (!trimmed.startsWith('PRV_')) {
      const withPrefix = lookup.get('PRV_' + trimmed)
      if (withPrefix) return isPlaceholder(withPrefix) ? '—' : withPrefix
    }
    // Never expose raw PRV_ codes — strip prefix for display
    if (trimmed.startsWith('PRV_')) {
      return trimmed.replace(/^PRV_/, 'Proveedor ')
    }
    return trimmed
  }, [lookup])

  const resolveAll = useCallback((proveedores: string): string => {
    if (!proveedores) return '—'
    return proveedores
      .split(',')
      .map(s => resolve(s.trim()))
      .filter(Boolean)
      .join(', ')
  }, [resolve])

  return { resolve, resolveAll, loaded }
}
