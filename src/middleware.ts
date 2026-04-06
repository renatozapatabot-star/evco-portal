import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_ONLY_ROUTES } from '@/components/nav/nav-config'
import { verifySession } from '@/lib/session'
import { validateCsrf } from '@/lib/csrf'

/** Public paths that bypass auth */
const PUBLIC_PATHS = ['/login']

/** Token-gated paths — accessible without login via URL token */
const TOKEN_PATHS = ['/track/', '/upload/', '/share/', '/proveedor/']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isApiRoute = pathname.startsWith('/api')

  // CSRF validation for mutating API requests (POST/PUT/DELETE)
  if (isApiRoute) {
    const csrfError = validateCsrf(request)
    if (csrfError) return csrfError
    return NextResponse.next()
  }

  // Allow token-gated paths (track/upload) without auth
  if (TOKEN_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()

  // Login page: redirect authenticated users to dashboard
  if (PUBLIC_PATHS.includes(pathname)) {
    const existingSession = request.cookies.get('portal_session')?.value || ''
    const existing = await verifySession(existingSession).catch(() => null)
    if (existing) return NextResponse.redirect(new URL('/', request.url))
    return NextResponse.next()
  }

  // Validate signed session token (HMAC — cannot be forged without server secret)
  const sessionToken = request.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)

  if (!session) {
    // No valid HMAC session — redirect to login.
    // Legacy portal_auth cookie is no longer accepted (security: prevents cookie escalation).
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Role is derived exclusively from the signed session — never from the manipulable user_role cookie
  const role = session.role

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
