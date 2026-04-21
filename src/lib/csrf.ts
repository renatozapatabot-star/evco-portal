import { NextRequest, NextResponse } from 'next/server'

/**
 * CSRF Protection — Double Submit Cookie Pattern
 *
 * Flow:
 * 1. On login, server sets `csrf_token` cookie (httpOnly: false so JS can read it)
 * 2. Client sends the token in X-CSRF-Token header on every POST/PUT/DELETE
 * 3. Server compares header token to cookie token — must match
 *
 * This works because:
 * - SameSite=Lax cookies prevent cross-origin POSTs from sending the cookie
 * - Even if an attacker can trigger a POST, they can't read the csrf_token cookie
 *   from another origin to set the header
 */

export function generateCsrfToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Validate CSRF token on mutating requests.
 * Returns null if valid, or a NextResponse error if invalid.
 * Skips validation for:
 * - API key authenticated routes (v1/*)
 * - Telegram webhook (external callback)
 * - Vapi webhook (external callback)
 */
export function validateCsrf(req: NextRequest): NextResponse | null {
  const method = req.method
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null

  const path = req.nextUrl.pathname

  // Skip CSRF for external webhooks and API-key-authenticated routes
  if (path.startsWith('/api/v1/')) return null
  if (path.startsWith('/api/telegram-webhook')) return null
  if (path.startsWith('/api/vapi')) return null
  if (path.startsWith('/api/webhook')) return null
  if (path.startsWith('/api/whatsapp/webhook')) return null
  // Claude Routines call from Anthropic cloud — they auth via x-routine-secret
  // (src/lib/routines/auth.ts), not via session cookie. CSRF doesn't apply.
  if (path.startsWith('/api/routines/')) return null
  // Telemetry uses sendBeacon which cannot set custom headers
  if (path.startsWith('/api/telemetry')) return null
  // Login sets the token — can't require it before it exists
  if (path === '/api/auth' && method === 'POST') return null
  // Public lead capture (from /pitch, /demo marketing pages) —
  // prospect has no session + no csrf_token cookie. Spam is mitigated
  // app-side: firm_name required, sanitized max-length, single INSERT
  // (no enumeration), and the table is RLS deny-all.
  if (path === '/api/leads' && method === 'POST') return null

  const cookieToken = req.cookies.get('csrf_token')?.value
  const headerToken = req.headers.get('x-csrf-token')

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return NextResponse.json(
      { error: 'Token CSRF inválido. Recarga la página e intenta de nuevo.' },
      { status: 403 }
    )
  }

  return null
}
