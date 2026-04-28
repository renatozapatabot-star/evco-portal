import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { resolveTenantScope } from '@/lib/api/tenant-scope'

// P0-A4: explicit service-role requirement. Tenant scope comes from
// resolveTenantScope (signed session for client role); the underlying
// supabase client is service-role only.
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_ROLE) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY required for /api/supplier-comms')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SERVICE_ROLE
)

// Tenant scope comes from the signed session (client) or from
// param/cookie for internal roles via resolveTenantScope (which
// powers the admin view-as feature). core-invariants rule 15.
// Pre-fix, any authenticated user could set `company_id=<other>`
// in their cookie jar; the helper now fences that at the rule layer.

export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const companyId = resolveTenantScope(session, req)
  if (!companyId) return NextResponse.json({ error: 'Tenant scope required' }, { status: 400 })

  const { data } = await supabase.from('communication_events')
    .select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(50)
  return NextResponse.json({ communications: data || [] })
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const companyId = resolveTenantScope(session, req)
  if (!companyId) return NextResponse.json({ error: 'Tenant scope required' }, { status: 400 })

  const { supplier, trafico, message_type } = await req.json()
  if (!supplier) return NextResponse.json({ error: 'supplier required' }, { status: 400 })

  const { error } = await supabase.from('communication_events').insert({
    company_id: companyId,
    event_type: message_type || 'usmca_request',
    channel: 'email',
    recipient: supplier,
    subject: `Solicitud de certificado USMCA — ${trafico || 'pendiente'}`,
    body: `Estimado proveedor ${supplier}, solicitamos el certificado USMCA/T-MEC para el embarque ${trafico}. Favor de enviarlo dentro de 48 horas.`,
    status: 'pending',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ queued: true, supplier, trafico })
}
