import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_ONLY_ROUTES } from '@/components/nav/nav-config'
import { verifySession } from '@/lib/session'
import { validateCsrf } from '@/lib/csrf'

/** Public paths that bypass auth */
const PUBLIC_PATHS = ['/login', '/signup', '/onboarding', '/demo']

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

  // Demo routes are always public (no redirect if authenticated)
  if (pathname.startsWith('/demo')) return NextResponse.next()

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

  // Warehouse + contabilidad: internal-team roles with dedicated cockpit landing pages.
  // They pass through the same auth/session guards as operators; only the root redirect differs.
  if (pathname === '/') {
    if (role === 'warehouse') {
      return NextResponse.redirect(new URL('/bodega/inicio', request.url))
    }
    if (role === 'contabilidad') {
      return NextResponse.redirect(new URL('/contabilidad/inicio', request.url))
    }
  }

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
      return NextResponse.redirect(new URL('/?unavailable=1', request.url))
    }
  }

  // Operators: block financial routes (no brokerage data exposure)
  if (role === 'operator') {
    const FINANCIAL_ROUTES = ['/financiero', '/cuentas', '/rentabilidad', '/facturacion', '/resultados', '/cotizacion']
    const isFinancialRoute = FINANCIAL_ROUTES.some(route =>
      pathname === route || pathname.startsWith(route + '/')
    )
    if (isFinancialRoute) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    // Operators also cannot access admin-only routes (except those in OPERATOR_ROUTES)
    const isAdminRoute = ADMIN_ONLY_ROUTES.some(route =>
      pathname === route || pathname.startsWith(route + '/')
    )
    // Allow specific operator routes through
    const OPERATOR_ALLOWED = ['/', '/traficos', '/entradas', '/pedimentos', '/expedientes', '/clasificar', '/fracciones', '/cumplimiento', '/bodega', '/aduana', '/cambiar-contrasena', '/inteligencia', '/health', '/catalogo', '/anexo24', '/reportes', '/financiero', '/facturacion', '/documentos']
    const isOperatorAllowed = OPERATOR_ALLOWED.some(route =>
      pathname === route || pathname.startsWith(route + '/')
    )
    if (isAdminRoute && !isOperatorAllowed) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-|.*\\.svg$).*)'],
}
