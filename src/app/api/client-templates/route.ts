import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const role = req.cookies.get('user_role')?.value
  const isInternal = role === 'broker' || role === 'admin'
  const cookieCompanyId = req.cookies.get('company_id')?.value
  const queryCompanyId = req.nextUrl.searchParams.get('company_id')

  // Broker/admin can query any company; client sees own only
  const companyId = isInternal ? (queryCompanyId || undefined) : cookieCompanyId

  let q = supabase
    .from('client_document_templates')
    .select('*')
    .order('document_type', { ascending: true })

  if (companyId) q = q.eq('company_id', companyId)

  const { data, error } = await q

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, error: null })
}

export async function POST(req: NextRequest) {
  const role = req.cookies.get('user_role')?.value
  if (role !== 'broker' && role !== 'admin') {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 403 })
  }

  const body = await req.json()
  const { company_id, document_type, document_name, file_url, is_permanent, expiry_date, notes } = body

  if (!company_id || !document_type || !document_name) {
    return NextResponse.json({ data: null, error: 'company_id, document_type, and document_name are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('client_document_templates')
    .upsert(
      {
        company_id,
        document_type,
        document_name,
        file_url: file_url || null,
        is_permanent: is_permanent ?? true,
        expiry_date: expiry_date || null,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,document_type' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, error: null })
}
