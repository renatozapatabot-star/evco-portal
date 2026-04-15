/**
 * ZAPATA AI v9 — cockpit SSR queries are resilient by construction.
 *
 * Two failure modes handled:
 * 1. PostgREST error (bad column, missing table) → `{ data: null, error }` returned
 *    by Supabase. We check error and return safe default.
 * 2. Query hangs (cold DB, network stall, Realtime flake) → we race against a
 *    timeout so the page still renders within SSR budget.
 *
 * Consumers: /inicio, /operador/inicio, /admin/eagle. Banned elsewhere —
 * don't hide real errors outside the cockpit layer (core-invariants 34).
 */

type PgResult<T> = { data: T | null; error: unknown; count?: number | null }

// Max time any single cockpit query is allowed to block SSR.
const DEFAULT_TIMEOUT_MS = 3000

function withTimeout<T>(p: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

export async function softCount(
  q: PromiseLike<PgResult<unknown>>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<number> {
  try {
    const r = await withTimeout(q, timeoutMs, { data: null, error: 'timeout', count: 0 } as PgResult<unknown>)
    if (r?.error) return 0
    return r?.count ?? 0
  } catch {
    return 0
  }
}

export async function softData<T>(
  q: PromiseLike<PgResult<T[]>>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T[]> {
  try {
    const r = await withTimeout(q, timeoutMs, { data: [], error: 'timeout' } as PgResult<T[]>)
    if (r?.error) return []
    return r?.data ?? []
  } catch {
    return []
  }
}

export async function softFirst<T>(
  q: PromiseLike<PgResult<T[]>>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T | null> {
  try {
    const r = await withTimeout(q, timeoutMs, { data: [], error: 'timeout' } as PgResult<T[]>)
    if (r?.error) return null
    return r?.data?.[0] ?? null
  } catch {
    return null
  }
}
