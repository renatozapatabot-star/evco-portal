import { NextRequest, NextResponse } from 'next/server'

const COOKIES_TO_CLEAR = [
  'portal_auth', 'portal_session', 'user_role', 'company_id',
  'company_clave', 'company_name', 'company_rfc', 'viewing_as',
  'broker_id', 'csrf_token', 'portal_role',
]

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url))

  for (const name of COOKIES_TO_CLEAR) {
    response.cookies.set(name, '', { path: '/', maxAge: 0 })
  }

  return response
}
