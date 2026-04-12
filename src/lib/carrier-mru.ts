'use client'

/**
 * AGUILA · Block 12 — localStorage wrapper for CarrierSelector MRU cache.
 *
 * Isolated from lib/carriers.ts so the pure helpers stay trivially testable
 * in node. This module touches `window` and is client-only.
 */

import {
  type CarrierSearchResult,
  type CarrierType,
  type MruEntry,
  mruKey,
  pushMru,
} from './carriers'

export function readMru(
  operatorId: string,
  carrierType: CarrierType,
): MruEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(mruKey(operatorId, carrierType))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isMruEntry)
  } catch {
    return []
  }
}

export function writeMru(
  operatorId: string,
  carrierType: CarrierType,
  carrier: CarrierSearchResult,
): MruEntry[] {
  const prev = readMru(operatorId, carrierType)
  const next = pushMru(prev, carrier)
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        mruKey(operatorId, carrierType),
        JSON.stringify(next),
      )
    } catch {
      // Quota exceeded / private mode — silently degrade.
    }
  }
  return next
}

function isMruEntry(v: unknown): v is MruEntry {
  if (!v || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.name === 'string' &&
    typeof r.carrier_type === 'string' &&
    ['mx', 'transfer', 'foreign'].includes(r.carrier_type as string) &&
    typeof r.usedAt === 'number'
  )
}
