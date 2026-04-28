import { NextResponse } from 'next/server'
import { signSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'

/**
 * GET /demo/live — Sets a demo session cookie and redirects to the cockpit.
 * The demo session authenticates as DEMO PLASTICS (company_id='demo-plastics')
 * with role='client'. No password needed. Read-only.
 *
 * Also logs a row to the `leads` table with source='demo' so the admin
 * pipeline shows funnel-top attribution. The insert is fire-and-forget
 * (awaited but not blocking the redirect on failure) so a DB blip
 * never breaks the demo flow for a prospect.
 */

function captureReferrer(req: Request): string | null {
  const ref = req.headers.get('referer') || req.headers.get('referrer')
  if (!ref) return null
  try {
    const url = new URL(ref)
    // Strip query strings but keep path — enough for attribution,
    // won't leak search terms.
    return `${url.origin}${url.pathname}`.slice(0, 500)
  } catch {
    return null
  }
}

async function logDemoHit(req: Request): Promise<void> {
  try {
    const supabase = createServerClient()
    const referrer = captureReferrer(req)
    // Guard: we don't want duplicate demo-anon rows per visit.
    // Simple heuristic — a single row per demo session cookie cycle
    // (24h) is fine. Short-circuit if source_url already inserted
    // within the last hour from the same referrer.
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: existing } = await supabase
      .from('leads')
      .select('id')
      .eq('firm_name', 'Demo visitor (anónimo)')
      .eq('source', 'demo')
      .eq('source_url', referrer ?? '')
      .gte('created_at', hourAgo)
      .limit(1)
    if (existing && existing.length > 0) return

    await supabase.from('leads').insert({
      firm_name: 'Demo visitor (anónimo)',
      source: 'demo',
      source_url: referrer,
      source_campaign: 'demo-live-hit',
      stage: 'demo-viewed',
      notes: 'Auto-logged from /demo/live. Upgrade to real lead if they follow up.',
    })
  } catch {
    // Swallow — analytics must never block the prospect's demo.
  }
}

export async function GET(req: Request) {
  // Fire-and-forget analytics write
  void logDemoHit(req)

  const sessionToken = await signSession('demo-plastics', 'client', 86400) // 24h

  const response = NextResponse.redirect(new URL('/', req.url))

  // Set the signed session (same format as real logins)
  response.cookies.set('portal_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 86400,
    path: '/',
  })
  response.cookies.set('portal_auth', 'authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 86400,
    path: '/',
  })
  response.cookies.set('company_id', 'demo-plastics', { path: '/', maxAge: 86400 })
  response.cookies.set('company_name', 'DEMO PLASTICS S.A. DE C.V.', { path: '/', maxAge: 86400 })
  response.cookies.set('company_clave', 'DEMO', { path: '/', maxAge: 86400 })
  response.cookies.set('user_role', 'client', { path: '/', maxAge: 86400 })
  response.cookies.set('cruz_demo', '1', { path: '/', maxAge: 86400 })

  return response
}
