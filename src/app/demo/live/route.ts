import { NextResponse } from 'next/server'
import { signSession } from '@/lib/session'

/**
 * GET /demo/live — Sets a demo session cookie and redirects to the cockpit.
 * The demo session authenticates as DEMO PLASTICS (company_id='demo-plastics')
 * with role='client'. No password needed. Read-only.
 */
export async function GET(req: Request) {
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
