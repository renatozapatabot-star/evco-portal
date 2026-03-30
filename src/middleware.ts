import { NextRequest, NextResponse } from 'next/server'

/* Soft redirects: removed nav items redirect to their new home.
   Routes still work by URL — this just guides stale bookmarks. */
const CLIENT_REDIRECTS: Record<string, string> = {
  '/immex': '/',
  '/anexo24': '/reportes',
  '/soia': '/',
  '/alertas': '/',
  '/cuentas': '/reportes',
  '/entradas': '/traficos',
  '/status': '/',
}

export function middleware(request: NextRequest) {
  const isAuthenticated = request.cookies.get('portal_auth')?.value === 'authenticated'
  const isLoginPage = request.nextUrl.pathname === '/login'
  const isApiRoute = request.nextUrl.pathname.startsWith('/api')

  // Allow API routes always
  if (isApiRoute) return NextResponse.next()

  // Redirect to login if not authenticated
  if (!isAuthenticated && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect to home if already authenticated and hitting login
  if (isAuthenticated && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Soft redirects for removed nav items (non-admin clients)
  const redirectTo = CLIENT_REDIRECTS[request.nextUrl.pathname]
  if (redirectTo && isAuthenticated) {
    const role = request.cookies.get('user_role')?.value
    if (role !== 'admin') {
      return NextResponse.redirect(new URL(redirectTo, request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
