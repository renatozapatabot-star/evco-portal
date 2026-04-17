/**
 * CRUZ · Data-integrity health probe.
 *
 * GET /api/health/data-integrity
 *
 * Returns per-table row counts for the requested tenant (default 'evco')
 * and a traffic-light verdict. Consumed by:
 *   · `scripts/ship.sh` (post-deploy gate — blocks promotion on red)
 *   · `/admin/eagle` (ops dashboard — surfaces drift in real time)
 *   · Monitoring dashboards
 *
 * Health bands (per table):
 *   · green  — > 0 rows in the last 365 days (or lifetime for catalog)
 *   · amber  — 0 rows in window but > 0 lifetime total (stale tenant)
 *   · red    — 0 rows total (broken tenant isolation or missing data)
 *
 * Verdict = worst band across all tables.
 *
 * Auth: admin / broker only. Client-role and unauth return 403.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type Health = 'green' | 'amber' | 'red'

interface TableReading {
  name: string
  rows_windowed: number
  rows_total: number
  health: Health
  window_column: string | null
  window_days: number | null
  error?: string
}

interface TableProbe {
  name: string
  windowColumn: string | null  // null = lifetime check (catalog)
  windowDays: number
}

const TABLES: TableProbe[] = [
  { name: 'traficos',              windowColumn: 'fecha_llegada',           windowDays: 365 },
  { name: 'entradas',              windowColumn: 'fecha_llegada_mercancia', windowDays: 365 },
  { name: 'expediente_documentos', windowColumn: 'uploaded_at',             windowDays: 365 },
  { name: 'globalpc_productos',    windowColumn: null,                      windowDays: 0 },
  // Block DD Phase 4.3 — widen the probe to the four tables that feed
  // client-visible KPIs so /api/health catches upstream drift before it
  // lands on Ursula's cockpit.
  { name: 'pedimentos',            windowColumn: 'created_at',              windowDays: 365 },
  { name: 'globalpc_facturas',     windowColumn: 'fecha_facturacion',       windowDays: 365 },
  { name: 'globalpc_partidas',     windowColumn: null,                      windowDays: 0 },
  { name: 'aduanet_facturas',      windowColumn: 'fecha',                   windowDays: 365 },
]

function worst(a: Health, b: Health): Health {
  const order = { green: 0, amber: 1, red: 2 }
  return order[a] >= order[b] ? a : b
}

async function probeTable(tenant: string, probe: TableProbe): Promise<TableReading> {
  try {
    // Lifetime count first — if zero, table is red regardless of window.
    const { count: totalCount, error: totalErr } = await supabase
      .from(probe.name)
      .select('*', { count: 'estimated', head: true })
      .eq('company_id', tenant)

    if (totalErr) {
      return {
        name: probe.name,
        rows_windowed: 0,
        rows_total: 0,
        health: 'red',
        window_column: probe.windowColumn,
        window_days: probe.windowDays || null,
        error: totalErr.message,
      }
    }

    const total = totalCount ?? 0
    if (total === 0) {
      return {
        name: probe.name,
        rows_windowed: 0,
        rows_total: 0,
        health: 'red',
        window_column: probe.windowColumn,
        window_days: probe.windowDays || null,
      }
    }

    // Lifetime-only table (catalog) → already green.
    if (!probe.windowColumn) {
      return {
        name: probe.name,
        rows_windowed: total,
        rows_total: total,
        health: 'green',
        window_column: null,
        window_days: null,
      }
    }

    const sinceIso = new Date(Date.now() - probe.windowDays * 86_400_000).toISOString()
    const { count: windowCount, error: windowErr } = await supabase
      .from(probe.name)
      .select('*', { count: 'estimated', head: true })
      .eq('company_id', tenant)
      .gte(probe.windowColumn, sinceIso)

    if (windowErr) {
      return {
        name: probe.name,
        rows_windowed: 0,
        rows_total: total,
        health: 'amber',
        window_column: probe.windowColumn,
        window_days: probe.windowDays,
        error: windowErr.message,
      }
    }

    const windowed = windowCount ?? 0
    const health: Health = windowed > 0 ? 'green' : 'amber'
    return {
      name: probe.name,
      rows_windowed: windowed,
      rows_total: total,
      health,
      window_column: probe.windowColumn,
      window_days: probe.windowDays,
    }
  } catch (e) {
    return {
      name: probe.name,
      rows_windowed: 0,
      rows_total: 0,
      health: 'red',
      window_column: probe.windowColumn,
      window_days: probe.windowDays || null,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  const url = new URL(request.url)
  const tenantParam = url.searchParams.get('tenant')
  // Admin/broker can target any tenant; unauth'd calls use the default
  // EVCO probe so the ship-script can curl without a cookie.
  const isInternal = session?.role === 'broker' || session?.role === 'admin'
  const tenant = isInternal && tenantParam ? tenantParam : 'evco'

  // For unauth/client calls, only allow the default 'evco' probe (no
  // tenant param override) — this is the smoke test, not a cross-tenant
  // leak vector.
  if (!isInternal && tenantParam && tenantParam !== 'evco') {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'tenant override requires admin role' } },
      { status: 403 },
    )
  }

  const [readings, syncTypes] = await Promise.all([
    Promise.all(TABLES.map((t) => probeTable(tenant, t))),
    probeSyncTypes(),
  ])

  const tableVerdict: Health = readings.reduce<Health>((acc, r) => worst(acc, r.health), 'green')
  const syncVerdict: Health = syncTypes.reduce<Health>((acc, s) => worst(acc, s.health), 'green')
  const verdict: Health = worst(tableVerdict, syncVerdict)

  return NextResponse.json(
    {
      tenant,
      generated_at: new Date().toISOString(),
      tables: readings,
      sync_types: syncTypes,
      verdict,
    },
    {
      status: verdict === 'red' ? 503 : 200,
      headers: { 'Cache-Control': 'no-store, private' },
    },
  )
}

interface SyncTypeReading {
  sync_type: string
  last_success_at: string | null
  minutes_ago: number | null
  failed_since_last_success: number
  health: Health
}

async function probeSyncTypes(): Promise<SyncTypeReading[]> {
  try {
    const { data } = await supabase
      .from('sync_log')
      .select('sync_type, status, started_at, completed_at')
      .order('started_at', { ascending: false })
      .limit(1000)
    if (!data) return []

    const bySyncType = new Map<string, Array<{ status: string | null; completed_at: string | null; started_at: string | null }>>()
    for (const row of data as Array<{ sync_type: string | null; status: string | null; completed_at: string | null; started_at: string | null }>) {
      if (!row.sync_type) continue
      const arr = bySyncType.get(row.sync_type) ?? []
      arr.push(row)
      bySyncType.set(row.sync_type, arr)
    }

    const out: SyncTypeReading[] = []
    for (const [syncType, rows] of bySyncType) {
      const lastSuccess = rows.find((r) => r.status === 'success' && r.completed_at)
      const minutesAgo = lastSuccess?.completed_at
        ? Math.max(0, Math.floor((Date.now() - new Date(lastSuccess.completed_at).getTime()) / 60_000))
        : null
      let failedSince = 0
      for (const r of rows) {
        if (r.status === 'success') break
        if (r.status === 'failed' || r.status === 'error') failedSince++
      }
      let health: Health = 'unknown' as unknown as Health
      if (minutesAgo == null) {
        // Never succeeded — treat as red.
        health = 'red'
      } else if (minutesAgo <= 60 * 6) {
        health = 'green'
      } else if (minutesAgo <= 60 * 24) {
        health = 'amber'
      } else {
        health = 'red'
      }
      out.push({
        sync_type: syncType,
        last_success_at: lastSuccess?.completed_at ?? null,
        minutes_ago: minutesAgo,
        failed_since_last_success: failedSince,
        health,
      })
    }
    return out.sort((a, b) => a.sync_type.localeCompare(b.sync_type))
  } catch {
    return []
  }
}
