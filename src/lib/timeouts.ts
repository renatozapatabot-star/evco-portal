/**
 * Timeout helpers for server-component data fetching.
 *
 * Born from the 2026-04-16 cold-start investigation: companies-query
 * sharing a 3 s softFirst budget with N-other queries in a Promise.all
 * would time out under serverless cold start → redirect('/login?stale=1')
 * → bad first impression. Fix: give the session-validity gate its own
 * 8 s budget, separate from the cockpit aggregate queries (which can
 * degrade gracefully when their 3 s budget exceeds).
 */

/**
 * Races a promise against a hard deadline. On timeout, logs a warning
 * and resolves `null` — caller decides whether null is fatal (redirect
 * to login) or degradation-worthy (render the cockpit without that
 * data slice).
 *
 * Use this for session-validity gates (company row) and other queries
 * where the caller needs to branch on "data | unavailable".
 *
 * Different from the existing `withHardTimeout` in `src/app/inicio/page.tsx`
 * which returns a caller-supplied fallback value. That variant stays
 * for aggregate queries that need typed defaults like `[]`.
 */
export async function withHardTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn(`[timeout] ${label} exceeded ${ms}ms`)
      resolve(null)
    }, ms)
  })
  try {
    const result = await Promise.race([promise, timeout])
    return result
  } finally {
    if (timer) clearTimeout(timer)
  }
}
