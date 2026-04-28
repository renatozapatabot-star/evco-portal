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
import { resolvePartidaLinks } from '@/lib/queries/partidas-trafico-link'

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
    /** SKU with ≥ 3× partida volume recent 7d vs prior 7d (min 3 prior). */
    | 'volume_spike'
    /** Proveedor appearing in the current window but never before
     *  (or only once before). First-ever crossing gets a calm flag
     *  so the broker can validate the supplier before scale. */
    | 'new_proveedor'
  subject: string // cve_producto or cve_proveedor
  detail: string // humanized Spanish summary
  score: number // 0..1 severity — higher = more attention
  occurred_at: string // ISO
  metadata: Record<string, unknown>
}

/** Volume summary — total partida count in the last 7d vs prior 7d.
 *  Surfaced on /admin/intelligence as a volume health signal. */
export interface VolumeSummary {
  recent_7d: number
  prior_7d: number
  /** recent / prior · null when prior=0 */
  ratio: number | null
  /** Signed pp change · null when prior=0 */
  delta_pct: number | null
  /** 7-point daily series — one element per day, oldest → newest.
   *  index 0 = 7 days ago; index 6 = yesterday. Each element is a
   *  { date, count, verde_pct } triple for sparkline rendering. */
  daily_series: Array<{ date: string; count: number; verde_pct: number | null }>
}

/** Fracción chapter health — semáforo rate aggregated by the first
 *  two digits of the fracción arancelaria (SAT chapter). Surfaces
 *  tariff-class risk concentrations: "every HTS 39.x.x shipment
 *  this month went verde". */
export interface FraccionHealth {
  /** 2-digit chapter (e.g. "39", "40", "84"). */
  chapter: string
  /** Partida count within the chapter. */
  total_crossings: number
  verde_count: number
  amarillo_count: number
  rojo_count: number
  /** verde_count / total · null when total=0 */
  pct_verde: number | null
  /** Most-recent cruce ISO date within the chapter. */
  last_fecha_cruce: string | null
}

/** Cruzó Verde predictor — early signal blending SKU + proveedor +
 *  fracción signals into an explainable probability. Not ML; a
 *  transparent rule-weighted score that operators can reason about. */
export interface VerdePrediction {
  cve_producto: string
  /** 0..1 probability the next crossing of this SKU ends verde. */
  probability: number
  /** Human-readable confidence band. */
  band: 'high' | 'medium' | 'low'
  /** One-sentence Spanish summary for the insight card. */
  summary: string
  /** Signed contributions summing to (probability - baseline). Each
   *  entry is `{ factor, delta_pp, detail }` where delta_pp is signed
   *  percentage points. Lets the UI render an explainable breakdown. */
  factors: Array<{ factor: string; delta_pp: number; detail: string }>
  /** Baseline portal-wide verde rate used as the starting point. */
  baseline_pct: number
  /** Proveedor that drove most of the signal (for display). */
  cve_proveedor: string | null
  /** Most-recent cruce iso for this SKU. */
  last_fecha_cruce: string | null
  /** Total crossings observed in window. */
  total_crossings: number
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
  /** Week-over-week partida volume summary. */
  volume: VolumeSummary
  /** Fracción chapter health (top 10 by volume). Tariff-class risk lens. */
  fraccion_health: FraccionHealth[]
  /** Top 5 SKUs with highest predicted next-crossing verde probability. */
  top_predictions: VerdePrediction[]
  /** SKUs with LOW predicted verde probability — operator watch list. */
  watch_predictions: VerdePrediction[]
  /** Portal-wide verde rate used as the predictor baseline. */
  baseline_verde_pct: number
}

// ── Pure aggregation helpers (unit-testable) ───────────────────────

interface RawPartidaForInsights {
  cve_producto: string | null
  cve_proveedor: string | null
  folio: number | null
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
 * Rules (in order of precision):
 *   1. `proveedor_slip` — verde rate dropped ≥ 10pp WoW (prior 7d vs
 *      current 7d), and prior rate was ≥ 70%. Only fires with ≥ 3
 *      crossings in each window — avoids noise.
 *   2. `streak_break` — SKU whose longest_verde_streak ≥ 5 had its
 *      current streak broken in the last 30 days.
 *   3. `volume_spike` — SKU with ≥ 3× partida volume in the recent 7d
 *      window vs prior 7d. Fires only when prior had ≥ 3 crossings so
 *      we don't flag every-rare-SKU's second shipment. Score = min(1,
 *      ratio/10) so a 10× spike = score 1.0.
 *   4. `new_proveedor` — proveedor whose first appearance is in the
 *      recent 14 days and has ≤ 3 crossings total. Calm signal — the
 *      broker should validate the new supplier before scale. Score
 *      fixed at 0.4 (informational, not urgent).
 *
 * Pure — no DB dependency. Sorted by score desc at return.
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

  // ── Volume spike per SKU (recent 7d ≥ 3× prior 7d) ──────────────
  const byPart = new Map<
    string,
    { recent: number; prior: number; lastCrossIso: string | null }
  >()
  for (const c of crossings) {
    if (!c.cve_producto || !c.fecha_cruce) continue
    const ts = new Date(c.fecha_cruce).getTime()
    if (!Number.isFinite(ts)) continue
    if (ts < cutoffPrior) continue
    const bucket = byPart.get(c.cve_producto) ?? {
      recent: 0,
      prior: 0,
      lastCrossIso: null,
    }
    if (ts >= cutoffRecent) bucket.recent += 1
    else bucket.prior += 1
    if (!bucket.lastCrossIso || c.fecha_cruce > bucket.lastCrossIso) {
      bucket.lastCrossIso = c.fecha_cruce
    }
    byPart.set(c.cve_producto, bucket)
  }
  for (const [cve, b] of byPart) {
    if (b.prior < 3) continue
    const ratio = b.recent / b.prior
    if (ratio < 3) continue
    anomalies.push({
      kind: 'volume_spike',
      subject: cve,
      detail: `${cve} subió de ${b.prior} a ${b.recent} cruces semanales (${ratio.toFixed(1)}×). Validar que es crecimiento planeado.`,
      score: Math.min(1, ratio / 10),
      occurred_at: b.lastCrossIso ?? new Date(now).toISOString(),
      metadata: { recent_count: b.recent, prior_count: b.prior, ratio: Math.round(ratio * 10) / 10 },
    })
  }

  // ── New proveedor (first-seen in last 14d, ≤ 3 total crossings) ─
  const byProvNew = new Map<
    string,
    { total: number; firstSeenIso: string | null; lastCrossIso: string | null }
  >()
  for (const c of crossings) {
    if (!c.cve_proveedor || !c.fecha_cruce) continue
    const bucket = byProvNew.get(c.cve_proveedor) ?? {
      total: 0,
      firstSeenIso: null,
      lastCrossIso: null,
    }
    bucket.total += 1
    if (!bucket.firstSeenIso || c.fecha_cruce < bucket.firstSeenIso) {
      bucket.firstSeenIso = c.fecha_cruce
    }
    if (!bucket.lastCrossIso || c.fecha_cruce > bucket.lastCrossIso) {
      bucket.lastCrossIso = c.fecha_cruce
    }
    byProvNew.set(c.cve_proveedor, bucket)
  }
  const fourteenDaysAgoMs = now - 14 * 86_400_000
  for (const [clave, b] of byProvNew) {
    if (b.total > 3) continue
    if (!b.firstSeenIso) continue
    const firstMs = new Date(b.firstSeenIso).getTime()
    if (!Number.isFinite(firstMs) || firstMs < fourteenDaysAgoMs) continue
    anomalies.push({
      kind: 'new_proveedor',
      subject: clave,
      detail: `Proveedor ${clave} apareció por primera vez el ${b.firstSeenIso.slice(0, 10)} (${b.total} cruce${b.total === 1 ? '' : 's'}). Validar RFC, T-MEC y riesgo antes de escalar.`,
      score: 0.4,
      occurred_at: b.firstSeenIso,
      metadata: { total_crossings: b.total, first_seen: b.firstSeenIso },
    })
  }

  // Sort by score desc.
  anomalies.sort((a, b) => b.score - a.score)
  return anomalies
}

/**
 * Compute the week-over-week volume summary from a crossing stream.
 * Pure — no DB dependency.
 */
export function computeVolumeSummary(
  crossings: Array<{ fecha_cruce: string | null; semaforo?: SemaforoValue }>,
  now: number = Date.now(),
): VolumeSummary {
  const SEVEN_D = 7 * 86_400_000
  const cutoffRecent = now - SEVEN_D
  const cutoffPrior = now - 2 * SEVEN_D
  let recent = 0
  let prior = 0

  // Daily series — 7 days, oldest first. Each bucket captures count +
  // verde rate so the UI can render a dual sparkline (volume bar +
  // verde line).
  const daily: Array<{ date: string; count: number; verdeCount: number; totalWithSemaforo: number }> = []
  const DAY_MS = 86_400_000
  // Anchor the bucket to the start of each calendar day (UTC-agnostic
  // here — the UI renders with America/Chicago tz when displaying).
  const todayUtcStartMs =
    Math.floor(now / DAY_MS) * DAY_MS
  for (let i = 6; i >= 0; i--) {
    const bucketStart = todayUtcStartMs - i * DAY_MS
    daily.push({
      date: new Date(bucketStart).toISOString().slice(0, 10),
      count: 0,
      verdeCount: 0,
      totalWithSemaforo: 0,
    })
  }

  for (const c of crossings) {
    if (!c.fecha_cruce) continue
    const ts = new Date(c.fecha_cruce).getTime()
    if (!Number.isFinite(ts)) continue
    if (ts >= cutoffRecent) recent += 1
    else if (ts >= cutoffPrior) prior += 1

    // Daily bucketing: find which of the 7 buckets (if any) this falls in.
    if (ts >= cutoffRecent && ts < now + DAY_MS) {
      const bucketStart = Math.floor(ts / DAY_MS) * DAY_MS
      const idx = Math.floor((bucketStart - (todayUtcStartMs - 6 * DAY_MS)) / DAY_MS)
      if (idx >= 0 && idx < 7) {
        daily[idx].count += 1
        if (c.semaforo === 0) daily[idx].verdeCount += 1
        if (c.semaforo === 0 || c.semaforo === 1 || c.semaforo === 2) {
          daily[idx].totalWithSemaforo += 1
        }
      }
    }
  }

  const daily_series = daily.map((d) => ({
    date: d.date,
    count: d.count,
    verde_pct:
      d.totalWithSemaforo > 0
        ? Math.round((d.verdeCount / d.totalWithSemaforo) * 100)
        : null,
  }))

  const ratio = prior > 0 ? recent / prior : null
  const delta_pct = prior > 0 ? Math.round(((recent - prior) / prior) * 100) : null
  return { recent_7d: recent, prior_7d: prior, ratio, delta_pct, daily_series }
}

/**
 * Aggregate semáforo counts per fracción chapter (first 2 digits of
 * the HTS code — e.g. "39" = plastics, "84" = mechanical machinery).
 * Pure — no DB dependency. Caller supplies crossings already enriched
 * with fraccion (from a products join).
 */
export function computeFraccionHealth(
  crossings: Array<{
    fraccion: string | null
    fecha_cruce: string | null
    semaforo: SemaforoValue
  }>,
): FraccionHealth[] {
  const byChapter = new Map<
    string,
    { verde: number; amarillo: number; rojo: number; total: number; lastDate: string | null }
  >()
  for (const row of crossings) {
    if (!row.fraccion) continue
    // Normalize: strip dots, take first 2 digits. "3903.20.01" → "39".
    const digits = row.fraccion.replace(/\D/g, '')
    if (digits.length < 2) continue
    const chapter = digits.slice(0, 2)
    const agg = byChapter.get(chapter) ?? {
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
    byChapter.set(chapter, agg)
  }

  const out: FraccionHealth[] = []
  for (const [chapter, a] of byChapter) {
    out.push({
      chapter,
      total_crossings: a.total,
      verde_count: a.verde,
      amarillo_count: a.amarillo,
      rojo_count: a.rojo,
      pct_verde: a.total > 0 ? Math.round((a.verde / a.total) * 100) : null,
      last_fecha_cruce: a.lastDate,
    })
  }
  out.sort((a, b) => b.total_crossings - a.total_crossings)
  return out
}

/**
 * Cruzó Verde predictor — rule-based early signal for a single SKU's
 * next-crossing verde probability. Explainable, not ML.
 *
 * Factors (each contributes signed percentage points to the baseline):
 *   +5 pp   for every verde in current streak (capped at +15)
 *   +10 pp  if proveedor pct_verde ≥ 95%
 *    +5 pp  if proveedor pct_verde 85-94%
 *    0 pp   proveedor 75-84% (neutral)
 *   -10 pp  if proveedor pct_verde < 75%
 *   -15 pp  if just_broke_streak
 *   -10 pp  if fracción chapter pct_verde < 90%
 *   +3 pp   if SKU has ≥ 5 total crossings (signal confidence)
 *
 * Result clipped to [5, 99]. Bands: ≥ 92 = high, 80-91 = medium, < 80 = low.
 */
export function predictVerdeProbability(input: {
  streak: PartStreak
  proveedor: ProveedorHealth | null
  fraccionHealth: FraccionHealth | null
  baselinePct: number
}): VerdePrediction {
  const { streak, proveedor, fraccionHealth, baselinePct } = input
  const factors: VerdePrediction['factors'] = []

  // 1. Streak contribution (capped).
  const streakDelta = Math.min(streak.current_verde_streak * 5, 15)
  if (streakDelta > 0) {
    factors.push({
      factor: 'streak',
      delta_pp: streakDelta,
      detail: `${streak.current_verde_streak} verdes consecutivos (+${streakDelta} pp)`,
    })
  }

  // 2. Proveedor health.
  if (proveedor && proveedor.pct_verde != null && proveedor.total_crossings >= 3) {
    let provDelta = 0
    if (proveedor.pct_verde >= 95) provDelta = 10
    else if (proveedor.pct_verde >= 85) provDelta = 5
    else if (proveedor.pct_verde >= 75) provDelta = 0
    else provDelta = -10
    if (provDelta !== 0) {
      factors.push({
        factor: 'proveedor',
        delta_pp: provDelta,
        detail: `Proveedor ${proveedor.cve_proveedor} @ ${proveedor.pct_verde}% verde (${provDelta >= 0 ? '+' : ''}${provDelta} pp)`,
      })
    }
  }

  // 3. Broken-streak penalty.
  if (streak.just_broke_streak) {
    factors.push({
      factor: 'streak_break',
      delta_pp: -15,
      detail: `Racha reciente rota (-15 pp)`,
    })
  }

  // 4. Fracción chapter risk.
  if (
    fraccionHealth &&
    fraccionHealth.pct_verde != null &&
    fraccionHealth.pct_verde < 90 &&
    fraccionHealth.total_crossings >= 5
  ) {
    factors.push({
      factor: 'fraccion_risk',
      delta_pp: -10,
      detail: `Capítulo ${fraccionHealth.chapter} @ ${fraccionHealth.pct_verde}% (-10 pp)`,
    })
  }

  // 5. Signal confidence boost.
  if (streak.total_crossings >= 5) {
    factors.push({
      factor: 'sample_confidence',
      delta_pp: 3,
      detail: `${streak.total_crossings} cruces en ventana (+3 pp)`,
    })
  }

  const totalDelta = factors.reduce((s, f) => s + f.delta_pp, 0)
  const probabilityPct = Math.max(5, Math.min(99, baselinePct + totalDelta))
  const probability = probabilityPct / 100

  const band: VerdePrediction['band'] =
    probabilityPct >= 92 ? 'high' : probabilityPct >= 80 ? 'medium' : 'low'

  const summaryBand = band === 'high' ? 'alta' : band === 'medium' ? 'media' : 'baja'
  const summary = `Probabilidad ${probabilityPct}% de cruzar verde · confianza ${summaryBand}`

  return {
    cve_producto: streak.cve_producto,
    probability,
    band,
    summary,
    factors,
    baseline_pct: baselinePct,
    cve_proveedor: proveedor?.cve_proveedor ?? null,
    last_fecha_cruce: streak.last_fecha_cruce,
    total_crossings: streak.total_crossings,
  }
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
    volume: { recent_7d: 0, prior_7d: 0, ratio: null, delta_pct: null, daily_series: [] },
    fraccion_health: [],
    top_predictions: [],
    watch_predictions: [],
    baseline_verde_pct: 0,
  }
  if (!companyId) return empty

  // 1. Partidas in window — real schema: cve_producto + cve_proveedor +
  //    folio. The join to traficos goes through facturas (partidas
  //    DOES NOT have cve_trafico — M11/M12 schema-drift finding).
  const { data: partidasRaw, error: partidasErr } = await supabase
    .from('globalpc_partidas')
    .select('cve_producto, cve_proveedor, folio')
    .eq('company_id', companyId)
    .gte('created_at', cutoffIso)
    .limit(PART_FETCH_LIMIT)

  if (partidasErr) return empty
  const partidas = (partidasRaw ?? []) as RawPartidaForInsights[]
  if (partidas.length === 0) return empty

  // 2. Resolve the 2-hop join (partidas → facturas → traficos) via the
  //    shared helper. Handles tenant scoping + chunking.
  const links = await resolvePartidaLinks(
    supabase,
    companyId,
    partidas.map((p) => ({
      folio: p.folio,
      cve_producto: p.cve_producto,
      cve_proveedor: p.cve_proveedor,
    })),
  )
  if (links.byFolio.size === 0) return empty

  // 2.5. Enrich cve_producto → fraccion via globalpc_productos. This is
  //     the canonical 3rd hop (partidas.cve_producto → productos.fraccion)
  //     documented in handbook §28.3. Chunked .in() to stay under
  //     PostgREST URL limits on wide tenants.
  const distinctCves = Array.from(
    new Set(partidas.map((p) => p.cve_producto).filter((c): c is string => !!c)),
  )
  const fraccionByCve = new Map<string, string | null>()
  if (distinctCves.length > 0) {
    for (let i = 0; i < distinctCves.length; i += 500) {
      const slice = distinctCves.slice(i, i + 500)
      const { data: prods } = await supabase
        .from('globalpc_productos')
        .select('cve_producto, fraccion')
        .eq('company_id', companyId)
        .in('cve_producto', slice)
      for (const row of (prods ?? []) as Array<{ cve_producto: string | null; fraccion: string | null }>) {
        if (row.cve_producto) fraccionByCve.set(row.cve_producto, row.fraccion)
      }
    }
  }

  // 3. Build the enriched crossing stream (now with fraccion).
  const enriched: Array<{
    cve_producto: string | null
    cve_proveedor: string | null
    fraccion: string | null
    fecha_cruce: string | null
    semaforo: SemaforoValue
  }> = partidas
    .map((p) => {
      const link = p.folio != null ? links.byFolio.get(p.folio) : null
      if (!link || !link.fecha_cruce) return null // only count filed crossings
      return {
        cve_producto: p.cve_producto,
        cve_proveedor: p.cve_proveedor,
        fraccion: p.cve_producto ? fraccionByCve.get(p.cve_producto) ?? null : null,
        fecha_cruce: link.fecha_cruce,
        semaforo:
          link.semaforo === 0 || link.semaforo === 1 || link.semaforo === 2
            ? (link.semaforo as SemaforoValue)
            : null,
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
  const volume = computeVolumeSummary(
    enriched.map((c) => ({ fecha_cruce: c.fecha_cruce, semaforo: c.semaforo })),
    now,
  )

  const fraccionHealthAll = computeFraccionHealth(
    enriched.map((c) => ({
      fraccion: c.fraccion,
      fecha_cruce: c.fecha_cruce,
      semaforo: c.semaforo,
    })),
  )
  const fraccion_health = fraccionHealthAll.slice(0, 10)

  // Baseline verde pct — portal-wide rate across the enriched stream.
  // Used as the predictor starting point. Cap denom to 1 to avoid /0.
  const totalWithSemaforo = enriched.filter(
    (c) => c.semaforo === 0 || c.semaforo === 1 || c.semaforo === 2,
  ).length
  const verdeCount = enriched.filter((c) => c.semaforo === 0).length
  const baseline_verde_pct =
    totalWithSemaforo > 0
      ? Math.round((verdeCount / totalWithSemaforo) * 100)
      : 85 // sane fallback when a fresh tenant has no signal

  // Predictions — one per SKU-with-signal (≥ 2 crossings in window).
  const proveedorByCve = new Map<string, ProveedorHealth>()
  for (const p of proveedores) proveedorByCve.set(p.cve_proveedor, p)
  const fraccionByCveProduct = new Map<string, string | null>(fraccionByCve)
  const fraccionByChapter = new Map<string, FraccionHealth>()
  for (const f of fraccionHealthAll) fraccionByChapter.set(f.chapter, f)
  // Map each cve_producto to its most-frequent proveedor in the stream.
  const topProvByCve = new Map<string, string>()
  const provCountByCve = new Map<string, Map<string, number>>()
  for (const c of enriched) {
    if (!c.cve_producto || !c.cve_proveedor) continue
    const counts = provCountByCve.get(c.cve_producto) ?? new Map<string, number>()
    counts.set(c.cve_proveedor, (counts.get(c.cve_proveedor) ?? 0) + 1)
    provCountByCve.set(c.cve_producto, counts)
  }
  for (const [cve, counts] of provCountByCve) {
    let best: string | null = null
    let bestN = 0
    for (const [prov, n] of counts) {
      if (n > bestN) {
        bestN = n
        best = prov
      }
    }
    if (best) topProvByCve.set(cve, best)
  }

  const predictions: VerdePrediction[] = streaks
    .filter((s) => s.total_crossings >= 2)
    .map((s) => {
      const topProv = topProvByCve.get(s.cve_producto) ?? null
      const proveedor = topProv ? proveedorByCve.get(topProv) ?? null : null
      const fraccion = fraccionByCveProduct.get(s.cve_producto) ?? null
      const digits = fraccion?.replace(/\D/g, '') ?? ''
      const chapter = digits.length >= 2 ? digits.slice(0, 2) : null
      const fraccionHealth = chapter ? fraccionByChapter.get(chapter) ?? null : null
      return predictVerdeProbability({
        streak: s,
        proveedor,
        fraccionHealth,
        baselinePct: baseline_verde_pct,
      })
    })

  const top_predictions = predictions
    .filter((p) => p.band === 'high')
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5)

  const watch_predictions = predictions
    .filter((p) => p.band === 'low')
    .sort((a, b) => a.probability - b.probability)
    .slice(0, 5)

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
    volume,
    fraccion_health,
    top_predictions,
    watch_predictions,
    baseline_verde_pct,
  }
}
