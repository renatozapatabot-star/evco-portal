import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const companyId = req.cookies.get('company_id')?.value
  const userRole = req.cookies.get('user_role')?.value
  if (!userRole) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase.from('communication_events')
    .select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(50)
  return NextResponse.json({ communications: data || [] })
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const companyId = req.cookies.get('company_id')?.value
  const userRole = req.cookies.get('user_role')?.value
  if (!userRole) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { supplier, trafico, message_type } = await req.json()
  if (!supplier) return NextResponse.json({ error: 'supplier required' }, { status: 400 })

  const { error } = await supabase.from('communication_events').insert({
    company_id: companyId,
    event_type: message_type || 'usmca_request',
    channel: 'email',
    recipient: supplier,
    subject: `Solicitud de certificado USMCA — ${trafico || 'pendiente'}`,
    body: `Estimado proveedor ${supplier}, solicitamos el certificado USMCA/T-MEC para el tráfico ${trafico}. Favor de enviarlo dentro de 48 horas.`,
    status: 'pending',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ queued: true, supplier, trafico })
}
