const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, limit = 100, windowMs = 60000) {
  const now = Date.now(); const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) { rateLimitMap.set(key, { count: 1, resetAt: now + windowMs }); return { success: true, remaining: limit - 1, resetIn: windowMs } }
  if (entry.count >= limit) return { success: false, remaining: 0, resetIn: entry.resetAt - now }
  entry.count++; return { success: true, remaining: limit - entry.count, resetIn: entry.resetAt - now }
}
