/**
 * CRUZ v9 — cockpit SSR queries are resilient by construction.
 *
 * Two failure modes handled:
 * 1. PostgREST error (bad column, missing table, RLS denial) → `{ data: null, error }`
 *    returned by Supabase. We check error and return safe default.
 * 2. Query hangs (cold DB, network stall, Realtime flake) → we race against a
 *    timeout so the page still renders within SSR budget.
 *
 * v9.4 (2026-04-17): suppressions are now VISIBLE. Two surfaces:
 *   a. `console.warn('[softQuery] suppressed', …)` fires on every suppressed
 *      error so Vercel logs capture the table name + error detail. Silent
 *      failure had us shipping zero-count cockpits without knowing why.
 *   b. An optional `signals` collector (created per-render with
 *      `createQuerySignals()`) records each failure; the page reads the
 *      collector's state and renders a partial-data banner when ≥ N failed.
 *
 * Consumers: /inicio, /operador/inicio, /admin/eagle. Banned elsewhere —
 * don't hide real errors outside the cockpit layer (core-invariants 34).
 */

type PgResult<T> = { data: T | null; error: unknown; count?: number | null }

const DEFAULT_TIMEOUT_MS = 3000

function withTimeout<T>(p: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

export interface QuerySignals {
  /** Number of soft queries that suppressed an error this render. */
  failureCount: number
  /** Which tables/labels failed (deduped). */
  failedLabels: string[]
  record: (label: string, kind: 'timeout' | 'error', detail?: unknown) => void
}

/** Creates a new per-render signal collector. Pass this into every soft
 *  call's options so the caller can render a "datos parciales" banner when
 *  multiple queries suppress errors in the same SSR. Each render gets its
 *  own collector — never reuse across requests. */
export function createQuerySignals(): QuerySignals {
  const failedSet = new Set<string>()
  const state: QuerySignals = {
    failureCount: 0,
    failedLabels: [],
    record(label, kind, detail) {
      state.failureCount++
      if (!failedSet.has(label)) {
        failedSet.add(label)
        state.failedLabels.push(label)
      }
      const msg = typeof detail === 'object' && detail !== null
        ? (detail as { message?: string }).message ?? JSON.stringify(detail)
        : String(detail ?? '')
      console.warn(`[softQuery] suppressed (${kind})`, { label, detail: msg })
    },
  }
  return state
}

interface SoftOptions {
  timeoutMs?: number
  /** Query label — propagates into the console warning + the banner signal.
   *  Use the table name, or table+purpose ("traficos.active"). When omitted
   *  failures are logged as "unknown" so every supressed error is still
   *  diagnosable by its stack trace. */
  label?: string
  /** Optional signal collector for the current render. */
  signals?: QuerySignals
}

function coerceOptions(opts: number | SoftOptions | undefined): SoftOptions {
  if (opts == null) return {}
  if (typeof opts === 'number') return { timeoutMs: opts }
  return opts
}

export async function softCount(
  q: PromiseLike<PgResult<unknown>>,
  opts?: number | SoftOptions,
): Promise<number> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, label = 'unknown', signals } = coerceOptions(opts)
  try {
    const timeoutSentinel = { data: null, error: 'timeout', count: 0 } as PgResult<unknown>
    const r = await withTimeout(q, timeoutMs, timeoutSentinel)
    if (r === timeoutSentinel) {
      signals?.record(label, 'timeout')
      return 0
    }
    if (r?.error) {
      signals?.record(label, 'error', r.error)
      return 0
    }
    return r?.count ?? 0
  } catch (e) {
    signals?.record(label, 'error', e)
    return 0
  }
}

export async function softData<T>(
  q: PromiseLike<PgResult<T[]>>,
  opts?: number | SoftOptions,
): Promise<T[]> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, label = 'unknown', signals } = coerceOptions(opts)
  try {
    const timeoutSentinel = { data: [], error: 'timeout' } as PgResult<T[]>
    const r = await withTimeout(q, timeoutMs, timeoutSentinel)
    if (r === timeoutSentinel) {
      signals?.record(label, 'timeout')
      return []
    }
    if (r?.error) {
      signals?.record(label, 'error', r.error)
      return []
    }
    return r?.data ?? []
  } catch (e) {
    signals?.record(label, 'error', e)
    return []
  }
}

export async function softFirst<T>(
  q: PromiseLike<PgResult<T[]>>,
  opts?: number | SoftOptions,
): Promise<T | null> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, label = 'unknown', signals } = coerceOptions(opts)
  try {
    const timeoutSentinel = { data: [], error: 'timeout' } as PgResult<T[]>
    const r = await withTimeout(q, timeoutMs, timeoutSentinel)
    if (r === timeoutSentinel) {
      signals?.record(label, 'timeout')
      return null
    }
    if (r?.error) {
      signals?.record(label, 'error', r.error)
      return null
    }
    return r?.data?.[0] ?? null
  } catch (e) {
    signals?.record(label, 'error', e)
    return null
  }
}
