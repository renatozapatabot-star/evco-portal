import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { signSession } from '@/lib/session'
import { generateCsrfToken } from '@/lib/csrf'
import { authSchema } from '@/lib/api-schemas'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Set auth + company cookies on a successful login response. */
async function setAuthCookies(
  response: NextResponse,
  opts: { companyId: string; companyName: string; companyClave: string; companyRfc?: string; role: string; operatorName?: string }
) {
  const maxAge = 28800 // 8 hours — forces daily re-login
  const sessionToken = await signSession(opts.companyId, opts.role, maxAge)
  response.cookies.set('portal_auth', 'authenticated', {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', maxAge, path: '/',
  })
  response.cookies.set('portal_session', sessionToken, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', maxAge, path: '/',
  })
  response.cookies.set('company_id', opts.companyId, { path: '/', maxAge })
  response.cookies.set('company_name', opts.companyName, { path: '/', maxAge })
  response.cookies.set('company_clave', opts.companyClave, { path: '/', maxAge })
  response.cookies.set('company_rfc', opts.companyRfc ?? '', { path: '/', maxAge })
  response.cookies.set('user_role', opts.role, { path: '/', maxAge })
  response.cookies.set('broker_id', 'rzco', { path: '/', maxAge })
  // CSRF token — readable by JS for X-CSRF-Token header
  response.cookies.set('csrf_token', generateCsrfToken(), {
    path: '/', maxAge, sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

  // Operator identity cookie (for action shadowing)
  if (opts.operatorName) {
    response.cookies.set('operator_name', opts.operatorName, { path: '/', maxAge })
  }

  // Audit log — login success
  supabase.from('audit_log').insert({
    action: 'login_success',
    resource: 'auth',
    resource_id: opts.companyId,
    diff: { role: opts.role, company: opts.companyName },
    created_at: new Date().toISOString(),
  }).then(() => {}, (e) => console.error('[audit-log] login success:', e.message))

  // Operator action shadow log
  if (opts.role === 'admin' || opts.role === 'broker') {
    supabase.from('operator_actions').insert({
      operator_name: opts.operatorName || opts.role,
      action_type: 'login',
      resource_type: 'auth',
      company_id: opts.companyId,
      metadata: { role: opts.role },
    }).then(() => {}, () => {})
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = authSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Contraseña requerida' }, { status: 400 })
  }
  const { password } = parsed.data

  // Check admin password first
  if (password === process.env.ADMIN_PASSWORD) {
    const response = NextResponse.json({
      success: true,
      role: 'admin',
      company: { company_id: 'admin', name: 'CRUZ Admin' }
    })
    await setAuthCookies(response, {
      companyId: 'admin',
      companyName: 'CRUZ Admin',
      companyClave: '',
      role: 'admin',
      operatorName: 'tito',
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
    await setAuthCookies(response, {
      companyId: 'internal',
      companyName: 'Renato Zapata & Company',
      companyClave: 'internal',
      role: 'broker',
      operatorName: 'renato',
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
    await setAuthCookies(response, {
      companyId: company.company_id,
      companyName: company.name,
      companyClave: company.clave_cliente || '',
      companyRfc: company.rfc || '',
      role: 'client',
    })
    return response
  }

  // Log failed login attempt
  supabase.from('audit_log').insert({
    action: 'login_failed',
    resource: 'auth',
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    created_at: new Date().toISOString(),
  }).then(() => {}, (e) => console.error('[audit-log] login failed:', e.message))

  return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete('portal_auth')
  response.cookies.delete('portal_session')
  response.cookies.delete('company_id')
  response.cookies.delete('company_name')
  response.cookies.delete('company_clave')
  response.cookies.delete('user_role')
  response.cookies.delete('viewing_as')
  response.cookies.delete('broker_id')
  response.cookies.delete('csrf_token')
  return response
}
