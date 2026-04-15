/**
 * ZAPATA AI · Block 12 — Carriers master catalog library.
 *
 * Pure types + zod schemas + MRU cache helpers. UI components and API
 * routes import from here; no IO lives at this layer.
 */

import { z } from 'zod'

export type CarrierType = 'mx' | 'transfer' | 'foreign'

export const CARRIER_TYPES: readonly CarrierType[] = ['mx', 'transfer', 'foreign']

export interface CarrierSearchResult {
  id: string
  name: string
  rfc: string | null
  sct_permit: string | null
  carrier_type: CarrierType
}

export interface CarrierFull extends CarrierSearchResult {
  dot_number: string | null
  scac_code: string | null
  active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

// === zod ===

const CarrierTypeSchema = z.enum(['mx', 'transfer', 'foreign'])

export const CarrierSearchQuerySchema = z.object({
  q: z.string().max(120).optional().default(''),
  type: CarrierTypeSchema.optional(),
  onlyActive: z.boolean().optional().default(true),
  limit: z.number().int().min(1).max(25).optional().default(5),
})
export type CarrierSearchQuery = z.infer<typeof CarrierSearchQuerySchema>

export const CarrierCreateSchema = z.object({
  carrier_type: CarrierTypeSchema,
  name: z.string().min(2).max(160),
  rfc: z.string().min(10).max(13).nullish(),
  sct_permit: z.string().max(40).nullish(),
  dot_number: z.string().max(20).nullish(),
  scac_code: z.string().min(2).max(8).nullish(),
  active: z.boolean().optional().default(true),
  notes: z.string().max(500).nullish(),
})
export type CarrierCreate = z.infer<typeof CarrierCreateSchema>

export const CarrierUpdateSchema = CarrierCreateSchema.partial()
export type CarrierUpdate = z.infer<typeof CarrierUpdateSchema>

// === MRU cache (pure helpers — UI wires localStorage) ===

export const MRU_MAX = 10
export const MRU_STORAGE_PREFIX = 'aguila:carrier-mru:'

export interface MruEntry {
  id: string
  name: string
  rfc: string | null
  sct_permit: string | null
  carrier_type: CarrierType
  usedAt: number
}

export function mruKey(operatorId: string, carrierType: CarrierType): string {
  return `${MRU_STORAGE_PREFIX}${operatorId}:${carrierType}`
}

/**
 * Pure: push a carrier to the front, dedupe by id, cap at MRU_MAX.
 * UI passes the previous list (from storage) and writes back.
 */
export function pushMru(
  previous: readonly MruEntry[],
  carrier: CarrierSearchResult,
  now: number = Date.now(),
): MruEntry[] {
  const entry: MruEntry = {
    id: carrier.id,
    name: carrier.name,
    rfc: carrier.rfc,
    sct_permit: carrier.sct_permit,
    carrier_type: carrier.carrier_type,
    usedAt: now,
  }
  const filtered = previous.filter(p => p.id !== carrier.id)
  return [entry, ...filtered].slice(0, MRU_MAX)
}

/**
 * Pure: order = MRU first (newest → oldest), then fresh results without dupes.
 * Applied when the query string is empty (we show recent selections).
 */
export function mergeMruAndResults(
  mru: readonly MruEntry[],
  results: readonly CarrierSearchResult[],
): CarrierSearchResult[] {
  const seen = new Set<string>()
  const ordered: CarrierSearchResult[] = []
  for (const m of mru) {
    if (seen.has(m.id)) continue
    seen.add(m.id)
    ordered.push({
      id: m.id,
      name: m.name,
      rfc: m.rfc,
      sct_permit: m.sct_permit,
      carrier_type: m.carrier_type,
    })
  }
  for (const r of results) {
    if (seen.has(r.id)) continue
    seen.add(r.id)
    ordered.push(r)
  }
  return ordered
}

// === client fetch helper ===

export async function searchCarriers(
  params: { q?: string; type?: CarrierType; limit?: number },
  fetchImpl: typeof fetch = fetch,
): Promise<CarrierSearchResult[]> {
  const sp = new URLSearchParams()
  if (params.q) sp.set('q', params.q)
  if (params.type) sp.set('type', params.type)
  if (params.limit) sp.set('limit', String(params.limit))
  const res = await fetchImpl(`/api/carriers/search?${sp.toString()}`)
  if (!res.ok) return []
  const body = (await res.json()) as { data?: CarrierSearchResult[] | null }
  return body.data ?? []
}
