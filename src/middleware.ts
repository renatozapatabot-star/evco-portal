import { NextRequest, NextResponse } from 'next/server'

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

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
