/**
 * Sync-health snapshot for the /admin/sync-health dashboard.
 * Returns per-table freshness + per-script last run.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

// Tables we care about — each row fetches MAX(updated_at OR created_at) + count.
const TABLES = [
  { name: 'traficos', timestamp: 'updated_at' },
  { name: 'aduanet_facturas', timestamp: 'created_at' },
  { name: 'globalpc_facturas', timestamp: 'updated_at' },
  { name: 'globalpc_partidas', timestamp: 'created_at' },
  { name: 'globalpc_productos', timestamp: 'created_at' },
  { name: 'globalpc_proveedores', timestamp: 'created_at' },
  { name: 'expediente_documentos', timestamp: 'created_at' },
  { name: 'pipeline_log', timestamp: 'created_at' },
  { name: 'workflow_events', timestamp: 'created_at' },
  { name: 'bridge_times', timestamp: 'recorded_at' },
] as const

interface TableRow {
  name: string
  last_updated: string | null
  row_count: number | null
  age_minutes: number | null
  freshness: 'green' | 'amber' | 'red' | 'unknown'
}

interface ScriptRow {
  step: string
  last_run: string | null
  status: string | null
  duration_ms: number | null
  error_message: string | null
  age_minutes: number | null
  freshness: 'green' | 'amber' | 'red' | 'unknown'
}

function classify(ageMin: number | null): TableRow['freshness'] {
  if (ageMin == null) return 'unknown'
  if (ageMin < 120) return 'green'
  if (ageMin < 24 * 60) return 'amber'
  return 'red'
}

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin' && session.role !== 'broker') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = Date.now()

  // Per-table snapshots in parallel — each is one HEAD count + one limit-1 max-ts query.
  const tables: TableRow[] = await Promise.all(
    TABLES.map(async ({ name, timestamp }) => {
      const [{ count }, { data: latest }] = await Promise.all([
        supabase.from(name).select('*', { head: true, count: 'exact' }),
        supabase.from(name).select(timestamp).order(timestamp, { ascending: false }).limit(1),
      ])
      const lastTs = (latest?.[0] as Record<string, string | null> | undefined)?.[timestamp] ?? null
      const ageMin = lastTs ? Math.round((now - new Date(lastTs).getTime()) / 60000) : null
      return {
        name,
        last_updated: lastTs,
        row_count: count ?? null,
        age_minutes: ageMin,
        freshness: classify(ageMin),
      }
    }),
  )

  // Per-script: latest pipeline_log row per step (last 7 days).
  const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString()
  const { data: logs } = await supabase
    .from('pipeline_log')
    .select('step, status, duration_ms, error_message, created_at')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(2000)

  const seen = new Map<string, ScriptRow>()
  for (const r of (logs ?? []) as Array<{ step: string; status: string | null; duration_ms: number | null; error_message: string | null; created_at: string }>) {
    if (seen.has(r.step)) continue
    const ageMin = r.created_at ? Math.round((now - new Date(r.created_at).getTime()) / 60000) : null
    seen.set(r.step, {
      step: r.step,
      last_run: r.created_at,
      status: r.status,
      duration_ms: r.duration_ms,
      error_message: r.error_message,
      age_minutes: ageMin,
      freshness: classify(ageMin),
    })
  }
  const scripts = Array.from(seen.values()).sort((a, b) => (a.age_minutes ?? Infinity) - (b.age_minutes ?? Infinity))

  return NextResponse.json({
    data: { tables, scripts, generated_at: new Date().toISOString() },
    error: null,
  }, { headers: { 'Cache-Control': 'private, max-age=30' } })
}
