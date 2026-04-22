/**
 * PORTAL · Data-integrity health probe.
 *
 * GET /api/health/data-integrity
 *
 * Returns per-table row counts for the requested tenant (default 'evco'),
 * per-sync-type freshness against the canonical registry, and a
 * split-verdict payload. Consumed by:
 *   · `scripts/ship.sh` (post-deploy gate — blocks promotion on red)
 *   · `/admin/sync-health` (ops dashboard — surfaces drift in real time)
 *   · Monitoring dashboards
 *
 * Per-table health bands:
 *   · green  — > 0 rows in the last 365 days (or lifetime for catalog)
 *   · amber  — 0 rows in window but > 0 lifetime total (stale tenant)
 *   · red    — 0 rows total (broken tenant isolation or missing data)
 *
 * Per-sync-type health bands:
 *   Read from `src/lib/health/sync-registry.ts` — each sync has its own
 *   expected cadence and is classified against cadence × 1.5 (green) /
 *   × 3 (amber). Unknown sync types (not in the registry) are reported
 *   but never affect the verdict.
 *
 * Verdict split:
 *   · `tables_verdict`              — worst band across probed tables
 *   · `critical_syncs_verdict`      — worst band across `critical: true` syncs
 *   · `non_critical_syncs_verdict`  — worst band across everything else
 *   · `verdict`                     — ship-gate verdict = worst(tables, critical_syncs)
 *
 * The non-critical bucket is surfaced so the dashboard can show it,
 * but it NEVER contributes to the top-level verdict. A retired or
 * disabled weekly cron no longer turns the ship gate red.
 *
 * Auth: admin / broker only. Client-role returns 403.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import {
  SYNC_REGISTRY,
  classifyBySyncType,
  getSyncRegistryEntry,
  minutesOverdue,
  worstBand,
  type SyncHealthBand,
} from '@/lib/health/sync-registry'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface TableReading {
  name: string
  rows_windowed: number
  rows_total: number
  health: SyncHealthBand
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
  // Block DD Phase 4.3 — widen the probe to the globalpc_* tables that
  // feed client KPIs. `pedimentos` and `aduanet_facturas` were considered
  // but excluded: `pedimentos` is broker-scoped (no company_id column),
  // and `aduanet_facturas` has no recent rows for EVCO (the current flow
  // lives in globalpc_facturas). Add them back when the schema consolidates.
  { name: 'globalpc_facturas',     windowColumn: 'fecha_facturacion',       windowDays: 365 },
  { name: 'globalpc_partidas',     windowColumn: null,                      windowDays: 0 },
]

// Tables contribute to the verdict under the same 3-band model as syncs:
// green/amber are fine, red blocks the ship gate. `unknown` collapses
// to green for verdict purposes (see `worstBand`).

async function probeTable(tenant: string, probe: TableProbe): Promise<TableReading> {
  try {
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
    const health: SyncHealthBand = windowed > 0 ? 'green' : 'amber'
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

interface SyncTypeReading {
  sync_type: string
  label: string | null
  last_success_at: string | null
  last_attempt_at: string | null
  last_attempt_status: string | null
  minutes_ago: number | null
  failed_since_last_success: number
  cadence_minutes: number | null
  minutes_overdue: number
  critical: boolean
  known: boolean
  cron: string | null
  description: string | null
  health: SyncHealthBand
  reason: string | null
}

// How far back we look for sync_log rows. Wide enough for weekly
// backfills to appear as "last succeeded N days ago" instead of being
// invisible (which would be ambiguous — "retired?" vs "never wrote").
// The registry cadence — not this window — decides the actual band.
const SYNC_TYPE_ACTIVE_WINDOW_DAYS = 30

async function probeSyncTypes(): Promise<SyncTypeReading[]> {
  try {
    const sinceIso = new Date(Date.now() - SYNC_TYPE_ACTIVE_WINDOW_DAYS * 86_400_000).toISOString()
    const { data, error } = await supabase
      .from('sync_log')
      .select('sync_type, status, started_at, completed_at')
      .gte('started_at', sinceIso)
      .order('started_at', { ascending: false })
      .limit(5000)
    if (error || !data) return []

    const bySyncType = new Map<
      string,
      Array<{ status: string | null; completed_at: string | null; started_at: string | null }>
    >()
    for (const row of data as Array<{
      sync_type: string | null
      status: string | null
      completed_at: string | null
      started_at: string | null
    }>) {
      if (!row.sync_type) continue
      const arr = bySyncType.get(row.sync_type) ?? []
      arr.push(row)
      bySyncType.set(row.sync_type, arr)
    }

    const out: SyncTypeReading[] = []
    for (const [syncType, rows] of bySyncType) {
      const entry = getSyncRegistryEntry(syncType)
      const lastSuccess = rows.find((r) => r.status === 'success' && r.completed_at)
      const lastAttempt = rows[0] ?? null
      const minutesAgo = lastSuccess?.completed_at
        ? Math.max(0, Math.floor((Date.now() - new Date(lastSuccess.completed_at).getTime()) / 60_000))
        : null

      let failedSince = 0
      for (const r of rows) {
        if (r.status === 'success') break
        if (r.status === 'failed' || r.status === 'error') failedSince++
      }

      const health = classifyBySyncType(syncType, minutesAgo)
      const overdue = minutesOverdue(syncType, minutesAgo)

      // A human-readable reason for why this row is the band it is.
      // The dashboard surfaces this so operators don't have to guess
      // what "red" means for a specific sync.
      let reason: string | null = null
      if (!entry) {
        reason = 'Sync type no registrado — revisa sync-registry.ts'
      } else if (minutesAgo == null) {
        reason = `Sin éxito registrado en los últimos ${SYNC_TYPE_ACTIVE_WINDOW_DAYS} días`
      } else if (health === 'red') {
        reason = `Atrasado ${overdue} min (cadencia ${entry.cadenceMin} min)`
      } else if (health === 'amber') {
        reason = `Por encima de 1.5× cadencia (${entry.cadenceMin} min)`
      } else if (failedSince > 0) {
        reason = `${failedSince} fallo(s) desde el último éxito`
      }

      out.push({
        sync_type: syncType,
        label: entry?.label ?? null,
        last_success_at: lastSuccess?.completed_at ?? null,
        last_attempt_at: lastAttempt?.started_at ?? null,
        last_attempt_status: lastAttempt?.status ?? null,
        minutes_ago: minutesAgo,
        failed_since_last_success: failedSince,
        cadence_minutes: entry?.cadenceMin ?? null,
        minutes_overdue: overdue,
        critical: entry?.critical ?? false,
        known: entry != null,
        cron: entry?.cron ?? null,
        description: entry?.description ?? null,
        health,
        reason,
      })
    }

    // Registered critical syncs that never wrote a row in the window
    // are worse than silent — they're invisible. Surface them as red
    // with an explicit "never ran" reason so operators investigate.
    for (const entry of Object.values(SYNC_REGISTRY)) {
      if (bySyncType.has(entry.syncType)) continue
      if (!entry.critical) continue
      out.push({
        sync_type: entry.syncType,
        label: entry.label,
        last_success_at: null,
        last_attempt_at: null,
        last_attempt_status: null,
        minutes_ago: null,
        failed_since_last_success: 0,
        cadence_minutes: entry.cadenceMin,
        minutes_overdue: 0,
        critical: true,
        known: true,
        cron: entry.cron ?? null,
        description: entry.description ?? null,
        health: 'red',
        reason: `Sin actividad registrada en los últimos ${SYNC_TYPE_ACTIVE_WINDOW_DAYS} días`,
      })
    }

    return out.sort((a, b) => {
      // Critical rows first, then by band severity (red > amber > green > unknown), then alphabetical.
      if (a.critical !== b.critical) return a.critical ? -1 : 1
      const rank: Record<SyncHealthBand, number> = { red: 0, amber: 1, green: 2, unknown: 3 }
      if (rank[a.health] !== rank[b.health]) return rank[a.health] - rank[b.health]
      return a.sync_type.localeCompare(b.sync_type)
    })
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  const url = new URL(request.url)
  const tenantParam = url.searchParams.get('tenant')
  const isInternal = session?.role === 'broker' || session?.role === 'admin'
  const tenant = isInternal && tenantParam ? tenantParam : 'evco'

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

  const tablesVerdict = worstBand(readings.map((r) => r.health))
  const criticalSyncs = syncTypes.filter((s) => s.critical)
  const nonCriticalSyncs = syncTypes.filter((s) => !s.critical)
  const criticalSyncsVerdict = worstBand(criticalSyncs.map((s) => s.health))
  const nonCriticalSyncsVerdict = worstBand(nonCriticalSyncs.map((s) => s.health))

  // Ship-gate verdict excludes non-critical syncs on purpose — a
  // retired weekly backfill should never block a production push.
  const verdict = worstBand([tablesVerdict, criticalSyncsVerdict])

  return NextResponse.json(
    {
      tenant,
      generated_at: new Date().toISOString(),
      tables: readings,
      sync_types: syncTypes,
      tables_verdict: tablesVerdict,
      critical_syncs_verdict: criticalSyncsVerdict,
      non_critical_syncs_verdict: nonCriticalSyncsVerdict,
      verdict,
      // Convenience counts for the dashboard summary row.
      summary: {
        tables: countsByBand(readings.map((r) => r.health)),
        critical_syncs: countsByBand(criticalSyncs.map((s) => s.health)),
        non_critical_syncs: countsByBand(nonCriticalSyncs.map((s) => s.health)),
      },
    },
    {
      status: verdict === 'red' ? 503 : 200,
      headers: { 'Cache-Control': 'no-store, private' },
    },
  )
}

function countsByBand(bands: SyncHealthBand[]): Record<SyncHealthBand, number> {
  const counts: Record<SyncHealthBand, number> = { green: 0, amber: 0, red: 0, unknown: 0 }
  for (const b of bands) counts[b]++
  return counts
}
