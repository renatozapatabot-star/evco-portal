/**
 * Cheap polling endpoint for the topbar status cells.
 * Returns the live exchange rate (Banxico via system_config) and the
 * "lider" bridge — currently the southbound crossing with the shortest
 * recent wait time. The shape is intentionally minimal so the topbar
 * can hammer it every few minutes without DB pressure.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { getExchangeRate } from '@/lib/rates'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

interface BridgeRow {
  bridge_name: string | null
  bridge_code: string | null
  wait_minutes: number | null
  direction: string | null
  recorded_at: string | null
  semaforo: string | null
}

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED' } }, { status: 401 })
  }

  // Exchange rate — null on failure, never throws.
  let exchange: { rate: number; date: string; source: string } | null = null
  try {
    exchange = await getExchangeRate()
  } catch {
    // system_config may be empty; topbar tolerates null and renders dim.
  }

  // Bridges — most recent batch, shortest wait wins. Limit is intentionally
  // generous so we span all crossings written in the same poll cycle.
  const { data: bridgeRows } = await supabase
    .from('bridge_times')
    .select('bridge_name, bridge_code, wait_minutes, direction, recorded_at, semaforo')
    .order('recorded_at', { ascending: false })
    .limit(50)

  const rows = (bridgeRows ?? []) as BridgeRow[]
  // Group by recorded_at hour bucket so we don't mix stale + fresh.
  let leader: BridgeRow | null = null
  if (rows.length > 0) {
    const newest = rows[0]?.recorded_at?.slice(0, 13) // hour resolution
    const sameBatch = rows.filter(r => r.recorded_at?.slice(0, 13) === newest && r.wait_minutes != null)
    leader = sameBatch.reduce<BridgeRow | null>((best, r) => {
      if (!best) return r
      return (r.wait_minutes ?? 9999) < (best.wait_minutes ?? 9999) ? r : best
    }, null)
  }

  const ageMs = leader?.recorded_at ? Date.now() - new Date(leader.recorded_at).getTime() : null
  const stale = ageMs != null && ageMs > 6 * 60 * 60 * 1000 // older than 6h = stale

  return NextResponse.json({
    data: {
      exchange: exchange ? {
        rate: exchange.rate,
        date: exchange.date,
        source: exchange.source,
      } : null,
      bridge: leader ? {
        name: leader.bridge_name ?? leader.bridge_code ?? 'Puente',
        wait_min: leader.wait_minutes,
        direction: leader.direction,
        recorded_at: leader.recorded_at,
        stale,
      } : null,
    },
    error: null,
  }, {
    headers: { 'Cache-Control': 'private, max-age=120' },
  })
}
