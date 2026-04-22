/**
 * /api/health/data-integrity — verdict-split regression fence.
 *
 * The critical-vs-non-critical split is the whole point of Section B:
 * a retired weekly cron should NEVER turn the ship-gate red, and a
 * stale critical cron SHOULD. These tests verify both directions using
 * stubbed Supabase responses.
 *
 * The route runs six parallel table probes + one sync_log pass. We
 * mock the Supabase client so each `.from(table)` returns a fixed
 * response shape tuned for the scenario being tested.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/* eslint-disable @typescript-eslint/no-explicit-any -- mock chains are
   inherently untyped; faithful typing would duplicate PostgrestBuilder. */

// ── Supabase mock helpers ─────────────────────────────────────────────

interface TableStub {
  count?: number | null
  rows?: Array<Record<string, unknown>>
  error?: { message: string } | null
}

const tableResponses = new Map<string, TableStub>()
let syncLogRows: Array<{
  sync_type: string | null
  status: string | null
  started_at: string | null
  completed_at: string | null
}> = []

function resetStubs() {
  tableResponses.clear()
  // Default: every table has 100 rows, both lifetime and windowed.
  // Individual tests can override by setting a specific table.
  for (const t of [
    'traficos',
    'entradas',
    'expediente_documentos',
    'globalpc_productos',
    'globalpc_facturas',
    'globalpc_partidas',
  ]) {
    tableResponses.set(t, { count: 100, rows: [], error: null })
  }
  syncLogRows = []
}

function minutesAgoIso(min: number): string {
  return new Date(Date.now() - min * 60_000).toISOString()
}

/**
 * Supabase PostgrestBuilder is thenable at every link in the chain —
 * `await supabase.from(...).select(...).eq(...)` works because the
 * builder itself implements `.then`. We mirror that by making every
 * chain method return the same thenable object, which resolves to
 * the shape the route expects for that table.
 */
function makeThenableChain(resolver: () => { data?: unknown; count?: number | null; error?: unknown }) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    order: () => chain,
    limit: () => chain,
    then: (onF: (v: ReturnType<typeof resolver>) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve(resolver()).then(onF, onR),
  }
  return chain
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (tableName: string) => {
      if (tableName === 'sync_log') {
        return makeThenableChain(() => ({ data: syncLogRows, error: null }))
      }
      const stub = tableResponses.get(tableName) ?? { count: 100, rows: [], error: null }
      return makeThenableChain(() => ({
        count: stub.count ?? 0,
        data: stub.rows ?? null,
        error: stub.error ?? null,
      }))
    },
  }),
}))

// Admin session so the route doesn't short-circuit on auth.
vi.mock('@/lib/session', () => ({
  verifySession: async () => ({
    role: 'admin',
    companyId: 'admin',
    userId: 'test-admin',
  }),
}))

// ── Route under test ──────────────────────────────────────────────────

import { GET } from '../route'
import { NextRequest } from 'next/server'

function call(): Promise<Response> {
  const req = new NextRequest('http://localhost/api/health/data-integrity?tenant=evco', {
    method: 'GET',
  })
  return GET(req) as unknown as Promise<Response>
}

async function readJson(res: Response): Promise<any> {
  const text = await res.text()
  return JSON.parse(text)
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('/api/health/data-integrity — verdict split', () => {
  beforeEach(() => {
    resetStubs()
  })

  it('returns green verdict when every critical sync is fresh and every table has rows', async () => {
    // All 6 critical syncs logged a success in the last few minutes.
    syncLogRows = [
      { sync_type: 'globalpc_delta', status: 'success', started_at: minutesAgoIso(5),  completed_at: minutesAgoIso(4)  },
      { sync_type: 'email_intake',   status: 'success', started_at: minutesAgoIso(10), completed_at: minutesAgoIso(9)  },
      { sync_type: 'econta_full',    status: 'success', started_at: minutesAgoIso(12), completed_at: minutesAgoIso(11) },
      { sync_type: 'risk_feed',      status: 'success', started_at: minutesAgoIso(15), completed_at: minutesAgoIso(14) },
      { sync_type: 'risk_scorer',    status: 'success', started_at: minutesAgoIso(30), completed_at: minutesAgoIso(29) },
      { sync_type: 'globalpc',       status: 'success', started_at: minutesAgoIso(60), completed_at: minutesAgoIso(59) },
    ]

    const res = await call()
    const body = await readJson(res)

    expect(body.verdict).toBe('green')
    expect(body.tables_verdict).toBe('green')
    expect(body.critical_syncs_verdict).toBe('green')
    expect(res.status).toBe(200)
  })

  it('a retired non-critical weekly cron (red band) does NOT flip the verdict', async () => {
    // Critical syncs all fresh.
    syncLogRows = [
      { sync_type: 'globalpc_delta', status: 'success', started_at: minutesAgoIso(5),  completed_at: minutesAgoIso(4)  },
      { sync_type: 'email_intake',   status: 'success', started_at: minutesAgoIso(10), completed_at: minutesAgoIso(9)  },
      { sync_type: 'econta_full',    status: 'success', started_at: minutesAgoIso(12), completed_at: minutesAgoIso(11) },
      { sync_type: 'risk_feed',      status: 'success', started_at: minutesAgoIso(15), completed_at: minutesAgoIso(14) },
      { sync_type: 'risk_scorer',    status: 'success', started_at: minutesAgoIso(30), completed_at: minutesAgoIso(29) },
      { sync_type: 'globalpc',       status: 'success', started_at: minutesAgoIso(60), completed_at: minutesAgoIso(59) },
      // Non-critical weekly backfill last succeeded 25 days ago — red band (cadence 7d → amber ≤ 21d).
      { sync_type: 'backfill_proveedor_rfc', status: 'success', started_at: minutesAgoIso(25 * 1440), completed_at: minutesAgoIso(25 * 1440) },
    ]

    const res = await call()
    const body = await readJson(res)

    const backfill = body.sync_types.find((s: any) => s.sync_type === 'backfill_proveedor_rfc')
    expect(backfill.health).toBe('red')
    expect(backfill.critical).toBe(false)

    expect(body.non_critical_syncs_verdict).toBe('red')
    expect(body.critical_syncs_verdict).toBe('green')
    expect(body.verdict).toBe('green')          // ← the whole point of Section B
    expect(res.status).toBe(200)
  })

  it('an overdue critical sync flips the verdict to red with 503 status', async () => {
    // globalpc_delta cadence 15 min → amber upper bound 45 min. 90 min is solidly red.
    syncLogRows = [
      { sync_type: 'globalpc_delta', status: 'success', started_at: minutesAgoIso(90),  completed_at: minutesAgoIso(90)  },
      { sync_type: 'email_intake',   status: 'success', started_at: minutesAgoIso(10),  completed_at: minutesAgoIso(9)   },
      { sync_type: 'econta_full',    status: 'success', started_at: minutesAgoIso(12),  completed_at: minutesAgoIso(11)  },
      { sync_type: 'risk_feed',      status: 'success', started_at: minutesAgoIso(15),  completed_at: minutesAgoIso(14)  },
      { sync_type: 'risk_scorer',    status: 'success', started_at: minutesAgoIso(30),  completed_at: minutesAgoIso(29)  },
      { sync_type: 'globalpc',       status: 'success', started_at: minutesAgoIso(60),  completed_at: minutesAgoIso(59)  },
    ]

    const res = await call()
    const body = await readJson(res)

    const delta = body.sync_types.find((s: any) => s.sync_type === 'globalpc_delta')
    expect(delta.health).toBe('red')
    expect(delta.reason).toMatch(/Atrasado/)

    expect(body.critical_syncs_verdict).toBe('red')
    expect(body.verdict).toBe('red')
    expect(res.status).toBe(503)
  })

  it('a missing critical sync surfaces as red with "Sin actividad" reason', async () => {
    // Five of the six critical syncs present; `email_intake` omitted entirely.
    syncLogRows = [
      { sync_type: 'globalpc_delta', status: 'success', started_at: minutesAgoIso(5),  completed_at: minutesAgoIso(4)  },
      { sync_type: 'econta_full',    status: 'success', started_at: minutesAgoIso(12), completed_at: minutesAgoIso(11) },
      { sync_type: 'risk_feed',      status: 'success', started_at: minutesAgoIso(15), completed_at: minutesAgoIso(14) },
      { sync_type: 'risk_scorer',    status: 'success', started_at: minutesAgoIso(30), completed_at: minutesAgoIso(29) },
      { sync_type: 'globalpc',       status: 'success', started_at: minutesAgoIso(60), completed_at: minutesAgoIso(59) },
    ]

    const res = await call()
    const body = await readJson(res)

    const email = body.sync_types.find((s: any) => s.sync_type === 'email_intake')
    expect(email).toBeDefined()
    expect(email.health).toBe('red')
    expect(email.last_success_at).toBeNull()
    expect(email.reason).toMatch(/Sin actividad registrada/)

    expect(body.critical_syncs_verdict).toBe('red')
    expect(body.verdict).toBe('red')
    expect(res.status).toBe(503)
  })

  it('an unknown (non-registered) sync type is reported but never affects the verdict', async () => {
    syncLogRows = [
      { sync_type: 'globalpc_delta', status: 'success', started_at: minutesAgoIso(5),  completed_at: minutesAgoIso(4)  },
      { sync_type: 'email_intake',   status: 'success', started_at: minutesAgoIso(10), completed_at: minutesAgoIso(9)  },
      { sync_type: 'econta_full',    status: 'success', started_at: minutesAgoIso(12), completed_at: minutesAgoIso(11) },
      { sync_type: 'risk_feed',      status: 'success', started_at: minutesAgoIso(15), completed_at: minutesAgoIso(14) },
      { sync_type: 'risk_scorer',    status: 'success', started_at: minutesAgoIso(30), completed_at: minutesAgoIso(29) },
      { sync_type: 'globalpc',       status: 'success', started_at: minutesAgoIso(60), completed_at: minutesAgoIso(59) },
      { sync_type: 'experimental_scraper_2026', status: 'failed', started_at: minutesAgoIso(1), completed_at: null },
    ]

    const res = await call()
    const body = await readJson(res)

    const unk = body.sync_types.find((s: any) => s.sync_type === 'experimental_scraper_2026')
    expect(unk.known).toBe(false)
    expect(unk.health).toBe('unknown')
    expect(unk.reason).toMatch(/no registrado/)

    expect(body.verdict).toBe('green')          // unknown never escalates
    expect(body.critical_syncs_verdict).toBe('green')
  })

  it('a broken table (0 lifetime rows) flips the verdict to red even when syncs are green', async () => {
    tableResponses.set('traficos', { count: 0, rows: [], error: null })

    syncLogRows = [
      { sync_type: 'globalpc_delta', status: 'success', started_at: minutesAgoIso(5),  completed_at: minutesAgoIso(4)  },
      { sync_type: 'email_intake',   status: 'success', started_at: minutesAgoIso(10), completed_at: minutesAgoIso(9)  },
      { sync_type: 'econta_full',    status: 'success', started_at: minutesAgoIso(12), completed_at: minutesAgoIso(11) },
      { sync_type: 'risk_feed',      status: 'success', started_at: minutesAgoIso(15), completed_at: minutesAgoIso(14) },
      { sync_type: 'risk_scorer',    status: 'success', started_at: minutesAgoIso(30), completed_at: minutesAgoIso(29) },
      { sync_type: 'globalpc',       status: 'success', started_at: minutesAgoIso(60), completed_at: minutesAgoIso(59) },
    ]

    const res = await call()
    const body = await readJson(res)

    const traficos = body.tables.find((t: any) => t.name === 'traficos')
    expect(traficos.health).toBe('red')
    expect(body.tables_verdict).toBe('red')
    expect(body.verdict).toBe('red')
    expect(res.status).toBe(503)
  })

  it('payload includes per-bucket counts for dashboard summary', async () => {
    syncLogRows = [
      { sync_type: 'globalpc_delta', status: 'success', started_at: minutesAgoIso(5),  completed_at: minutesAgoIso(4)  },
      { sync_type: 'email_intake',   status: 'success', started_at: minutesAgoIso(10), completed_at: minutesAgoIso(9)  },
      { sync_type: 'econta_full',    status: 'success', started_at: minutesAgoIso(12), completed_at: minutesAgoIso(11) },
      { sync_type: 'risk_feed',      status: 'success', started_at: minutesAgoIso(15), completed_at: minutesAgoIso(14) },
      { sync_type: 'risk_scorer',    status: 'success', started_at: minutesAgoIso(30), completed_at: minutesAgoIso(29) },
      { sync_type: 'globalpc',       status: 'success', started_at: minutesAgoIso(60), completed_at: minutesAgoIso(59) },
    ]

    const res = await call()
    const body = await readJson(res)

    expect(body.summary).toBeDefined()
    expect(body.summary.tables.green).toBe(6)
    expect(body.summary.critical_syncs.green).toBe(6)
    expect(body.summary.critical_syncs.red).toBe(0)
  })
})
