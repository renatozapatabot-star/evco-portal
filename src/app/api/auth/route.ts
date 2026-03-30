import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { CLIENT_CLAVE, COMPANY_ID as EVCO_ID, CLIENT_NAME } from '@/lib/client-config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const { password } = await request.json()

  // Check admin password first
  if (password === process.env.ADMIN_PASSWORD) {
    const response = NextResponse.json({
      success: true,
      role: 'admin',
      company: { company_id: 'admin', name: 'CRUZ Admin' }
    })
    response.cookies.set('portal_auth', 'authenticated', {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/',
    })
    response.cookies.set('company_id', 'admin', { path: '/', maxAge: 86400 })
    response.cookies.set('company_name', 'CRUZ Admin', { path: '/', maxAge: 86400 })
    response.cookies.set('user_role', 'admin', { path: '/', maxAge: 86400 })
    return response
  }

  // Check legacy single password
  if (password === process.env.PORTAL_PASSWORD) {
    const response = NextResponse.json({
      success: true,
      role: 'client',
      company: { company_id: EVCO_ID, name: CLIENT_NAME, clave: CLIENT_CLAVE }
    })
    response.cookies.set('portal_auth', 'authenticated', {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/',
    })
    response.cookies.set('company_id', 'evco', { path: '/', maxAge: 86400 })
    response.cookies.set('company_name', encodeURIComponent('EVCO Plastics de México'), { path: '/', maxAge: 86400 })
    response.cookies.set('company_clave', CLIENT_CLAVE, { path: '/', maxAge: 86400 })
    response.cookies.set('user_role', 'client', { path: '/', maxAge: 86400 })
    return response
  }

  // Check client portal password from companies table
  const { data: company } = await supabase
    .from('companies')
    .select('*')
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
        rfc: company.rfc
      }
    })
    response.cookies.set('portal_auth', 'authenticated', {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/',
    })
    response.cookies.set('company_id', company.company_id, { path: '/', maxAge: 86400 })
    response.cookies.set('company_name', encodeURIComponent(company.name), { path: '/', maxAge: 86400 })
    response.cookies.set('company_clave', company.clave_cliente || '', { path: '/', maxAge: 86400 })
    response.cookies.set('user_role', 'client', { path: '/', maxAge: 86400 })
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
  return response
}
