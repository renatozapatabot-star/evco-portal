/**
 * Shared cockpit data-fetch helpers (CRUZ v7).
 * Used by /inicio, /operador/inicio, /admin/eagle to ensure the same
 * series-bucketing logic produces the same trend shape across surfaces.
 */

/** Bucket timestamp rows into `days` daily counts, oldest → newest. */
export function bucketDailySeries(
  rows: Array<Record<string, unknown>> | null | undefined,
  key: string,
  days = 14,
  now: Date = new Date(),
): number[] {
  const buckets = new Array(days).fill(0)
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  for (const row of rows ?? []) {
    const v = row?.[key]
    if (typeof v !== 'string') continue
    const t = new Date(v).getTime()
    if (!Number.isFinite(t)) continue
    const daysAgo = Math.floor((dayStart - t) / 86400000)
    if (daysAgo < 0 || daysAgo > days - 1) continue
    buckets[days - 1 - daysAgo] += 1
  }
  return buckets
}

/** Sum a slice of a series, half-open [from, to). */
export function sumRange(series: number[], from: number, to: number): number {
  let s = 0
  for (let i = from; i < to && i < series.length; i++) s += series[i]
  return s
}

/** "today at 00:00:00 in UTC-agnostic local terms" — pairs with gte filters. */
export function startOfToday(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function daysAgo(n: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - n * 86400000)
}
