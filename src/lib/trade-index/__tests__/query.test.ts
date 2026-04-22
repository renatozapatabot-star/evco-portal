/* eslint-disable @typescript-eslint/no-explicit-any -- this test stubs
   the Supabase chainable query-builder; typing the mock faithfully
   would duplicate PostgrestQueryBuilder and add no test value. */

/**
 * Tenant-isolation + k-anonymity contract test for
 * src/lib/trade-index/query.ts.
 *
 * These primitives feed /admin/trade-index AND /mi-cuenta —
 * cross-tenant leakage or k-anon bypass here is a SEV-2 regression
 * against .claude/rules/tenant-isolation.md.
 *
 * Key contracts this suite locks:
 *   1. readClientPosition filters by the companyId argument.
 *      Spoofing a different companyId returns THAT company's row,
 *      not the caller's — so the page gate must source companyId
 *      from session.companyId (verified externally via
 *      mi-cuenta/__tests__/isolation.test.ts).
 *   2. Client position returns has_data=false when the client has
 *      fewer than MIN_CLIENT_SHIPMENTS (3) shipments OR the fleet
 *      has fewer than MIN_FLEET_SAMPLE (10) aggregate shipments.
 *   3. meets_k_anon=false when zero of the client's lanes appear
 *      in v_trade_index_public (the ≥3 distinct companies view).
 *   4. readLaneLeaderboard ALWAYS queries v_trade_index_public —
 *      never the raw mv_trade_index_lane_90d — so k-anon is
 *      enforced at the view level.
 *   5. readClientRanking uses the latest period; it never returns
 *      stale multi-period rows.
 */

import { describe, it, expect } from 'vitest'
import {
  readClientPosition,
  readLaneLeaderboard,
  readClientRanking,
  readFleetSnapshot,
  _TEST_MIN_CLIENT_SHIPMENTS,
  _TEST_MIN_FLEET_SAMPLE,
} from '../query'

// ──────────────────────────────────────────────────────────────────────
// Minimal Supabase query-builder stub.
// ──────────────────────────────────────────────────────────────────────

type TableRow = Record<string, unknown>
type Fixtures = {
  [table: string]: TableRow[]
}

function stubSupabase(fixtures: Fixtures) {
  const tables = fixtures

  function makeBuilder(tableName: string) {
    const state = {
      table: tableName,
      eq: {} as Record<string, unknown>,
      orExpr: null as string | null,
      inCol: null as string | null,
      inVals: null as unknown[] | null,
      orderBy: null as { col: string; asc: boolean } | null,
      limitN: null as number | null,
      capturedMaybeSingle: false,
    }

    const b: any = {
      select() {
        return b
      },
      eq(col: string, val: unknown) {
        state.eq[col] = val
        return b
      },
      or(expr: string) {
        state.orExpr = expr
        return b
      },
      in(col: string, vals: unknown[]) {
        state.inCol = col
        state.inVals = vals
        return b
      },
      order(col: string, opts?: { ascending?: boolean }) {
        state.orderBy = { col, asc: opts?.ascending ?? true }
        return b
      },
      limit(n: number) {
        state.limitN = n
        return b
      },
      maybeSingle() {
        state.capturedMaybeSingle = true
        return resolveRows(state).then((rows) => ({
          data: rows[0] ?? null,
          error: null,
        }))
      },
      then(onF: any, onR: any) {
        return resolveRows(state)
          .then((rows) => ({ data: rows, error: null }))
          .then(onF, onR)
      },
    }
    return b
  }

  function resolveRows(state: any): Promise<TableRow[]> {
    const src = tables[state.table] ?? []
    let out = src.filter((r) => {
      for (const [k, v] of Object.entries(state.eq)) {
        if (r[k] !== v) return false
      }
      return true
    })

    if (state.inCol && Array.isArray(state.inVals)) {
      const set = new Set(state.inVals)
      out = out.filter((r) => set.has(r[state.inCol!]))
    }

    if (state.orExpr) {
      // Minimal parser for: and(aduana.eq.X,oficina.eq.Y),and(…)
      // Matches exactly the shape readClientPosition emits.
      const clauses = parseOrClauses(state.orExpr)
      out = out.filter((r) =>
        clauses.some((c) => r.aduana === c.aduana && r.oficina === c.oficina),
      )
    }

    if (state.orderBy) {
      const { col, asc } = state.orderBy
      out = [...out].sort((a, b) => {
        const av = a[col]
        const bv = b[col]
        if (av == null && bv == null) return 0
        if (av == null) return 1
        if (bv == null) return -1
        if ((av as number) < (bv as number)) return asc ? -1 : 1
        if ((av as number) > (bv as number)) return asc ? 1 : -1
        return 0
      })
    }

    if (state.limitN != null) out = out.slice(0, state.limitN)
    return Promise.resolve(out)
  }

  const client: any = {
    from(table: string) {
      return makeBuilder(table)
    },
  }
  return client
}

function parseOrClauses(expr: string): Array<{ aduana: string; oficina: string }> {
  const clauses: Array<{ aduana: string; oficina: string }> = []
  const re = /and\(aduana\.eq\.([^,]+),oficina\.eq\.([^)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(expr)) !== null) {
    clauses.push({ aduana: m[1], oficina: m[2] })
  }
  return clauses
}

// ──────────────────────────────────────────────────────────────────────
// readClientPosition — the /mi-cuenta card primitive.
// ──────────────────────────────────────────────────────────────────────

describe('readClientPosition · tenant + k-anon contract', () => {
  it('returns has_data=false when client shipment count is below the floor', async () => {
    const sb = stubSupabase({
      client_benchmarks: [
        {
          company_id: 'evco',
          metric_name: 'avg_crossing_days',
          client_value: 2.4,
          fleet_average: 3.1,
          fleet_median: 2.9,
          p10: 1.2,
          p90: 5.5,
          percentile: 72,
          sample_size: 500,
          total_operations: _TEST_MIN_CLIENT_SHIPMENTS - 1, // just under
          period: '2026-04-22',
        },
      ],
      mv_trade_index_client_position_90d: [],
      v_trade_index_public: [],
    })

    const result = await readClientPosition(sb, 'evco')
    expect(result.has_data).toBe(false)
    expect(result.period).toBe('2026-04-22')
  })

  it('returns has_data=false when fleet sample size is below the floor', async () => {
    const sb = stubSupabase({
      client_benchmarks: [
        {
          company_id: 'evco',
          metric_name: 'avg_crossing_days',
          client_value: 2.4,
          fleet_average: 3.1,
          fleet_median: 2.9,
          p10: 1.2,
          p90: 5.5,
          percentile: 72,
          sample_size: _TEST_MIN_FLEET_SAMPLE - 1,
          total_operations: 50,
          period: '2026-04-22',
        },
      ],
      mv_trade_index_client_position_90d: [],
      v_trade_index_public: [],
    })

    const result = await readClientPosition(sb, 'evco')
    expect(result.has_data).toBe(false)
  })

  it('returns meets_k_anon=false when none of the client lanes appear in the public view', async () => {
    const sb = stubSupabase({
      client_benchmarks: [
        {
          company_id: 'evco',
          metric_name: 'avg_crossing_days',
          client_value: 2.4,
          fleet_average: 3.1,
          fleet_median: 2.9,
          p10: 1.2,
          p90: 5.5,
          percentile: 72,
          sample_size: 500,
          total_operations: 42,
          period: '2026-04-22',
        },
      ],
      mv_trade_index_client_position_90d: [
        {
          company_id: 'evco',
          aduana: '240',
          oficina: '01',
          shipment_count: 42,
          tmec_rate: 0.85,
          total_value_usd: 1_200_000,
        },
      ],
      // Empty public view → EVCO's lane isn't k-anon-compliant.
      v_trade_index_public: [],
    })

    const result = await readClientPosition(sb, 'evco')
    expect(result.has_data).toBe(true)
    expect(result.meets_k_anon).toBe(false)
    expect(result.k_anon_lane_count).toBe(0)
  })

  it('returns meets_k_anon=true when at least one client lane appears in the public view', async () => {
    const sb = stubSupabase({
      client_benchmarks: [
        {
          company_id: 'evco',
          metric_name: 'avg_crossing_days',
          client_value: 2.4,
          fleet_average: 3.1,
          fleet_median: 2.9,
          p10: 1.2,
          p90: 5.5,
          percentile: 72,
          sample_size: 500,
          total_operations: 42,
          period: '2026-04-22',
        },
      ],
      mv_trade_index_client_position_90d: [
        {
          company_id: 'evco',
          aduana: '240',
          oficina: '01',
          shipment_count: 30,
          tmec_rate: 0.9,
          total_value_usd: 800_000,
        },
        {
          company_id: 'evco',
          aduana: '240',
          oficina: '02',
          shipment_count: 12,
          tmec_rate: 0.7,
          total_value_usd: 400_000,
        },
      ],
      v_trade_index_public: [
        // Only 240/01 passes the ≥3 distinct companies gate.
        {
          aduana: '240',
          oficina: '01',
          shipment_count: 500,
          distinct_company_count: 8,
        },
      ],
    })

    const result = await readClientPosition(sb, 'evco')
    expect(result.has_data).toBe(true)
    expect(result.meets_k_anon).toBe(true)
    expect(result.k_anon_lane_count).toBe(1)
    expect(result.client.percentile).toBe(72)
    expect(result.client.shipment_count).toBe(42)
    expect(result.fleet.p10_clearance_days).toBe(1.2)
    expect(result.fleet.p90_clearance_days).toBe(5.5)
  })

  it('filters client_benchmarks strictly by the supplied companyId', async () => {
    // EVCO and MAFESA both have rows; the primitive must NOT leak
    // MAFESA's data when asked for EVCO.
    const sb = stubSupabase({
      client_benchmarks: [
        {
          company_id: 'evco',
          metric_name: 'avg_crossing_days',
          client_value: 2.4,
          fleet_average: 3.1,
          fleet_median: 2.9,
          p10: 1.2,
          p90: 5.5,
          percentile: 72,
          sample_size: 500,
          total_operations: 42,
          period: '2026-04-22',
        },
        {
          company_id: 'mafesa',
          metric_name: 'avg_crossing_days',
          client_value: 4.2,
          fleet_average: 3.1,
          fleet_median: 2.9,
          p10: 1.2,
          p90: 5.5,
          percentile: 18,
          sample_size: 500,
          total_operations: 15,
          period: '2026-04-22',
        },
      ],
      mv_trade_index_client_position_90d: [],
      v_trade_index_public: [],
    })

    const evco = await readClientPosition(sb, 'evco')
    expect(evco.client.percentile).toBe(72)

    const mafesa = await readClientPosition(sb, 'mafesa')
    expect(mafesa.client.percentile).toBe(18)
  })

  it('returns the empty shape when companyId is blank', async () => {
    const sb = stubSupabase({
      client_benchmarks: [
        {
          company_id: '',
          metric_name: 'avg_crossing_days',
          client_value: 99,
          sample_size: 500,
          total_operations: 99,
          period: '2026-04-22',
        },
      ],
    })

    const result = await readClientPosition(sb, '')
    expect(result.has_data).toBe(false)
    expect(result.client.percentile).toBeNull()
  })
})

// ──────────────────────────────────────────────────────────────────────
// readLaneLeaderboard — must ALWAYS hit the k-anon view.
// ──────────────────────────────────────────────────────────────────────

describe('readLaneLeaderboard · k-anon enforcement', () => {
  it('queries v_trade_index_public, never the raw lane MV', async () => {
    const seenTables: string[] = []
    const fixtures = {
      v_trade_index_public: [
        {
          aduana: '240',
          oficina: '01',
          shipment_count: 500,
          distinct_company_count: 8,
          avg_clearance_days: 2.8,
          median_clearance_days: 2.5,
          p10_clearance_days: 1.2,
          p90_clearance_days: 5.5,
          total_value_usd: 12_000_000,
          tmec_rate: 0.88,
          computed_at: '2026-04-22T02:45:00Z',
        },
      ],
      mv_trade_index_lane_90d: [
        {
          aduana: '999',
          oficina: '99',
          shipment_count: 1,
          distinct_company_count: 1,
        },
      ],
    }

    const sb: any = {
      from(table: string) {
        seenTables.push(table)
        return stubSupabase(fixtures).from(table)
      },
    }

    const result = await readLaneLeaderboard(sb, { limit: 10, sortBy: 'avg_asc' })
    expect(result.length).toBe(1)
    expect(result[0].aduana).toBe('240')
    expect(seenTables).toContain('v_trade_index_public')
    expect(seenTables).not.toContain('mv_trade_index_lane_90d')
  })

  it('returns [] on fetch error without crashing', async () => {
    const sb: any = {
      from() {
        return {
          select: () => ({
            limit: () => ({
              order: () => Promise.resolve({ data: null, error: new Error('boom') }),
            }),
          }),
        }
      },
    }
    const result = await readLaneLeaderboard(sb)
    expect(result).toEqual([])
  })
})

// ──────────────────────────────────────────────────────────────────────
// readClientRanking — latest period only.
// ──────────────────────────────────────────────────────────────────────

describe('readClientRanking · latest period discipline', () => {
  it('returns only rows from the latest period', async () => {
    const sb = stubSupabase({
      client_benchmarks: [
        // Two periods co-exist; primitive must pick the newer one.
        { company_id: 'evco', metric_name: 'avg_crossing_days', period: '2026-04-21', client_value: 3.0, percentile: 50, total_operations: 40 },
        { company_id: 'mafesa', metric_name: 'avg_crossing_days', period: '2026-04-21', client_value: 4.0, percentile: 30, total_operations: 20 },
        { company_id: 'evco', metric_name: 'avg_crossing_days', period: '2026-04-22', client_value: 2.4, percentile: 72, total_operations: 42 },
        { company_id: 'mafesa', metric_name: 'avg_crossing_days', period: '2026-04-22', client_value: 4.2, percentile: 18, total_operations: 15 },
      ],
      companies: [
        { company_id: 'evco', name: 'EVCO Plastics de México' },
        { company_id: 'mafesa', name: 'MAFESA' },
      ],
      mv_trade_index_client_position_90d: [
        { company_id: 'evco', shipment_count: 42, tmec_rate: 0.88, total_value_usd: 1_200_000 },
        { company_id: 'mafesa', shipment_count: 15, tmec_rate: 0.5, total_value_usd: 300_000 },
      ],
    })

    const result = await readClientRanking(sb, { limit: 10 })
    expect(result).toHaveLength(2)
    // Ordered by percentile desc → EVCO first
    expect(result[0].company_id).toBe('evco')
    expect(result[0].company_name).toBe('EVCO Plastics de México')
    expect(result[0].percentile).toBe(72)
    expect(result[0].avg_clearance_days).toBe(2.4) // the 2026-04-22 value, not 3.0
    expect(result[1].company_id).toBe('mafesa')
    expect(result[1].percentile).toBe(18)
  })

  it('returns [] when no benchmark rows exist', async () => {
    const sb = stubSupabase({ client_benchmarks: [] })
    const result = await readClientRanking(sb)
    expect(result).toEqual([])
  })
})

// ──────────────────────────────────────────────────────────────────────
// readFleetSnapshot — aggregates lane MV, not lane public view.
// ──────────────────────────────────────────────────────────────────────

describe('readFleetSnapshot · aggregation', () => {
  it('weights averages by shipment_count across lanes', async () => {
    const sb = stubSupabase({
      mv_trade_index_lane_90d: [
        {
          aduana: '240',
          oficina: '01',
          shipment_count: 100,
          distinct_company_count: 8,
          avg_clearance_days: 2.0,
          median_clearance_days: 2.0,
          p10_clearance_days: 1.0,
          p90_clearance_days: 4.0,
          tmec_rate: 0.9,
          total_value_usd: 10_000_000,
          computed_at: '2026-04-22T02:45:00Z',
        },
        {
          aduana: '240',
          oficina: '02',
          shipment_count: 50,
          distinct_company_count: 5,
          avg_clearance_days: 5.0,
          median_clearance_days: 4.5,
          p10_clearance_days: 2.0,
          p90_clearance_days: 8.0,
          tmec_rate: 0.6,
          total_value_usd: 3_000_000,
          computed_at: '2026-04-22T02:45:00Z',
        },
      ],
    })

    const snap = await readFleetSnapshot(sb)
    expect(snap.has_data).toBe(true)
    expect(snap.shipment_count).toBe(150)
    expect(snap.distinct_lanes).toBe(2)
    // Weighted avg: (2.0*100 + 5.0*50) / 150 = 3.0
    expect(snap.avg_clearance_days).toBe(3)
    // Weighted TMEC: (0.9*100 + 0.6*50) / 150 = 0.8
    expect(snap.tmec_rate).toBe(0.8)
    // p10 = min, p90 = max across lanes
    expect(snap.p10_clearance_days).toBe(1)
    expect(snap.p90_clearance_days).toBe(8)
    expect(snap.total_value_usd).toBe(13_000_000)
  })

  it('returns empty snapshot when MV has no rows', async () => {
    const sb = stubSupabase({ mv_trade_index_lane_90d: [] })
    const snap = await readFleetSnapshot(sb)
    expect(snap.has_data).toBe(false)
    expect(snap.shipment_count).toBe(0)
  })
})
