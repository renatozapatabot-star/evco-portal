/**
 * PORTAL · /api/admin/feature-flags
 *
 * POST  { flagKey: string, enabled: boolean }
 *   → admin/broker only
 *   → updates the `portal_ff_overrides` cookie on the caller's browser
 *   → internal-session scoped preview: client sessions never read this
 *   → returns the merged override map so the UI can re-render instantly
 *
 * DELETE { flagKey?: string }
 *   → admin/broker only
 *   → clears a single flag's override, or all if no key given
 *   → returns the merged override map
 *
 * The env var (production truth) is untouched. See
 * `src/lib/admin/feature-flags.ts` for the resolution rules.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifySession } from '@/lib/session'
import {
  FEATURE_FLAG_OVERRIDE_COOKIE,
  FEATURE_FLAG_OVERRIDE_TTL_SECONDS,
  isInternalRole,
  isKnownFlagKey,
  parseOverrideCookie,
  serializeOverrideCookie,
} from '@/lib/admin/feature-flags'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const postSchema = z.object({
  flagKey: z.string().min(1).max(64),
  enabled: z.boolean(),
})

const deleteSchema = z.object({
  flagKey: z.string().min(1).max(64).optional(),
})

async function authorize(req: NextRequest) {
  const token = req.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
        { status: 401 },
      ),
    }
  }
  if (!isInternalRole(session.role)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { data: null, error: { code: 'FORBIDDEN', message: 'Solo roles internos' } },
        { status: 403 },
      ),
    }
  }
  return { ok: true as const, session }
}

function cookieHeaderValue(value: string): string {
  const parts = [
    `${FEATURE_FLAG_OVERRIDE_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${FEATURE_FLAG_OVERRIDE_TTL_SECONDS}`,
    'SameSite=Lax',
    'HttpOnly',
  ]
  if (process.env.NODE_ENV === 'production') parts.push('Secure')
  return parts.join('; ')
}

function clearCookieHeaderValue(): string {
  const parts = [
    `${FEATURE_FLAG_OVERRIDE_COOKIE}=`,
    'Path=/',
    'Max-Age=0',
    'SameSite=Lax',
    'HttpOnly',
  ]
  if (process.env.NODE_ENV === 'production') parts.push('Secure')
  return parts.join('; ')
}

export async function POST(req: NextRequest) {
  const auth = await authorize(req)
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'flagKey + enabled requeridos' } },
      { status: 400 },
    )
  }
  if (!isKnownFlagKey(parsed.data.flagKey)) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'flag desconocida' } },
      { status: 404 },
    )
  }

  const existing = parseOverrideCookie(req.cookies.get(FEATURE_FLAG_OVERRIDE_COOKIE)?.value)
  const merged = { ...existing, [parsed.data.flagKey]: parsed.data.enabled }
  const serialized = serializeOverrideCookie(merged)

  const res = NextResponse.json({ data: { overrides: merged }, error: null })
  res.headers.set('Set-Cookie', cookieHeaderValue(serialized))
  return res
}

export async function DELETE(req: NextRequest) {
  const auth = await authorize(req)
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  const parsed = deleteSchema.safeParse(body ?? {})
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'flagKey opcional' } },
      { status: 400 },
    )
  }

  const { flagKey } = parsed.data

  // No key → clear all overrides by expiring the cookie outright.
  if (!flagKey) {
    const res = NextResponse.json({ data: { overrides: {} }, error: null })
    res.headers.set('Set-Cookie', clearCookieHeaderValue())
    return res
  }

  if (!isKnownFlagKey(flagKey)) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'flag desconocida' } },
      { status: 404 },
    )
  }

  const existing = parseOverrideCookie(req.cookies.get(FEATURE_FLAG_OVERRIDE_COOKIE)?.value)
  const next: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(existing)) {
    if (k !== flagKey) next[k] = v
  }
  const res = NextResponse.json({ data: { overrides: next }, error: null })
  // If there are zero keys left, fully clear the cookie — a stale
  // empty-JSON cookie isn't worth keeping around.
  res.headers.set(
    'Set-Cookie',
    Object.keys(next).length === 0 ? clearCookieHeaderValue() : cookieHeaderValue(serializeOverrideCookie(next)),
  )
  return res
}
