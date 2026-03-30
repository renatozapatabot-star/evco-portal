import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const role = request.cookies.get('user_role')?.value
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await request.json()
  const { name, rfc, clave_cliente, contact_name, contact_email, contact_phone, immex, language, portal_password } = body

  // Validate required fields
  if (!name || !rfc || !clave_cliente) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Validate RFC format
  if (!/^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) {
    return NextResponse.json({ error: 'Invalid RFC format' }, { status: 400 })
  }

  // Check duplicate clave
  const { data: existing } = await supabase
    .from('companies')
    .select('company_id')
    .eq('clave_cliente', clave_cliente)
    .single()

  if (existing) {
    return NextResponse.json({ error: `Clave ${clave_cliente} already exists` }, { status: 409 })
  }

  // Generate company_id from name
  const company_id = name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30)

  // Insert company
  const { error: insertError } = await supabase
    .from('companies')
    .insert({
      company_id,
      name,
      rfc,
      clave_cliente,
      globalpc_clave: clave_cliente,
      contact_name,
      contact_email,
      contact_phone,
      immex: !!immex,
      language: language || 'bilingual',
      portal_password,
      active: true,
      health_score: 0,
      traficos_count: 0,
      created_at: new Date().toISOString(),
    })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Log the event
  await supabase.from('communication_events').insert({
    company_id,
    event_type: 'client_onboarded',
    recipient: contact_email,
    subject: `New client onboarded: ${name}`,
    status: 'completed',
    created_at: new Date().toISOString()
  })

  return NextResponse.json({
    success: true,
    company_id,
    name,
    portal_password
  })
}
