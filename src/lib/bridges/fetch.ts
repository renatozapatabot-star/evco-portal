// ZAPATA AI V1.5 · F18 — Bridge wait times fetch + latest-read helpers.
//
// Primary source: CBP bwtRss XML feed (public, no key).
// Fallback: hardcoded plausible values (source='placeholder') when the
// feed fails or BRIDGES_USE_PLACEHOLDER=true.
//
// The feed covers US-bound (northbound) commercial/passenger/ready lanes.
// Southbound (Mexican SAT) is deferred — see V15_F18_AUDIT.md.

import { createClient } from '@supabase/supabase-js'

export type BridgeCode = 'wtb' | 'solidarity' | 'lincoln_juarez' | 'colombia'
export type BridgeDirection = 'northbound' | 'southbound'
export type BridgeLaneType = 'commercial' | 'passenger' | 'fast' | 'ready'

export interface BridgeWait {
  bridge_code: BridgeCode
  bridge_name: string
  direction: BridgeDirection
  lane_type: BridgeLaneType
  wait_minutes: number | null
  source: 'cbp' | 'soia' | 'placeholder'
}

export interface BridgeWaitRow extends BridgeWait {
  id: number
  fetched_at: string
}

const BRIDGE_NAMES: Record<BridgeCode, string> = {
  wtb: 'World Trade',
  solidarity: 'Colombia Solidarity',
  lincoln_juarez: 'Lincoln-Juárez',
  colombia: 'Colombia',
}

// CBP port identifiers for Laredo-area crossings (public bwt feed).
const CBP_PORTS: Array<{ portNumber: string; bridge_code: BridgeCode }> = [
  { portNumber: '2304', bridge_code: 'wtb' },
  { portNumber: '2309', bridge_code: 'solidarity' },
  { portNumber: '2305', bridge_code: 'lincoln_juarez' },
  { portNumber: '2303', bridge_code: 'colombia' },
]

function placeholderWaits(): BridgeWait[] {
  // Plausible rush-hour commercial northbound values (minutes).
  const rows: Array<[BridgeCode, BridgeLaneType, number]> = [
    ['wtb', 'commercial', 25],
    ['wtb', 'passenger', 15],
    ['solidarity', 'commercial', 18],
    ['solidarity', 'passenger', 10],
    ['lincoln_juarez', 'commercial', 12],
    ['lincoln_juarez', 'passenger', 22],
    ['colombia', 'commercial', 45],
    ['colombia', 'passenger', 8],
  ]
  return rows.map(([bridge_code, lane_type, wait_minutes]) => ({
    bridge_code,
    bridge_name: BRIDGE_NAMES[bridge_code],
    direction: 'northbound' as const,
    lane_type,
    wait_minutes,
    source: 'placeholder' as const,
  }))
}

function parseInt10(s: string | null | undefined): number | null {
  if (s == null) return null
  const n = parseInt(String(s).trim(), 10)
  return Number.isFinite(n) ? n : null
}

// Parse the CBP bwtwaittimes JSON-ish payload. The endpoint has varied over
// time; we accept either an RSS-like XML body or a JSON list and extract
// integer delay fields defensively.
function parseCbpJson(payload: unknown): BridgeWait[] {
  const out: BridgeWait[] = []
  const list = Array.isArray(payload) ? payload : []
  for (const { portNumber, bridge_code } of CBP_PORTS) {
    const row = list.find(
      (d): d is Record<string, unknown> =>
        !!d && typeof d === 'object' && String((d as Record<string, unknown>).port_number) === portNumber,
    )
    if (!row) continue
    const commercial = parseInt10(
      String(
        ((row.commercial_vehicle_lanes as Record<string, unknown> | undefined)?.standard_lanes as
          | Record<string, unknown>
          | undefined)?.delay_minutes ?? (row.comm_lanes_delay as string | undefined) ?? '',
      ),
    )
    const passenger = parseInt10(
      String(
        ((row.passenger_vehicle_lanes as Record<string, unknown> | undefined)?.standard_lanes as
          | Record<string, unknown>
          | undefined)?.delay_minutes ?? (row.pass_lanes_delay as string | undefined) ?? '',
      ),
    )
    if (commercial != null) {
      out.push({
        bridge_code,
        bridge_name: BRIDGE_NAMES[bridge_code],
        direction: 'northbound',
        lane_type: 'commercial',
        wait_minutes: commercial,
        source: 'cbp',
      })
    }
    if (passenger != null) {
      out.push({
        bridge_code,
        bridge_name: BRIDGE_NAMES[bridge_code],
        direction: 'northbound',
        lane_type: 'passenger',
        wait_minutes: passenger,
        source: 'cbp',
      })
    }
  }
  return out
}

/**
 * Fetch bridge wait times from CBP or placeholder fallback.
 * Never throws; on any error returns placeholder rows.
 */
export async function fetchBridgeWaitTimes(): Promise<BridgeWait[]> {
  if (process.env.BRIDGES_USE_PLACEHOLDER === 'true') return placeholderWaits()

  try {
    const res = await fetch('https://bwt.cbp.gov/api/bwtwaittimes', {
      headers: { Accept: 'application/json' },
      // No Next cache: the caller decides freshness via DB write-time.
      cache: 'no-store',
    })
    if (!res.ok) return placeholderWaits()
    const json: unknown = await res.json()
    const parsed = parseCbpJson(json)
    return parsed.length > 0 ? parsed : placeholderWaits()
  } catch {
    return placeholderWaits()
  }
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Read most-recent row per (bridge_code, direction, lane_type).
 * Pulls a small recent window and dedupes client-side; rows are bounded
 * by the insert rate (every ~6 min at most).
 */
export async function getLatestBridgeWaits(): Promise<BridgeWaitRow[]> {
  const supabase = serviceClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('bridge_wait_times')
    .select('id, bridge_code, bridge_name, direction, lane_type, wait_minutes, source, fetched_at')
    .gte('fetched_at', since)
    .order('fetched_at', { ascending: false })
    .limit(200)
  if (error || !data) return []
  const seen = new Set<string>()
  const out: BridgeWaitRow[] = []
  for (const r of data) {
    const key = `${r.bridge_code}|${r.direction}|${r.lane_type}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r as BridgeWaitRow)
  }
  return out
}

/**
 * Insert a fresh snapshot batch. Best-effort; returns inserted count.
 */
export async function persistBridgeWaits(waits: BridgeWait[]): Promise<number> {
  if (waits.length === 0) return 0
  const supabase = serviceClient()
  const { data, error } = await supabase
    .from('bridge_wait_times')
    .insert(waits.map(w => ({ ...w, metadata: { event: 'bridge_waits_refreshed' } })))
    .select('id')
  if (error) return 0
  return data?.length ?? 0
}

/** Refresh if the latest row is older than `maxAgeMs`. Returns true if refreshed. */
export async function refreshIfStale(maxAgeMs = 6 * 60 * 1000): Promise<boolean> {
  const latest = await getLatestBridgeWaits()
  if (latest.length > 0) {
    const newest = Math.max(...latest.map(r => new Date(r.fetched_at).getTime()))
    if (Date.now() - newest < maxAgeMs) return false
  }
  const waits = await fetchBridgeWaitTimes()
  await persistBridgeWaits(waits)
  return true
}

export const _internal = { placeholderWaits, parseCbpJson, BRIDGE_NAMES }
