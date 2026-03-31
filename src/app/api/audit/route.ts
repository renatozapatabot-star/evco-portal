import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  try {
    const companyId = request.cookies.get('company_id')?.value ?? 'evco'
    const body = await request.json()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const ua = request.headers.get('user-agent') || ''
    await supabase.from('portal_audit_log').insert({ event_type: body.event_type, tenant_slug: body.tenant_slug || companyId, path: body.path, query: body.query, ip_address: ip, user_agent: ua.substring(0, 200), metadata: body.metadata || {} })
    return NextResponse.json({ logged: true })
  } catch { return NextResponse.json({ logged: false }) }
}
