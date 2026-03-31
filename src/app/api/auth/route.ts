import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Set auth + company cookies on a successful login response. */
function setAuthCookies(
  response: NextResponse,
  opts: { companyId: string; companyName: string; companyClave: string; role: string }
) {
  const maxAge = 28800 // 8 hours — forces daily re-login
  response.cookies.set('portal_auth', 'authenticated', {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', maxAge, path: '/',
  })
  response.cookies.set('company_id', opts.companyId, { path: '/', maxAge })
  response.cookies.set('company_name', encodeURIComponent(opts.companyName), { path: '/', maxAge })
  response.cookies.set('company_clave', opts.companyClave, { path: '/', maxAge })
  response.cookies.set('user_role', opts.role, { path: '/', maxAge })
}

export async function POST(request: NextRequest) {
  const { password } = await request.json()

  // Check admin password first
  if (password === process.env.ADMIN_PASSWORD) {
    const response = NextResponse.json({
      success: true,
      role: 'admin',
      company: { company_id: 'admin', name: 'CRUZ Admin' }
    })
    setAuthCookies(response, {
      companyId: 'admin',
      companyName: 'CRUZ Admin',
      companyClave: '',
      role: 'admin',
    })
    return response
  }

  // Check broker password — internal operator access to command center
  if (password === process.env.BROKER_PASSWORD) {
    const response = NextResponse.json({
      success: true,
      role: 'broker',
      company: { company_id: 'internal', name: 'Renato Zapata & Company' }
    })
    setAuthCookies(response, {
      companyId: 'internal',
      companyName: 'Renato Zapata & Company',
      companyClave: 'internal',
      role: 'broker',
    })
    return response
  }

  // Lookup by portal_password in companies table (covers all clients)
  const { data: company } = await supabase
    .from('companies')
    .select('company_id, name, clave_cliente, rfc')
    .eq('portal_password', password)
    .eq('active', true)
    .single()

  if (company) {
    const response = NextResponse.json({
      success: true,
      role: 'client',
      company: {
        company_id: company.company_id,
        name: company.name,
        clave: company.clave_cliente,
        rfc: company.rfc,
      }
    })
    setAuthCookies(response, {
      companyId: company.company_id,
      companyName: company.name,
      companyClave: company.clave_cliente || '',
      role: 'client',
    })
    return response
  }

  return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete('portal_auth')
  response.cookies.delete('company_id')
  response.cookies.delete('company_name')
  response.cookies.delete('company_clave')
  response.cookies.delete('user_role')
  response.cookies.delete('viewing_as')
  return response
}
