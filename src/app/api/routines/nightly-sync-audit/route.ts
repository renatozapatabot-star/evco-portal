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

interface ScriptRun {
  script: string
  status: 'success' | 'failed' | 'missing'
  lastRunAt: string | null
  errorMessage: string | null
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
  scripts: ScriptRun[]
  failedScripts: string[]
  missingScripts: string[]
  regressions: CoverageDelta[]
  aduanetFacturas: { freshestAt: string | null; rowsLast24h: number }
  econtaSyncHealthy: boolean
  critical: boolean
  thread?: { id: string; posted: boolean }
}

// Scripts we expect to see heartbeat entries for every 24h.
const EXPECTED_SCRIPTS = [
  'full-sync-econta',
  'full-sync-eventos',
  'full-sync-facturas',
  'full-sync-productos',
  'globalpc-delta-sync',
  'aduanet-import',
  'regression-guard',
]

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
      heartbeatRows,
      regressionRows,
      aduanetLatest,
      aduanetLast24h,
    ] = await Promise.all([
      sb.from('heartbeat_log').select('script_name, status, run_at, error_message').gte('run_at', last24hIso).order('run_at', { ascending: false }).limit(500),
      sb.from('regression_guard_log').select('company_id, field, yesterday_pct, today_pct, delta_pct, logged_at').gte('logged_at', last24hIso).limit(500),
      sb.from('aduanet_facturas').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      sb.from('aduanet_facturas').select('id', { count: 'exact', head: true }).gte('created_at', last24hIso).limit(1),
    ])

    const heartbeats = (heartbeatRows.data ?? []) as Array<{
      script_name: string; status: string; run_at: string; error_message: string | null
    }>

    // For each expected script, find its most recent run (if any).
    const scripts: ScriptRun[] = EXPECTED_SCRIPTS.map((name) => {
      const matches = heartbeats.filter(h => h.script_name === name || h.script_name?.startsWith(name))
      if (matches.length === 0) {
        return { script: name, status: 'missing' as const, lastRunAt: null, errorMessage: null }
      }
      const mostRecent = matches[0]
      return {
        script: name,
        status: (mostRecent.status === 'success' ? 'success' : 'failed') as 'success' | 'failed',
        lastRunAt: mostRecent.run_at,
        errorMessage: mostRecent.error_message,
      }
    })

    const failedScripts = scripts.filter(s => s.status === 'failed').map(s => s.script)
    const missingScripts = scripts.filter(s => s.status === 'missing').map(s => s.script)

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

    // econta health: facturas table has a row in the last 24h
    const econtaSyncHealthy = (aduanetLast24h.count ?? 0) > 0

    const critical =
      failedScripts.length > 0 ||
      missingScripts.length > 0 ||
      regressions.some(r => r.deltaPct < -5) || // 5%+ drop
      !econtaSyncHealthy

    const payload: AuditPayload = {
      generatedAt: now.toISOString(),
      windowHours: 24,
      scripts,
      failedScripts,
      missingScripts,
      regressions,
      aduanetFacturas: {
        freshestAt: aduanetLatest.data ? (aduanetLatest.data as { created_at: string }).created_at : null,
        rowsLast24h: aduanetLast24h.count ?? 0,
      },
      econtaSyncHealthy,
      critical,
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
