/**
 * Crossing insights — the first V2 intelligence layer.
 *
 * Why:
 *   Every tenant has months of `traficos` + `globalpc_partidas` data.
 *   A smart broker can spot patterns a human scan can't: a SKU that
 *   suddenly breaks a long green streak, a proveedor whose semáforo
 *   rate slipped 15% week-over-week, a fracción that's been flagged
 *   red three times running. These are the "Cruzó Verde" moments
 *   the user asked for in the V2 kickoff brief.
 *
 * Design:
 *   - All three aggregations take a `SupabaseClient` + `companyId`.
 *     Tenant isolation is enforced at query time via `.eq('company_id', …)` —
 *     never trust the caller to have pre-filtered.
 *   - Pure-ish: DB queries return minimal rows; all aggregation logic
 *     is local JS that tests can exercise with fixture data (see
 *     `computePartStreaks`, `computeProveedorHealth`, `detectAnomalies`).
 *   - Every function has a "time window" parameter with a sane default
 *     (90 days for most signals; anomaly detector uses 14d vs 14d).
 *
 * What this module is NOT:
 *   - Not a scheduler. Callers invoke these; PM2 crons are separate.
 *   - Not a notifier. Callers surface insights; Telegram/Mensajería
 *     is wired separately (see automation hooks doc).
 *   - Not ML. These are rule-based signals on recent data. ML belongs
 *     in a later phase with a proper training pipeline.
 *
 * The three primary signals:
 *   1. Part streaks       — SKUs with long green streaks + recent breaks
 *   2. Proveedor health   — semáforo verde-rate per supplier
 *   3. Anomaly detection  — week-over-week shifts worth investigating
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ──────────────────────────────────────────────────────────

/** 0 verde · 1 amarillo · 2 rojo · null unknown. */
export type SemaforoValue = 0 | 1 | 2 | null

export interface PartStreak {
  cve_producto: string
  /** Current consecutive verde count, newest first. 0 if the most-recent
   * crossing wasn't verde. */
  current_verde_streak: number
  /** Longest-ever verde streak in the fetched window. Tracks "records". */
  longest_verde_streak: number
  /** True iff the previous run was verde and was broken in the last
   * 30 days. Surfaces as "watch" signals. */
  just_broke_streak: boolean
  /** The most-recent semáforo result (null if never crossed). */
  last_semaforo: SemaforoValue
  /** Most-recent fecha_cruce. ISO string. */
  last_fecha_cruce: string | null
  /** Total crossings in the window. */
  total_crossings: number
}

export interface ProveedorHealth {
  cve_proveedor: string
  total_crossings: number
  verde_count: number
  amarillo_count: number
  rojo_count: number
  /** verde_count / total_crossings · null when total=0 */
  pct_verde: number | null
  /** Most-recent fecha_cruce for this proveedor. */
  last_fecha_cruce: string | null
}

export interface Anomaly {
  kind:
    | 'semaforo_rate_drop'
    | 'proveedor_slip'
    | 'streak_break'
  subject: string // cve_producto or cve_proveedor
  detail: string // humanized Spanish summary
  score: number // 0..1 severity — higher = more attention
  occurred_at: string // ISO
  metadata: Record<string, unknown>
}

export interface InsightsPayload {
  generated_at: string
  company_id: string
  /** Top 5 parts by longest current verde streak. */
  green_streaks: PartStreak[]
  /** Parts whose green streak broke in the last 30 days. */
  broken_streaks: PartStreak[]
  /** Top proveedores by verde rate (total > 5 crossings for signal). */
  top_proveedores: ProveedorHealth[]
  /** Proveedores with declining health — pct_verde < 80%. */
  watch_proveedores: ProveedorHealth[]
  /** Rule-based anomalies in the window. */
  anomalies: Anomaly[]
}

// ── Pure aggregation helpers (unit-testable) ───────────────────────

interface RawCrossing {
  cve_producto: string | null
  cve_proveedor: string | null
  cve_trafico: string | null
}

interface RawTrafico {
  trafico: string | null
  fecha_cruce: string | null
  semaforo: number | null
}

/**
 * Compute per-part streak statistics from a pre-joined stream.
 * Pure — no DB dependency. Exported for tests.
 */
export function computePartStreaks(
  crossings: Array<{
    cve_producto: string
    fecha_cruce: string | null
    semaforo: SemaforoValue
  }>,
): PartStreak[] {
  const byPart = new Map<
    string,
    Array<{ fecha_cruce: string | null; semaforo: SemaforoValue }>
  >()
  for (const row of crossings) {
    if (!row.cve_producto) continue
    const list = byPart.get(row.cve_producto) ?? []
    list.push({ fecha_cruce: row.fecha_cruce, semaforo: row.semaforo })
    byPart.set(row.cve_producto, list)
  }

  const result: PartStreak[] = []
  const now = Date.now()
  const thirtyDaysAgo = now - 30 * 86_400_000

  for (const [cve, events] of byPart) {
    // Newest first
    events.sort((a, b) => (b.fecha_cruce ?? '').localeCompare(a.fecha_cruce ?? ''))

    // Current streak: consecutive verde from newest end backward.
    let current = 0
    for (const e of events) {
      if (e.semaforo === 0) current += 1
      else break
    }

    // Longest streak anywhere in the window.
    let longest = 0
    let running = 0
    for (const e of events) {
      if (e.semaforo === 0) {
        running += 1
        longest = Math.max(longest, running)
      } else {
        running = 0
      }
    }

    // Did a streak break in the last 30 days?
    // Definition: events[0] is NOT verde, AND events[1] IS verde, AND
    // events[0].fecha_cruce falls within the 30-day window.
    let justBroke = false
    if (events.length >= 2) {
      const mostRecent = events[0]
      const prior = events[1]
      if (
        mostRecent.semaforo !== 0 &&
        prior.semaforo === 0 &&
        mostRecent.fecha_cruce
      ) {
        const ts = new Date(mostRecent.fecha_cruce).getTime()
        if (Number.isFinite(ts) && ts >= thirtyDaysAgo) justBroke = true
      }
    }

    result.push({
      cve_producto: cve,
      current_verde_streak: current,
      longest_verde_streak: longest,
      just_broke_streak: justBroke,
      last_semaforo: events[0]?.semaforo ?? null,
      last_fecha_cruce: events[0]?.fecha_cruce ?? null,
      total_crossings: events.length,
    })
  }

  return result
}

/**
 * Compute per-proveedor health from a pre-joined stream.
 * Pure — no DB dependency.
 */
export function computeProveedorHealth(
  crossings: Array<{
    cve_proveedor: string
    fecha_cruce: string | null
    semaforo: SemaforoValue
  }>,
): ProveedorHealth[] {
  const byProv = new Map<
    string,
    { verde: number; amarillo: number; rojo: number; total: number; lastDate: string | null }
  >()
  for (const row of crossings) {
    if (!row.cve_proveedor) continue
    const agg = byProv.get(row.cve_proveedor) ?? {
      verde: 0,
      amarillo: 0,
      rojo: 0,
      total: 0,
      lastDate: null,
    }
    agg.total += 1
    if (row.semaforo === 0) agg.verde += 1
    else if (row.semaforo === 1) agg.amarillo += 1
    else if (row.semaforo === 2) agg.rojo += 1
    if (row.fecha_cruce && (!agg.lastDate || row.fecha_cruce > agg.lastDate)) {
      agg.lastDate = row.fecha_cruce
    }
    byProv.set(row.cve_proveedor, agg)
  }

  const out: ProveedorHealth[] = []
  for (const [clave, a] of byProv) {
    out.push({
      cve_proveedor: clave,
      total_crossings: a.total,
      verde_count: a.verde,
      amarillo_count: a.amarillo,
      rojo_count: a.rojo,
      pct_verde: a.total > 0 ? Math.round((a.verde / a.total) * 100) : null,
      last_fecha_cruce: a.lastDate,
    })
  }
  out.sort((a, b) => (b.pct_verde ?? 0) - (a.pct_verde ?? 0))
  return out
}

/**
 * Simple rule-based anomaly detector.
 * Rules:
 *   - Proveedor verde rate dropped ≥ 10 pp week-over-week (prior 7d vs
 *     current 7d), and prior rate was ≥ 70%. Only fires with ≥ 3
 *     crossings in each window — avoids noise.
 *   - Streak break on a SKU whose longest_verde_streak ≥ 5.
 * Pure — no DB dependency.
 */
export function detectAnomalies(
  crossings: Array<{
    cve_producto: string | null
    cve_proveedor: string | null
    fecha_cruce: string | null
    semaforo: SemaforoValue
  }>,
  now: number = Date.now(),
): Anomaly[] {
  const anomalies: Anomaly[] = []
  const SEVEN_D = 7 * 86_400_000
  const cutoffRecent = now - SEVEN_D
  const cutoffPrior = now - 2 * SEVEN_D

  // ── Proveedor verde-rate drop ───────────────────────────────────
  const byProv = new Map<
    string,
    { recent: { v: number; t: number }; prior: { v: number; t: number } }
  >()
  for (const c of crossings) {
    if (!c.cve_proveedor || !c.fecha_cruce) continue
    const ts = new Date(c.fecha_cruce).getTime()
    if (!Number.isFinite(ts)) continue
    if (ts < cutoffPrior) continue
    const bucket = byProv.get(c.cve_proveedor) ?? {
      recent: { v: 0, t: 0 },
      prior: { v: 0, t: 0 },
    }
    if (ts >= cutoffRecent) {
      bucket.recent.t += 1
      if (c.semaforo === 0) bucket.recent.v += 1
    } else {
      bucket.prior.t += 1
      if (c.semaforo === 0) bucket.prior.v += 1
    }
    byProv.set(c.cve_proveedor, bucket)
  }
  for (const [clave, b] of byProv) {
    if (b.recent.t < 3 || b.prior.t < 3) continue
    const priorPct = (b.prior.v / b.prior.t) * 100
    const recentPct = (b.recent.v / b.recent.t) * 100
    const drop = priorPct - recentPct
    if (priorPct >= 70 && drop >= 10) {
      anomalies.push({
        kind: 'proveedor_slip',
        subject: clave,
        detail: `Proveedor ${clave} bajó de ${Math.round(priorPct)}% a ${Math.round(recentPct)}% verde esta semana (${b.recent.v}/${b.recent.t} vs ${b.prior.v}/${b.prior.t}).`,
        score: Math.min(1, drop / 30),
        occurred_at: new Date(now).toISOString(),
        metadata: {
          prior_pct: Math.round(priorPct),
          recent_pct: Math.round(recentPct),
          drop_pp: Math.round(drop),
        },
      })
    }
  }

  // ── Streak breaks ───────────────────────────────────────────────
  const partStreaks = computePartStreaks(
    crossings
      .filter((c): c is typeof c & { cve_producto: string } => !!c.cve_producto)
      .map((c) => ({
        cve_producto: c.cve_producto,
        fecha_cruce: c.fecha_cruce,
        semaforo: c.semaforo,
      })),
  )
  for (const s of partStreaks) {
    if (s.just_broke_streak && s.longest_verde_streak >= 5) {
      anomalies.push({
        kind: 'streak_break',
        subject: s.cve_producto,
        detail: `${s.cve_producto} rompió una racha de ${s.longest_verde_streak} cruces verdes. Último cruce: ${s.last_fecha_cruce?.slice(0, 10) ?? '—'}.`,
        score: Math.min(1, s.longest_verde_streak / 20),
        occurred_at: s.last_fecha_cruce ?? new Date(now).toISOString(),
        metadata: {
          longest_streak: s.longest_verde_streak,
          last_semaforo: s.last_semaforo,
        },
      })
    }
  }

  // Sort by score desc.
  anomalies.sort((a, b) => b.score - a.score)
  return anomalies
}

// ── DB-facing entry points ─────────────────────────────────────────

const DEFAULT_WINDOW_DAYS = 90
const PART_FETCH_LIMIT = 5000

/**
 * Fetch + aggregate insights for a tenant. Single orchestrator that
 * all callers (API route, future cron) use. Handles DB errors by
 * returning an empty but well-formed payload so the UI degrades
 * gracefully (never renders a crash page).
 */
export async function getCrossingInsights(
  supabase: SupabaseClient,
  companyId: string,
  opts: { windowDays?: number; now?: number } = {},
): Promise<InsightsPayload> {
  const windowDays = opts.windowDays ?? DEFAULT_WINDOW_DAYS
  const now = opts.now ?? Date.now()
  const cutoffIso = new Date(now - windowDays * 86_400_000).toISOString()

  const empty: InsightsPayload = {
    generated_at: new Date(now).toISOString(),
    company_id: companyId,
    green_streaks: [],
    broken_streaks: [],
    top_proveedores: [],
    watch_proveedores: [],
    anomalies: [],
  }
  if (!companyId) return empty

  // 1. Partidas in window — pulls the SKU + proveedor + trafico-ref triple.
  const { data: partidasRaw, error: partidasErr } = await supabase
    .from('globalpc_partidas')
    .select('cve_producto, cve_proveedor, cve_trafico')
    .eq('company_id', companyId)
    .gte('created_at', cutoffIso)
    .limit(PART_FETCH_LIMIT)

  if (partidasErr) return empty
  const partidas = (partidasRaw ?? []) as RawCrossing[]
  if (partidas.length === 0) return empty

  // 2. Traficos for those distinct trafico refs — for fecha_cruce + semaforo.
  const distinctTraficos = Array.from(
    new Set(
      partidas
        .map((p) => p.cve_trafico)
        .filter((t): t is string => typeof t === 'string' && t.length > 0),
    ),
  )
  if (distinctTraficos.length === 0) return empty

  const traficoByRef = new Map<
    string,
    { fecha_cruce: string | null; semaforo: SemaforoValue }
  >()
  // Chunk to avoid overly-long IN clauses.
  for (let i = 0; i < distinctTraficos.length; i += 500) {
    const batch = distinctTraficos.slice(i, i + 500)
    const { data: traficosRaw } = await supabase
      .from('traficos')
      .select('trafico, fecha_cruce, semaforo')
      .eq('company_id', companyId)
      .in('trafico', batch)
    for (const t of (traficosRaw ?? []) as RawTrafico[]) {
      if (!t.trafico) continue
      traficoByRef.set(t.trafico, {
        fecha_cruce: t.fecha_cruce ?? null,
        semaforo:
          t.semaforo === 0 || t.semaforo === 1 || t.semaforo === 2
            ? (t.semaforo as SemaforoValue)
            : null,
      })
    }
  }

  // 3. Join: build the enriched crossing stream.
  const enriched: Array<{
    cve_producto: string | null
    cve_proveedor: string | null
    fecha_cruce: string | null
    semaforo: SemaforoValue
  }> = partidas
    .map((p) => {
      const t = p.cve_trafico ? traficoByRef.get(p.cve_trafico) : null
      if (!t || !t.fecha_cruce) return null // only count filed crossings
      return {
        cve_producto: p.cve_producto,
        cve_proveedor: p.cve_proveedor,
        fecha_cruce: t.fecha_cruce,
        semaforo: t.semaforo,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  // 4. Aggregate.
  const streaks = computePartStreaks(
    enriched
      .filter((c): c is typeof c & { cve_producto: string } => !!c.cve_producto)
      .map((c) => ({
        cve_producto: c.cve_producto,
        fecha_cruce: c.fecha_cruce,
        semaforo: c.semaforo,
      })),
  )
  const proveedores = computeProveedorHealth(
    enriched
      .filter((c): c is typeof c & { cve_proveedor: string } => !!c.cve_proveedor)
      .map((c) => ({
        cve_proveedor: c.cve_proveedor,
        fecha_cruce: c.fecha_cruce,
        semaforo: c.semaforo,
      })),
  )
  const anomalies = detectAnomalies(enriched, now)

  const green_streaks = streaks
    .filter((s) => s.current_verde_streak >= 3)
    .sort((a, b) => b.current_verde_streak - a.current_verde_streak)
    .slice(0, 5)
  const broken_streaks = streaks
    .filter((s) => s.just_broke_streak && s.longest_verde_streak >= 3)
    .slice(0, 10)
  const top_proveedores = proveedores
    .filter((p) => p.total_crossings >= 5 && (p.pct_verde ?? 0) >= 90)
    .slice(0, 5)
  const watch_proveedores = proveedores
    .filter((p) => p.total_crossings >= 5 && (p.pct_verde ?? 100) < 80)
    .slice(0, 5)

  return {
    generated_at: new Date(now).toISOString(),
    company_id: companyId,
    green_streaks,
    broken_streaks,
    top_proveedores,
    watch_proveedores,
    anomalies,
  }
}
