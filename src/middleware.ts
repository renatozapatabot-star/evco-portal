import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_ONLY_ROUTES } from '@/components/nav/nav-config'
import { verifySession } from '@/lib/session'

/** Public paths that bypass auth */
const PUBLIC_PATHS = ['/login']

/** Token-gated paths — accessible without login via URL token */
const TOKEN_PATHS = ['/track/', '/upload/', '/share/']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isApiRoute = pathname.startsWith('/api')

  // Always allow API routes (they have their own auth)
  if (isApiRoute) return NextResponse.next()

  // Allow token-gated paths (track/upload) without auth
  if (TOKEN_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()

  // Allow login page
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next()

  // Validate signed session token (HMAC — cannot be forged without server secret)
  const sessionToken = request.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)

  if (!session) {
    // Fallback: check legacy portal_auth cookie for backward compatibility
    // (existing sessions before this deploy — will expire within 8h)
    const legacyAuth = request.cookies.get('portal_auth')?.value === 'authenticated'
    if (!legacyAuth) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Determine role: prefer signed session, fall back to cookie
  const role = session?.role || request.cookies.get('user_role')?.value

  // Broker command center — only broker or admin
  if (pathname.startsWith('/broker')) {
    if (role !== 'broker' && role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // Client users cannot access admin-only routes
  if (role === 'client') {
    const isAdminRoute = ADMIN_ONLY_ROUTES.some(route =>
      pathname === route || pathname.startsWith(route + '/')
    )
    if (isAdminRoute) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-|.*\\.svg$).*)'],
}
