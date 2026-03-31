import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** POST: Broker "view as client" — swaps cookies to impersonate a client. */
export async function POST(request: NextRequest) {
  const role = request.cookies.get('user_role')?.value
  if (role !== 'broker' && role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { company_id } = await request.json()
  if (!company_id || typeof company_id !== 'string') {
    return NextResponse.json({ error: 'company_id required' }, { status: 400 })
  }

  const { data: company } = await supabase
    .from('companies')
    .select('company_id, name, clave_cliente')
    .eq('company_id', company_id)
    .eq('active', true)
    .single()

  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const response = NextResponse.json({ success: true, company })

  // Set viewing_as flag so nav knows to show the banner
  response.cookies.set('viewing_as', company.company_id, { path: '/', maxAge: 86400 })

  // Swap identity cookies so all data queries resolve to this client
  response.cookies.set('company_id', company.company_id, { path: '/', maxAge: 86400 })
  response.cookies.set('company_name', encodeURIComponent(company.name), { path: '/', maxAge: 86400 })
  response.cookies.set('company_clave', company.clave_cliente || '', { path: '/', maxAge: 86400 })

  return response
}

/** DELETE: Exit "view as" — restore broker identity cookies. */
export async function DELETE(request: NextRequest) {
  const viewingAs = request.cookies.get('viewing_as')?.value
  if (!viewingAs) {
    return NextResponse.json({ error: 'Not viewing as client' }, { status: 400 })
  }

  const response = NextResponse.json({ success: true })

  // Clear viewing_as flag
  response.cookies.delete('viewing_as')

  // Restore broker identity
  response.cookies.set('company_id', 'internal', { path: '/', maxAge: 86400 })
  response.cookies.set('company_name', encodeURIComponent('Renato Zapata & Company'), { path: '/', maxAge: 86400 })
  response.cookies.set('company_clave', 'internal', { path: '/', maxAge: 86400 })

  return response
}
