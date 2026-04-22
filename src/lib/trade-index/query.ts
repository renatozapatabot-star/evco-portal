/**
 * Trade Index · data access primitives.
 *
 * Reads from the 2026-04-22 materialized views:
 *   - mv_trade_index_client_position_90d  (per-(company, lane) aggregate)
 *   - mv_trade_index_lane_90d             (per-lane aggregate, all clients)
 *   - v_trade_index_public                (k-anon view — distinct_company_count ≥ 3)
 * Plus the refreshed `client_benchmarks` rows written nightly by
 * scripts/refresh-trade-index.js (fleet avg/median/p10/p90 + percentile).
 *
 * Tenant contract (per .claude/rules/tenant-isolation.md + -.../client-accounting-ethics.md):
 *   - The caller MUST pass a service-role Supabase client. The MVs
 *     `revoke all from public` — anon/authenticated roles cannot read
 *     them. The API/page layer is the RBAC gate.
 *   - `readClientPosition(sb, companyId)` filters by the exact
 *     companyId the caller provides. The caller is responsible for
 *     sourcing companyId from `session.companyId` (never URL/cookie/
 *     header override). This primitive does NOT trust its companyId
 *     argument to be verified — the page/test is the verification
 *     boundary. Passing a spoofed companyId returns THAT company's
 *     aggregate; that's why the page gate matters.
 *   - The k-anonymity floor (≥3 distinct companies per lane) is
 *     enforced at the view level for lane leaderboards, and at the
 *     function level for `readClientPosition.meetsKAnon`.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ──────────────────────────────────────────────────────────────────────
// Types — hand-written because the MVs aren't in types/supabase.ts yet
// (regen happens post-migration). Shape follows the migration SQL.
// ──────────────────────────────────────────────────────────────────────

export type LaneRow = {
  aduana: string
  oficina: string
  shipment_count: number
  distinct_company_count: number
  avg_clearance_days: number | null
  median_clearance_days: number | null
  p10_clearance_days: number | null
  p90_clearance_days: number | null
  total_value_usd: number | null
  tmec_rate: number | null
  computed_at: string | null
}

export type ClientPositionRow = {
  company_id: string
  aduana: string
  oficina: string
  shipment_count: number
  avg_clearance_days: number | null
  median_clearance_days: number | null
  total_value_usd: number | null
  tmec_rate: number | null
}

export type FleetSnapshot = {
  shipment_count: number
  distinct_lanes: number
  distinct_companies: number
  avg_clearance_days: number | null
  median_clearance_days: number | null
  p10_clearance_days: number | null
  p90_clearance_days: number | null
  tmec_rate: number | null
  total_value_usd: number | null
  period: string | null
  has_data: boolean
}

export type ClientRankingRow = {
  company_id: string
  company_name: string | null
  shipment_count: number
  avg_clearance_days: number | null
  percentile: number | null
  tmec_rate: number | null
  total_value_usd: number | null
}

export type ClientPosition = {
  has_data: boolean
  meets_k_anon: boolean
  client: {
    shipment_count: number
    avg_clearance_days: number | null
    percentile: number | null
    tmec_rate: number | null
    total_value_usd: number | null
  }
  fleet: {
    avg_clearance_days: number | null
    median_clearance_days: number | null
    p10_clearance_days: number | null
    p90_clearance_days: number | null
    sample_size: number | null
  }
  period: string | null
  k_anon_lane_count: number
}

// Minimum shipment counts to surface a client-facing comparison.
// Below these thresholds, the card shows "Aún no hay datos suficientes".
// K-anon is enforced separately via the v_trade_index_public view.
const MIN_CLIENT_SHIPMENTS = 3
const MIN_FLEET_SAMPLE = 10

// ──────────────────────────────────────────────────────────────────────
// readFleetSnapshot — overall fleet stats from the lane MV.
// ──────────────────────────────────────────────────────────────────────

export async function readFleetSnapshot(
  sb: SupabaseClient,
): Promise<FleetSnapshot> {
  const empty: FleetSnapshot = {
    shipment_count: 0,
    distinct_lanes: 0,
    distinct_companies: 0,
    avg_clearance_days: null,
    median_clearance_days: null,
    p10_clearance_days: null,
    p90_clearance_days: null,
    tmec_rate: null,
    total_value_usd: null,
    period: null,
    has_data: false,
  }

  const { data: laneRows, error: laneErr } = await sb
    .from('mv_trade_index_lane_90d')
    .select(
      'shipment_count, distinct_company_count, avg_clearance_days, median_clearance_days, p10_clearance_days, p90_clearance_days, tmec_rate, total_value_usd, computed_at',
    )

  if (laneErr || !laneRows || laneRows.length === 0) return empty

  const rows = laneRows as LaneRow[]
  let totalShipments = 0
  let weightedAvg = 0
  let weightedTmec = 0
  let totalValue = 0
  let minP10: number | null = null
  let maxP90: number | null = null
  let median: number | null = null
  let maxCompanies = 0
  let latestComputed: string | null = null

  for (const r of rows) {
    const n = r.shipment_count ?? 0
    if (n === 0) continue
    totalShipments += n
    if (r.avg_clearance_days != null) weightedAvg += r.avg_clearance_days * n
    if (r.tmec_rate != null) weightedTmec += r.tmec_rate * n
    if (r.total_value_usd != null) totalValue += r.total_value_usd
    if (r.p10_clearance_days != null) {
      minP10 = minP10 == null ? r.p10_clearance_days : Math.min(minP10, r.p10_clearance_days)
    }
    if (r.p90_clearance_days != null) {
      maxP90 = maxP90 == null ? r.p90_clearance_days : Math.max(maxP90, r.p90_clearance_days)
    }
    if (median == null && r.median_clearance_days != null) {
      median = r.median_clearance_days
    }
    maxCompanies = Math.max(maxCompanies, r.distinct_company_count ?? 0)
    if (r.computed_at && (latestComputed == null || r.computed_at > latestComputed)) {
      latestComputed = r.computed_at
    }
  }

  if (totalShipments === 0) return empty

  return {
    shipment_count: totalShipments,
    distinct_lanes: rows.length,
    // MV is per-lane — distinct_company_count varies by lane; the
    // max across lanes is the best floor for "how many clients on
    // our biggest corridor" without a second round-trip.
    distinct_companies: maxCompanies,
    avg_clearance_days: round(weightedAvg / totalShipments, 3),
    median_clearance_days: round(median, 3),
    p10_clearance_days: round(minP10, 3),
    p90_clearance_days: round(maxP90, 3),
    tmec_rate: round(weightedTmec / totalShipments, 4),
    total_value_usd: round(totalValue, 2),
    period: latestComputed,
    has_data: true,
  }
}

// ──────────────────────────────────────────────────────────────────────
// readLaneLeaderboard — top lanes by volume or clearance speed.
// Always k-anon gated (distinct_company_count >= 3) via the public view.
// ──────────────────────────────────────────────────────────────────────

export type LaneSortKey =
  | 'shipments_desc'
  | 'avg_asc'      // fastest lanes first
  | 'avg_desc'     // slowest first
  | 'tmec_desc'
  | 'value_desc'

export async function readLaneLeaderboard(
  sb: SupabaseClient,
  { limit = 25, sortBy = 'shipments_desc' }: { limit?: number; sortBy?: LaneSortKey } = {},
): Promise<LaneRow[]> {
  let q = sb
    .from('v_trade_index_public')
    .select(
      'aduana, oficina, shipment_count, distinct_company_count, avg_clearance_days, median_clearance_days, p10_clearance_days, p90_clearance_days, total_value_usd, tmec_rate, computed_at',
    )
    .limit(limit)

  switch (sortBy) {
    case 'avg_asc':
      q = q.order('avg_clearance_days', { ascending: true, nullsFirst: false })
      break
    case 'avg_desc':
      q = q.order('avg_clearance_days', { ascending: false, nullsFirst: false })
      break
    case 'tmec_desc':
      q = q.order('tmec_rate', { ascending: false, nullsFirst: false })
      break
    case 'value_desc':
      q = q.order('total_value_usd', { ascending: false, nullsFirst: false })
      break
    case 'shipments_desc':
    default:
      q = q.order('shipment_count', { ascending: false, nullsFirst: false })
      break
  }

  const { data, error } = await q
  if (error || !data) return []
  return data as LaneRow[]
}

// ──────────────────────────────────────────────────────────────────────
// readClientRanking — per-company aggregates for the admin table.
// Source: client_benchmarks (written nightly with percentile), joined
// to companies for display names.
// ──────────────────────────────────────────────────────────────────────

export async function readClientRanking(
  sb: SupabaseClient,
  { limit = 50 }: { limit?: number } = {},
): Promise<ClientRankingRow[]> {
  // Latest period only — refresh-trade-index.js writes a new row per
  // period (YYYY-MM-DD) each run. We take the latest.
  const { data: periodRow, error: periodErr } = await sb
    .from('client_benchmarks')
    .select('period')
    .eq('metric_name', 'avg_crossing_days')
    .order('period', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (periodErr || !periodRow) return []
  const period = (periodRow as { period: string | null }).period
  if (!period) return []

  const { data: rows, error } = await sb
    .from('client_benchmarks')
    .select('company_id, client_value, percentile, total_operations')
    .eq('metric_name', 'avg_crossing_days')
    .eq('period', period)
    .order('percentile', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error || !rows || rows.length === 0) return []

  // Pull company names in a single batched query (no N+1).
  const companyIds = (rows as { company_id: string | null }[])
    .map((r) => r.company_id)
    .filter((s): s is string => typeof s === 'string' && s.length > 0)

  const { data: companies } = await sb
    .from('companies')
    .select('company_id, name')
    .in('company_id', companyIds)

  const nameByCompany = new Map<string, string>()
  for (const c of (companies ?? []) as { company_id: string; name: string | null }[]) {
    if (c.company_id && c.name) nameByCompany.set(c.company_id, c.name)
  }

  // Per-company T-MEC and value are pulled from the client-position MV,
  // summed across that company's lanes.
  const { data: posRows } = await sb
    .from('mv_trade_index_client_position_90d')
    .select('company_id, shipment_count, tmec_rate, total_value_usd')
    .in('company_id', companyIds)

  type PosAgg = { tmecWeighted: number; count: number; value: number }
  const posByCompany = new Map<string, PosAgg>()
  for (const p of (posRows ?? []) as ClientPositionRow[]) {
    const existing = posByCompany.get(p.company_id) ?? { tmecWeighted: 0, count: 0, value: 0 }
    const n = p.shipment_count ?? 0
    existing.count += n
    if (p.tmec_rate != null) existing.tmecWeighted += p.tmec_rate * n
    if (p.total_value_usd != null) existing.value += p.total_value_usd
    posByCompany.set(p.company_id, existing)
  }

  return (rows as Array<{
    company_id: string | null
    client_value: number | null
    percentile: number | null
    total_operations: number | null
  }>)
    .filter((r) => r.company_id)
    .map((r) => {
      const pos = posByCompany.get(r.company_id as string)
      return {
        company_id: r.company_id as string,
        company_name: nameByCompany.get(r.company_id as string) ?? null,
        shipment_count: r.total_operations ?? pos?.count ?? 0,
        avg_clearance_days: r.client_value,
        percentile: r.percentile,
        tmec_rate: pos && pos.count > 0 ? round(pos.tmecWeighted / pos.count, 4) : null,
        total_value_usd: pos ? round(pos.value, 2) : null,
      }
    })
}

// ──────────────────────────────────────────────────────────────────────
// readClientPosition — the client's own position vs fleet.
// Powers <TradeIndexCard> on /mi-cuenta. K-anon gated: returns
// meets_k_anon=false if the client has no lane with ≥3 distinct peers.
// ──────────────────────────────────────────────────────────────────────

export async function readClientPosition(
  sb: SupabaseClient,
  companyId: string,
): Promise<ClientPosition> {
  const empty: ClientPosition = {
    has_data: false,
    meets_k_anon: false,
    client: {
      shipment_count: 0,
      avg_clearance_days: null,
      percentile: null,
      tmec_rate: null,
      total_value_usd: null,
    },
    fleet: {
      avg_clearance_days: null,
      median_clearance_days: null,
      p10_clearance_days: null,
      p90_clearance_days: null,
      sample_size: null,
    },
    period: null,
    k_anon_lane_count: 0,
  }

  if (!companyId) return empty

  // 1. Client's own benchmark row (latest period).
  const { data: benchRow, error: benchErr } = await sb
    .from('client_benchmarks')
    .select(
      'client_value, fleet_average, fleet_median, p10, p90, percentile, sample_size, total_operations, period',
    )
    .eq('company_id', companyId)
    .eq('metric_name', 'avg_crossing_days')
    .order('period', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (benchErr || !benchRow) return empty
  const bench = benchRow as {
    client_value: number | null
    fleet_average: number | null
    fleet_median: number | null
    p10: number | null
    p90: number | null
    percentile: number | null
    sample_size: number | null
    total_operations: number | null
    period: string | null
  }

  const clientOps = bench.total_operations ?? 0
  const fleetSample = bench.sample_size ?? 0
  const hasData =
    clientOps >= MIN_CLIENT_SHIPMENTS && fleetSample >= MIN_FLEET_SAMPLE

  if (!hasData) {
    return { ...empty, period: bench.period }
  }

  // 2. Client's per-lane rows — for weighted TMEC + total value, and
  //    to count how many of their lanes survive the k-anon floor.
  const { data: posRows } = await sb
    .from('mv_trade_index_client_position_90d')
    .select('aduana, oficina, shipment_count, tmec_rate, total_value_usd')
    .eq('company_id', companyId)

  let tmecWeighted = 0
  let tmecDenom = 0
  let totalValue = 0
  const clientLanes: Array<{ aduana: string; oficina: string }> = []
  for (const p of (posRows ?? []) as ClientPositionRow[]) {
    const n = p.shipment_count ?? 0
    if (p.tmec_rate != null && n > 0) {
      tmecWeighted += p.tmec_rate * n
      tmecDenom += n
    }
    if (p.total_value_usd != null) totalValue += p.total_value_usd
    if (p.aduana && p.oficina) {
      clientLanes.push({ aduana: p.aduana, oficina: p.oficina })
    }
  }

  // 3. K-anon check: how many of the client's lanes appear in the
  //    public (≥3 distinct companies) view?
  let kAnonCount = 0
  if (clientLanes.length > 0) {
    // The ".or()" filter is the narrowest way to match N specific
    // (aduana, oficina) pairs in one round-trip. Postgres happily
    // parses this; Supabase's PostgREST forwards it verbatim.
    const orClauses = clientLanes
      .map(
        (l) =>
          `and(aduana.eq.${escapeForOr(l.aduana)},oficina.eq.${escapeForOr(l.oficina)})`,
      )
      .join(',')
    const { data: publicLanes } = await sb
      .from('v_trade_index_public')
      .select('aduana, oficina')
      .or(orClauses)
    kAnonCount = publicLanes ? publicLanes.length : 0
  }

  return {
    has_data: true,
    meets_k_anon: kAnonCount > 0,
    client: {
      shipment_count: clientOps,
      avg_clearance_days: bench.client_value,
      percentile: bench.percentile,
      tmec_rate: tmecDenom > 0 ? round(tmecWeighted / tmecDenom, 4) : null,
      total_value_usd: round(totalValue, 2),
    },
    fleet: {
      avg_clearance_days: bench.fleet_average,
      median_clearance_days: bench.fleet_median,
      p10_clearance_days: bench.p10,
      p90_clearance_days: bench.p90,
      sample_size: bench.sample_size,
    },
    period: bench.period,
    k_anon_lane_count: kAnonCount,
  }
}

// ──────────────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────────────

function round(n: number | null | undefined, places: number): number | null {
  if (n == null || !Number.isFinite(n)) return null
  const f = 10 ** places
  return Math.round(n * f) / f
}

// Supabase .or() clause values must escape commas + parens. Aduana /
// oficina values are short numeric codes in practice, but defend in
// depth so a future alphanumeric code doesn't smuggle a comma through.
function escapeForOr(v: string): string {
  return v.replace(/[(),]/g, '')
}

// Re-exported for test scaffolding.
export const _TEST_MIN_CLIENT_SHIPMENTS = MIN_CLIENT_SHIPMENTS
export const _TEST_MIN_FLEET_SAMPLE = MIN_FLEET_SAMPLE
