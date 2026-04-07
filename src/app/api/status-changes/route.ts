import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PORTAL_DATE_FROM } from '@/lib/data'
import { verifySession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } }, { status: 401 })
  }
  const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString()

  const { data } = await supabase
    .from('traficos')
    .select('trafico, estatus, updated_at, company_id, pedimento')
    .eq('company_id', session.companyId)
    .gte('updated_at', twoHoursAgo)
    .gte('fecha_llegada', PORTAL_DATE_FROM)
    .order('updated_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ changes: data || [] })
}
