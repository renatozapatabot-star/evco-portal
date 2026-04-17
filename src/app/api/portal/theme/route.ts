import { NextResponse } from 'next/server'
import {
  PORTAL_THEME_COOKIE,
  PORTAL_THEME_DEFAULTS,
  parsePortalTheme,
  serializePortalTheme,
  type PortalTheme,
} from '@/lib/portal/theme'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let patch: Partial<PortalTheme> = {}
  try {
    patch = (await request.json()) as Partial<PortalTheme>
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const merged = parsePortalTheme(
    serializePortalTheme({ ...PORTAL_THEME_DEFAULTS, ...patch }),
  )

  const response = NextResponse.json({ ok: true, theme: merged })
  response.cookies.set({
    name: PORTAL_THEME_COOKIE,
    value: serializePortalTheme(merged),
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  })
  return response
}
