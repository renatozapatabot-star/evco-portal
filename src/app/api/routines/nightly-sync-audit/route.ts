/**
 * AGUILA · Routine R2 — Nightly Sync Audit
 *
 * Called ~4:00 AM Central by Claude Routines. Pulls last 24h sync state:
 *   - heartbeat_log: which scripts ran, which failed, timing
 *   - regression_guard_log: coverage deltas > 2% trigger flags
 *   - aduanet_facturas: freshness (max created_at)
 *   - per-company expediente coverage delta
 *
 * Returns structured JSON. Routine summarizes + posts to internal
 * Mensajería thread. If critical failures detected, `critical: true`
 * flag tells the routine to open a GitHub issue too.
 */

import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyRoutineRequest, routineOk, routineError } from '@/lib/routines/auth'
import { createThread } from '@/lib/mensajeria/threads'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface HealthSnapshot {
  checkedAt: string
  pm2Ok: boolean
  supabaseOk: boolean
  vercelOk: boolean
  syncOk: boolean
  syncAgeHours: number | null
  allOk: boolean
  details: Record<string, unknown> | null
}

interface CoverageDelta {
  companyId: string
  field: string
  yesterdayPct: number
  todayPct: number
  deltaPct: number
}

interface AuditPayload {
  generatedAt: string
  windowHours: number
  latestHeartbeat: HealthSnapshot | null
  heartbeatsLast24h: number
  heartbeatFailures24h: { pm2: number; supabase: number; vercel: number; sync: number }
  regressions: CoverageDelta[]
  aduanetFacturas: { freshestAt: string | null; rowsLast24h: number }
  econtaSyncHealthy: boolean
  critical: boolean
  thread?: { id: string; posted: boolean }
}

export async function POST(request: NextRequest) {
  const auth = verifyRoutineRequest(request, 'nightly-sync-audit')
  if (!auth.ok) return auth.response

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const now = new Date()
  const last24hIso = new Date(now.getTime() - 86_400_000).toISOString()

  const body = await request.json().catch(() => ({}))
  const postToThread: boolean = body?.postToThread !== false
  const summary: string | undefined = typeof body?.summary === 'string' ? body.summary : undefined

  try {
    const [
      latestHb,
      heartbeats24h,
      regressionRows,
      aduanetLatest,
      aduanetLast24h,
    ] = await Promise.all([
      sb.from('heartbeat_log').select('checked_at, pm2_ok, supabase_ok, vercel_ok, sync_ok, sync_age_hours, all_ok, details').order('checked_at', { ascending: false }).limit(1).maybeSingle(),
      sb.from('heartbeat_log').select('pm2_ok, supabase_ok, vercel_ok, sync_ok').gte('checked_at', last24hIso).limit(500),
      sb.from('regression_guard_log').select('company_id, field, yesterday_pct, today_pct, delta_pct, logged_at').gte('logged_at', last24hIso).limit(500),
      sb.from('aduanet_facturas').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      sb.from('aduanet_facturas').select('id', { count: 'exact', head: true }).gte('created_at', last24hIso).limit(1),
    ])

    const latestRaw = latestHb.data as
      | { checked_at: string; pm2_ok: boolean; supabase_ok: boolean; vercel_ok: boolean; sync_ok: boolean; sync_age_hours: number | null; all_ok: boolean; details: Record<string, unknown> | null }
      | null
    const latestHeartbeat: HealthSnapshot | null = latestRaw
      ? {
          checkedAt: latestRaw.checked_at,
          pm2Ok: latestRaw.pm2_ok,
          supabaseOk: latestRaw.supabase_ok,
          vercelOk: latestRaw.vercel_ok,
          syncOk: latestRaw.sync_ok,
          syncAgeHours: latestRaw.sync_age_hours,
          allOk: latestRaw.all_ok,
          details: latestRaw.details,
        }
      : null

    const hbRows = (heartbeats24h.data ?? []) as Array<{ pm2_ok: boolean; supabase_ok: boolean; vercel_ok: boolean; sync_ok: boolean }>
    const hbFail = {
      pm2: hbRows.filter(h => h.pm2_ok === false).length,
      supabase: hbRows.filter(h => h.supabase_ok === false).length,
      vercel: hbRows.filter(h => h.vercel_ok === false).length,
      sync: hbRows.filter(h => h.sync_ok === false).length,
    }

    // Regressions = any row with |delta_pct| > 2
    const regressions: CoverageDelta[] = (regressionRows.data ?? [])
      .filter((r) => Math.abs(Number((r as { delta_pct: number }).delta_pct ?? 0)) > 2)
      .map((r) => {
        const row = r as { company_id: string; field: string; yesterday_pct: number; today_pct: number; delta_pct: number }
        return {
          companyId: row.company_id,
          field: row.field,
          yesterdayPct: Number(row.yesterday_pct),
          todayPct: Number(row.today_pct),
          deltaPct: Number(row.delta_pct),
        }
      })

    // econta health: aduanet_facturas table has a row in the last 24h
    const econtaSyncHealthy = (aduanetLast24h.count ?? 0) > 0

    const critical =
      (latestHeartbeat && !latestHeartbeat.allOk) ||
      hbFail.pm2 > 0 || hbFail.supabase > 0 || hbFail.vercel > 0 || hbFail.sync > 0 ||
      regressions.some(r => r.deltaPct < -5) ||
      !econtaSyncHealthy

    const payload: AuditPayload = {
      generatedAt: now.toISOString(),
      windowHours: 24,
      latestHeartbeat,
      heartbeatsLast24h: hbRows.length,
      heartbeatFailures24h: hbFail,
      regressions,
      aduanetFacturas: {
        freshestAt: aduanetLatest.data ? (aduanetLatest.data as { created_at: string }).created_at : null,
        rowsLast24h: aduanetLast24h.count ?? 0,
      },
      econtaSyncHealthy,
      critical: Boolean(critical),
    }

    if (postToThread && summary) {
      const dateStr = now.toLocaleDateString('es-MX', { timeZone: 'America/Chicago', day: '2-digit', month: 'long', year: 'numeric' })
      const threadRes = await createThread({
        companyId: 'internal',
        subject: `Auditoría nocturna · ${dateStr}${critical ? ' · ⚠ ATENCIÓN' : ''}`,
        firstMessageBody: summary,
        role: 'system',
        authorName: 'AGUILA Routines',
        internalOnly: true,
      })
      if (threadRes.data) {
        payload.thread = { id: threadRes.data.id, posted: true }
      } else {
        payload.thread = { id: '', posted: false }
      }
    }

    return routineOk(payload)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return routineError('INTERNAL_ERROR', `nightly-sync-audit failed: ${msg}`)
  }
}
