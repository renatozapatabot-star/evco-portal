import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_ONLY_ROUTES } from '@/components/nav/nav-config'

/** Public paths that bypass auth and don't need the track/upload token check */
const PUBLIC_PATHS = ['/login']

/** Token-gated paths — accessible without login via URL token */
const TOKEN_PATHS = ['/track/', '/upload/']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isAuthenticated = request.cookies.get('portal_auth')?.value === 'authenticated'
  const isApiRoute = pathname.startsWith('/api')

  // Always allow API routes
  if (isApiRoute) return NextResponse.next()

  // Allow token-gated paths (track/upload) without auth
  if (TOKEN_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()

  // Redirect to login if not authenticated
  if (!isAuthenticated && !PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Login page: allow access always (login page handles session display itself)
  // No auto-redirect — user may want to switch accounts or log out

  // Role-based route protection
  if (isAuthenticated) {
    const role = request.cookies.get('user_role')?.value

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
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-|.*\\.svg$).*)'],
}
