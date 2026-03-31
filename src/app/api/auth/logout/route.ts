import { NextRequest, NextResponse } from 'next/server'

const COOKIES_TO_CLEAR = [
  'portal_auth', 'user_role', 'company_id',
  'company_clave', 'company_name', 'viewing_as',
]

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url))

  for (const name of COOKIES_TO_CLEAR) {
    response.cookies.set(name, '', { path: '/', maxAge: 0 })
  }

  return response
}
