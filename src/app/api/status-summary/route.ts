import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import { resolveTenantScope } from '@/lib/api/tenant-scope'
import { createClient } from '@supabase/supabase-js'
import { PORTAL_DATE_FROM } from '@/lib/data'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = resolveTenantScope(session, request)
  if (!companyId) return NextResponse.json({ error: 'Tenant scope required' }, { status: 400 })
  // traficos.cruz_score is a phantom — use prediction_confidence (0..1,
  // higher = less risk) as the urgency signal. M15 sweep.
  const { data } = await supabase
    .from('traficos')
    .select('estatus, prediction_confidence, fecha_cruce, fecha_pago, updated_at')
    .eq('company_id', companyId)
    .gte('fecha_llegada', PORTAL_DATE_FROM)

  const rows = data || []
  const today = new Date().toISOString().split('T')[0]

  const enProceso = rows.filter(r => r.estatus === 'En Proceso').length
  // Urgent = prediction_confidence < 0.5 (models with low confidence need
  // operator attention). Preserves the prior <50/100 threshold.
  const urgentes = rows.filter(r => r.estatus === 'En Proceso' && (r.prediction_confidence ?? 1) < 0.5).length
  const cruzadosHoy = rows.filter(r => {
    if (r.estatus !== 'Cruzado') return false
    const d = r.fecha_cruce || r.fecha_pago || r.updated_at
    return d?.startsWith(today)
  }).length

  return NextResponse.json(
    { enProceso, urgentes, cruzadosHoy, total: rows.length },
    { headers: { 'Cache-Control': 's-maxage=7200, stale-while-revalidate=14400' } }
  )
}
