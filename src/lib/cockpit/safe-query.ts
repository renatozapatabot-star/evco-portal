/**
 * AGUILA v9 — cockpit SSR queries are resilient by construction.
 *
 * Supabase JS client returns `{ data, error, count }` by default (no throw
 * on PostgREST errors). But Promise.all still rejects if a network failure
 * or runtime exception bubbles out. These wrappers guarantee a safe default
 * regardless: a bad column, a missing table, a timeout, or a network blip
 * never takes down the whole page.
 *
 * Consumers: /inicio, /operador/inicio, /admin/eagle. Banned elsewhere —
 * don't hide real errors outside the cockpit layer (core-invariants 34).
 */

type PgResult<T> = { data: T | null; error: unknown; count?: number | null }

export async function softCount(
  q: PromiseLike<PgResult<unknown>>,
): Promise<number> {
  try {
    const r = await q
    if (r?.error) return 0
    return r?.count ?? 0
  } catch {
    return 0
  }
}

export async function softData<T>(
  q: PromiseLike<PgResult<T[]>>,
): Promise<T[]> {
  try {
    const r = await q
    if (r?.error) return []
    return r?.data ?? []
  } catch {
    return []
  }
}

export async function softFirst<T>(
  q: PromiseLike<PgResult<T[]>>,
): Promise<T | null> {
  try {
    const r = await q
    if (r?.error) return null
    return r?.data?.[0] ?? null
  } catch {
    return null
  }
}
