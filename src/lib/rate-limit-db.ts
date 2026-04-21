import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Supabase-backed rate limiter. Persists across serverless cold starts.
 * Uses upsert on rate_limits table with (key, window_start) composite.
 *
 * Falls back to allow if Supabase is unreachable (fail-open for availability).
 */
export async function rateLimitDB(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ success: boolean; remaining: number; resetIn: number }> {
  const now = Date.now()
  const windowStart = new Date(now - windowMs).toISOString()

  try {
    // Count requests in current window
    const { count } = await supabase
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('key', key)
      .gte('created_at', windowStart)

    const currentCount = count || 0

    if (currentCount >= limit) {
      return { success: false, remaining: 0, resetIn: windowMs }
    }

    // Record this request
    await supabase.from('rate_limits').insert({ key, created_at: new Date().toISOString() })

    return { success: true, remaining: limit - currentCount - 1, resetIn: windowMs }
  } catch {
    // Fail-open: allow request if rate-limit check fails
    return { success: true, remaining: limit, resetIn: windowMs }
  }
}
